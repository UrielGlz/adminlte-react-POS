import { query } from '../../config/database.js'
import { NotFoundError, ConflictError } from '../../utils/errors.js'

/**
 * Vehicle Types Service
 * Catálogo de tipos de vehículo (Tractor, Torton, Pickup, etc.)
 */

/**
 * Genera el código automáticamente desde el nombre
 * "Truck 3.5t" → "TRUCK35T"
 * "Tractor" → "TRACTOR"
 */
const generateCode = (name) => {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') // Quitar todo excepto letras y números
    .substring(0, 50) // Limitar a 50 caracteres
}

export const getAll = async (includeInactive = false) => {
  let sql = `
    SELECT 
      vt.vehicle_type_id,
      vt.code,
      vt.name,
      vt.is_active,
      vt.created_at,
      vt.updated_at,
      vt.created_by_user,
      vt.edited_by_user,
      creator.username AS created_by_username,
      editor.username AS edited_by_username
    FROM vehicle_types vt
    LEFT JOIN users creator ON vt.created_by_user = creator.user_id
    LEFT JOIN users editor ON vt.edited_by_user = editor.user_id
  `
  if (!includeInactive) sql += ` WHERE vt.is_active = 1`
  sql += ` ORDER BY vt.name ASC`
  
  return await query(sql)
}

export const getById = async (id) => {
  const sql = `
    SELECT 
      vt.*,
      creator.username AS created_by_username,
      editor.username AS edited_by_username
    FROM vehicle_types vt
    LEFT JOIN users creator ON vt.created_by_user = creator.user_id
    LEFT JOIN users editor ON vt.edited_by_user = editor.user_id
    WHERE vt.vehicle_type_id = ?
  `
  const result = await query(sql, [id])
  if (result.length === 0) throw new NotFoundError('Vehicle type not found')
  return result[0]
}

export const findByCode = async (code) => {
  const sql = `SELECT * FROM vehicle_types WHERE code = ?`
  const result = await query(sql, [code])
  return result[0] || null
}

export const create = async (data, currentUserId = null) => {
  const { name, is_active = 1 } = data
  
  if (!name) {
    throw new ConflictError('Name is required')
  }
  
  // Generar código automáticamente
  const code = generateCode(name)
  
  // Verificar duplicado
  const existing = await findByCode(code)
  if (existing) {
    throw new ConflictError(`Vehicle type with code "${code}" already exists`)
  }
  
  const sql = `
    INSERT INTO vehicle_types (code, name, is_active, created_by_user)
    VALUES (?, ?, ?, ?)
  `
  
  const result = await query(sql, [code, name, is_active ? 1 : 0, currentUserId])
  
  return await getById(result.insertId)
}

export const update = async (id, data, currentUserId = null) => {
  const existing = await query('SELECT * FROM vehicle_types WHERE vehicle_type_id = ?', [id])
  if (existing.length === 0) throw new NotFoundError('Vehicle type not found')
  
  const fields = []
  const params = []
  
  // Si cambia name, regenerar code
  if (data.name !== undefined) {
    const newCode = generateCode(data.name)
    
    // Verificar duplicado solo si el código cambia
    if (newCode !== existing[0].code) {
      const duplicate = await findByCode(newCode)
      if (duplicate) {
        throw new ConflictError(`Vehicle type with code "${newCode}" already exists`)
      }
      fields.push('code = ?')
      params.push(newCode)
    }
    
    fields.push('name = ?')
    params.push(data.name)
  }
  
  if (data.is_active !== undefined) {
    fields.push('is_active = ?')
    params.push(data.is_active ? 1 : 0)
  }
  
  // Siempre actualizar edited_by_user
  fields.push('edited_by_user = ?')
  params.push(currentUserId)
  
  if (fields.length === 1) return await getById(id) // Solo edited_by_user, no hay cambios reales
  
  params.push(id)
  const sql = `UPDATE vehicle_types SET ${fields.join(', ')} WHERE vehicle_type_id = ?`
  
  await query(sql, params)
  return await getById(id)
}

/**
 * Soft delete - solo cambia is_active a 0
 */
export const remove = async (id, currentUserId = null) => {
  const existing = await query('SELECT * FROM vehicle_types WHERE vehicle_type_id = ?', [id])
  if (existing.length === 0) throw new NotFoundError('Vehicle type not found')
  
  const sql = `UPDATE vehicle_types SET is_active = 0, edited_by_user = ? WHERE vehicle_type_id = ?`
  await query(sql, [currentUserId, id])
  return true
}

export default { getAll, getById, create, update, remove }