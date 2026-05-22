# Customer Reassignment — Business Rules Reference

**Module:** Daily Operations → Change Customer / Reassign Customer
**Last updated:** 2026-05-22

---

## 1. Context

The Change Customer module existed before this work session. It was extended and corrected across two commits:

**commit `cab0869`** — initial extension:
- Walk-in conversion (PREPAID → Walk-in Customer) added.
- `sale_customer_reassignments.to_customer_id` made nullable for Walk-in target.
- `sale_driver_info` address fields set to `'WALK-IN CUSTOMER'` instead of `NULL`.
- Credit block on target customer removed (correction flow, not a new sale).
- Walk-in toggle gated to PREPAID Business Account sources only.
- Operator-facing messages standardized.

**commit `04bee52`** — AR allocation fix + active_ticket_uid uniqueness:
- The original AR check blocked all non-VOIDED allocations, including `CREDIT_BALANCE` entries that represent PREPAID consumption. This blocked PREPAID → Walk-in even though those allocations are reversible.
- New rule: only `APPLIED` and `PARTIAL` allocations (real AR payments) are hard blockers. `CREDIT_BALANCE` allocations on PREPAID tickets are reversed within the same transaction.
- `ar_payment_allocations` gains four columns (reversal tracking + `active_ticket_uid` for uniqueness).
- PREPAID → PREPAID creates a new active allocation for the target customer's CREDIT_BALANCE ar_payment.
- PREPAID → POSTPAID reverts the payment to PENDING so the ticket appears in the AR pending list.
- `active_ticket_uid` replaces the simple `UNIQUE KEY (ticket_uid)` to allow one reversed + one active row per ticket without deleting history.
- `payments` record updated to reflect the true post-reassignment state per scenario.

---

## 2. Modified Files

| File | Purpose |
|------|---------|
| `server/modules/sales/reassignment.service.js` | Core transaction logic: AR check split, allocation reversal, payment updates, PREPAID→PREPAID target allocation |
| `server/modules/ar/ar.service.js` | AR payment application: INSERT now includes `active_ticket_uid` |
| `server/modules/ar/ar.model.js` | `getPaymentDetail`: exposes `reversed_at`, `is_reversed`; response split into `allocations` + `reversed_allocations` |
| `client/src/pages/ar/PaymentDetail.jsx` | Shows active and reversed allocations in separate sections |
| `server/database/ticket_reassignment_tables.sql` | Schema migration: 4 new columns on `ar_payment_allocations`, uniqueness redesign |
| `docs/sales/customer-reassignment-business-rules.md` | This document |

---

## 3. Tables Involved

### `sales`
- `customer_id` — set to `NULL` on Walk-in conversion; updated to target customer on regular reassignment.

### `sale_driver_info`
- `account_number` — set to `NULL` on Walk-in; set to target customer value on regular reassignment.
- `account_name` — set to `'WALK-IN CUSTOMER'` on Walk-in; set to target customer name on regular reassignment.
- `account_address` — set to `'WALK-IN CUSTOMER'` on Walk-in; set to target value on regular reassignment.
- `account_country` — same as `account_address`.
- `account_state` — same as `account_address`.

### `customer_credit`
- `available_credit` — adjusted for PREPAID customers (source: +amount, target: -amount). Can go negative on correction flows.
- `current_balance` — adjusted for POSTPAID customers (target: +amount; source: -amount if source is POSTPAID).

### `customer_credit_movements`
- `movement_type = 'SALE_REASSIGN_REVERSAL'` — credit returned to source customer.
- `movement_type = 'SALE_REASSIGN_CHARGE'` — credit charged to target customer.
- Fields `balance_before/after` and `available_before/after` snapshot the values at time of operation.
- On Walk-in conversion, `balance_before` and `balance_after` are `NULL` (PREPAID has no balance concept).

### `sale_customer_reassignments`
- Full audit trail of every change: from/to account snapshots, moved amount, credit types, reason, user, timestamp.
- `to_customer_id` — nullable; `NULL` when target is Walk-in.
- `to_account_name` — `'WALK-IN CUSTOMER'` when target is Walk-in.
- `from_credit_type` / `to_credit_type` — `NULL` for Walk-in target.

### `payments`
- Modified in some scenarios (see Section 4):
  - `method_id` — changed to Cash on Walk-in conversion.
  - `payment_status_id` — changed to PENDING on PREPAID → POSTPAID so ticket appears in AR pending list.
  - `amount_applied` — set to `amount` on Walk-in; set to 0 on PREPAID → POSTPAID.
  - `received_at` — set to `COALESCE(received_at, NOW())` on Walk-in; set to `NULL` on PREPAID → POSTPAID.

### `ar_payment_allocations`
Four new columns added:

| Column | Type | Description |
|--------|------|-------------|
| `reversed_at` | `TIMESTAMP NULL` | Timestamp of reversal. `NULL` = allocation is active. |
| `reversed_by` | `INT UNSIGNED NULL` | User ID who triggered the reversal. |
| `reversal_note` | `VARCHAR(255) NULL` | Short description for audit trail. |
| `active_ticket_uid` | `CHAR(36) NULL` | Application-managed uniqueness sentinel (see below). |

**Rows are never deleted.** Reversed allocations are identified by `reversed_at IS NOT NULL`.

**`active_ticket_uid` contract (no triggers, no generated columns):**
- On INSERT of an active allocation: set `active_ticket_uid = ticket_uid`
- On UPDATE marking reversed: also set `active_ticket_uid = NULL`
- A `UNIQUE INDEX uq_apa_active_ticket_uid (active_ticket_uid)` enforces that at most one active allocation exists per `ticket_uid`. MariaDB/MySQL treat each `NULL` as distinct, so any number of reversed rows (all `NULL`) coexist freely.

**Why this design for PREPAID → PREPAID:** the source allocation is reversed (`active_ticket_uid = NULL`) and a new active row is inserted for the target (`active_ticket_uid = ticket_uid`). Both rows share the same `ticket_uid` — the unique index only enforces uniqueness on non-NULL values, so source history is preserved.

### `ar_payments`
- `status` is **never modified** by this module.
- `amount_applied` and `amount_unapplied` **are recalculated** whenever allocations change:
  - Full recalc from active allocations: `COALESCE(SUM(amount_applied), 0) WHERE reversed_at IS NULL`
  - Not incremental — corrects drift and handles multiple allocations per payment.
  - `amount_unapplied` may go negative in correction flows (same policy as negative `available_credit`).

### `status_catalogo`
- Joined to `sales` to check ticket status. Blocked statuses: `CANCELLED`, `VOID`, `VOIDED`, `REFUNDED`.
- Used to resolve payment status IDs by `module = 'PAYMENTS'`, `code = 'PENDING'|'RECEIVED'` (never hardcoded).

### `payment_methods`
- Used to resolve Cash `method_id` by `code = 'cash'` (never hardcoded).

### `ticket_reassignment_reasons`
- Dropdown catalog for mandatory reassignment reason.

---

## 4. Business Rules

### A) PREPAID → Walk-in Customer

Applies when: Business Account sale, source `credit_type = 'PREPAID'`, operator selects "Convert to Walk-in".

| Table / Field | Action |
|---|---|
| `sales.customer_id` | Set to `NULL` |
| `sale_driver_info.account_number` | Set to `NULL` |
| `sale_driver_info.account_name` | Set to `'WALK-IN CUSTOMER'` |
| `sale_driver_info.account_address` | Set to `'WALK-IN CUSTOMER'` |
| `sale_driver_info.account_country` | Set to `'WALK-IN CUSTOMER'` |
| `sale_driver_info.account_state` | Set to `'WALK-IN CUSTOMER'` |
| `customer_credit.available_credit` (source) | `+ ticket amount` |
| `sale_customer_reassignments.to_customer_id` | `NULL` |
| `sale_customer_reassignments.to_account_name` | `'WALK-IN CUSTOMER'` |
| `customer_credit_movements` | `SALE_REASSIGN_REVERSAL` for source |
| `ar_payment_allocations` (CREDIT_BALANCE) | `reversed_at = NOW()`, `reversed_by`, `reversal_note`, `active_ticket_uid = NULL` |
| `payments.method_id` | Changed to Cash (lookup by `code = 'cash'`) |
| `payments.payment_status_id` | Stays `RECEIVED` |
| `payments.amount_applied` | Set to `amount` (full ticket total) |
| `payments.received_at` | `COALESCE(received_at, NOW())` |
| `ar_payments.status` | **Not modified** |
| New allocation for target | **Not created** (no target account) |

The "Convert to Walk-in" toggle only appears when `isBusinessPayment AND sourceIsPrepaid`. POSTPAID tickets cannot use this path.

---

### B) PREPAID → PREPAID

Applies when: Business Account sale, source `credit_type = 'PREPAID'`, target `credit_type = 'PREPAID'`.

| Step | Action |
|---|---|
| Source `available_credit` | `+ ticket amount` (returned) |
| Target `available_credit` | `- ticket amount` (charged); negative balance allowed |
| `sale_customer_reassignments` | Audit row: `from_credit_type = 'PREPAID'`, `to_credit_type = 'PREPAID'` |
| `customer_credit_movements` | `SALE_REASSIGN_REVERSAL` (source) + `SALE_REASSIGN_CHARGE` (target) |
| `ar_payment_allocations` (source) | `reversed_at = NOW()`, `active_ticket_uid = NULL` — source allocation reversed |
| `ar_payment_allocations` (target) | New active row on target's oldest CREDIT_BALANCE ar_payment (FIFO: `payment_date ASC, created_at ASC`) |
| `active_ticket_uid` (new row) | `= ticket_uid` — enforces uniqueness of active allocation |
| Target ar_payment header | `amount_applied` / `amount_unapplied` recalculated from active allocations |
| `payments` record | **Not modified** — stays Business Account, RECEIVED |
| Idempotency guard | If an active allocation for this `sale_uid` already exists on the target ar_payment, INSERT is skipped |

---

### C) PREPAID → POSTPAID

Applies when: Business Account sale, source `credit_type = 'PREPAID'`, target `credit_type = 'POSTPAID'`.

| Step | Action |
|---|---|
| Source `available_credit` | `+ ticket amount` (returned) |
| Target `current_balance` | `+ ticket amount` (debt increases); exceeding credit limit allowed |
| Target `available_credit` | `- ticket amount` (decreases) |
| `customer_credit_movements` | `SALE_REASSIGN_REVERSAL` (source) + `SALE_REASSIGN_CHARGE` (target) |
| `ar_payment_allocations` (source) | `reversed_at = NOW()`, `active_ticket_uid = NULL` — source allocation reversed |
| `payments.payment_status_id` | Changed to `PENDING` — ticket now a POSTPAID receivable in AR |
| `payments.amount_applied` | Set to `0.00` |
| `payments.received_at` | Set to `NULL` |
| New allocation for POSTPAID target | **Not created** — POSTPAID balance captured via `customer_credit`; AR collects via FIFO/manual |

**Why payment reverts to PENDING:** The ticket now belongs to a POSTPAID customer who owes the amount. `getPendingTransactions` (source for AR FIFO/manual collection) filters on `payment_status_id = PENDING` and `amount_applied < amount`.

---

### D) Suspended Customers

A suspended customer cannot be the target of any reassignment, including correction flows.

- Backend throws `BadRequestError` before any DB write.
- Frontend disables selection of suspended customers and blocks form submit.

---

### E) Blocked Tickets

| Blocker | Condition | Error |
|---|---|---|
| Real AR payment applied | `ar_payment_allocations` has rows with `ap.status IN ('APPLIED', 'PARTIAL')` and `apa.reversed_at IS NULL` | *This ticket cannot be changed because it already has active AR payment allocations.* |
| Invalid ticket status | `status_catalogo.code` IN (`CANCELLED`, `VOID`, `VOIDED`, `REFUNDED`) | *This ticket cannot be changed because it is cancelled, voided, refunded, or closed for changes.* |

`CREDIT_BALANCE` allocations on PREPAID sources do **not** block. They are reversed within the same transaction.

---

## 5. AR Allocation — Blocking vs. Reversible

| `ar_payments.status` | Source credit type | Effect |
|---|---|---|
| `APPLIED` | Any | Hard block |
| `PARTIAL` | Any | Hard block |
| `CREDIT_BALANCE` | `PREPAID` | Reversible — `reversed_at` set, reassignment proceeds |
| `CREDIT_BALANCE` | `POSTPAID` | Should not occur by design; treated as no-op (not a blocker) |
| `VOIDED` | Any | Not a blocker (already voided) |

`ar_payments` status is **never modified** by this module.

---

## 6. Operator-Facing Messages

| Scenario | Message |
|---|---|
| Non-Business Account | *Non-Business Account correction: only the sale record and audit history will be updated. Credit balances will not change.* |
| Business Account | *Business Account correction: credit balances will be updated for both customers.* |
| Low available credit on target (allowed) | *Low credit notice: this correction will be applied even if the customer's available credit becomes negative.* |
| PREPAID to Walk-in mode active | *PREPAID to Walk-in conversion: the account will be unlinked and the ticket amount will be returned to the original PREPAID balance.* |
| Target customer suspended | *This customer is suspended and cannot receive corrected charges. Please select another customer or contact an administrator.* |
| Source and target are the same customer | *Please select a different customer.* |
| Active APPLIED/PARTIAL AR allocation | *This ticket cannot be changed because it already has active AR payment allocations.* |
| Ticket is cancelled / voided / refunded | *This ticket cannot be changed because it is cancelled, voided, refunded, or closed for changes.* |
| POSTPAID attempting Walk-in | *Walk-in conversion is only allowed for PREPAID Business Account tickets. POSTPAID tickets must be reassigned to another customer.* |

---

## 7. Schema Migration

Applied to `server/database/ticket_reassignment_tables.sql`. Compatible with **MariaDB 10.5+** and MySQL 8.0.29+. Idempotent — safe to run multiple times.

No triggers. No generated columns.

```sql
-- Allow Walk-in target (to_customer_id nullable)
ALTER TABLE sale_customer_reassignments
  MODIFY to_customer_id INT(10) UNSIGNED NULL;

-- ── Reversal tracking ────────────────────────────────────────────────
ALTER TABLE ar_payment_allocations
  ADD COLUMN IF NOT EXISTS reversed_at   TIMESTAMP         NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reversed_by   INT(10) UNSIGNED  NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reversal_note VARCHAR(255)       NULL DEFAULT NULL;

ALTER TABLE ar_payment_allocations
  ADD INDEX IF NOT EXISTS idx_apa_reversed_at (reversed_at);

-- ── Active-allocation uniqueness ─────────────────────────────────────
-- Replaces UNIQUE KEY (ticket_uid) to allow one reversed + one active
-- row per ticket without deleting history.
--
-- Application rule:
--   INSERT active  → active_ticket_uid = ticket_uid
--   Mark reversed  → also set active_ticket_uid = NULL
--
-- MariaDB/MySQL treat each NULL as distinct in a UNIQUE index,
-- so reversed rows (NULL) coexist; only active rows are constrained.

ALTER TABLE ar_payment_allocations
  ADD COLUMN IF NOT EXISTS active_ticket_uid CHAR(36)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci
    NULL DEFAULT NULL;

UPDATE ar_payment_allocations
SET active_ticket_uid = CASE
    WHEN reversed_at IS NULL THEN ticket_uid
    ELSE NULL
END;

ALTER TABLE ar_payment_allocations
  DROP INDEX IF EXISTS `ticket_uid`;

ALTER TABLE ar_payment_allocations
  ADD UNIQUE INDEX IF NOT EXISTS uq_apa_active_ticket_uid (active_ticket_uid);
```

---

## 8. Validated Scenarios

### A) PREPAID → Walk-in — tickets 5219 and 5220

| Field | Value |
|---|---|
| Tickets | 5219 and 5220 |
| Source | ACC-25 / Customer test UG (PREPAID) |
| Target | Walk-in (no account) |

Both tickets converted to Walk-in.

**Expected and confirmed per ticket:**
- `sales.customer_id = NULL`
- `sale_driver_info.account_name = 'WALK-IN CUSTOMER'`, `account_number = NULL`
- Source `available_credit` increased by ticket amount
- `ar_payment_allocations`: `reversed_at` set, `active_ticket_uid = NULL`
- `ar_payments` header recalculated: `amount_applied` decreased, `amount_unapplied` increased
- `payments.method_id` → Cash (`code = 'cash'`), `payment_status_id` → RECEIVED, `amount_applied = amount`

---

### B) PREPAID → PREPAID — ticket 5222

| Field | Value |
|---|---|
| `sale_uid` | `c3efbd52-4023-485a-9bd9-1f3249913905` |
| Ticket | 5222 |
| Source | ACC-25 / Customer test UG (PREPAID) |
| Target | ACC-28 / TEST UG Prepaid 2 (PREPAID) |

**Expected and confirmed:**
- Source `available_credit` increased by ticket amount
- Target `available_credit` decreased by ticket amount (negative balance accepted)
- `ar_payment_allocations` (source): `reversed_at` set, `active_ticket_uid = NULL`
- `ar_payment_allocations` (target): new active row created on ACC-28's CREDIT_BALANCE ar_payment; `active_ticket_uid = ticket_uid`
- Two rows exist for the same `ticket_uid` — no unique key violation (one `NULL`, one `ticket_uid`)
- Target `ar_payments` header recalculated correctly
- `payments` record not modified (stays Business Account, RECEIVED)
- `customer_credit_movements`: REVERSAL (ACC-25) + CHARGE (ACC-28) recorded

---

### C) PREPAID → POSTPAID — ticket 5223

| Field | Value |
|---|---|
| `sale_uid` | `32b58d6f-f99f-45ac-928a-73f3d18dcddc` |
| Ticket | 5223 |
| Source | ACC-28 / TEST UG Prepaid 2 (PREPAID) |
| Target | ACC-26 / Customer Test 2 UG (POSTPAID) |

**Expected and confirmed:**
- Source `available_credit` increased by ticket amount (PREPAID credit returned)
- Target `current_balance` increased by ticket amount (POSTPAID debt recorded)
- Target `available_credit` decreased by ticket amount
- `ar_payment_allocations` (source): `reversed_at` set, `active_ticket_uid = NULL`
- No new allocation created for POSTPAID target (AR collects via FIFO/manual later)
- `payments.payment_status_id` → PENDING, `amount_applied = 0`, `received_at = NULL`
- `payments.method_id` not modified (stays Business Account = method_id 3)
- `customer_credit_movements`: REVERSAL (ACC-28) + CHARGE (ACC-26) recorded

---

## 9. Validation Queries

### PREPAID → Walk-in

```sql
-- Allocation must be reversed; ar_payments header must be recalculated
SELECT
  apa.allocation_id,
  apa.amount_applied,
  apa.reversed_at,            -- must NOT be NULL
  apa.active_ticket_uid,      -- must be NULL
  apa.reversal_note,
  ap.ar_payment_id,
  ap.status,                  -- must be 'CREDIT_BALANCE'
  ap.amount_received,         -- unchanged
  ap.amount_applied           AS header_applied,    -- must equal (received - alloc_amount)
  ap.amount_unapplied         AS header_unapplied   -- must equal (received + alloc_amount if started at 0)
FROM ar_payment_allocations apa
INNER JOIN ar_payments ap ON apa.ar_payment_id = ap.ar_payment_id
WHERE apa.sale_uid = '<sale_uid>';

-- Payment must be Cash, RECEIVED
SELECT p.method_id, pm.code, p.payment_status_id, p.amount, p.amount_applied, p.received_at
FROM payments p
INNER JOIN payment_methods pm ON p.method_id = pm.method_id
WHERE p.sale_uid = '<sale_uid>';
-- pm.code must be 'cash', amount_applied must equal amount

-- Sale and driver info
SELECT s.customer_id, sdi.account_number, sdi.account_name, sdi.account_address
FROM sales s INNER JOIN sale_driver_info sdi ON s.sale_uid = sdi.sale_uid
WHERE s.sale_uid = '<sale_uid>';
-- customer_id = NULL, account_number = NULL, account_name = 'WALK-IN CUSTOMER'
```

---

### PREPAID → PREPAID

```sql
-- Two allocation rows for the same ticket: one reversed (source), one active (target)
SELECT
  apa.allocation_id,
  ap.customer_id,
  c.account_number,
  ap.ar_payment_id,
  apa.amount_applied,
  apa.reversed_at,            -- source: NOT NULL | target: NULL
  apa.active_ticket_uid       -- source: NULL     | target: <ticket_uid>
FROM ar_payment_allocations apa
INNER JOIN ar_payments ap ON apa.ar_payment_id = ap.ar_payment_id
INNER JOIN customers c ON ap.customer_id = c.id_customer
WHERE apa.sale_uid = '<sale_uid>'
  AND ap.status = 'CREDIT_BALANCE'
ORDER BY apa.allocation_id;
-- Expect exactly 2 rows

-- Target ar_payments header
SELECT ar_payment_id, amount_received, amount_applied, amount_unapplied, status
FROM ar_payments
WHERE customer_id = <target_customer_id> AND status = 'CREDIT_BALANCE';
-- amount_applied = ticket_amount; amount_unapplied may be negative

-- Credit movements (2 rows: REVERSAL + CHARGE)
SELECT ccm.movement_type, c.account_number, cc.credit_type,
       ccm.amount, ccm.available_before, ccm.available_after
FROM customer_credit_movements ccm
INNER JOIN customers c ON ccm.customer_id = c.id_customer
INNER JOIN customer_credit cc ON c.id_customer = cc.customer_id
WHERE ccm.sale_uid = '<sale_uid>'
ORDER BY ccm.created_at;

-- Payment must stay Business Account, RECEIVED
SELECT p.method_id, pm.code, p.payment_status_id, p.amount_applied
FROM payments p
INNER JOIN payment_methods pm ON p.method_id = pm.method_id
WHERE p.sale_uid = '<sale_uid>';
-- pm.code must be 'business_account' (or equivalent), payment_status_id RECEIVED
```

**Example: sale_uid = `c3efbd52-4023-485a-9bd9-1f3249913905`, ACC-25 → ACC-28**

| Row | `allocation_id` | `account_number` | `reversed_at` | `active_ticket_uid` |
|---|---|---|---|---|
| Source (ACC-25) | original | ACC-25 | NOT NULL | NULL |
| Target (ACC-28) | new | ACC-28 | NULL | `<ticket_uid>` |

---

### PREPAID → POSTPAID

```sql
-- Source allocation must be reversed
SELECT apa.allocation_id, apa.reversed_at, apa.active_ticket_uid, ap.status
FROM ar_payment_allocations apa
INNER JOIN ar_payments ap ON apa.ar_payment_id = ap.ar_payment_id
WHERE apa.sale_uid = '<sale_uid>'
  AND ap.status = 'CREDIT_BALANCE';
-- reversed_at NOT NULL, active_ticket_uid NULL

-- Credit movements
SELECT ccm.movement_type, c.account_number, cc.credit_type,
       ccm.balance_before, ccm.balance_after,
       ccm.available_before, ccm.available_after
FROM customer_credit_movements ccm
INNER JOIN customers c ON ccm.customer_id = c.id_customer
INNER JOIN customer_credit cc ON c.id_customer = cc.customer_id
WHERE ccm.sale_uid = '<sale_uid>'
ORDER BY ccm.created_at;
-- REVERSAL (PREPAID source): available_after = available_before + amount
-- CHARGE (POSTPAID target):  balance_after = balance_before + amount

-- Payment must be Business Account, PENDING, amount_applied = 0
SELECT p.method_id, p.payment_status_id, p.amount_applied, p.received_at
FROM payments p WHERE p.sale_uid = '<sale_uid>';
-- payment_status_id = PENDING status_id, amount_applied = 0, received_at = NULL

-- No active allocation should exist for POSTPAID target
SELECT COUNT(*) AS should_be_zero
FROM ar_payment_allocations apa
INNER JOIN ar_payments ap ON apa.ar_payment_id = ap.ar_payment_id
INNER JOIN customers c ON ap.customer_id = c.id_customer
WHERE apa.sale_uid = '<sale_uid>'
  AND c.account_number = '<target_account_number>'
  AND apa.reversed_at IS NULL;
```

---

### Verify hard block still works

```sql
-- If this returns rows, the reassignment must be blocked
SELECT apa.allocation_id, ap.status, apa.reversed_at
FROM ar_payment_allocations apa
INNER JOIN ar_payments ap ON apa.ar_payment_id = ap.ar_payment_id
INNER JOIN payments p ON apa.payment_uid COLLATE utf8mb4_general_ci = p.payment_uid
WHERE p.sale_uid = '<sale_uid>'
  AND ap.status IN ('APPLIED', 'PARTIAL')
  AND apa.reversed_at IS NULL;
```

---

### Full reassignment audit for a ticket

```sql
SELECT
  r.reassignment_id, r.changed_at,
  u.full_name AS changed_by,
  r.from_account_number, r.from_account_name, r.from_credit_type,
  r.to_account_number,   r.to_account_name,   r.to_credit_type,
  r.moved_amount, rr.label AS reason, r.reason_notes
FROM sale_customer_reassignments r
LEFT JOIN users u ON r.changed_by_user = u.user_id
LEFT JOIN ticket_reassignment_reasons rr ON r.reassignment_reason_id = rr.reassignment_reason_id
WHERE r.sale_uid = '<sale_uid>'
ORDER BY r.changed_at ASC;
```

---

## 10. Pending Validations

| Scenario | Status | Notes |
|---|---|---|
| POSTPAID → PREPAID | Not yet tested | Source `current_balance` decreases, target `available_credit` decreases; no AR allocation reversal (no CREDIT_BALANCE on POSTPAID source); payment method stays Business Account |
| POSTPAID → POSTPAID | Not yet tested | Source and target `current_balance` / `available_credit` adjusted; no AR allocation reversal |
| POSTPAID → Walk-in | Blocked by design | Walk-in toggle hidden for POSTPAID sources; error thrown if forced via API |
| APPLIED/PARTIAL hard block | Logic validated, E2E not tested | Requires a ticket that has had a real AR payment applied |

---

## 11. Known Risks / Design Decisions

| Topic | Decision |
|---|---|
| `payments` changes to Cash on Walk-in | By design. Sales Report will show "Cash" instead of "Business Account" for converted tickets. Retroactive impact accepted per business decision. |
| `payments` reverts to PENDING on PREPAID → POSTPAID | By design. Required for ticket to appear in AR pending list for the POSTPAID customer. |
| `payments` not modified on PREPAID → PREPAID | By design. Business Account / RECEIVED status preserved. Effect captured in credit movements and new ar_payment_allocations row. |
| `active_ticket_uid` maintained by application code | No triggers, no generated columns (MariaDB limitation). Every INSERT and every reversal UPDATE must maintain the column. Failure to do so silently breaks the uniqueness guarantee. The two code sites are: `ar.service.js` (POSTPAID apply) and `reassignment.service.js` (PREPAID→PREPAID insert + `markAllocationsReversed`). |
| Negative `amount_unapplied` on ar_payments | Allowed in correction flows (PREPAID→PREPAID when target's balance is over-applied). Same philosophy as negative `available_credit`. |
| POSTPAID → Walk-in | Not allowed. Walk-in toggle hidden for POSTPAID sources; backend throws if forced via API. |
| Suspended target customers | Hard block retained. No correction flow can assign to a suspended customer. |
| Target balance going negative | Allowed. No backend guard. Frontend shows `alert-warning` but does not block submission. |
| Non-Business Account reassignment | No credit movement, no AR allocation handling. Only `sales.customer_id`, `sale_driver_info`, and `sale_customer_reassignments` are updated. |
| `ar_payments.status` never modified | Hard constraint. This module only sets `ar_payment_allocations.reversed_at` and recalculates `amount_applied`/`amount_unapplied`. |

---

## 12. Commit References

| Commit | Description |
|---|---|
| `cab0869` | Walk-in support, credit block removal, PREPAID gating, audit trail |
| `04bee52` | AR check split, allocation reversal, active_ticket_uid uniqueness, PREPAID→PREPAID target allocation, PREPAID→POSTPAID payment revert, AR Payment Detail UI (active vs reversed) |
| `00630ef` | Stabilize all three PREPAID scenarios; docs fully rewritten with validated test data, schema migration, validation queries, pending scenarios, and known risks. Validated: PREPAID→Walk-in (tickets 5219/5220, ACC-25), PREPAID→PREPAID (ticket 5222, sale c3efbd52, ACC-25→ACC-28), PREPAID→POSTPAID (ticket 5223, sale 32b58d6f, ACC-28→ACC-26). |
