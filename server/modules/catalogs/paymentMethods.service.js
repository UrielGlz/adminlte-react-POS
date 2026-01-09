import { query } from '../../config/database.js'
import { NotFoundError, ConflictError } from '../../utils/errors.js'

/**
 * Obtener todos los métodos de pago
 */
export const getAll = async (includeInactive = false) => {
  let sql = `
    SELECT method_id, code, name, is_cash, allow_reference, is_active, updated_at
    FROM payment_methods
  `
  
  if (!includeInactive) {
    sql += ` WHERE is_active = 1`
  }
  
  sql += ` ORDER BY name ASC`
  
  return await query(sql)
}

/**
 * Obtener por ID
 */
export const getById = async (methodId) => {
  const items = await query(
    `SELECT method_id, code, name, is_cash, allow_reference, is_active, updated_at
     FROM payment_methods 
     WHERE method_id = ?`,
    [methodId]
  )

  if (items.length === 0) {
    throw new NotFoundError('Payment method not found')
  }

  // Contar uso en payments
  const usage = await query(
    'SELECT COUNT(*) as count FROM payments WHERE method_id = ?',
    [methodId]
  )

  const item = items[0]
  item.usage_count = usage[0].count

  return item
}

/**
 * Crear nuevo método de pago
 */
export const create = async (data) => {
  const { code, name, is_cash = false, allow_reference = true, is_active = true } = data

  // Verificar código único
  const existing = await query(
    'SELECT method_id FROM payment_methods WHERE code = ?',
    [code.toLowerCase()]
  )

  if (existing.length > 0) {
    throw new ConflictError(`Payment method code "${code}" already exists`)
  }

  const result = await query(
    `INSERT INTO payment_methods (code, name, is_cash, allow_reference, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [
      code.toLowerCase(),
      name,
      is_cash ? 1 : 0,
      allow_reference ? 1 : 0,
      is_active ? 1 : 0
    ]
  )

  return await getById(result.insertId)
}

/**
 * Actualizar método de pago
 */
export const update = async (methodId, data) => {
  const { code, name, is_cash, allow_reference, is_active } = data

  // Verificar que existe
  const existing = await query(
    'SELECT method_id, code FROM payment_methods WHERE method_id = ?',
    [methodId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Payment method not found')
  }

  // Si cambia el código, verificar que no exista
  if (code && code.toLowerCase() !== existing[0].code) {
    const duplicate = await query(
      'SELECT method_id FROM payment_methods WHERE code = ? AND method_id != ?',
      [code.toLowerCase(), methodId]
    )

    if (duplicate.length > 0) {
      throw new ConflictError(`Payment method code "${code}" already exists`)
    }
  }

  await query(
    `UPDATE payment_methods 
     SET code = ?, name = ?, is_cash = ?, allow_reference = ?, is_active = ?, updated_at = NOW()
     WHERE method_id = ?`,
    [
      code ? code.toLowerCase() : existing[0].code,
      name,
      is_cash !== undefined ? (is_cash ? 1 : 0) : 0,
      allow_reference !== undefined ? (allow_reference ? 1 : 0) : 1,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      methodId
    ]
  )

  return await getById(methodId)
}

/**
 * Eliminar método de pago
 */
export const remove = async (methodId) => {
  const existing = await query(
    'SELECT method_id FROM payment_methods WHERE method_id = ?',
    [methodId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Payment method not found')
  }

  // Verificar uso
  const usage = await query(
    'SELECT COUNT(*) as count FROM payments WHERE method_id = ?',
    [methodId]
  )

  if (usage[0].count > 0) {
    throw new ConflictError(`Cannot delete. This payment method is used in ${usage[0].count} payment(s).`)
  }

  await query('DELETE FROM payment_methods WHERE method_id = ?', [methodId])

  return true
}

export default {
  getAll,
  getById,
  create,
  update,
  remove,
}