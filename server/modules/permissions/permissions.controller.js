import permissionsService from './permissions.service.js'
import { success } from '../../utils/response.js'

/**
 * GET /api/permissions
 */
export const getAll = async (req, res, next) => {
  try {
    const data = await permissionsService.getGrouped()
    success(res, data)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/permissions/list
 */
export const getList = async (req, res, next) => {
  try {
    const permissions = await permissionsService.getAll()
    success(res, permissions)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/permissions/modules
 */
export const getModules = async (req, res, next) => {
  try {
    const modules = await permissionsService.getModules()
    success(res, modules)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/permissions/:id
 */
export const getById = async (req, res, next) => {
  try {
    const permission = await permissionsService.getById(req.params.id)
    success(res, permission)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/permissions
 */
export const create = async (req, res, next) => {
  try {
    const permission = await permissionsService.create(req.body)
    success(res, permission, 'Permission created successfully', 201)
  } catch (error) {
    next(error)
  }
}

/**
 * PUT /api/permissions/:id
 */
export const update = async (req, res, next) => {
  try {
    const permission = await permissionsService.update(req.params.id, req.body)
    success(res, permission, 'Permission updated successfully')
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/permissions/:id
 */
export const remove = async (req, res, next) => {
  try {
    await permissionsService.remove(req.params.id)
    success(res, null, 'Permission deleted successfully')
  } catch (error) {
    next(error)
  }
}

export default {
  getAll,
  getList,
  getModules,
  getById,
  create,
  update,
  remove,
}