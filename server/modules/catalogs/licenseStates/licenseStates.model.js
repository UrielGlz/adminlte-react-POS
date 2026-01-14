import { query } from '../../../config/database.js'

/**
 * License States Model
 * Catálogo de estados para licencias de conductores
 */

export const findAll = async (includeInactive = false) => {
  let sql = `
    SELECT 
      ls.id_state,
      ls.country_code,
      ls.state_code,
      ls.state_name,
      ls.is_active,
      ls.created_at,
      ls.updated_at,
      ls.created_by_user,
      ls.edited_by_user,
      creator.username AS created_by_username,
      editor.username AS edited_by_username
    FROM license_states ls
    LEFT JOIN users creator ON ls.created_by_user = creator.user_id
    LEFT JOIN users editor ON ls.edited_by_user = editor.user_id
  `
  if (!includeInactive) sql += ` WHERE ls.is_active = 1`
  sql += ` ORDER BY ls.country_code ASC, ls.state_name ASC`
  
  return await query(sql)
}

export const findById = async (id) => {
  const sql = `
    SELECT 
      ls.*,
      creator.username AS created_by_username,
      editor.username AS edited_by_username
    FROM license_states ls
    LEFT JOIN users creator ON ls.created_by_user = creator.user_id
    LEFT JOIN users editor ON ls.edited_by_user = editor.user_id
    WHERE ls.id_state = ?
  `
  const result = await query(sql, [id])
  return result[0] || null
}

export const findByCode = async (countryCode, stateCode) => {
  const sql = `SELECT * FROM license_states WHERE country_code = ? AND state_code = ?`
  const result = await query(sql, [countryCode, stateCode])
  return result[0] || null
}

export const findByCountry = async (countryCode, includeInactive = false) => {
  let sql = `
    SELECT 
      ls.*,
      creator.username AS created_by_username,
      editor.username AS edited_by_username
    FROM license_states ls
    LEFT JOIN users creator ON ls.created_by_user = creator.user_id
    LEFT JOIN users editor ON ls.edited_by_user = editor.user_id
    WHERE ls.country_code = ?
  `
  if (!includeInactive) sql += ` AND ls.is_active = 1`
  sql += ` ORDER BY ls.state_name ASC`
  
  return await query(sql, [countryCode])
}

export const create = async (data) => {
  const { country_code, state_code, state_name, is_active = 1, created_by_user = null } = data
  
  const sql = `
    INSERT INTO license_states (country_code, state_code, state_name, is_active, created_by_user)
    VALUES (?, ?, ?, ?, ?)
  `
  
  const result = await query(sql, [
    country_code.toUpperCase(),
    state_code.toUpperCase(),
    state_name,
    is_active,
    created_by_user
  ])
  
  return await findById(result.insertId)
}

export const update = async (id, data) => {
  const fields = []
  const params = []
  
  if (data.country_code !== undefined) {
    fields.push('country_code = ?')
    params.push(data.country_code.toUpperCase())
  }
  if (data.state_code !== undefined) {
    fields.push('state_code = ?')
    params.push(data.state_code.toUpperCase())
  }
  if (data.state_name !== undefined) {
    fields.push('state_name = ?')
    params.push(data.state_name)
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
  const sql = `UPDATE license_states SET ${fields.join(', ')} WHERE id_state = ?`
  
  await query(sql, params)
  return await findById(id)
}

/**
 * Soft delete - solo cambia is_active a 0
 */
export const softDelete = async (id, editedByUser = null) => {
  const sql = `UPDATE license_states SET is_active = 0, edited_by_user = ? WHERE id_state = ?`
  await query(sql, [editedByUser, id])
  return true
}

export default { findAll, findById, findByCode, findByCountry, create, update, softDelete }