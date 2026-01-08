/**
 * Respuestas estandarizadas para la API
 * Todas las respuestas siguen el mismo formato
 */

/**
 * Respuesta exitosa
 * @param {Response} res - Express response
 * @param {any} data - Datos a enviar
 * @param {string} message - Mensaje opcional
 * @param {number} statusCode - Código HTTP (default 200)
 */
export const success = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Respuesta de creación exitosa
 */
export const created = (res, data, message = 'Created successfully') => {
  return success(res, data, message, 201)
}

/**
 * Respuesta de error
 * @param {Response} res - Express response
 * @param {string} message - Mensaje de error
 * @param {number} statusCode - Código HTTP (default 500)
 * @param {any} errors - Errores adicionales
 */
export const error = (res, message = 'Error', statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Respuesta 404 - No encontrado
 */
export const notFound = (res, message = 'Resource not found') => {
  return error(res, message, 404)
}

/**
 * Respuesta 400 - Bad Request
 */
export const badRequest = (res, message = 'Bad request', errors = null) => {
  return error(res, message, 400, errors)
}

/**
 * Respuesta 401 - No autorizado
 */
export const unauthorized = (res, message = 'Unauthorized') => {
  return error(res, message, 401)
}

/**
 * Respuesta 403 - Prohibido
 */
export const forbidden = (res, message = 'Forbidden') => {
  return error(res, message, 403)
}

/**
 * Respuesta paginada
 */
export const paginated = (res, data, pagination) => {
  return res.status(200).json({
    success: true,
    message: 'Success',
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
    timestamp: new Date().toISOString(),
  })
}

export default {
  success,
  created,
  error,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  paginated,
}
