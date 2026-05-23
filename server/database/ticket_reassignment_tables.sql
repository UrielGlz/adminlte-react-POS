-- ============================================================
-- Ticket Customer Reassignment — DDL + Seed Data
-- Safe to run multiple times (idempotent).
--
-- COLLATION: utf8mb4_general_ci
--   Legacy/POS tables (sales, customers, payments, ar_payments,
--   ar_payment_allocations, etc.) use utf8mb4_general_ci in production.
--   New tables MUST match to avoid "Illegal mix of collations"
--   errors on any cross-table VARCHAR/CHAR comparison or JOIN.
-- ============================================================

-- 1) Reason catalog
CREATE TABLE IF NOT EXISTS ticket_reassignment_reasons (
  reassignment_reason_id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  label VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 10,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (reassignment_reason_id),
  UNIQUE KEY uq_ticket_reassignment_reasons_code (code),
  KEY idx_ticket_reassignment_reasons_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Idempotent seed: INSERT IGNORE skips rows if code (UNIQUE) already exists
INSERT IGNORE INTO ticket_reassignment_reasons (code, label, sort_order) VALUES
  ('CUSTOMER_REQUEST',        'Customer Request',          10),
  ('WRONG_ACCOUNT_SELECTED',  'Wrong Account Selected',    20),
  ('DISPATCH_CORRECTION',     'Dispatch Correction',       30),
  ('BILLING_CORRECTION',      'Billing Correction',        40),
  ('OTHER',                   'Other',                     99);

-- 2) Reassignment history / audit
--
-- NOTE on foreign keys:
--   This project intentionally avoids FK constraints on most tables
--   (e.g. ar_payments, ar_payment_allocations have no FK declarations).
--   Following that convention, no FK constraints are added here.
--   Referential integrity is enforced at the application/service layer.
--
CREATE TABLE IF NOT EXISTS sale_customer_reassignments (
  reassignment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_uid CHAR(36) NOT NULL,
  ticket_uid CHAR(36) NULL,
  from_customer_id INT(10) UNSIGNED NULL,
  to_customer_id INT(10) UNSIGNED NOT NULL,
  from_account_number VARCHAR(30) NULL,
  from_account_name VARCHAR(120) NULL,
  from_account_address VARCHAR(255) NULL,
  from_account_country VARCHAR(80) NULL,
  from_account_state VARCHAR(80) NULL,
  to_account_number VARCHAR(30) NULL,
  to_account_name VARCHAR(120) NULL,
  to_account_address VARCHAR(255) NULL,
  to_account_country VARCHAR(80) NULL,
  to_account_state VARCHAR(80) NULL,
  sale_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  moved_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  from_credit_type ENUM('POSTPAID','PREPAID') NULL,
  to_credit_type ENUM('POSTPAID','PREPAID') NULL,
  reassignment_reason_id INT(10) UNSIGNED NOT NULL,
  reason_notes VARCHAR(500) NULL,
  changed_by_user INT(10) UNSIGNED NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reassignment_id),
  KEY idx_scr_sale_uid (sale_uid),
  KEY idx_scr_from_customer (from_customer_id),
  KEY idx_scr_to_customer (to_customer_id),
  KEY idx_scr_changed_at (changed_at),
  KEY idx_scr_reason (reassignment_reason_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3) Credit movement ledger
CREATE TABLE IF NOT EXISTS customer_credit_movements (
  movement_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT(10) UNSIGNED NOT NULL,
  sale_uid CHAR(36) NULL,
  reassignment_id BIGINT UNSIGNED NULL,
  movement_type VARCHAR(50) NOT NULL,
  reference_type VARCHAR(50) NULL,
  reference_id VARCHAR(100) NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  balance_before DECIMAL(12,2) NULL,
  balance_after DECIMAL(12,2) NULL,
  available_before DECIMAL(12,2) NULL,
  available_after DECIMAL(12,2) NULL,
  notes VARCHAR(500) NULL,
  created_by_user INT(10) UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (movement_id),
  KEY idx_ccm_customer_id (customer_id),
  KEY idx_ccm_sale_uid (sale_uid),
  KEY idx_ccm_reassignment_id (reassignment_id),
  KEY idx_ccm_type (movement_type),
  KEY idx_ccm_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- MIGRATION FIX: If the tables were already created with
-- utf8mb4_unicode_ci, run these ALTERs to convert them.
-- Safe to run even if tables are already general_ci (no-op).
-- ============================================================
ALTER TABLE ticket_reassignment_reasons
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE sale_customer_reassignments
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

ALTER TABLE sale_customer_reassignments
  MODIFY from_customer_id INT(10) UNSIGNED NULL;

-- Allow Walk-in target: to_customer_id can now be NULL when ticket is converted to Walk-in
ALTER TABLE sale_customer_reassignments
  MODIFY to_customer_id INT(10) UNSIGNED NULL;

ALTER TABLE customer_credit_movements
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- ============================================================
-- MIGRATION: ar_payment_allocations — reversal tracking
--
-- Adds three nullable columns so a PREPAID CREDIT_BALANCE allocation
-- can be marked as reversed without deleting historical data.
-- Safe to run multiple times: IF NOT EXISTS / ADD COLUMN checks.
--
-- reversed_at   — timestamp of the reversal (NULL = still active)
-- reversed_by   — user_id who triggered the reversal
-- reversal_note — short description for audit trail
-- ============================================================
ALTER TABLE ar_payment_allocations
  ADD COLUMN IF NOT EXISTS reversed_at   TIMESTAMP    NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reversed_by   INT(10) UNSIGNED NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reversal_note VARCHAR(255) NULL DEFAULT NULL;

-- Index for fast "active allocations only" queries
ALTER TABLE ar_payment_allocations
  ADD INDEX IF NOT EXISTS idx_apa_reversed_at (reversed_at);

-- ============================================================
-- MIGRATION: ar_payment_allocations — active-allocation uniqueness
--
-- Problem: the original table has a UNIQUE KEY on ticket_uid.
-- PREPAID → PREPAID reassignment needs two rows for the same
-- ticket_uid: one reversed (source) + one active (target).
-- Rows are never deleted, so the old unique key blocks this.
--
-- Solution: plain nullable column managed by application code.
--   active_ticket_uid = ticket_uid  when reversed_at IS NULL  (active)
--   active_ticket_uid = NULL        when reversed_at IS NOT NULL (reversed)
--
-- MySQL/MariaDB treat each NULL as distinct in a UNIQUE index,
-- so any number of reversed rows coexist while only one active
-- allocation per ticket_uid is enforced.
--
-- Application responsibility (no triggers):
--   INSERT active allocation  → set active_ticket_uid = ticket_uid
--   UPDATE to mark reversed   → also set active_ticket_uid = NULL
-- ============================================================

-- 1. Add the plain nullable column (IF NOT EXISTS for idempotency).
ALTER TABLE ar_payment_allocations
  ADD COLUMN IF NOT EXISTS active_ticket_uid CHAR(36) NULL DEFAULT NULL;

-- 2. Backfill: active rows get ticket_uid; reversed rows stay NULL.
--    Safe to re-run: overwrites with the same correct value.
UPDATE ar_payment_allocations
SET active_ticket_uid = CASE
    WHEN reversed_at IS NULL THEN ticket_uid
    ELSE NULL
END;

-- 3. Remove the old per-ticket unique constraint.
--    Key name 'ticket_uid' confirmed from runtime duplicate-key error.
ALTER TABLE ar_payment_allocations
  DROP INDEX IF EXISTS `ticket_uid`;

-- 4. New unique constraint on the managed column.
--    Reversed rows (NULL) are distinct — allowed to pile up.
--    Active rows (ticket_uid value) must be unique.
ALTER TABLE ar_payment_allocations
  ADD UNIQUE INDEX IF NOT EXISTS uq_apa_active_ticket_uid (active_ticket_uid);

-- ============================================================
-- MIGRATION: ar_payment_adjustments — audit trail for A/R payment amount edits
--
-- Captures every change to ar_payments.amount_received for PREPAID customers.
-- adjustment_uid generated by application code (crypto.randomUUID()).
-- No FK constraints — follows the project convention.
-- COLLATION utf8mb4_general_ci matches all legacy A/R tables.
-- ============================================================
CREATE TABLE IF NOT EXISTS ar_payment_adjustments (
  adjustment_id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  adjustment_uid       CHAR(36) NOT NULL,

  ar_payment_id        INT(10) UNSIGNED NOT NULL,
  ar_payment_uid       CHAR(36) NOT NULL,
  customer_id          INT(10) UNSIGNED NOT NULL,

  old_amount_received  DECIMAL(12,2) NOT NULL,
  new_amount_received  DECIMAL(12,2) NOT NULL,
  delta_amount         DECIMAL(12,2) NOT NULL,

  applied_amount       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  old_amount_unapplied DECIMAL(12,2) NOT NULL,
  new_amount_unapplied DECIMAL(12,2) NOT NULL,

  old_available_credit DECIMAL(12,2) NOT NULL,
  new_available_credit DECIMAL(12,2) NOT NULL,

  payment_status       VARCHAR(30) NOT NULL,
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
