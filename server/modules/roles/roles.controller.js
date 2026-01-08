import rolesService from './roles.service.js'
import { success } from '../../utils/response.js'

/**
 * GET /api/roles
 */
export const getAll = async (req, res, next) => {
  try {
    const roles = await rolesService.getAll()
    success(res, roles)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/roles/:id
 */
export const getById = async (req, res, next) => {
  try {
    const role = await rolesService.getById(req.params.id)
    success(res, role)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/roles
 */
export const create = async (req, res, next) => {
  try {
    const role = await rolesService.create(req.body)
    success(res, role, 'Role created successfully', 201)
  } catch (error) {
    next(error)
  }
}

/**
 * PUT /api/roles/:id
 */
export const update = async (req, res, next) => {
  try {
    const role = await rolesService.update(req.params.id, req.body)
    success(res, role, 'Role updated successfully')
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/roles/:id
 */
export const remove = async (req, res, next) => {
  try {
    await rolesService.remove(req.params.id)
    success(res, null, 'Role deleted successfully')
  } catch (error) {
    next(error)
  }
}

/**
 * PUT /api/roles/:id/permissions
 */
export const assignPermissions = async (req, res, next) => {
  try {
    const { permission_ids } = req.body
    const role = await rolesService.assignPermissions(req.params.id, permission_ids || [])
    success(res, role, 'Permissions updated successfully')
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/permissions
 */
export const getAllPermissions = async (req, res, next) => {
  try {
    const permissions = await rolesService.getAllPermissions()
    success(res, permissions)
  } catch (error) {
    next(error)
  }
}

export default {
  getAll,
  getById,
  create,
  update,
  remove,
  assignPermissions,
  getAllPermissions,
}