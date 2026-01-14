import * as LicenseStatesModel from './licenseStates.model.js'
import { NotFoundError, ConflictError } from '../../../utils/errors.js'

export const getAll = async (includeInactive = false) => {
  return await LicenseStatesModel.findAll(includeInactive)
}

export const getById = async (id) => {
  const item = await LicenseStatesModel.findById(id)
  if (!item) throw new NotFoundError('State not found')
  return item
}

export const getByCountry = async (countryCode, includeInactive = false) => {
  return await LicenseStatesModel.findByCountry(countryCode, includeInactive)
}

export const create = async (data, currentUserId = null) => {
  const { country_code, state_code, state_name } = data
  
  if (!country_code || !state_code || !state_name) {
    throw new ConflictError('Country code, state code and state name are required')
  }
  
  // Verificar duplicado
  const existing = await LicenseStatesModel.findByCode(country_code, state_code)
  if (existing) {
    throw new ConflictError(`State "${state_code}" already exists for country "${country_code}"`)
  }
  
  return await LicenseStatesModel.create({
    ...data,
    created_by_user: currentUserId
  })
}

export const update = async (id, data, currentUserId = null) => {
  const existing = await LicenseStatesModel.findById(id)
  if (!existing) throw new NotFoundError('State not found')
  
  // Si cambia country_code o state_code, verificar duplicado
  if (data.country_code || data.state_code) {
    const checkCountry = (data.country_code || existing.country_code).toUpperCase()
    const checkState = (data.state_code || existing.state_code).toUpperCase()
    
    const duplicate = await LicenseStatesModel.findByCode(checkCountry, checkState)
    if (duplicate && duplicate.id_state !== parseInt(id)) {
      throw new ConflictError(`State "${checkState}" already exists for country "${checkCountry}"`)
    }
  }
  
  return await LicenseStatesModel.update(id, {
    ...data,
    edited_by_user: currentUserId
  })
}

/**
 * Soft delete - desactiva el estado
 */
export const remove = async (id, currentUserId = null) => {
  const existing = await LicenseStatesModel.findById(id)
  if (!existing) throw new NotFoundError('State not found')
  
  return await LicenseStatesModel.softDelete(id, currentUserId)
}

export default { getAll, getById, getByCountry, create, update, remove }