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
      CASE 
        WHEN ap.status = 'CREDIT_BALANCE' THEN 'Credit Balance'
        WHEN ap.status = 'APPLIED' THEN 'Applied'
        WHEN ap.status = 'PARTIAL' THEN 'Partial'
        WHEN ap.status = 'VOIDED' THEN 'Void'
        ELSE ap.status
      END AS status_label,
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
      u.full_name AS created_by,
      cc.credit_type
    FROM ar_payments ap
    INNER JOIN payment_methods pm ON ap.method_id = pm.method_id
    INNER JOIN customers c ON ap.customer_id = c.id_customer
    INNER JOIN customer_credit cc ON c.id_customer = cc.customer_id
    LEFT JOIN users u ON ap.created_by_user = u.user_id
    WHERE ap.ar_payment_id = ?
  `

  const realAppliedSql = `
    SELECT COALESCE(SUM(amount_applied), 0) AS real_applied_amount
    FROM ar_payment_allocations
    WHERE ar_payment_id = ? AND reversed_at IS NULL
  `

  const adjustmentsSql = `
    SELECT
      adj.adjustment_id,
      adj.adjustment_uid,
      adj.old_amount_received,
      adj.new_amount_received,
      adj.delta_amount,
      adj.applied_amount,
      adj.old_amount_unapplied,
      adj.new_amount_unapplied,
      adj.old_available_credit,
      adj.new_available_credit,
      adj.payment_status,
      adj.reason,
      adj.notes,
      adj.adjusted_by_user,
      u.full_name AS adjusted_by_name,
      adj.adjusted_at
    FROM ar_payment_adjustments adj
    LEFT JOIN users u ON adj.adjusted_by_user = u.user_id
    WHERE adj.ar_payment_id = ?
    ORDER BY adj.adjusted_at DESC
  `

  const allocationsSql = `
    SELECT
      apa.allocation_id,
      apa.sale_uid,
      apa.payment_uid,
      apa.ticket_number,
      apa.amount_applied,
      apa.created_at,
      apa.reversed_at,
      apa.reversal_note,
      CASE WHEN apa.reversed_at IS NOT NULL THEN 1 ELSE 0 END AS is_reversed,
      t.printed_at
      ,(SELECT full_name FROM sales s JOIN users u ON s.operator_id = u.user_id WHERE s.sale_uid = apa.sale_uid) AS operator_user
      ,CONCAT(sdf.driver_first_name,' ', sdf.driver_last_name) AS driver_name

    FROM ar_payment_allocations apa
    JOIN tickets t ON apa.ticket_uid = t.ticket_uid
    JOIN sale_driver_info sdf ON apa.sale_uid = sdf.sale_uid

    WHERE apa.ar_payment_id = ?
    ORDER BY apa.created_at
  `

  const [header, allAllocations, realApplied, adjustments] = await Promise.all([
    query(headerSql, [arPaymentId]),
    query(allocationsSql, [arPaymentId]),
    query(realAppliedSql, [arPaymentId]),
    query(adjustmentsSql, [arPaymentId])
  ])

  if (header.length === 0) return null

  const h = header[0]
  const realAppliedAmount = parseFloat(realApplied[0].real_applied_amount)

  return {
    ...h,
    real_applied_amount: realAppliedAmount,
    is_editable: h.credit_type === 'PREPAID' && h.status !== 'VOIDED' && h.voided_at == null,
    adjustments,
    allocations:          allAllocations.filter(a => !a.is_reversed),
    reversed_allocations: allAllocations.filter(a =>  a.is_reversed)
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

/**
 * Get ALL A/R payment history with filters and pagination
 * NOTE: Filtering by created_at (registration date) instead of payment_date
 * This is intentional per business requirement - users want to filter by when
 * the payment was recorded in the system, not the payment date on the check/receipt
 */
export const getAllPaymentHistory = async (filters = {}) => {
  const {
    customer_id,
    status,
    date_from,
    date_to,
    page = 1,
    limit = 25
  } = filters

  const offset = (page - 1) * limit
  const params = []
  const conditions = []

  // Build WHERE conditions
  if (customer_id) {
    conditions.push('ap.customer_id = ?')
    params.push(customer_id)
  }

  if (status) {
    conditions.push('ap.status = ?')
    params.push(status)
  }

  if (date_from) {
    conditions.push('DATE(ap.created_at) >= ?')
    params.push(date_from)
  }

  if (date_to) {
    conditions.push('DATE(ap.created_at) <= ?')
    params.push(date_to)
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : ''

  // Count total records
  const countSql = `
    SELECT COUNT(*) AS total
    FROM ar_payments ap
    ${whereClause}
  `
  const countResult = await query(countSql, params)
  const total = countResult[0]?.total || 0

  // Get paginated data
  const dataSql = `
    SELECT 
      ap.ar_payment_id,
      ap.ar_payment_uid,
      ap.payment_date,
      ap.amount_received,
      ap.amount_applied,
      ap.amount_unapplied,
      ap.apply_method,
      ap.status,
      CASE 
        WHEN ap.status = 'CREDIT_BALANCE' THEN 'Credit Balance'
        WHEN ap.status = 'APPLIED' THEN 'Applied'
        WHEN ap.status = 'PARTIAL' THEN 'Partial'
        WHEN ap.status = 'VOIDED' THEN 'Void'
        ELSE ap.status
      END AS status_label,
      ap.reference_number,
      ap.notes,
      ap.created_at,
      pm.name AS payment_method,
      c.id_customer,
      c.account_number,
      c.account_name,
      u.full_name AS created_by
    FROM ar_payments ap
    INNER JOIN payment_methods pm ON ap.method_id = pm.method_id
    INNER JOIN customers c ON ap.customer_id = c.id_customer
    LEFT JOIN users u ON ap.created_by_user = u.user_id
    ${whereClause}
    ORDER BY ap.created_at DESC
    LIMIT ? OFFSET ?
  `

  const data = await query(dataSql, [...params, parseInt(limit), parseInt(offset)])

  return {
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
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
  isCustomerSuspended,
  getAllPaymentHistory
}