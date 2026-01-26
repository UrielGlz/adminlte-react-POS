import { query } from '../../config/database.js'

/**
 * A/R Model - Database queries
 * Relation: sales → sale_driver_info.account_number → customers.account_number
 */

/**
 * Get customers with credit (for dropdown)
 */
export const getCustomersWithCredit = async () => {
  const sql = `
    SELECT 
      c.id_customer,
      c.account_number,
      c.account_name,
      cc.credit_type,
      cc.credit_limit,
      cc.current_balance,
      cc.available_credit,
      cc.is_suspended,
      cc.suspension_reason
    FROM customers c
    INNER JOIN customer_credit cc ON c.id_customer = cc.customer_id
    WHERE c.is_active = 1
    ORDER BY c.account_name
  `
  return await query(sql)
}

/**
 * Get customer summary for A/R
 */
export const getCustomerSummary = async (customerId) => {
  const sql = `
    SELECT 
      c.id_customer,
      c.account_number,
      c.account_name,
      
      c.phone_number,
     
      cc.credit_type,
      cc.credit_limit,
      cc.current_balance,
      cc.available_credit,
      cc.is_suspended,
      cc.suspension_reason,
      cc.last_payment_date,
      cc.payment_terms_days,
      cc.expiry_date
    FROM customers c
    INNER JOIN customer_credit cc ON c.id_customer = cc.customer_id
    WHERE c.id_customer = ?
  `
  const rows = await query(sql, [customerId])
  return rows.length > 0 ? rows[0] : null
}

/**
 * Get last A/R payment for customer
 */
export const getLastPayment = async (customerId) => {
  const sql = `
    SELECT 
      ap.ar_payment_id,
      ap.payment_date,
      ap.amount_received,
      ap.reference_number,
      pm.name AS payment_method
    FROM ar_payments ap
    INNER JOIN payment_methods pm ON ap.method_id = pm.method_id
    WHERE ap.customer_id = ?
      AND ap.status != 'VOIDED'
    ORDER BY ap.payment_date DESC, ap.created_at DESC
    LIMIT 1
  `
  const rows = await query(sql, [customerId])
  return rows.length > 0 ? rows[0] : null
}

/**
 * Get pending transactions for customer
 */
export const getPendingTransactions = async (customerId) => {
  const sql = `
    SELECT 
      s.sale_uid,
      s.sale_id,
      p.payment_uid,
      t.ticket_uid,
      t.ticket_number,
      COALESCE(t.printed_at, s.created_at) AS transaction_date,
      p.amount AS original_amount,
      p.amount_applied,
      (p.amount - p.amount_applied) AS pending_amount,
      DATEDIFF(CURRENT_DATE, DATE(COALESCE(t.printed_at, s.created_at))) AS days_outstanding,
      CASE 
        WHEN DATEDIFF(CURRENT_DATE, DATE(COALESCE(t.printed_at, s.created_at))) <= 30 THEN 'CURRENT'
        WHEN DATEDIFF(CURRENT_DATE, DATE(COALESCE(t.printed_at, s.created_at))) <= 60 THEN '31-60'
        WHEN DATEDIFF(CURRENT_DATE, DATE(COALESCE(t.printed_at, s.created_at))) <= 90 THEN '61-90'
        ELSE '90+'
      END AS aging_bucket
    FROM payments p
    INNER JOIN sales s ON p.sale_uid = s.sale_uid
    INNER JOIN sale_driver_info sdi ON s.sale_uid = sdi.sale_uid
    INNER JOIN customers c ON sdi.account_number = c.account_number
    LEFT JOIN tickets t ON s.sale_uid = t.sale_uid
    WHERE c.id_customer = ?
      AND p.method_id = 3
      AND p.payment_status_id = 5
      AND (p.amount - p.amount_applied) > 0
    ORDER BY COALESCE(t.printed_at, s.created_at) ASC
  `
  return await query(sql, [customerId])
}

/**
 * Get payment methods for A/R
 */
export const getPaymentMethods = async () => {
  const sql = `
    SELECT method_id, code, name, is_cash, allow_reference
    FROM payment_methods
    WHERE is_active = 1
      AND (is_pos_enabled = 0 OR code IN ('cash', 'card'))
    ORDER BY 
      CASE code 
        WHEN 'cash' THEN 1 
        WHEN 'check' THEN 2 
        WHEN 'card' THEN 3
        WHEN 'wire' THEN 4
        WHEN 'ach' THEN 5
        ELSE 6 
      END
  `
  return await query(sql)
}

/**
 * Get A/R payment history for customer
 */
export const getPaymentHistory = async (customerId, limit = 50) => {
  const sql = `
    SELECT 
      ap.ar_payment_id,
      ap.ar_payment_uid,
      ap.payment_date,
      ap.amount_received,
      ap.amount_applied,
      ap.amount_unapplied,
      ap.apply_method,
      ap.status,
      ap.reference_number,
      ap.notes,
      ap.created_at,
      pm.name AS payment_method,
      u.full_name AS created_by
    FROM ar_payments ap
    INNER JOIN payment_methods pm ON ap.method_id = pm.method_id
    LEFT JOIN users u ON ap.created_by_user = u.user_id
    WHERE ap.customer_id = ?
    ORDER BY ap.payment_date DESC, ap.created_at DESC
    LIMIT ?
  `
  return await query(sql, [customerId, limit])
}

/**
 * Get A/R payment detail with allocations
 */
export const getPaymentDetail = async (arPaymentId) => {
  const headerSql = `
    SELECT 
      ap.*,
      pm.name AS payment_method,
      c.account_number,
      c.account_name,
      u.full_name AS created_by
    FROM ar_payments ap
    INNER JOIN payment_methods pm ON ap.method_id = pm.method_id
    INNER JOIN customers c ON ap.customer_id = c.id_customer
    LEFT JOIN users u ON ap.created_by_user = u.user_id
    WHERE ap.ar_payment_id = ?
  `
  
  const allocationsSql = `
    SELECT 
      apa.allocation_id,
      apa.sale_uid,
      apa.payment_uid,
      apa.ticket_number,
      apa.amount_applied,
      apa.created_at
    FROM ar_payment_allocations apa
    WHERE apa.ar_payment_id = ?
    ORDER BY apa.created_at
  `
  
  const header = await query(headerSql, [arPaymentId])
  const allocations = await query(allocationsSql, [arPaymentId])
  
  if (header.length === 0) return null
  
  return {
    ...header[0],
    allocations
  }
}

/**
 * Check if customer is suspended
 */
export const isCustomerSuspended = async (customerId) => {
  const sql = `
    SELECT is_suspended, suspension_reason
    FROM customer_credit
    WHERE customer_id = ?
  `
  const rows = await query(sql, [customerId])
  if (rows.length === 0) return { suspended: false }
  
  return {
    suspended: rows[0].is_suspended === 1,
    reason: rows[0].suspension_reason
  }
}

export default {
  getCustomersWithCredit,
  getCustomerSummary,
  getLastPayment,
  getPendingTransactions,
  getPaymentMethods,
  getPaymentHistory,
  getPaymentDetail,
  isCustomerSuspended
}