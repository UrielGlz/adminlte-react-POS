import customersService from './customers.service.js'
import { success } from '../../utils/response.js'

export const getAll = async (req, res, next) => {
  try {
    const items = await customersService.getAll(req.query.all === 'true')
    success(res, items)
  } catch (error) { next(error) }
}

export const getById = async (req, res, next) => {
  try {
    const item = await customersService.getById(req.params.id)
    success(res, item)
  } catch (error) { next(error) }
}

export const create = async (req, res, next) => {
  try {
    const item = await customersService.create(req.body)
    success(res, item, 'Customer created', 201)
  } catch (error) { next(error) }
}

export const update = async (req, res, next) => {
  try {
    const item = await customersService.update(req.params.id, req.body)
    success(res, item, 'Customer updated')
  } catch (error) { next(error) }
}

export const remove = async (req, res, next) => {
  try {
    await customersService.remove(req.params.id)
    success(res, null, 'Customer deleted')
  } catch (error) { next(error) }
}

export default { getAll, getById, create, update, remove }