-- ============================================================
-- Manual Ticket Capture Module — Migration
-- File: server/database/manual_ticket_migration.sql
-- Idempotent: safe to run multiple times
-- Collation: utf8mb4_general_ci (project convention)
--
-- Roles expected: SUPERADMIN, ADMINISTRATOR
--
-- PRE-FLIGHT: verify before running:
--   DESCRIBE number_sequences;
--   SELECT * FROM number_sequences WHERE scope IN ('TICKETS.NUMBER','SALES.RECEIPT');
--   SELECT nav_id, label, route FROM navigation_items WHERE type='tree' AND is_active=1;
-- ============================================================

-- ============================================================
-- 1. Add capture_source to sales
--    ALTER TABLE ... ADD COLUMN IF NOT EXISTS is MySQL 8.0+.
--    For MariaDB/MySQL 5.7 compat, we use the procedure below.
-- ============================================================
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'sales'
    AND COLUMN_NAME  = 'capture_source'
);

SET @sql_add_col = IF(
  @col_exists = 0,
  'ALTER TABLE sales ADD COLUMN capture_source VARCHAR(20) NOT NULL DEFAULT ''POS'' COMMENT ''POS = normal POS sale | WEB_MANUAL = created from web manual capture'' AFTER currency',
  'SELECT ''capture_source already exists, skipping'' AS info'
);

PREPARE stmt FROM @sql_add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 2. Insert permission (idempotent via INSERT IGNORE)
--    Requires permissions table to have UNIQUE on (code).
-- ============================================================
INSERT IGNORE INTO permissions (code, name, module, description)
VALUES (
  'manual_ticket.write',
  'Create Manual Ticket',
  'manual_ticket',
  'Allows creating a manual sale/ticket from the web interface'
);

-- ============================================================
-- 3. Assign permission to SUPERADMIN and ADMINISTRATOR
--    INSERT IGNORE handles the composite PK / UNIQUE constraint.
-- ============================================================
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM   roles r
CROSS JOIN permissions p
WHERE  r.code IN ('SUPERADMIN', 'ADMINISTRATOR')
  AND  r.is_active = 1
  AND  p.code = 'manual_ticket.write';

-- ============================================================
-- 4. Add navigation item for Manual Ticket
--    Only inserts if route '/sales/manual' does not exist yet.
--    parent_id: tries to find a 'tree' parent with 'sales' or
--    'operations' in its label/route; falls back to NULL (root).
--    VERIFY parent with pre-flight query above before running.
-- ============================================================
INSERT INTO navigation_items
  (parent_id, type, label, icon, route, permission_code, sort_order, is_active)
SELECT
  (
    SELECT nav_id
    FROM   navigation_items
    WHERE  type = 'tree'
      AND  is_active = 1
      AND  (
             LOWER(label) IN ('sales','operations','daily operations','transactions')
             OR route LIKE '%sales%'
           )
    ORDER BY sort_order ASC
    LIMIT 1
  ) AS parent_id,
  'link'                  AS type,
  'Manual Ticket'         AS label,
  'bi-pencil-square'      AS icon,
  '/sales/manual'         AS route,
  'manual_ticket.write'   AS permission_code,
  99                      AS sort_order,
  1                       AS is_active
WHERE NOT EXISTS (
  SELECT 1 FROM navigation_items WHERE route = '/sales/manual'
);

-- ============================================================
-- ROLLBACK SCRIPT (run manually if needed)
-- ============================================================
-- ALTER TABLE sales DROP COLUMN capture_source;
-- DELETE FROM role_permissions WHERE permission_id = (SELECT permission_id FROM permissions WHERE code = 'manual_ticket.write');
-- DELETE FROM navigation_items WHERE route = '/sales/manual';
-- DELETE FROM permissions WHERE code = 'manual_ticket.write';
