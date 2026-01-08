import { query } from '../../config/database.js'
import logger from '../../utils/logger.js'

/**
 * Users Model
 * Adaptado a la estructura de tu tabla users
 */

/**
 * Obtener todos los usuarios
 */
export const findAll = async (options = {}) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    is_active = null,
    role_code = null,
    orderBy = 'user_id',
    order = 'DESC',
  } = options

  const offset = (page - 1) * limit
  const params = []

  let sql = `SELECT 
    user_id,
    username,
    full_name,
    email,
    role_code,
    is_active,
    site_id,
    last_login_at,
    created_at,
    updated_at
  FROM users WHERE 1=1`

  // Filtro de búsqueda
  if (search) {
    sql += ` AND (username LIKE ? OR full_name LIKE ? OR email LIKE ?)`
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  // Filtro de status
  if (is_active !== null) {
    sql += ` AND is_active = ?`
    params.push(is_active)
  }

  // Filtro de rol
  if (role_code) {
    sql += ` AND role_code = ?`
    params.push(role_code)
  }

  // Ordenamiento
  const validOrderBy = ['user_id', 'username', 'full_name', 'email', 'created_at']
  const validOrder = ['ASC', 'DESC']

  sql += ` ORDER BY ${validOrderBy.includes(orderBy) ? orderBy : 'user_id'} ${validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC'}`

  // Paginación
  sql += ` LIMIT ? OFFSET ?`
  params.push(limit, offset)

  logger.sql(sql, params)

  return await query(sql, params)
}

/**
 * Contar total de usuarios
 */
export const count = async (options = {}) => {
  const { search = '', is_active = null, role_code = null } = options
  const params = []

  let sql = `SELECT COUNT(*) as total FROM users WHERE 1=1`

  if (search) {
    sql += ` AND (username LIKE ? OR full_name LIKE ? OR email LIKE ?)`
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  if (is_active !== null) {
    sql += ` AND is_active = ?`
    params.push(is_active)
  }

  if (role_code) {
    sql += ` AND role_code = ?`
    params.push(role_code)
  }

  const result = await query(sql, params)
  return result[0]?.total || 0
}

/**
 * Buscar usuario por ID
 */
export const findById = async (id) => {
  const sql = `SELECT * FROM users WHERE user_id = ?`
  const result = await query(sql, [id])
  return result[0] || null
}

/**
 * Buscar usuario por email
 */
export const findByEmail = async (email) => {
  const sql = `SELECT * FROM users WHERE email = ?`
  const result = await query(sql, [email])
  return result[0] || null
}

/**
 * Buscar usuario por username
 */
export const findByUsername = async (username) => {
  const sql = `SELECT * FROM users WHERE username = ?`
  const result = await query(sql, [username])
  return result[0] || null
}

/**
 * Crear nuevo usuario
 */
export const create = async (data) => {
  const {
    username,
    full_name,
    email,
    password_hash = '',
    password_algo = 'SHA256',
    role_code = 'USER',
    is_active = 1,
    must_change_pw = 0,
    site_id = 1
  } = data

  const sql = `
    INSERT INTO users (username, full_name, email, password_hash, password_algo, role_code, is_active, must_change_pw, site_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `

  const result = await query(sql, [username, full_name, email, password_hash, password_algo, role_code, is_active, must_change_pw, site_id])

  return {
    user_id: result.insertId,
    username,
    full_name,
    email,
    role_code,
    is_active,
  }
}

/**
 * Actualizar usuario
 */
export const update = async (id, data) => {
  const fields = []
  const params = []

  if (data.username !== undefined) {
    fields.push('username = ?')
    params.push(data.username)
  }
  if (data.full_name !== undefined) {
    fields.push('full_name = ?')
    params.push(data.full_name)
  }
  if (data.email !== undefined) {
    fields.push('email = ?')
    params.push(data.email)
  }
  if (data.password_hash !== undefined) {
    fields.push('password_hash = ?')
    params.push(data.password_hash)
  }
  if (data.role_code !== undefined) {
    fields.push('role_code = ?')
    params.push(data.role_code)
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?')
    params.push(data.is_active)
  }
  if (data.site_id !== undefined) {
    fields.push('site_id = ?')
    params.push(data.site_id)
  }
  if (data.password_algo !== undefined) {
    fields.push('password_algo = ?')
    params.push(data.password_algo)
  }


  fields.push('updated_at = NOW()')
  params.push(id)

  const sql = `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`

  await query(sql, params)

  return await findById(id)
}

/**
 * Eliminar usuario
 */
export const remove = async (id) => {
  const sql = `DELETE FROM users WHERE user_id = ?`
  const result = await query(sql, [id])
  return result.affectedRows > 0
}

/**
 * Obtener estadísticas de usuarios
 */
export const getStats = async () => {
  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive,
      SUM(CASE WHEN role_code = 'ADMIN' THEN 1 ELSE 0 END) as admins
    FROM users
  `
  const result = await query(sql)
  return result[0]
}

export default {
  findAll,
  findById,
  findByEmail,
  findByUsername,
  create,
  update,
  remove,
  count,
  getStats,
}