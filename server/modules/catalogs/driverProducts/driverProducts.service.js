import * as DriverProductsModel from './driverProducts.model.js'
import { NotFoundError, ConflictError } from '../../../utils/errors.js'

export const getAll = async (includeInactive = false) => {
  return await DriverProductsModel.findAll(includeInactive)
}

export const getById = async (id) => {
  const item = await DriverProductsModel.findById(id)
  if (!item) throw new NotFoundError('Product not found')
  return item
}

export const create = async (data, currentUserId = null) => {
  const { code, name } = data
  
  if (!code || !name) {
    throw new ConflictError('Code and name are required')
  }
  
  // Verificar duplicado
  const existing = await DriverProductsModel.findByCode(code)
  if (existing) {
    throw new ConflictError(`Product with code "${code}" already exists`)
  }
  
  return await DriverProductsModel.create({
    ...data,
    created_by_user: currentUserId
  })
}

export const update = async (id, data, currentUserId = null) => {
  const existing = await DriverProductsModel.findById(id)
  if (!existing) throw new NotFoundError('Product not found')
  
  // Si cambia code, verificar duplicado
  if (data.code && data.code.toUpperCase() !== existing.code) {
    const duplicate = await DriverProductsModel.findByCode(data.code)
    if (duplicate) {
      throw new ConflictError(`Product with code "${data.code}" already exists`)
    }
  }
  
  return await DriverProductsModel.update(id, {
    ...data,
    edited_by_user: currentUserId
  })
}

/**
 * Soft delete - desactiva el producto
 */
export const remove = async (id, currentUserId = null) => {
  const existing = await DriverProductsModel.findById(id)
  if (!existing) throw new NotFoundError('Product not found')
  
  return await DriverProductsModel.softDelete(id, currentUserId)
}

export default { getAll, getById, create, update, remove }