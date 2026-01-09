import vehicleTypesService from './vehicleTypes.service.js'
import { success } from '../../utils/response.js'

export const getAll = async (req, res, next) => {
  try {
    const items = await vehicleTypesService.getAll(req.query.all === 'true')
    success(res, items)
  } catch (error) { next(error) }
}

export const getById = async (req, res, next) => {
  try {
    const item = await vehicleTypesService.getById(req.params.id)
    success(res, item)
  } catch (error) { next(error) }
}

export const create = async (req, res, next) => {
  try {
    const item = await vehicleTypesService.create(req.body)
    success(res, item, 'Vehicle type created', 201)
  } catch (error) { next(error) }
}

export const update = async (req, res, next) => {
  try {
    const item = await vehicleTypesService.update(req.params.id, req.body)
    success(res, item, 'Vehicle type updated')
  } catch (error) { next(error) }
}

export const remove = async (req, res, next) => {
  try {
    await vehicleTypesService.remove(req.params.id)
    success(res, null, 'Vehicle type deleted')
  } catch (error) { next(error) }
}

export default { getAll, getById, create, update, remove }