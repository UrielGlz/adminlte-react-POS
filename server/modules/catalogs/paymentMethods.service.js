import { query } from '../../config/database.js'
import { NotFoundError, ConflictError } from '../../utils/errors.js'

/**
 * Payment Methods Service
 * Catálogo de métodos de pago (Cash, Card, Business Account)
 */

export const getAll = async (includeInactive = false) => {
  let sql = `
    SELECT 
      pm.method_id,
      pm.code,
      pm.name,
      pm.is_cash,
      pm.allow_reference,
      pm.is_active,
      pm.created_at,
      pm.updated_at,
      pm.created_by_user,
      pm.edited_by_user,
      creator.username AS created_by_username,
      editor.username AS edited_by_username
    FROM payment_methods pm
    LEFT JOIN users creator ON pm.created_by_user = creator.user_id
    LEFT JOIN users editor ON pm.edited_by_user = editor.user_id
  `
  if (!includeInactive) sql += ` WHERE pm.is_active = 1`
  sql += ` ORDER BY pm.name ASC`
  
  return await query(sql)
}

export const getById = async (id) => {
  const sql = `
    SELECT 
      pm.*,
      creator.username AS created_by_username,
      editor.username AS edited_by_username
    FROM payment_methods pm
    LEFT JOIN users creator ON pm.created_by_user = creator.user_id
    LEFT JOIN users editor ON pm.edited_by_user = editor.user_id
    WHERE pm.method_id = ?
  `
  const result = await query(sql, [id])
  if (result.length === 0) throw new NotFoundError('Payment method not found')
  return result[0]
}

export const findByCode = async (code) => {
  const sql = `SELECT * FROM payment_methods WHERE code = ?`
  const result = await query(sql, [code])
  return result[0] || null
}

export const create = async (data, currentUserId = null) => {
  const { code, name, is_cash = 0, allow_reference = 1, is_active = 1 } = data
  
  if (!code || !name) {
    throw new ConflictError('Code and name are required')
  }
  
  // Verificar duplicado
  const existing = await findByCode(code)
  if (existing) {
    throw new ConflictError(`Payment method with code "${code}" already exists`)
  }
  
  const sql = `
    INSERT INTO payment_methods (code, name, is_cash, allow_reference, is_active, created_by_user)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  
  const result = await query(sql, [
    code.toLowerCase(),
    name,
    is_cash ? 1 : 0,
    allow_reference ? 1 : 0,
    is_active ? 1 : 0,
    currentUserId
  ])
  
  return await getById(result.insertId)
}

export const update = async (id, data, currentUserId = null) => {
  const existing = await query('SELECT * FROM payment_methods WHERE method_id = ?', [id])
  if (existing.length === 0) throw new NotFoundError('Payment method not found')
  
  // Si cambia code, verificar duplicado
  if (data.code && data.code.toLowerCase() !== existing[0].code) {
    const duplicate = await findByCode(data.code)
    if (duplicate) {
      throw new ConflictError(`Payment method with code "${data.code}" already exists`)
    }
  }
  
  const fields = []
  const params = []
  
  if (data.code !== undefined) {
    fields.push('code = ?')
    params.push(data.code.toLowerCase())
  }
  if (data.name !== undefined) {
    fields.push('name = ?')
    params.push(data.name)
  }
  if (data.is_cash !== undefined) {
    fields.push('is_cash = ?')
    params.push(data.is_cash ? 1 : 0)
  }
  if (data.allow_reference !== undefined) {
    fields.push('allow_reference = ?')
    params.push(data.allow_reference ? 1 : 0)
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?')
    params.push(data.is_active ? 1 : 0)
  }
  
  // Siempre actualizar edited_by_user
  fields.push('edited_by_user = ?')
  params.push(currentUserId)
  
  if (fields.length === 0) return await getById(id)
  
  params.push(id)
  const sql = `UPDATE payment_methods SET ${fields.join(', ')} WHERE method_id = ?`
  
  await query(sql, params)
  return await getById(id)
}

/**
 * Soft delete - solo cambia is_active a 0
 */
export const remove = async (id, currentUserId = null) => {
  const existing = await query('SELECT * FROM payment_methods WHERE method_id = ?', [id])
  if (existing.length === 0) throw new NotFoundError('Payment method not found')
  
  const sql = `UPDATE payment_methods SET is_active = 0, edited_by_user = ? WHERE method_id = ?`
  await query(sql, [currentUserId, id])
  return true
}

export default { getAll, getById, create, update, remove }