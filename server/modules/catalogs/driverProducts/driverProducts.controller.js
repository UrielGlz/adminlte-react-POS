import * as DriverProductsService from './driverProducts.service.js'
import { success } from '../../../utils/response.js'

export const getAll = async (req, res, next) => {
  try {
    const includeInactive = req.query.all === 'true'
    const items = await DriverProductsService.getAll(includeInactive)
    success(res, items)
  } catch (error) { next(error) }
}

export const getById = async (req, res, next) => {
  try {
    const item = await DriverProductsService.getById(req.params.id)
    success(res, item)
  } catch (error) { next(error) }
}

export const create = async (req, res, next) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || null
    const item = await DriverProductsService.create(req.body, currentUserId)
    success(res, item, 'Product created', 201)
  } catch (error) { next(error) }
}

export const update = async (req, res, next) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || null
    const item = await DriverProductsService.update(req.params.id, req.body, currentUserId)
    success(res, item, 'Product updated')
  } catch (error) { next(error) }
}

export const remove = async (req, res, next) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || null
    await DriverProductsService.remove(req.params.id, currentUserId)
    success(res, null, 'Product deactivated')
  } catch (error) { next(error) }
}

export default { getAll, getById, create, update, remove }