import { query } from '../../../config/database.js'

/**
 * Driver Products Model
 * Catálogo de productos que transportan los choferes (granos, materiales, etc.)
 */

export const findAll = async (includeInactive = false) => {
  let sql = `
    SELECT 
      dp.product_id,
      dp.code,
      dp.name,
      dp.is_active,
      dp.created_at,
      dp.updated_at,
      dp.created_by_user,
      dp.edited_by_user,
      creator.username AS created_by_username,
      editor.username AS edited_by_username
    FROM driver_products dp
    LEFT JOIN users creator ON dp.created_by_user = creator.user_id
    LEFT JOIN users editor ON dp.edited_by_user = editor.user_id
  `
  if (!includeInactive) sql += ` WHERE dp.is_active = 1`
  sql += ` ORDER BY dp.name ASC`
  
  return await query(sql)
}

export const findById = async (id) => {
  const sql = `
    SELECT 
      dp.*,
      creator.username AS created_by_username,
      editor.username AS edited_by_username
    FROM driver_products dp
    LEFT JOIN users creator ON dp.created_by_user = creator.user_id
    LEFT JOIN users editor ON dp.edited_by_user = editor.user_id
    WHERE dp.product_id = ?
  `
  const result = await query(sql, [id])
  return result[0] || null
}

export const findByCode = async (code) => {
  const sql = `SELECT * FROM driver_products WHERE code = ?`
  const result = await query(sql, [code])
  return result[0] || null
}

export const create = async (data) => {
  const { code, name, is_active = 1, created_by_user = null } = data
  
  const sql = `
    INSERT INTO driver_products (code, name, is_active, created_by_user)
    VALUES (?, ?, ?, ?)
  `
  
  const result = await query(sql, [
    code.toUpperCase(),
    name,
    is_active,
    created_by_user
  ])
  
  return await findById(result.insertId)
}

export const update = async (id, data) => {
  const fields = []
  const params = []
  
  if (data.code !== undefined) {
    fields.push('code = ?')
    params.push(data.code.toUpperCase())
  }
  if (data.name !== undefined) {
    fields.push('name = ?')
    params.push(data.name)
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?')
    params.push(data.is_active ? 1 : 0)
  }
  if (data.edited_by_user !== undefined) {
    fields.push('edited_by_user = ?')
    params.push(data.edited_by_user)
  }
  
  if (fields.length === 0) return await findById(id)
  
  params.push(id)
  const sql = `UPDATE driver_products SET ${fields.join(', ')} WHERE product_id = ?`
  
  await query(sql, params)
  return await findById(id)
}

/**
 * Soft delete - solo cambia is_active a 0
 */
export const softDelete = async (id, editedByUser = null) => {
  const sql = `UPDATE driver_products SET is_active = 0, edited_by_user = ? WHERE product_id = ?`
  await query(sql, [editedByUser, id])
  return true
}

export default { findAll, findById, findByCode, create, update, softDelete }