import { query } from '../../config/database.js'
import { NotFoundError, ConflictError } from '../../utils/errors.js'

export const getAll = async (filters = {}) => {
  const { date_from, date_to, status_id, is_reweigh } = filters

  let sql = `
    SELECT s.sale_id, s.sale_uid, s.receipt_number, s.sale_status_id, s.subtotal, s.discount_total,
           s.tax_total, s.total, s.amount_paid, s.balance_due, s.currency, s.is_reweigh,
           s.occurred_at, s.created_at, s.reweigh_of_sale_id,
           st.code as status_code, st.label as status_label,
           u.full_name as operator_name,
           d.account_name, d.driver_first_name, d.driver_last_name, d.vehicle_plates
    FROM sales s
    LEFT JOIN status_catalogo st ON s.sale_status_id = st.status_id
    LEFT JOIN users u ON s.operator_id = u.user_id
    LEFT JOIN sale_driver_info d ON s.sale_uid = d.sale_uid
    WHERE 1=1
  `
  const params = []

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
    sql += ` AND s.is_reweigh = ?`
    params.push(is_reweigh ? 1 : 0)
  }

  sql += ` ORDER BY s.created_at DESC LIMIT 500`

  return await query(sql, params)
}

export const getById = async (id) => {
  const sales = await query(`
    SELECT s.*, st.code as status_code, st.label as status_label, u.full_name as operator_name
    FROM sales s
    LEFT JOIN status_catalogo st ON s.sale_status_id = st.status_id
    LEFT JOIN users u ON s.operator_id = u.user_id
    WHERE s.sale_id = ?
  `, [id])

  if (sales.length === 0) throw new NotFoundError('Sale not found')

  const sale = sales[0]

  // Get driver info
  const driverInfo = await query('SELECT * FROM sale_driver_info WHERE sale_uid = ?', [sale.sale_uid])
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

export const cancelSale = async (saleId, reasonId) => {
  const sale = await query('SELECT sale_id, sale_status_id FROM sales WHERE sale_id = ?', [saleId])
  if (sale.length === 0) throw new NotFoundError('Sale not found')

  // Status 3 = CANCELLED (from your status_catalogo)
  const cancelledStatusId = 3

  if (sale[0].sale_status_id === cancelledStatusId) {
    throw new ConflictError('Sale is already cancelled')
  }

  await query('UPDATE sales SET sale_status_id = ?, updated_at = NOW() WHERE sale_id = ?', [cancelledStatusId, saleId])

  return await getById(saleId)
}

export const getSummary = async (dateFrom, dateTo) => {
  const params = []
  let dateFilter = ''

  if (dateFrom) {
    dateFilter += ' AND DATE(s.created_at) >= ?'
    params.push(dateFrom)
  }
  if (dateTo) {
    dateFilter += ' AND DATE(s.created_at) <= ?'
    params.push(dateTo)
  }

  const summary = await query(`
    SELECT 
      COUNT(*) as total_transactions,
      SUM(CASE WHEN s.sale_status_id != 3 THEN s.total ELSE 0 END) as total_sales,
      SUM(CASE WHEN s.is_reweigh = 1 AND s.sale_status_id != 3 THEN 1 ELSE 0 END) as total_reweighs,
      SUM(CASE WHEN s.sale_status_id = 3 THEN 1 ELSE 0 END) as total_cancelled
    FROM sales s
    WHERE 1=1 ${dateFilter}
  `, params)

  return summary[0]
}

export default { getAll, getById, updatePaymentMethod, cancelSale, getSummary }