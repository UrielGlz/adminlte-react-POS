import productsService from './products.service.js'
import { success } from '../../utils/response.js'

export const getAll = async (req, res, next) => {
  try {
    const includeInactive = req.query.all === 'true'
    const items = await productsService.getAll(includeInactive)
    success(res, items)
  } catch (error) {
    next(error)
  }
}

export const getById = async (req, res, next) => {
  try {
    const item = await productsService.getById(req.params.id)
    success(res, item)
  } catch (error) {
    next(error)
  }
}

export const create = async (req, res, next) => {
  try {
    const item = await productsService.create(req.body)
    success(res, item, 'Product created successfully', 201)
  } catch (error) {
    next(error)
  }
}

export const update = async (req, res, next) => {
  try {
    const item = await productsService.update(req.params.id, req.body)
    success(res, item, 'Product updated successfully')
  } catch (error) {
    next(error)
  }
}

export const remove = async (req, res, next) => {
  try {
    await productsService.remove(req.params.id)
    success(res, null, 'Product deleted successfully')
  } catch (error) {
    next(error)
  }
}

export const getTaxRates = async (req, res, next) => {
  try {
    const items = await productsService.getTaxRates()
    success(res, items)
  } catch (error) {
    next(error)
  }
}

export default { getAll, getById, create, update, remove, getTaxRates }