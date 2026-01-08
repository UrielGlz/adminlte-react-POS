import logger from '../utils/logger.js'
import config from '../config/index.js'

/**
 * Middleware global de manejo de errores
 * Captura todos los errores de la aplicación
 */
const errorHandler = (err, req, res, next) => {
  // Log del error
  logger.error(`${err.name}: ${err.message}`, {
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
  })

  // Si ya se envió respuesta, pasar al siguiente
  if (res.headersSent) {
    return next(err)
  }

  // Determinar código de estado
  const statusCode = err.statusCode || err.status || 500

  // Respuesta de error
  const response = {
    success: false,
    message: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  }

  // En desarrollo, incluir stack trace
  if (config.nodeEnv === 'development') {
    response.stack = err.stack
  }

  // Incluir errores de validación si existen
  if (err.errors) {
    response.errors = err.errors
  }

  res.status(statusCode).json(response)
}

/**
 * Middleware para rutas no encontradas
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  })
}

export default errorHandler
