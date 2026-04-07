-- ============================================================
-- Weigh → Reweigh Conversion — Audit Table
-- Collation: utf8mb4_general_ci (project convention)
-- No FK constraints (follows project pattern).
-- Safe to run multiple times (idempotent).
-- ============================================================

CREATE TABLE IF NOT EXISTS sale_reweigh_conversions (
  conversion_id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  sale_uid               CHAR(36)         NOT NULL COMMENT 'Sale that was converted',
  ticket_uid             CHAR(36)         NULL,
  original_sale_id       INT(10) UNSIGNED NOT NULL COMMENT 'sale_id of the base Weigh sale',
  original_ticket_number VARCHAR(50)      NOT NULL COMMENT 'ticket_number entered by user',
  from_product_id        INT(10) UNSIGNED NOT NULL,
  to_product_id          INT(10) UNSIGNED NOT NULL,
  from_product_name      VARCHAR(120)     NULL,
  to_product_name        VARCHAR(120)     NULL,
  old_subtotal           DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  old_tax_total          DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  old_total              DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  new_subtotal           DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  new_tax_total          DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  new_total              DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  notes                  VARCHAR(500)     NULL,
  changed_by_user        INT(10) UNSIGNED NOT NULL,
  changed_at             TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversion_id),
  KEY idx_src_sale_uid         (sale_uid),
  KEY idx_src_original_sale_id (original_sale_id),
  KEY idx_src_changed_at       (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Audit trail for Weigh → Reweigh conversions performed from the web';

-- ============================================================
-- ROLLBACK (manual):
-- DROP TABLE IF EXISTS sale_reweigh_conversions;
-- ============================================================
