import authService from './auth.service.js'
import { success } from '../../utils/response.js'

/**
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body
    const ipAddress = req.ip || req.connection.remoteAddress
    const userAgent = req.headers['user-agent'] || 'unknown'

    const result = await authService.login(username, password, ipAddress, userAgent)

    success(res, result, 'Login exitoso')
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.userId)
    success(res, user)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/auth/refresh
 */
export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    const ipAddress = req.ip || req.connection.remoteAddress
    const userAgent = req.headers['user-agent'] || 'unknown'

    const result = await authService.refresh(refreshToken, ipAddress, userAgent)

    success(res, result, 'Token renovado')
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body

    await authService.logout(refreshToken)

    success(res, null, 'Sesión cerrada')
  } catch (error) {
    next(error)
  }
}

export default {
  login,
  getMe,
  refresh,
  logout,
}