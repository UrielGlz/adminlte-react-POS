import paymentMethodsService from './paymentMethods.service.js'
import { success } from '../../utils/response.js'

export const getAll = async (req, res, next) => {
  try {
    const includeInactive = req.query.all === 'true'
    const items = await paymentMethodsService.getAll(includeInactive)
    success(res, items)
  } catch (error) {
    next(error)
  }
}

export const getById = async (req, res, next) => {
  try {
    const item = await paymentMethodsService.getById(req.params.id)
    success(res, item)
  } catch (error) {
    next(error)
  }
}

export const create = async (req, res, next) => {
  try {
    const item = await paymentMethodsService.create(req.body)
    success(res, item, 'Payment method created successfully', 201)
  } catch (error) {
    next(error)
  }
}

export const update = async (req, res, next) => {
  try {
    const item = await paymentMethodsService.update(req.params.id, req.body)
    success(res, item, 'Payment method updated successfully')
  } catch (error) {
    next(error)
  }
}

export const remove = async (req, res, next) => {
  try {
    await paymentMethodsService.remove(req.params.id)
    success(res, null, 'Payment method deleted successfully')
  } catch (error) {
    next(error)
  }
}

export default { getAll, getById, create, update, remove }