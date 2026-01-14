import { query } from '../../config/database.js'
import { NotFoundError, ConflictError } from '../../utils/errors.js'

// =============================================
// CONFIGURACIÓN DE PREFIJO PARA ACCOUNT NUMBER
// Cambiar aquí si piden quitar o modificar el prefijo
// =============================================
const ACCOUNT_PREFIX = 'ACC-'  // Cambiar a '' si quieren sin prefijo
const ACCOUNT_PAD_LENGTH = 1   // Cantidad de dígitos: 0001, 00001, etc.

/**
 * Genera el siguiente account_number automáticamente
 * Formato: ACC-0001, ACC-0002, etc.
 */
const generateAccountNumber = async () => {
  // Obtener el último número usado
  const result = await query(`
    SELECT account_number 
    FROM customers 
    WHERE account_number LIKE ?
    ORDER BY id_customer DESC 
    LIMIT 1
  `, [`${ACCOUNT_PREFIX}%`])

  let nextNumber = 1

  if (result.length > 0) {
    // Extraer el número del último account_number
    const lastAccount = result[0].account_number
    const numericPart = lastAccount.replace(ACCOUNT_PREFIX, '')
    const parsed = parseInt(numericPart, 10)
    if (!isNaN(parsed)) {
      nextNumber = parsed + 1
    }
  }

  // Formatear con padding: 1 -> "0001"
  const paddedNumber = String(nextNumber).padStart(ACCOUNT_PAD_LENGTH, '0')
  return `${ACCOUNT_PREFIX}${paddedNumber}`
}

export const getAll = async (includeInactive = false) => {
  let sql = `
    SELECT 
      c.*,
      cc.credit_type,
      cc.credit_limit,
      cc.current_balance,
      cc.available_credit,
      cc.is_suspended,
      creator.username AS created_by_username,
      editor.username AS edited_by_username
    FROM customers c
    LEFT JOIN customer_credit cc ON c.id_customer = cc.customer_id
    LEFT JOIN users creator ON c.created_by_user = creator.user_id
    LEFT JOIN users editor ON c.edited_by_user = editor.user_id
  `
  if (!includeInactive) sql += ` WHERE c.is_active = 1`
  sql += ` ORDER BY c.account_name ASC`
  return await query(sql)
}

export const getById = async (id) => {
  const items = await query(`
    SELECT 
      c.*,
      cc.credit_id,
      cc.credit_type,
      cc.credit_limit,
      cc.current_balance,
      cc.available_credit,
      cc.expiry_date,
      cc.is_suspended,
      cc.suspension_reason,
      cc.last_payment_date,
      cc.payment_terms_days,
      creator.username AS created_by_username,
      editor.username AS edited_by_username
    FROM customers c
    LEFT JOIN customer_credit cc ON c.id_customer = cc.customer_id
    LEFT JOIN users creator ON c.created_by_user = creator.user_id
    LEFT JOIN users editor ON c.edited_by_user = editor.user_id
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

export const create = async (data, currentUserId = null) => {
  const { 
    account_name, 
    account_address, 
    city,
    account_country, 
    account_state, 
    phone_number,
    tax_id,
    has_credit = false, 
    is_active = true, 
    credit 
  } = data

  // Generar account_number automáticamente
  const account_number = await generateAccountNumber()

  const result = await query(
    `INSERT INTO customers (account_number, account_name, account_address, city, account_country, account_state, phone_number, tax_id, has_credit, is_active, created_by_user)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [account_number, account_name, account_address || null, city || null, account_country || null, account_state || null, phone_number || null, tax_id || null, has_credit ? 1 : 0, is_active ? 1 : 0, currentUserId]
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

export const update = async (id, data, currentUserId = null) => {
  const { 
    account_name, 
    account_address, 
    city,
    account_country, 
    account_state, 
    phone_number,
    tax_id,
    has_credit, 
    is_active, 
    credit 
  } = data

  const existing = await query('SELECT * FROM customers WHERE id_customer = ?', [id])
  if (existing.length === 0) throw new NotFoundError('Customer not found')

  // account_number NO se actualiza, se mantiene el original
  await query(
    `UPDATE customers 
     SET account_name = ?, account_address = ?, city = ?, account_country = ?, account_state = ?, phone_number = ?, tax_id = ?, has_credit = ?, is_active = ?, edited_by_user = ?, updated_at = NOW()
     WHERE id_customer = ?`,
    [
      account_name, 
      account_address || null, 
      city || null, 
      account_country || null, 
      account_state || null, 
      phone_number || null, 
      tax_id || null, 
      has_credit ? 1 : 0, 
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      currentUserId,
      id
    ]
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

export const remove = async (id, currentUserId = null) => {
  const existing = await query('SELECT account_number FROM customers WHERE id_customer = ?', [id])
  if (existing.length === 0) throw new NotFoundError('Customer not found')

  const usage = await query('SELECT COUNT(*) as count FROM sale_driver_info WHERE account_number = ?', [existing[0].account_number])
  if (usage[0].count > 0) throw new ConflictError(`Cannot delete. Used in ${usage[0].count} transaction(s).`)

  await query('DELETE FROM customer_credit WHERE customer_id = ?', [id])
  await query('DELETE FROM customers WHERE id_customer = ?', [id])
  return true
}

export default { getAll, getById, create, update, remove }