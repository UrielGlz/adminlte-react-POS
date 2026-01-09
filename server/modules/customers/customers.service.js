import { query } from '../../config/database.js'
import { NotFoundError, ConflictError } from '../../utils/errors.js'

export const getAll = async (includeInactive = false) => {
  let sql = `
    SELECT c.*, cc.credit_type, cc.credit_limit, cc.current_balance, cc.available_credit, cc.is_suspended
    FROM customers c
    LEFT JOIN customer_credit cc ON c.id_customer = cc.customer_id
  `
  if (!includeInactive) sql += ` WHERE c.is_active = 1`
  sql += ` ORDER BY c.account_name ASC`
  return await query(sql)
}

export const getById = async (id) => {
  const items = await query(`
    SELECT c.*, cc.credit_id, cc.credit_type, cc.credit_limit, cc.current_balance, 
           cc.available_credit, cc.expiry_date, cc.is_suspended, cc.suspension_reason,
           cc.last_payment_date, cc.payment_terms_days
    FROM customers c
    LEFT JOIN customer_credit cc ON c.id_customer = cc.customer_id
    WHERE c.id_customer = ?
  `, [id])
  
  if (items.length === 0) throw new NotFoundError('Customer not found')

  // Contar transacciones
  const usage = await query(
    `SELECT COUNT(*) as count FROM sale_driver_info WHERE account_number = ?`,
    [items[0].account_number]
  )
  items[0].transaction_count = usage[0].count

  return items[0]
}

export const create = async (data) => {
  const { account_number, account_name, account_address, account_country, account_state, has_credit = false, is_active = true, credit } = data

  const existing = await query('SELECT id_customer FROM customers WHERE account_number = ?', [account_number])
  if (existing.length > 0) throw new ConflictError(`Account number "${account_number}" already exists`)

  const result = await query(
    `INSERT INTO customers (account_number, account_name, account_address, account_country, account_state, has_credit, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [account_number, account_name, account_address || null, account_country || null, account_state || null, has_credit ? 1 : 0, is_active ? 1 : 0]
  )

  const customerId = result.insertId

  // Crear registro de crédito si aplica
  if (has_credit && credit) {
    await query(
      `INSERT INTO customer_credit (customer_id, credit_type, credit_limit, current_balance, available_credit, payment_terms_days)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [customerId, credit.credit_type || 'POSTPAID', credit.credit_limit || 0, 0, credit.credit_limit || 0, credit.payment_terms_days || 30]
    )
  }

  return await getById(customerId)
}

export const update = async (id, data) => {
  const { account_number, account_name, account_address, account_country, account_state, has_credit, is_active, credit } = data

  const existing = await query('SELECT * FROM customers WHERE id_customer = ?', [id])
  if (existing.length === 0) throw new NotFoundError('Customer not found')

  if (account_number && account_number !== existing[0].account_number) {
    const dup = await query('SELECT id_customer FROM customers WHERE account_number = ? AND id_customer != ?', [account_number, id])
    if (dup.length > 0) throw new ConflictError(`Account number "${account_number}" already exists`)
  }

  await query(
    `UPDATE customers SET account_number = ?, account_name = ?, account_address = ?, account_country = ?, account_state = ?, has_credit = ?, is_active = ?, updated_at = NOW()
     WHERE id_customer = ?`,
    [account_number || existing[0].account_number, account_name, account_address || null, account_country || null, account_state || null, has_credit ? 1 : 0, is_active !== undefined ? (is_active ? 1 : 0) : 1, id]
  )

  // Actualizar crédito
  if (has_credit && credit) {
    const existingCredit = await query('SELECT credit_id FROM customer_credit WHERE customer_id = ?', [id])
    if (existingCredit.length > 0) {
      await query(
        `UPDATE customer_credit SET credit_type = ?, credit_limit = ?, payment_terms_days = ?, updated_at = NOW() WHERE customer_id = ?`,
        [credit.credit_type || 'POSTPAID', credit.credit_limit || 0, credit.payment_terms_days || 30, id]
      )
    } else {
      await query(
        `INSERT INTO customer_credit (customer_id, credit_type, credit_limit, available_credit, payment_terms_days) VALUES (?, ?, ?, ?, ?)`,
        [id, credit.credit_type || 'POSTPAID', credit.credit_limit || 0, credit.credit_limit || 0, credit.payment_terms_days || 30]
      )
    }
  }

  return await getById(id)
}

export const remove = async (id) => {
  const existing = await query('SELECT account_number FROM customers WHERE id_customer = ?', [id])
  if (existing.length === 0) throw new NotFoundError('Customer not found')

  const usage = await query('SELECT COUNT(*) as count FROM sale_driver_info WHERE account_number = ?', [existing[0].account_number])
  if (usage[0].count > 0) throw new ConflictError(`Cannot delete. Used in ${usage[0].count} transaction(s).`)

  await query('DELETE FROM customer_credit WHERE customer_id = ?', [id])
  await query('DELETE FROM customers WHERE id_customer = ?', [id])
  return true
}

export default { getAll, getById, create, update, remove }