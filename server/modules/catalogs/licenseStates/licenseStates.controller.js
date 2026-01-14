import * as LicenseStatesService from './licenseStates.service.js'
import { success } from '../../../utils/response.js'

export const getAll = async (req, res, next) => {
  try {
    const includeInactive = req.query.all === 'true'
    const items = await LicenseStatesService.getAll(includeInactive)
    success(res, items)
  } catch (error) { next(error) }
}

export const getById = async (req, res, next) => {
  try {
    const item = await LicenseStatesService.getById(req.params.id)
    success(res, item)
  } catch (error) { next(error) }
}

export const getByCountry = async (req, res, next) => {
  try {
    const items = await LicenseStatesService.getByCountry(req.params.country, req.query.all === 'true')
    success(res, items)
  } catch (error) { next(error) }
}

export const create = async (req, res, next) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || null
    const item = await LicenseStatesService.create(req.body, currentUserId)
    success(res, item, 'State created', 201)
  } catch (error) { next(error) }
}

export const update = async (req, res, next) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || null
    const item = await LicenseStatesService.update(req.params.id, req.body, currentUserId)
    success(res, item, 'State updated')
  } catch (error) { next(error) }
}

export const remove = async (req, res, next) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || null
    await LicenseStatesService.remove(req.params.id, currentUserId)
    success(res, null, 'State deactivated')
  } catch (error) { next(error) }
}

export default { getAll, getById, getByCountry, create, update, remove }