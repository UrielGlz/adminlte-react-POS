# A/R Payment Amount Adjustment — Business Rules Reference

**Module:** Accounts Receivable → All Payments History → Payment Detail
**Last updated:** 2026-05-22

---

## 1. Overview

The **Edit Payment Amount** feature allows authorized users to correct the `amount_received` recorded on a PREPAID A/R payment after it has been saved.

This addresses the scenario where an operator enters the wrong amount when registering a payment for a PREPAID customer. Because the payment directly affects `customer_credit.available_credit`, an incorrect amount must be correctable without deleting the original record.

The feature is explicitly **not available for POSTPAID accounts**, which use `current_balance` / `available_credit` through a different collection flow.

---

## 2. Scope and Restrictions

| Condition | Behavior |
|---|---|
| `customer_credit.credit_type = 'PREPAID'` | Allowed — edit button visible |
| `customer_credit.credit_type = 'POSTPAID'` | Blocked — button hidden; backend throws if forced |
| `ar_payments.status = 'VOIDED'` | Blocked |
| `ar_payments.voided_at IS NOT NULL` | Blocked |
| `ar_payments.status IN ('CREDIT_BALANCE', 'APPLIED', 'PARTIAL')` | Allowed if other rules pass |

The `is_editable` flag is computed in `ar.model.js → getPaymentDetail` and returned in the payment detail response:

```js
is_editable: h.credit_type === 'PREPAID' && h.status !== 'VOIDED' && h.voided_at == null
```

---

## 3. Business Rules

### 3.1 Applied Amount — Authoritative Source

The applied amount is computed from **active allocations**, not from the stored `ar_payments.amount_applied` field (which can drift):

```sql
SELECT COALESCE(SUM(amount_applied), 0) AS real_applied
FROM ar_payment_allocations
WHERE ar_payment_id = ? AND reversed_at IS NULL
```

This value (`real_applied_amount`) is returned in the payment detail response and used in both frontend validation and backend enforcement.

### 3.2 Allowed Decrease

The new amount can be **lower** than the current amount, as long as:

```
new_amount_received >= real_applied_amount
```

**Example — allowed:**
- `amount_received = 252`, `real_applied_amount = 12`
- Operator changes to `50` → ✓ (50 ≥ 12)
- Operator changes to `15` → ✓ (15 ≥ 12)

**Example — blocked:**
- Operator changes to `10` → ✗ (10 < 12)
- Error: `New amount ($10.00) cannot be less than the already applied amount ($12.00).`

### 3.3 Available Credit Guard

The delta (`new_amount_received - old_amount_received`) is applied to `customer_credit.available_credit`. The operation is blocked if it would make the balance negative:

```
new_available_credit = available_credit + delta
if new_available_credit < 0 → reject
```

The minimum receivable amount when this constraint activates:

```
minimum = max(old_amount_received - available_credit, real_applied_amount)
```

Error: `This adjustment would reduce the customer's available credit to $-X.XX. The minimum receivable amount for this payment is $Y.YY.`

### 3.4 Same Amount Guard

If `new_amount_received = old_amount_received` (rounded to 2 decimal places), the operation is rejected with: `New amount is the same as the current amount. No changes made.`

### 3.5 `amount_unapplied` — Generated Column

`ar_payments.amount_unapplied` is a generated column defined as `amount_received - amount_applied`. It is **never included in the UPDATE** statement. It recalculates automatically when `amount_received` changes.

---

## 4. Backend Flow — `PATCH /ar/payments/:id/amount`

**Route:** `server/modules/ar/ar.routes.js`
**Permission:** `ar.write`

**Request body:**
```json
{
  "new_amount_received": 50.00,
  "reason": "Corrected wrong received amount",
  "notes": "Optional additional context"
}
```

**Transaction steps in `adjustPaymentAmount` (`ar.service.js`):**

| Step | Action |
|---|---|
| 1 | `SELECT ... FOR UPDATE` on `ar_payments` |
| 2 | `SELECT ... FOR UPDATE` on `customer_credit` |
| 3 | Validate `credit_type = 'PREPAID'` |
| 4 | Validate `status ≠ 'VOIDED'` and `voided_at IS NULL` |
| 5 | Compute `real_applied_amount` from `SUM(ar_payment_allocations WHERE reversed_at IS NULL)` |
| 6 | Validate `new_amount >= real_applied_amount` |
| 7 | Compute delta; validate `available_credit + delta >= 0` |
| 8 | `UPDATE ar_payments SET amount_received = ?` (only this field) |
| 9 | `UPDATE customer_credit SET available_credit = ?` |
| 10 | `INSERT INTO ar_payment_adjustments` with full before/after snapshot |
| 11 | Commit / rollback on error |

**`customer_credit_movements` is NOT used** for this flow. The audit trail lives in `ar_payment_adjustments` only. This avoids contaminating the movement ledger (which was designed for ticket reassignment events) and prevents unintended effects on reports that filter by `movement_type`.

---

## 5. Audit Table — `ar_payment_adjustments`

```sql
CREATE TABLE ar_payment_adjustments (
  adjustment_id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  adjustment_uid       CHAR(36) NOT NULL,              -- app generates UUID via crypto.randomUUID()

  ar_payment_id        INT(10) UNSIGNED NOT NULL,
  ar_payment_uid       CHAR(36) NOT NULL,
  customer_id          INT(10) UNSIGNED NOT NULL,

  old_amount_received  DECIMAL(12,2) NOT NULL,
  new_amount_received  DECIMAL(12,2) NOT NULL,
  delta_amount         DECIMAL(12,2) NOT NULL,

  applied_amount       DECIMAL(12,2) NOT NULL DEFAULT 0.00,  -- SUM of active allocations at edit time
  old_amount_unapplied DECIMAL(12,2) NOT NULL,
  new_amount_unapplied DECIMAL(12,2) NOT NULL,

  old_available_credit DECIMAL(12,2) NOT NULL,
  new_available_credit DECIMAL(12,2) NOT NULL,

  payment_status       VARCHAR(30) NOT NULL,   -- snapshot of ar_payments.status at time of edit
  reason               VARCHAR(255) NOT NULL,
  notes                VARCHAR(500) NULL,

  adjusted_by_user     INT(10) UNSIGNED NOT NULL,
  adjusted_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (adjustment_id),
  UNIQUE KEY uq_ar_payment_adjustments_uid (adjustment_uid),
  KEY idx_ar_payment_adjustments_payment_id (ar_payment_id),
  KEY idx_ar_payment_adjustments_customer   (customer_id),
  KEY idx_ar_payment_adjustments_at         (adjusted_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;
```

**Design decisions:**
- No FK constraints — follows project convention.
- `DEFAULT (UUID())` not used — incompatible with MariaDB < 10.7. UUID populated by `crypto.randomUUID()` in Node.js.
- `applied_amount` is the real SUM at the time of the edit, not `ar_payments.amount_applied` (which may have drift).
- `payment_status` snapshot preserves the state for future audits.
- No `customer_credit_movements` rows are created.

---

## 6. Frontend — Payment Detail

**File:** `client/src/pages/ar/PaymentDetail.jsx`

### Button

Rendered next to "Back to History" only when `payment.is_editable === true`:
```jsx
{payment.is_editable && (
  <button className="btn btn-outline-warning" onClick={openModal}>
    Edit Payment Amount
  </button>
)}
```

### Modal

| Field | Type | Notes |
|---|---|---|
| Current Amount | read-only | `payment.amount_received` |
| Applied Amount | read-only | `payment.real_applied_amount` (from SUM) |
| Unapplied Amount | read-only | `payment.amount_unapplied` |
| New Amount | number input | min = `real_applied_amount` when applied > 0; else `0.01` |
| Reason | text input | required |
| Notes | textarea | optional |

**Warning banner** (shown when `real_applied_amount > 0`):
> "This prepaid payment has already been partially applied. You can decrease it only down to the applied amount ($X.XX)."

### Adjustment History card

Rendered inside the right column, directly below Amount Summary. Compact list style — one entry per adjustment:

```
May 22, 2026 10:30 AM        Uriel Gonzalez
$200.00 → $252.00    [+$52.00]
Corrected wrong received amount
```

Delta badge: green (`bg-success`) for positive, red (`bg-danger`) for negative.
If no adjustments: "No payment adjustments recorded."

---

## 7. Error Messages

| Scenario | Message |
|---|---|
| POSTPAID account | `Postpaid payments cannot be edited from this screen.` |
| Voided payment | `Voided payments cannot be edited.` |
| New amount < applied | `New amount ($X.XX) cannot be less than the already applied amount ($Y.YY).` |
| Available credit goes negative | `This adjustment would reduce the customer's available credit to $-X.XX. The minimum receivable amount for this payment is $Y.YY.` |
| Same amount | `New amount is the same as the current amount. No changes made.` |
| Success | `Payment amount updated successfully.` |

---

## 8. Modified Files

| File | Change |
|---|---|
| `server/modules/ar/ar.routes.js` | Added `PATCH /payments/:id/amount` before `GET /payments/:id` |
| `server/modules/ar/ar.controller.js` | Added `adjustPaymentAmount` handler |
| `server/modules/ar/ar.service.js` | Added `adjustPaymentAmount` transaction; removed stray `console.log` from `getAllPaymentHistory` |
| `server/modules/ar/ar.model.js` | `getPaymentDetail`: added `customer_credit` join, `real_applied_amount` query, `ar_payment_adjustments` query; returns `credit_type`, `is_editable`, `real_applied_amount`, `adjustments[]` |
| `client/src/pages/ar/PaymentDetail.jsx` | Added Edit button, modal, Adjustment History card |
| `server/database/ticket_reassignment_tables.sql` | Added `CREATE TABLE IF NOT EXISTS ar_payment_adjustments` |

---

## 9. Validation Queries

### Verify adjustment was recorded

```sql
SELECT
  adj.adjustment_id,
  adj.old_amount_received,
  adj.new_amount_received,
  adj.delta_amount,
  adj.applied_amount,
  adj.old_available_credit,
  adj.new_available_credit,
  adj.payment_status,
  adj.reason,
  adj.notes,
  u.full_name AS adjusted_by,
  adj.adjusted_at
FROM ar_payment_adjustments adj
LEFT JOIN users u ON adj.adjusted_by_user = u.user_id
WHERE adj.ar_payment_id = <ar_payment_id>
ORDER BY adj.adjusted_at DESC;
```

### Verify ar_payments header after adjustment

```sql
SELECT ar_payment_id, amount_received, amount_applied, amount_unapplied, status
FROM ar_payments
WHERE ar_payment_id = <ar_payment_id>;
-- amount_unapplied = amount_received - amount_applied (generated column, auto-updated)
```

### Verify available_credit was adjusted

```sql
SELECT cc.customer_id, cc.credit_type, cc.available_credit
FROM customer_credit cc
INNER JOIN ar_payments ap ON cc.customer_id = ap.customer_id
WHERE ap.ar_payment_id = <ar_payment_id>;
-- available_credit should equal: old_available_credit + delta_amount
```

### Verify real applied amount (SUM of active allocations)

```sql
SELECT COALESCE(SUM(amount_applied), 0) AS real_applied_amount
FROM ar_payment_allocations
WHERE ar_payment_id = <ar_payment_id>
  AND reversed_at IS NULL;
-- Must match applied_amount stored in ar_payment_adjustments
```

### Confirm customer_credit_movements was NOT touched

```sql
SELECT COUNT(*) AS should_be_zero
FROM customer_credit_movements
WHERE reference_id = '<ar_payment_uid>'
   OR notes LIKE '%adjustment%';
-- Expected: 0 rows from this feature
```

---

## 10. Validated Scenario

**Payment Detail #37 — ACC-X / PREPAID customer**

| Test | Input | Result |
|---|---|---|
| Increase | $200 → $252 | `amount_received = 252`, `amount_unapplied = 240`, `available_credit += 52` ✓ |
| Decrease (partial) | $252 → $50 (applied = $12) | Allowed (50 ≥ 12), `available_credit -= 202` ✓ |
| Decrease below applied | $252 → $10 (applied = $12) | Blocked: "cannot be less than applied amount ($12.00)" ✓ |
| VOIDED payment | Any | Blocked ✓ |
| Adjustment visible in UI | — | Card shows in right column below Amount Summary ✓ |

---

## 11. Known Constraints

| Topic | Decision |
|---|---|
| `amount_unapplied` is generated | Never SET in UPDATE. MariaDB recalculates on `amount_received` change. |
| `available_credit` can be negative on correction flows | Blocked by guard in this feature. Other flows (reassignment) allow negative balance per business decision. |
| Multiple adjustments | Supported. All entries shown in Adjustment History card, newest first. |
| POSTPAID excluded | By design. POSTPAID uses `current_balance` flow; editing A/R payment amount alone would not correctly reverse POSTPAID debt. |
| `ar_payments.amount_applied` drift | Not corrected by this feature. Drift is handled by the reassignment service recalc. |
