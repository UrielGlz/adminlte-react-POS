import { query, transaction } from '../../config/database.js'
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/errors.js'

export const getAll = async (filters = {}) => {
  const { date_from, date_to, status_id, is_reweigh, ticket_number } = filters
  //TODO UG s.capture_source, descomentar esto, cuando migremos a creacion de ticket manual
  let sql = `
    SELECT s.sale_id, s.sale_uid, s.receipt_number, s.sale_status_id, s.subtotal, s.discount_total,
           s.tax_total, s.total, s.amount_paid, s.balance_due, s.currency, 
           CASE WHEN s.reweigh_of_sale_id IS NOT NULL THEN 1 ELSE 0 END as is_reweigh,
           s.occurred_at, s.created_at, s.reweigh_of_sale_id,
           t.ticket_number,
           st.code as status_code, st.label as status_label,
           u.full_name as operator_name,
           d.account_name, d.driver_first_name, d.driver_last_name, d.vehicle_plates
    FROM sales s
    LEFT JOIN tickets t ON s.sale_uid = t.sale_uid
    LEFT JOIN status_catalogo st ON s.sale_status_id = st.status_id
    LEFT JOIN users u ON s.operator_id = u.user_id
    LEFT JOIN sale_driver_info d ON s.sale_uid = d.sale_uid
    WHERE 1=1
  `
  const params = []

  const trimmedTicket = ticket_number ? String(ticket_number).trim() : ''

  if (trimmedTicket) {
    // Ticket search is priority — skip date and other filters
    sql += ` AND t.ticket_number LIKE ?`
    params.push(`%${trimmedTicket}%`)
  } else {
    if (date_from) {
      sql += ` AND DATE(s.created_at) >= ?`
      params.push(date_from)
    }
    if (date_to) {
      sql += ` AND DATE(s.created_at) <= ?`
      params.push(date_to)
    }
    if (status_id) {
      sql += ` AND s.sale_status_id = ?`
      params.push(status_id)
    }
    if (is_reweigh !== undefined) {
      if (String(is_reweigh) === '1') {
        sql += ` AND s.reweigh_of_sale_id IS NOT NULL`
      } else {
        sql += ` AND s.reweigh_of_sale_id IS NULL`
      }
    }
  }

  sql += ` ORDER BY s.created_at DESC LIMIT 500`

  return await query(sql, params)
}

export const getById = async (id) => {
  const sales = await query(`
    SELECT s.*, st.code as status_code, st.label as status_label, u.full_name as operator_name,
           vr.code as void_reason_code, vr.label as void_reason_label
    FROM sales s
    LEFT JOIN status_catalogo st ON s.sale_status_id = st.status_id
    LEFT JOIN users u ON s.operator_id = u.user_id
    LEFT JOIN void_reasons vr ON s.void_reason_id = vr.void_reason_id
    WHERE s.sale_id = ?
  `, [id])

  if (sales.length === 0) throw new NotFoundError('Sale not found')

  const sale = sales[0]

  // Get driver info
  const driverInfo = await query(`
    SELECT sdi.*, dp.name as product_description
    FROM sale_driver_info sdi
    LEFT JOIN driver_products dp ON sdi.driver_product_id = dp.product_id
    WHERE sdi.sale_uid = ?
  `, [sale.sale_uid])
  sale.driver_info = driverInfo[0] || null

  // Get lines
  const lines = await query(`
    SELECT sl.*, p.name as product_name
    FROM sale_lines sl
    LEFT JOIN products p ON sl.product_id = p.product_id
    WHERE sl.sale_uid = ?
    ORDER BY sl.seq
  `, [sale.sale_uid])
  sale.lines = lines

  // Get payments
  const payments = await query(`
    SELECT pay.*, pm.name as method_name, ps.label as status_label
    FROM payments pay
    LEFT JOIN payment_methods pm ON pay.method_id = pm.method_id
    LEFT JOIN status_catalogo ps ON pay.payment_status_id = ps.status_id
    WHERE pay.sale_uid = ?
  `, [sale.sale_uid])
  sale.payments = payments

  // Get tickets
  const tickets = await query(`
    SELECT t.*, ts.label as status_label
    FROM tickets t
    LEFT JOIN status_catalogo ts ON t.ticket_status_id = ts.status_id
    WHERE t.sale_uid = ?
  `, [sale.sale_uid])
  sale.tickets = tickets

  // Exponer ticket_number al nivel raíz para acceso directo
  sale.ticket_number = (tickets.length > 0) ? tickets[0].ticket_number : null

  // If reweigh, get original sale info
  if (sale.reweigh_of_sale_id) {
    const original = await query('SELECT sale_id, sale_uid, receipt_number, total, created_at FROM sales WHERE sale_id = ?', [sale.reweigh_of_sale_id])
    sale.original_sale = original[0] || null
  }

  return sale
}

export const updatePaymentMethod = async (saleId, newMethodId) => {
  const sale = await query('SELECT sale_uid FROM sales WHERE sale_id = ?', [saleId])
  if (sale.length === 0) throw new NotFoundError('Sale not found')

  await query('UPDATE payments SET method_id = ?, updated_at = NOW() WHERE sale_uid = ?', [newMethodId, sale[0].sale_uid])
  
  return await getById(saleId)
}

export const getVoidReasons = async () => {
  return await query(
    `SELECT void_reason_id, code, label
     FROM void_reasons
     WHERE is_active = 1
     ORDER BY sort_order, label`
  )
}

export const cancelSale = async (saleId, reasonId, voidReasonNote, userId) => {
  // --- Validations (read-only, outside transaction) ---
  if (!reasonId) throw new BadRequestError('void_reason_id is required')

  const reason = await query(
    'SELECT void_reason_id, code FROM void_reasons WHERE void_reason_id = ? AND is_active = 1',
    [reasonId]
  )
  if (reason.length === 0) throw new BadRequestError('Invalid or inactive void reason')

  const isOther = reason[0].code === 'OTHER'
  let noteToSave = null
  if (isOther) {
    const trimmed = voidReasonNote ? String(voidReasonNote).trim() : ''
    if (!trimmed) throw new BadRequestError('A note is required when reason is Other')
    if (trimmed.length > 500) throw new BadRequestError('Void note must be 500 characters or less')
    noteToSave = trimmed
  }

  const sale = await query('SELECT sale_id, sale_uid, sale_status_id FROM sales WHERE sale_id = ?', [saleId])
  if (sale.length === 0) throw new NotFoundError('Sale not found')

  // Resolve CANCELLED status from catalog — no hardcoded ID
  const cancelledStatus = await query(
    `SELECT status_id FROM status_catalogo WHERE module = 'SALES' AND code = 'VOID' AND is_active = 1 LIMIT 1`
  )
  if (cancelledStatus.length === 0) throw new BadRequestError('SALES/VOID status not found in catalog')
  const cancelledStatusId = cancelledStatus[0].status_id

  if (sale[0].sale_status_id === cancelledStatusId) {
    throw new ConflictError('Sale is already cancelled')
  }

  // Resolve VOIDED payment status from catalog — no hardcoded ID
  const voidedStatus = await query(
    `SELECT status_id FROM status_catalogo WHERE module = 'PAYMENTS' AND code = 'VOIDED' AND is_active = 1 LIMIT 1`
  )
  if (voidedStatus.length === 0) throw new BadRequestError('PAYMENTS/VOIDED status not found in catalog')
  const voidedStatusId = voidedStatus[0].status_id

  // --- Atomic writes ---
  await transaction(async (conn) => {
    await conn.query(
      `UPDATE sales SET sale_status_id = ?, void_reason_id = ?, void_reason_note = ?, voided_at = NOW(), voided_by_user = ?, updated_at = NOW() WHERE sale_id = ?`,
      [cancelledStatusId, reasonId, noteToSave, userId, saleId]
    )
    await conn.query(
      `UPDATE payments SET payment_status_id = ?, amount_applied = 0.00, updated_at = NOW() WHERE sale_uid = ?`,
      [voidedStatusId, sale[0].sale_uid]
    )
  })

  return await getById(saleId)
}

export const getSummary = async (dateFrom, dateTo, ticketNumber) => {
  const params = []
  let extraFilter = ''
  const trimmedTicket = ticketNumber ? String(ticketNumber).trim() : ''

  if (trimmedTicket) {
    // Ticket search — no date filter, join tickets table
    extraFilter = ' AND t.ticket_number LIKE ?'
    params.push(`%${trimmedTicket}%`)
  } else {
    if (dateFrom) {
      extraFilter += ' AND DATE(s.created_at) >= ?'
      params.push(dateFrom)
    }
    if (dateTo) {
      extraFilter += ' AND DATE(s.created_at) <= ?'
      params.push(dateTo)
    }
  }

  const summary = await query(`
    SELECT
      COUNT(*) as total_transactions,
      SUM(CASE WHEN s.sale_status_id != 3 THEN s.total ELSE 0 END) as total_sales,
      SUM(CASE WHEN s.is_reweigh = 1 AND s.sale_status_id != 3 THEN 1 ELSE 0 END) as total_reweighs,
      SUM(CASE WHEN s.sale_status_id = 3 THEN 1 ELSE 0 END) as total_cancelled
    FROM sales s
    ${trimmedTicket ? 'LEFT JOIN tickets t ON s.sale_uid = t.sale_uid' : ''}
    WHERE 1=1 ${extraFilter}
  `, params)

  return summary[0]
}

export default { getAll, getById, updatePaymentMethod, cancelSale, getSummary, getVoidReasons }