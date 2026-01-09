import { query } from '../../config/database.js'
import { NotFoundError, ConflictError } from '../../utils/errors.js'

export const getAll = async (includeInactive = false) => {
  let sql = `SELECT vehicle_type_id, code, name, is_active, updated_at FROM vehicle_types`
  if (!includeInactive) sql += ` WHERE is_active = 1`
  sql += ` ORDER BY name ASC`
  return await query(sql)
}

export const getById = async (id) => {
  const items = await query('SELECT * FROM vehicle_types WHERE vehicle_type_id = ?', [id])
  if (items.length === 0) throw new NotFoundError('Vehicle type not found')
  
  const usage = await query('SELECT COUNT(*) as count FROM sale_driver_info WHERE vehicle_type_id = ?', [id])
  items[0].usage_count = usage[0].count
  return items[0]
}

export const create = async (data) => {
  const { code, name, is_active = true } = data
  
  const existing = await query('SELECT vehicle_type_id FROM vehicle_types WHERE code = ?', [code.toUpperCase()])
  if (existing.length > 0) throw new ConflictError(`Code "${code}" already exists`)

  const result = await query(
    'INSERT INTO vehicle_types (code, name, is_active) VALUES (?, ?, ?)',
    [code.toUpperCase(), name, is_active ? 1 : 0]
  )
  return await getById(result.insertId)
}

export const update = async (id, data) => {
  const { code, name, is_active } = data
  
  const existing = await query('SELECT * FROM vehicle_types WHERE vehicle_type_id = ?', [id])
  if (existing.length === 0) throw new NotFoundError('Vehicle type not found')

  if (code && code.toUpperCase() !== existing[0].code) {
    const dup = await query('SELECT vehicle_type_id FROM vehicle_types WHERE code = ? AND vehicle_type_id != ?', [code.toUpperCase(), id])
    if (dup.length > 0) throw new ConflictError(`Code "${code}" already exists`)
  }

  await query(
    'UPDATE vehicle_types SET code = ?, name = ?, is_active = ?, updated_at = NOW() WHERE vehicle_type_id = ?',
    [code ? code.toUpperCase() : existing[0].code, name, is_active !== undefined ? (is_active ? 1 : 0) : 1, id]
  )
  return await getById(id)
}

export const remove = async (id) => {
  const existing = await query('SELECT vehicle_type_id FROM vehicle_types WHERE vehicle_type_id = ?', [id])
  if (existing.length === 0) throw new NotFoundError('Vehicle type not found')

  const usage = await query('SELECT COUNT(*) as count FROM sale_driver_info WHERE vehicle_type_id = ?', [id])
  if (usage[0].count > 0) throw new ConflictError(`Cannot delete. Used in ${usage[0].count} transaction(s).`)

  await query('DELETE FROM vehicle_types WHERE vehicle_type_id = ?', [id])
  return true
}

export default { getAll, getById, create, update, remove }