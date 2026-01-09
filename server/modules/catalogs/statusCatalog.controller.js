import statusCatalogService from './statusCatalog.service.js'
import { success } from '../../utils/response.js'

/**
 * GET /api/catalogs/status
 */
export const getAll = async (req, res, next) => {
  try {
    const { module } = req.query
    
    if (module) {
      const items = await statusCatalogService.getAll(module)
      success(res, items)
    } else {
      const data = await statusCatalogService.getGrouped()
      success(res, data)
    }
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/catalogs/status/modules
 */
export const getModules = async (req, res, next) => {
  try {
    const modules = await statusCatalogService.getModules()
    success(res, modules)
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/catalogs/status/:id
 */
export const getById = async (req, res, next) => {
  try {
    const item = await statusCatalogService.getById(req.params.id)
    success(res, item)
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/catalogs/status
 */
export const create = async (req, res, next) => {
  try {
    const item = await statusCatalogService.create(req.body)
    success(res, item, 'Status created successfully', 201)
  } catch (error) {
    next(error)
  }
}

/**
 * PUT /api/catalogs/status/:id
 */
export const update = async (req, res, next) => {
  try {
    const item = await statusCatalogService.update(req.params.id, req.body)
    success(res, item, 'Status updated successfully')
  } catch (error) {
    next(error)
  }
}

/**
 * DELETE /api/catalogs/status/:id
 */
export const remove = async (req, res, next) => {
  try {
    await statusCatalogService.remove(req.params.id)
    success(res, null, 'Status deleted successfully')
  } catch (error) {
    next(error)
  }
}

export default {
  getAll,
  getModules,
  getById,
  create,
  update,
  remove,
}