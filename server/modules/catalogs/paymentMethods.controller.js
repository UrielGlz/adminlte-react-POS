import * as PaymentMethodsService from './paymentMethods.service.js'
import { success } from '../../utils/response.js'

export const getAll = async (req, res, next) => {
  try {
    const includeInactive = req.query.all === 'true'
    const items = await PaymentMethodsService.getAll(includeInactive)
    success(res, items)
  } catch (error) { next(error) }
}

export const getById = async (req, res, next) => {
  try {
    const item = await PaymentMethodsService.getById(req.params.id)
    success(res, item)
  } catch (error) { next(error) }
}

export const create = async (req, res, next) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || null
    const item = await PaymentMethodsService.create(req.body, currentUserId)
    success(res, item, 'Payment method created', 201)
  } catch (error) { next(error) }
}

export const update = async (req, res, next) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || null
    const item = await PaymentMethodsService.update(req.params.id, req.body, currentUserId)
    success(res, item, 'Payment method updated')
  } catch (error) { next(error) }
}

export const remove = async (req, res, next) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || null
    await PaymentMethodsService.remove(req.params.id, currentUserId)
    success(res, null, 'Payment method deactivated')
  } catch (error) { next(error) }
}

export default { getAll, getById, create, update, remove }