import crypto from 'crypto'
import bcrypt from 'bcryptjs'

import jwt from 'jsonwebtoken'
import { query } from '../../config/database.js'
import config from '../../config/index.js'
import { UnauthorizedError, NotFoundError } from '../../utils/errors.js'

/**
 * Genera hash SHA256 de un string
 */
const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex')

/**
 * Valida password según el algoritmo almacenado
 */
const verifyPassword = async (inputPassword, storedHash, algorithm) => {
  if (algorithm === 'bcrypt') {
    return await bcrypt.compare(inputPassword, storedHash)
  } else if (algorithm === 'sha256') {
    return sha256(inputPassword) === storedHash
  }
  return false
}

/**
 * Genera access token JWT
 */
const generateAccessToken = (user, permissions) => {
  return jwt.sign(
    {
      userId: user.user_id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      role: user.role_code,
      siteId: user.site_id,
      permissions: permissions,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn }
  )
}

/**
 * Genera refresh token (random string)
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex')
}

/**
 * Login de usuario
 */
export const login = async (username, password, ipAddress, userAgent) => {
  // 1. Buscar usuario
  const users = await query(
    `SELECT user_id, username, full_name, email, password_hash, password_algo, 
            role_code, is_active, must_change_pw, site_id 
     FROM users 
     WHERE username = ? OR email = ?`,
    [username, username]
  )

  if (users.length === 0) {
    throw new UnauthorizedError('Credenciales inválidas')
  }

  const user = users[0]

  // 2. Verificar que está activo
  if (!user.is_active) {
    throw new UnauthorizedError('Usuario desactivado')
  }

  // 3. Verificar password
  const validPassword = await verifyPassword(password, user.password_hash, user.password_algo)
  
  if (!validPassword) {
    throw new UnauthorizedError('Credenciales inválidas')
  }

  // 4. Obtener permisos del rol
  const permissions = await query(
    `SELECT p.code 
     FROM permissions p
     INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
     INNER JOIN roles r ON rp.role_id = r.role_id
     WHERE r.code = ?`,
    [user.role_code]
  )

  const permissionCodes = permissions.map(p => p.code)

  // 5. Generar tokens
  const accessToken = generateAccessToken(user, permissionCodes)
  const refreshToken = generateRefreshToken()

  // 6. Guardar refresh token en BD
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInMs)
  
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?)`,
    [user.user_id, sha256(refreshToken), expiresAt, ipAddress, userAgent]
  )

  // 7. Actualizar last_login_at
  await query(
    `UPDATE users SET last_login_at = CURDATE() WHERE user_id = ?`,
    [user.user_id]
  )

  return {
    accessToken,
    refreshToken,
    user: {
      userId: user.user_id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      role: user.role_code,
      siteId: user.site_id,
      mustChangePw: user.must_change_pw === 1,
      permissions: permissionCodes,
    },
  }
}

/**
 * Obtener usuario actual por ID
 */
export const getMe = async (userId) => {
  const users = await query(
    `SELECT user_id, username, full_name, email, role_code, site_id, must_change_pw
     FROM users 
     WHERE user_id = ? AND is_active = 1`,
    [userId]
  )

  if (users.length === 0) {
    throw new NotFoundError('Usuario no encontrado')
  }

  const user = users[0]

  // Obtener permisos
  const permissions = await query(
    `SELECT p.code 
     FROM permissions p
     INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
     INNER JOIN roles r ON rp.role_id = r.role_id
     WHERE r.code = ?`,
    [user.role_code]
  )

  return {
    userId: user.user_id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    role: user.role_code,
    siteId: user.site_id,
    mustChangePw: user.must_change_pw === 1,
    permissions: permissions.map(p => p.code),
  }
}

/**
 * Refrescar access token
 */
export const refresh = async (refreshToken, ipAddress, userAgent) => {
  const tokenHash = sha256(refreshToken)

  // 1. Buscar refresh token válido
  const tokens = await query(
    `SELECT rt.token_id, rt.user_id, rt.expires_at, u.username, u.full_name, 
            u.email, u.role_code, u.site_id, u.is_active
     FROM refresh_tokens rt
     INNER JOIN users u ON rt.user_id = u.user_id
     WHERE rt.token_hash = ? 
       AND rt.revoked_at IS NULL 
       AND rt.expires_at > NOW()`,
    [tokenHash]
  )

  if (tokens.length === 0) {
    throw new UnauthorizedError('Refresh token inválido o expirado')
  }

  const tokenData = tokens[0]

  // 2. Verificar usuario activo
  if (!tokenData.is_active) {
    throw new UnauthorizedError('Usuario desactivado')
  }

  // 3. Obtener permisos
  const permissions = await query(
    `SELECT p.code 
     FROM permissions p
     INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
     INNER JOIN roles r ON rp.role_id = r.role_id
     WHERE r.code = ?`,
    [tokenData.role_code]
  )

  const permissionCodes = permissions.map(p => p.code)

  // 4. Generar nuevo access token
  const user = {
    user_id: tokenData.user_id,
    username: tokenData.username,
    full_name: tokenData.full_name,
    email: tokenData.email,
    role_code: tokenData.role_code,
    site_id: tokenData.site_id,
  }

  const accessToken = generateAccessToken(user, permissionCodes)

  return { accessToken }
}

/**
 * Logout - revocar refresh token
 */
export const logout = async (refreshToken) => {
  const tokenHash = sha256(refreshToken)

  const result = await query(
    `UPDATE refresh_tokens 
     SET revoked_at = NOW() 
     WHERE token_hash = ? AND revoked_at IS NULL`,
    [tokenHash]
  )

  return result.affectedRows > 0
}

/**
 * Limpiar tokens expirados (para cron job o mantenimiento)
 */
export const cleanExpiredTokens = async () => {
  const result = await query(
    `DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL`
  )
  return result.affectedRows
}

export default {
  login,
  getMe,
  refresh,
  logout,
  cleanExpiredTokens,
}