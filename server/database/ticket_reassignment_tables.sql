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

ALTER TABLE customer_credit_movements
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
