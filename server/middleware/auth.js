import jwt from 'jsonwebtoken'
import config from '../config/index.js'
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js'

/**
 * Middleware de autenticación
 * Verifica el token JWT en el header Authorization
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided')
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, config.jwt.secret)
    
    req.user = decoded
    
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new UnauthorizedError('Invalid token'))
    } else if (error.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Token expired'))
    } else {
      next(error)
    }
  }
}

/**
 * Middleware de autorización por roles
 * @param {...string} roles - Roles permitidos
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'))
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Role '${req.user.role}' is not authorized`))
    }

    next()
  }
}

/**
 * Middleware de autorización por permisos
 * @param {...string} requiredPermissions - Permisos requeridos (OR logic)
 */
export const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'))
    }

    const userPermissions = req.user.permissions || []
    
    // Verificar si tiene AL MENOS UNO de los permisos requeridos
    const hasPermission = requiredPermissions.some(perm => 
      userPermissions.includes(perm)
    )

    if (!hasPermission) {
      return next(new ForbiddenError('No tienes permiso para esta acción'))
    }

    next()
  }
}

/**
 * Middleware de autorización por permisos (ALL logic)
 * @param {...string} requiredPermissions - Todos los permisos requeridos
 */
export const requireAllPermissions = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'))
    }

    const userPermissions = req.user.permissions || []
    
    // Verificar si tiene TODOS los permisos requeridos
    const hasAll = requiredPermissions.every(perm => 
      userPermissions.includes(perm)
    )

    if (!hasAll) {
      return next(new ForbiddenError('No tienes todos los permisos requeridos'))
    }

    next()
  }
}

/**
 * Middleware opcional de autenticación
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const decoded = jwt.verify(token, config.jwt.secret)
      req.user = decoded
    }
    
    next()
  } catch {
    next()
  }
}

export default { authenticate, authorize, requirePermission, requireAllPermissions, optionalAuth }