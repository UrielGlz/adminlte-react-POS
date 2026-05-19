# Customer Reassignment — Business Rules Reference

**Module:** Daily Operations → Change Customer / Reassign Customer
**Last updated:** 2026-05-19

---

## 1. Context

The Change Customer module existed before this work session. It was extended and corrected in two commits:

**commit `cab0869`** — initial extension:
- Walk-in conversion (PREPAID → Walk-in Customer) added.
- `sale_customer_reassignments.to_customer_id` made nullable for Walk-in target.
- `sale_driver_info` address fields set to `'WALK-IN CUSTOMER'` instead of `NULL`.
- Credit block on target customer removed (correction flow, not new sale).
- Walk-in toggle gated to PREPAID Business Account sources only.
- Operator-facing messages standardized.

**commit (this session)** — AR allocation fix:
- The original AR check blocked **all** non-VOIDED allocations, including `CREDIT_BALANCE` entries that represent PREPAID consumption. This blocked the PREPAID → Walk-in conversion even though the allocation is reversible.
- New rule: only `APPLIED` and `PARTIAL` allocations (real AR payments) are hard blockers. `CREDIT_BALANCE` allocations on PREPAID tickets are reversed within the same transaction.
- `ar_payment_allocations` gains three columns to track reversals without deleting history.
- `payments` record is updated to reflect the true post-reassignment state.

---

## 2. Modified Files

| File | Purpose |
|------|---------|
| `server/modules/sales/reassignment.service.js` | Core transaction logic: AR check split, allocation reversal, payment updates |
| `server/modules/ar/ar.model.js` | `getPaymentDetail` allocations query: exposes `reversed_at` and `is_reversed` flag |
| `client/src/pages/sales/ReassignCustomerModal.jsx` | Frontend modal (unchanged in this commit) |
| `server/database/ticket_reassignment_tables.sql` | Schema migration: new columns on `ar_payment_allocations` |
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
- Fields `balance_before/after` and `available_before/after` record the snapshot at time of operation.
- On Walk-in conversion, `balance_before` and `balance_after` are `NULL` (PREPAID has no balance concept).

### `sale_customer_reassignments`
- Full audit trail of every change: from/to account snapshots, moved amount, credit types, reason, user, timestamp.
- `to_customer_id` — nullable; `NULL` when target is Walk-in.
- `to_account_name` — `'WALK-IN CUSTOMER'` when target is Walk-in.
- `from_credit_type` / `to_credit_type` — `NULL` for Walk-in target.

### `payments`
- Modified in some scenarios. See Section 5.
- `method_id` — changed to Cash on Walk-in conversion.
- `payment_status_id` — changed to PENDING on PREPAID → POSTPAID (so ticket appears in AR pending list).
- `amount_applied` — set to `amount` on Walk-in (Cash is fully applied); set to 0 on PREPAID → POSTPAID.
- `received_at` — set to `COALESCE(received_at, NOW())` on Walk-in; set to `NULL` on PREPAID → POSTPAID.

### `ar_payment_allocations`
- Three new columns added:
  - `reversed_at TIMESTAMP NULL` — timestamp of reversal; `NULL` means still active.
  - `reversed_by INT UNSIGNED NULL` — user who triggered the reversal.
  - `reversal_note VARCHAR(255) NULL` — short description for audit.
- Rows are **never deleted**. Reversed allocations are identified by `reversed_at IS NOT NULL`.
- Only `CREDIT_BALANCE` allocations (PREPAID consumption) are reversible from this module.
- `APPLIED` and `PARTIAL` allocations remain hard blockers.

### `ar_payments`
- `status` is **never modified** by this module — stays `CREDIT_BALANCE`.
- `amount_applied` and `amount_unapplied` **are updated** when a CREDIT_BALANCE allocation is reversed:
  - `amount_applied = amount_applied - reversedAmount`
  - `amount_unapplied = amount_unapplied + reversedAmount`
- This keeps the AR header consistent with its allocations (the UI reads `ar_payments.amount_applied` for totals).
- Possible status values: `CREDIT_BALANCE`, `APPLIED`, `PARTIAL`, `VOIDED`.

**Example (ar_payment_id = 36):**

| Field | Before reversal | After reversal |
|---|---|---|
| `amount_received` | 100.00 | 100.00 (unchanged) |
| `amount_applied` | 12.00 | 0.00 |
| `amount_unapplied` | 88.00 | 100.00 |
| `status` | `CREDIT_BALANCE` | `CREDIT_BALANCE` (unchanged) |

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

Applies when: Business Account sale, source customer `credit_type = 'PREPAID'`, operator selects "Convert to Walk-in".

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
| `ar_payment_allocations` (CREDIT_BALANCE) | `reversed_at = NOW()`, `reversed_by`, `reversal_note` set |
| `payments.method_id` | Changed to Cash (lookup by `code = 'cash'`) |
| `payments.payment_status_id` | Stays `RECEIVED` |
| `payments.amount_applied` | Set to `amount` (full ticket total) |
| `payments.received_at` | `COALESCE(received_at, NOW())` |
| `ar_payments.status` | **Not modified** |

**Why `payments` changes to Cash:** The ticket was incorrectly charged to a Business Account. Once converted to Walk-in, there is no account holder. Cash is the correct payment method because the PREPAID credit was consumed immediately at the time of sale. Retroactive impact on Sales Report (method breakdown changes) is accepted per business decision.

The frontend "Convert to Walk-in" toggle only appears when `isBusinessPayment AND sourceIsPrepaid`. POSTPAID Business Account tickets do not show this option.

---

### B) PREPAID → PREPAID

Applies when: Business Account sale, source customer is PREPAID, target customer is PREPAID.

| Step | Action |
|---|---|
| Source `available_credit` | `+ ticket amount` (returned) |
| Target `available_credit` | `- ticket amount` (charged) |
| Target negative balance | **Allowed** — correction flow, not a new sale |
| `sale_customer_reassignments` | Audit row with `from_credit_type = 'PREPAID'`, `to_credit_type = 'PREPAID'` |
| `customer_credit_movements` | `SALE_REASSIGN_REVERSAL` (source) + `SALE_REASSIGN_CHARGE` (target) |
| `ar_payment_allocations` (CREDIT_BALANCE) | `reversed_at` set — PREPAID source allocation reversed |
| `payments.method_id` | **Not modified** — stays Business Account |
| `payments.payment_status_id` | **Not modified** — stays RECEIVED |
| `payments.amount_applied` | **Not modified** |
| No new allocation for target PREPAID | Credit effect captured via `customer_credit_movements` only |

---

### C) PREPAID → POSTPAID

Applies when: Business Account sale, source customer is PREPAID, target customer is POSTPAID.

| Step | Action |
|---|---|
| Source `available_credit` | `+ ticket amount` (returned) |
| Target `current_balance` | `+ ticket amount` (debt increases) |
| Target `available_credit` | `- ticket amount` (available decreases) |
| Target exceeds credit limit | **Allowed** — correction flow, not a new sale |
| `customer_credit_movements` | `SALE_REASSIGN_REVERSAL` (source) + `SALE_REASSIGN_CHARGE` (target) |
| `ar_payment_allocations` (CREDIT_BALANCE) | `reversed_at` set — PREPAID source allocation reversed |
| `payments.method_id` | **Not modified** — stays Business Account |
| `payments.payment_status_id` | Changed to `PENDING` — ticket now a POSTPAID receivable visible in AR |
| `payments.amount_applied` | Set to `0.00` |
| `payments.received_at` | Set to `NULL` |
| No new allocation for target POSTPAID | POSTPAID balance handled via `customer_credit`; AR collects via FIFO/manual later |

**Why payment reverts to PENDING:** The ticket now belongs to a POSTPAID customer who owes the amount. Setting `payment_status_id = PENDING` and `amount_applied = 0` makes the ticket appear in `getPendingTransactions`, which is the AR module's source for FIFO/manual collection.

---

### D) Suspended Customers

A suspended customer **cannot** be the target of any reassignment, including correction flows.

- Backend throws `BadRequestError` before any DB write.
- Frontend disables selection of suspended customers and blocks form submit.
- Error message: *"This customer is suspended and cannot receive corrected charges. Please select another customer or contact an administrator."*

---

### E) Blocked Tickets

| Blocker | Condition | Error message |
|---|---|---|
| Real AR payment applied | `ar_payment_allocations` has rows with `ap.status IN ('APPLIED', 'PARTIAL')` and `apa.reversed_at IS NULL` | *This ticket cannot be changed because it already has active AR payment allocations.* |
| Invalid status | `status_catalogo.code` IN (`CANCELLED`, `VOID`, `VOIDED`, `REFUNDED`) | *This ticket cannot be changed because it is cancelled, voided, refunded, or closed for changes.* |

**CREDIT_BALANCE allocations with a PREPAID source do NOT block the reassignment.** They are reversed within the same transaction.

---

## 5. AR Allocation — Blocking vs. Reversible

| `ar_payments.status` | Source credit type | Effect on reassignment |
|---|---|---|
| `APPLIED` | Any | **Hard block** |
| `PARTIAL` | Any | **Hard block** |
| `CREDIT_BALANCE` | `PREPAID` | Reversible — allocation marked `reversed_at`, reassignment proceeds |
| `CREDIT_BALANCE` | `POSTPAID` | Should not occur by design; treated as no-op (not a blocker) |
| `VOIDED` | Any | Not a blocker (already voided) |

The `ar_payments` record itself is **never modified** by this module. Only `ar_payment_allocations.reversed_at` is set.

---

## 6. Operator-Facing Messages

All messages are in English. No internal field names or technical terms are exposed to the operator.

| Scenario | Message |
|---|---|
| Non-Business Account | *Non-Business Account correction: only the sale record and audit history will be updated. Credit balances will not change.* |
| Business Account (selecting a customer) | *Business Account correction: credit balances will be updated for both customers.* |
| Low available credit on target (allowed) | *Low credit notice: this correction will be applied even if the customer's available credit becomes negative.* |
| PREPAID to Walk-in mode active | *PREPAID to Walk-in conversion: the account will be unlinked and the ticket amount will be returned to the original PREPAID balance.* |
| Target customer suspended | *This customer is suspended and cannot receive corrected charges. Please select another customer or contact an administrator.* |
| Reassignment reason not selected | *Please select a reassignment reason.* |
| Source and target are the same customer | *Please select a different customer.* |
| Active AR payment allocations on ticket | *This ticket cannot be changed because it already has active AR payment allocations.* |
| Ticket is cancelled / voided / refunded | *This ticket cannot be changed because it is cancelled, voided, refunded, or closed for changes.* |
| POSTPAID attempting Walk-in conversion | *Walk-in conversion is only allowed for PREPAID Business Account tickets. POSTPAID tickets must be reassigned to another customer.* |

---

## 7. Schema Migration

Applied to `server/database/ticket_reassignment_tables.sql` (idempotent — safe to run multiple times):

```sql
-- Allow Walk-in target
ALTER TABLE sale_customer_reassignments
  MODIFY to_customer_id INT(10) UNSIGNED NULL;

-- Reversal tracking on ar_payment_allocations (PREPAID CREDIT_BALANCE)
ALTER TABLE ar_payment_allocations
  ADD COLUMN IF NOT EXISTS reversed_at   TIMESTAMP    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reversed_by   INT(10) UNSIGNED NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reversal_note VARCHAR(255) NULL DEFAULT NULL;

ALTER TABLE ar_payment_allocations
  ADD INDEX IF NOT EXISTS idx_apa_reversed_at (reversed_at);
```

---

## 8. Validation Queries

### PREPAID → Walk-in: verify allocation and ar_payments header

```sql
-- Allocation: must have reversed_at set
SELECT
  apa.allocation_id,
  apa.amount_applied        AS alloc_amount_applied,
  apa.reversed_at,          -- must NOT be NULL
  apa.reversal_note,
  ap.ar_payment_id,
  ap.status                 AS ar_payment_status,  -- must be 'CREDIT_BALANCE'
  ap.amount_received,       -- unchanged
  ap.amount_applied         AS header_amount_applied,   -- must be (original - alloc_amount)
  ap.amount_unapplied       AS header_amount_unapplied  -- must be (original + alloc_amount)
FROM ar_payment_allocations apa
INNER JOIN ar_payments ap ON apa.ar_payment_id = ap.ar_payment_id
INNER JOIN payments p ON apa.payment_uid COLLATE utf8mb4_general_ci = p.payment_uid
WHERE apa.sale_uid = '<sale_uid>';

-- Payment: must be Cash, RECEIVED, amount_applied = amount
SELECT
  p.method_id,              -- must be Cash method_id (not 3)
  pm.code                   AS method_code,       -- must be 'cash'
  p.payment_status_id,      -- must be RECEIVED status_id
  p.amount,
  p.amount_applied,         -- must equal p.amount
  p.received_at             -- must NOT be NULL
FROM payments p
INNER JOIN payment_methods pm ON p.method_id = pm.method_id
WHERE p.sale_uid = '<sale_uid>';
```

**Expected result for `ar_payment_id = 36` after reversal of allocation_id = 1156 ($12.00):**

| `ar_payments` field | Expected value |
|---|---|
| `amount_received` | 100.00 |
| `amount_applied` | 0.00 |
| `amount_unapplied` | 100.00 |
| `status` | `CREDIT_BALANCE` |

### PREPAID → Walk-in: verify sale and driver info

```sql
SELECT
  s.sale_uid,
  s.customer_id,           -- must be NULL
  sdi.account_number,      -- must be NULL
  sdi.account_name,        -- must be 'WALK-IN CUSTOMER'
  sdi.account_address,     -- must be 'WALK-IN CUSTOMER'
  sdi.account_country,     -- must be 'WALK-IN CUSTOMER'
  sdi.account_state        -- must be 'WALK-IN CUSTOMER'
FROM sales s
INNER JOIN sale_driver_info sdi ON s.sale_uid = sdi.sale_uid
WHERE s.sale_uid = '<sale_uid>';
```

### PREPAID → Walk-in: verify credit movement

```sql
SELECT
  ccm.movement_type,       -- must be 'SALE_REASSIGN_REVERSAL'
  ccm.amount,
  ccm.available_before,
  ccm.available_after,     -- must be available_before + ticket total
  ccm.notes
FROM customer_credit_movements ccm
WHERE ccm.sale_uid = '<sale_uid>'
  AND ccm.movement_type = 'SALE_REASSIGN_REVERSAL'
ORDER BY ccm.created_at DESC;
```

### PREPAID → PREPAID: verify both allocation reversal and credit movements

```sql
-- Allocation reversed
SELECT apa.allocation_id, apa.reversed_at, apa.reversal_note, ap.status
FROM ar_payment_allocations apa
INNER JOIN ar_payments ap ON apa.ar_payment_id = ap.ar_payment_id
INNER JOIN payments p ON apa.payment_uid COLLATE utf8mb4_general_ci = p.payment_uid
WHERE apa.sale_uid = '<sale_uid>'
  AND ap.status = 'CREDIT_BALANCE';

-- Credit movements
SELECT ccm.movement_type, c.account_number, cc.credit_type,
       ccm.amount, ccm.available_before, ccm.available_after
FROM customer_credit_movements ccm
INNER JOIN customers c ON ccm.customer_id = c.id_customer
INNER JOIN customer_credit cc ON c.id_customer = cc.customer_id
WHERE ccm.sale_uid = '<sale_uid>'
  AND ccm.movement_type IN ('SALE_REASSIGN_REVERSAL', 'SALE_REASSIGN_CHARGE')
ORDER BY ccm.created_at;

-- Payment must still be Business Account, RECEIVED
SELECT p.method_id, p.payment_status_id, p.amount_applied
FROM payments p WHERE p.sale_uid = '<sale_uid>';
```

### PREPAID → POSTPAID: verify allocation reversal, credit moves, and payment revert

```sql
-- Allocation reversed
SELECT apa.allocation_id, apa.reversed_at, ap.status
FROM ar_payment_allocations apa
INNER JOIN ar_payments ap ON apa.ar_payment_id = ap.ar_payment_id
INNER JOIN payments p ON apa.payment_uid COLLATE utf8mb4_general_ci = p.payment_uid
WHERE apa.sale_uid = '<sale_uid>'
  AND ap.status = 'CREDIT_BALANCE';

-- PREPAID source: REVERSAL
SELECT ccm.movement_type, c.account_number, cc.credit_type,
       ccm.available_before, ccm.available_after
FROM customer_credit_movements ccm
INNER JOIN customers c ON ccm.customer_id = c.id_customer
INNER JOIN customer_credit cc ON c.id_customer = cc.customer_id
WHERE ccm.sale_uid = '<sale_uid>'
  AND ccm.movement_type = 'SALE_REASSIGN_REVERSAL';

-- POSTPAID target: CHARGE (balance_after = balance_before + amount)
SELECT ccm.movement_type, c.account_number, cc.credit_type,
       ccm.balance_before, ccm.balance_after,
       ccm.available_before, ccm.available_after
FROM customer_credit_movements ccm
INNER JOIN customers c ON ccm.customer_id = c.id_customer
INNER JOIN customer_credit cc ON c.id_customer = cc.customer_id
WHERE ccm.sale_uid = '<sale_uid>'
  AND ccm.movement_type = 'SALE_REASSIGN_CHARGE';

-- Payment: Business Account, PENDING, amount_applied = 0, received_at NULL
SELECT p.method_id, p.payment_status_id, p.amount_applied, p.received_at
FROM payments p WHERE p.sale_uid = '<sale_uid>';
-- payment_status_id must be PENDING (5), amount_applied must be 0, received_at must be NULL
```

### Cases that must still be blocked

```sql
-- Verify APPLIED/PARTIAL allocations still block (no reversed_at should exist on these)
SELECT apa.allocation_id, ap.status, apa.reversed_at
FROM ar_payment_allocations apa
INNER JOIN ar_payments ap ON apa.ar_payment_id = ap.ar_payment_id
INNER JOIN payments p ON apa.payment_uid COLLATE utf8mb4_general_ci = p.payment_uid
WHERE p.sale_uid = '<sale_uid>'
  AND ap.status IN ('APPLIED', 'PARTIAL')
  AND apa.reversed_at IS NULL;
-- If rows returned → reassignment must be blocked.
```

### Full reassignment audit for a specific ticket

```sql
SELECT
  r.reassignment_id,
  r.changed_at,
  u.full_name AS changed_by,
  r.from_account_number, r.from_account_name, r.from_credit_type,
  r.to_account_number,   r.to_account_name,   r.to_credit_type,
  r.moved_amount,
  rr.label AS reason,
  r.reason_notes
FROM sale_customer_reassignments r
LEFT JOIN users u ON r.changed_by_user = u.user_id
LEFT JOIN ticket_reassignment_reasons rr ON r.reassignment_reason_id = rr.reassignment_reason_id
WHERE r.sale_uid = '<sale_uid>'
ORDER BY r.changed_at ASC;
```

---

## 9. Known Risks / Design Decisions

| Topic | Status |
|---|---|
| `payments` changes to Cash on Walk-in | By design (this session). Sales Report will show "Cash" instead of "Business Account" for converted tickets. Retroactive impact accepted per business decision. |
| `payments` reverts to PENDING on PREPAID → POSTPAID | By design (this session). Required for ticket to appear in AR pending list for the POSTPAID customer. |
| `payments` not modified on PREPAID → PREPAID | By design. Business Account, RECEIVED status preserved. Credit effect captured in movements only. |
| POSTPAID → Walk-in | Not allowed. POSTPAID tickets must be reassigned to another customer. Walk-in toggle is hidden for POSTPAID sources. |
| Suspended customers | Hard blocker retained. Even correction flows cannot assign to a suspended customer. |
| Target balance going negative | Allowed. No backend guard. The frontend shows a warning (`alert-warning`) but does not block submission. |
| Non-Business Account reassignment | No credit movement, no AR allocation handling. Only `sales.customer_id`, `sale_driver_info`, and `sale_customer_reassignments` are updated. |
| `ar_payments.status` never modified | Hard constraint. This module only marks `ar_payment_allocations.reversed_at`. The parent `ar_payments` record is never voided, deleted, or changed. |
| MySQL `ADD COLUMN IF NOT EXISTS` | Requires MySQL 8.0.3+. If running an older version, remove `IF NOT EXISTS` from the ALTER statements and run manually if columns don't exist. |

---

## 10. Commit References

```
fix(sales): update customer reassignment business rules
```
**Commit:** `cab0869` — Walk-in support, credit block removal, PREPAID gating.

```
fix(sales): allow PREPAID CREDIT_BALANCE allocation reversal on customer change
```
**Commit:** _(this session)_ — AR check split, allocation reversal, payment state updates.
