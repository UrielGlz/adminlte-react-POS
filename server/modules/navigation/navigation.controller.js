import navigationService from './navigation.service.js'
import { success } from '../../utils/response.js'

/**
 * GET /api/navigation - Menú para sidebar (filtrado por permisos)
 */
export const getNavigation = async (req, res, next) => {
  try {
    const navigation = await navigationService.getNavigation(req.user.permissions || [])
    success(res, navigation)
  } catch (error) {
    next(error)
  }
}

// =============================================
// ADMIN ENDPOINTS
// =============================================

/**
 * GET /api/navigation/admin - Todos los items (para administración)
 */
export const getAllAdmin = async (req, res, next) => {
  try {
    const data = await navigationService.getAllAdmin()
    success(res, data)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/navigation/admin/:id - Obtener item por ID
 */
export const getById = async (req, res, next) => {
  try {
    const item = await navigationService.getById(req.params.id)
    success(res, item)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/navigation/admin - Crear item
 */
export const create = async (req, res, next) => {
  try {
    const item = await navigationService.create(req.body)
    success(res, item, 'Navigation item created successfully', 201)
  } catch (error) {
    next(error)
  }
}

/**
 * PUT /api/navigation/admin/:id - Actualizar item
 */
export const update = async (req, res, next) => {
  try {
    const item = await navigationService.update(req.params.id, req.body)
    success(res, item, 'Navigation item updated successfully')
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/navigation/admin/:id - Eliminar item
 */
export const remove = async (req, res, next) => {
  try {
    await navigationService.remove(req.params.id)
    success(res, null, 'Navigation item deleted successfully')
  } catch (error) {
    next(error)
  }
}

/**
 * PUT /api/navigation/admin/reorder - Reordenar items
 */
export const reorder = async (req, res, next) => {
  try {
    const { items } = req.body
    const data = await navigationService.reorder(items)
    success(res, data, 'Items reordered successfully')
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/navigation/admin/options/parents - Opciones para parent dropdown
 */
export const getParentOptions = async (req, res, next) => {
  try {
    const excludeId = req.query.exclude || null
    const options = await navigationService.getParentOptions(excludeId)
    success(res, options)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/navigation/admin/options/permissions - Opciones para permission dropdown
 */
export const getPermissionOptions = async (req, res, next) => {
  try {
    const options = await navigationService.getPermissionOptions()
    success(res, options)
  } catch (error) {
    next(error)
  }
}

export default {
  getNavigation,
  getAllAdmin,
  getById,
  create,
  update,
  remove,
  reorder,
  getParentOptions,
  getPermissionOptions,
}