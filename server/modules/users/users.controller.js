import * as UsersService from './users.service.js'
import response from '../../utils/response.js'
import logger from '../../utils/logger.js'

/**
 * Users Controller
 * Maneja requests HTTP y respuestas
 */

/**
 * GET /api/users
 * Obtener lista de usuarios
 */
export const getAll = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      role,
      orderBy,
      order,
    } = req.query
    
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      status,
      role,
      orderBy,
      order,
    }
    
    const { users, total } = await UsersService.getAllUsers(options)
    
    // ========== IMPRIMIR EN CONSOLA ==========
    logger.info('📋 Usuarios obtenidos de la BD:')
    console.log('\n========== USUARIOS ==========')
    console.table(users)
    console.log(`Total: ${total} usuarios`)
    console.log('==============================\n')
    // =========================================
    
    return response.paginated(res, users, {
      page: options.page,
      limit: options.limit,
      total,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/users/stats
 * Obtener estadísticas de usuarios
 */
export const getStats = async (req, res, next) => {
  try {
    const stats = await UsersService.getUserStats()
    
    logger.info('📊 Estadísticas de usuarios:', stats)
    
    return response.success(res, stats)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/users/:id
 * Obtener un usuario por ID
 */
export const getById = async (req, res, next) => {
  try {
    const { id } = req.params
    const user = await UsersService.getUserById(id)
    
    logger.info(`📄 Usuario obtenido: ${user.email}`)
    console.log('\n========== USUARIO ==========')
    console.log(user)
    console.log('==============================\n')
    
    return response.success(res, user)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/users
 * Crear nuevo usuario
 */
export const create = async (req, res, next) => {
  try {
    const data = req.body

    // ✅ Requeridos para tu tabla + password en texto plano
    if (!data.username || !data.full_name || !data.password) {
      return response.badRequest(res, 'username, full name y password required')
    }

    // NUEVO: obtener ID del usuario actual desde el token JWT
    const currentUserId = req.user?.userId || req.user?.user_id || null

    const user = await UsersService.createUser(data, currentUserId)
    logger.info(`✅ Usuario creado: ${user.username} por user_id: ${currentUserId}`)

    return response.created(res, user, 'User created successfully')
  } catch (error) {
    next(error)
  }
}


/**
 * PUT /api/users/:id
 * Actualizar usuario
 */
export const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const data = req.body
    
    // 👇 NUEVO: obtener ID del usuario actual desde el token JWT
    const currentUserId = req.user?.userId || req.user?.user_id || null
    
    const user = await UsersService.updateUser(id, data, currentUserId)
    
    logger.info(`✏️ Usuario actualizado: ${user.email} por user_id: ${currentUserId}`)
    
    return response.success(res, user, 'User updated successfully')
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/users/:id
 * Eliminar usuario
 */
export const remove = async (req, res, next) => {
  try {
    const { id } = req.params
    
    await UsersService.deleteUser(id)
    
    logger.info(`🗑️ Usuario eliminado: ID ${id}`)
    
    return response.success(res, null, 'User deleted successfully')
  } catch (error) {
    next(error)
  }
}

export default {
  getAll,
  getById,
  getStats,
  create,
  update,
  remove,
}
