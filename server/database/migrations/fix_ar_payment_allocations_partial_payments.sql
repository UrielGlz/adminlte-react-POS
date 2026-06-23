-- ============================================================
-- MIGRATION: fix_ar_payment_allocations_partial_payments.sql
--
-- Problem:
--   The current UNIQUE index on ar_payment_allocations:
--
--     UNIQUE (active_ticket_uid)
--
--   prevents more than one active allocation from existing for
--   the same ticket_uid globally across all AR payments.
--
--   This causes a duplicate-key error when a second AR payment
--   tries to cover the remaining balance of a partially-paid
--   ticket. Example:
--
--     AR Payment #1 applies $60 of a $100 ticket.
--       → INSERT: active_ticket_uid = '07532f59-...'   ← active
--       → payments.amount_applied becomes 60
--       → payments.payment_status_id stays 5 (PENDING)
--
--     AR Payment #2 tries to apply the remaining $40.
--       → getPendingTransactions finds the ticket (amount - applied = 40 > 0)
--       → FIFO tries INSERT: active_ticket_uid = '07532f59-...'
--       → MySQL: Duplicate entry '07532f59-...' for key 'uq_apa_active_ticket_uid'
--
-- Root cause:
--   The original constraint assumed "at most one active allocation
--   per ticket, ever." It was designed for the PREPAID reassignment
--   use-case, not for multi-payment FIFO partial coverage.
--
-- Fix:
--   Change the uniqueness scope from per-ticket-globally to
--   per-(ar_payment + ticket). This allows:
--     - Different AR payments to each have their own active
--       allocation for the same partially-paid ticket.  ✓
--     - The same AR payment still cannot duplicate an allocation
--       for the same ticket (intra-payment duplicate prevention). ✓
--     - Reversed rows (active_ticket_uid = NULL) still never
--       conflict because MySQL treats each NULL as distinct. ✓
--
-- Code impact (verified by full codebase audit):
--   Files that write active_ticket_uid:
--     - ar.service.js           → applyPayment() INSERT
--     - reassignment.service.js → markAllocationsReversed() UPDATE (→ NULL)
--                                → PREPAID/POSTPAID reassignment INSERTs
--
--   All three INSERTs already scope to a single ar_payment_id, so the
--   new composite constraint covers them exactly as before.
--
--   Files that read ar_payment_allocations but do NOT depend on
--   uniqueness: ar.model.js, reweighConversion.service.js,
--   customerStatement.service.js, all report services.
--   None of these query active_ticket_uid directly.
--
--   Reassignment hard block (reassignment.service.js ~line 232):
--   Uses COUNT(*) > 0 — still works correctly regardless of how
--   many active allocations exist for a ticket.
--
--   Idempotency check on reassignment INSERTs (~lines 662, 742):
--   Uses WHERE ar_payment_id = ? AND sale_uid = ? — does not rely
--   on the unique index; still prevents double-allocation.
--
-- Risk:
--   LOW. The constraint change is additive in the direction of
--   allowing more valid states. No application code needs to change.
--   The backfill pre-check below ensures no existing data would
--   violate the new index before it is created.
--
-- Safe to run: idempotent via IF EXISTS / IF NOT EXISTS guards.
-- Tested against: utf8mb4_general_ci (matches legacy AR tables).
-- ============================================================


-- ==============================================================
-- STEP 1 — PRE-MIGRATION VALIDATIONS
-- Run these SELECT statements and verify all counts are 0
-- before proceeding. If any count > 0, investigate before running
-- the ALTER TABLE statements below.
-- ==============================================================

-- 1a. Show the current indexes on ar_payment_allocations.
--     Confirm uq_apa_active_ticket_uid appears and is on a single column.
SHOW INDEX FROM ar_payment_allocations WHERE Key_name IN ('uq_apa_active_ticket_uid', 'uq_apa_active_per_payment');

-- 1b. Detect any rows that would violate the NEW composite index.
--     These would be cases where the same AR payment already has two
--     active allocations for the same ticket — which should be impossible
--     under the current constraint, but we verify before altering.
--     Expected result: 0 rows.
SELECT
  ar_payment_id,
  active_ticket_uid,
  COUNT(*) AS duplicate_count
FROM ar_payment_allocations
WHERE active_ticket_uid IS NOT NULL        -- active rows only
GROUP BY ar_payment_id, active_ticket_uid
HAVING COUNT(*) > 1;

-- 1c. Informational: show all tickets that have MORE THAN ONE
--     active allocation globally (across different AR payments).
--     These are the tickets that were broken by the old constraint
--     and motivate this fix. This should currently be 0 because the
--     old constraint has been preventing them; after the fix these
--     will legitimately be > 0 once partial payments accumulate.
SELECT
  ticket_uid,
  COUNT(*) AS active_allocation_count,
  GROUP_CONCAT(ar_payment_id ORDER BY ar_payment_id) AS ar_payment_ids
FROM ar_payment_allocations
WHERE active_ticket_uid IS NOT NULL
GROUP BY ticket_uid
HAVING COUNT(*) > 1;

-- 1d. Confirm the specific ticket that triggered the bug report
--     exists and show its current allocation state.
SELECT
  allocation_id,
  ar_payment_id,
  ticket_uid,
  ticket_number,
  amount_applied,
  active_ticket_uid,
  reversed_at,
  reversal_note,
  created_at
FROM ar_payment_allocations
WHERE ticket_uid = '07532f59-b96c-4551-89d1-b1abdfb6a747'
ORDER BY created_at;


-- ==============================================================
-- STEP 2 — APPLY THE INDEX CHANGE
-- Only run after STEP 1 confirms 0 blocking duplicates.
-- ==============================================================

-- 2a. Drop the old single-column unique index.
--     "IF EXISTS" prevents error if already removed in a prior run.
ALTER TABLE ar_payment_allocations
  DROP INDEX IF EXISTS `uq_apa_active_ticket_uid`;

-- 2b. Create the new composite unique index.
--     (ar_payment_id, active_ticket_uid):
--       - Same AR payment cannot allocate the same ticket twice. ✓
--       - Different AR payments CAN allocate the same ticket
--         (partial payment coverage across multiple payments). ✓
--       - NULL values in active_ticket_uid (reversed rows) are
--         always treated as distinct by MySQL UNIQUE indexes. ✓
ALTER TABLE ar_payment_allocations
  ADD UNIQUE INDEX IF NOT EXISTS `uq_apa_active_per_payment` (ar_payment_id, active_ticket_uid);


-- ==============================================================
-- STEP 3 — POST-MIGRATION VALIDATIONS
-- Run after the ALTER TABLE statements to confirm the change.
-- ==============================================================

-- 3a. Confirm the new index was created and the old one is gone.
--     Expected: only uq_apa_active_per_payment appears (with 2 columns).
SHOW INDEX FROM ar_payment_allocations WHERE Key_name IN ('uq_apa_active_ticket_uid', 'uq_apa_active_per_payment');

-- 3b. Verify invariant: same AR payment cannot have two active
--     allocations for the same ticket. This should return 0 rows.
SELECT
  ar_payment_id,
  active_ticket_uid,
  COUNT(*) AS cnt
FROM ar_payment_allocations
WHERE active_ticket_uid IS NOT NULL
GROUP BY ar_payment_id, active_ticket_uid
HAVING cnt > 1;

-- 3c. Verify the fix allows the correct scenario:
--     Show tickets that currently have active allocations spanning
--     MULTIPLE different AR payments (partial payment coverage).
--     These are valid after this migration. Pre-migration this should
--     be 0; post first-partial-payment it will be > 0.
SELECT
  apa.ticket_uid,
  apa.ticket_number,
  COUNT(DISTINCT apa.ar_payment_id) AS payments_covering_ticket,
  SUM(apa.amount_applied)           AS total_applied_so_far,
  p.amount                          AS original_amount,
  (p.amount - p.amount_applied)     AS still_pending
FROM ar_payment_allocations apa
INNER JOIN payments p ON apa.payment_uid = p.payment_uid
WHERE apa.active_ticket_uid IS NOT NULL
GROUP BY apa.ticket_uid, apa.ticket_number, p.amount, p.amount_applied
HAVING COUNT(DISTINCT apa.ar_payment_id) > 1;

-- 3d. Smoke-test: confirm the failed ticket from the bug report
--     can now accept a second active allocation without conflicts.
--     (Informational only — do not run the INSERT; let the app handle it.)
--     This shows what would have conflicted before the fix.
SELECT
  'Ticket from bug report — current allocation state after migration:' AS note,
  allocation_id,
  ar_payment_id,
  ticket_uid,
  amount_applied,
  CASE WHEN active_ticket_uid IS NOT NULL THEN 'ACTIVE' ELSE 'REVERSED' END AS status
FROM ar_payment_allocations
WHERE ticket_uid = '07532f59-b96c-4551-89d1-b1abdfb6a747'
ORDER BY created_at;
