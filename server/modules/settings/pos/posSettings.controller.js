import * as PosSettingsService from './posSettings.service.js'
import { success, error } from '../../../utils/response.js'

/**
 * Obtener lista de módulos disponibles
 */
export const getModules = async (req, res, next) => {
  try {
    const modules = await PosSettingsService.getModules()
    success(res, modules)
  } catch (err) {
    next(err)
  }
}

/**
 * Obtener settings por módulo
 */
export const getByModule = async (req, res, next) => {
  try {
    const { module } = req.params

    if (!module) {
      return error(res, 'Module parameter is required', 400)
    }

    const settings = await PosSettingsService.getByModule(module)
    success(res, settings)
  } catch (err) {
    next(err)
  }
}

/**
 * Actualizar un setting
 */
export const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const { value } = req.body

    if (value === undefined) {
      return error(res, 'Value is required', 400)
    }

    const result = await PosSettingsService.update(id, value)

    if (result) {
      success(res, { message: 'Setting updated successfully' })
    } else {
      error(res, 'Setting not found', 404)
    }
  } catch (err) {
    next(err)
  }
}

/**
 * Actualizar múltiples settings
 */
export const updateBulk = async (req, res, next) => {
  try {
    const { settings } = req.body

    if (!Array.isArray(settings) || settings.length === 0) {
      return error(res, 'Settings array is required', 400)
    }

    const results = await PosSettingsService.updateBulk(settings)
    success(res, { 
      message: 'Settings updated',
      results 
    })
  } catch (err) {
    next(err)
  }
}

/**
 * Crear nuevo setting
 */
export const create = async (req, res, next) => {
  try {
    const { key, value, site_id } = req.body

    if (!key) {
      return error(res, 'Key is required', 400)
    }

    const settingId = await PosSettingsService.create({ key, value, site_id })
    success(res, { 
      message: 'Setting created successfully',
      setting_id: settingId 
    }, 201)
  } catch (err) {
    if (err.message.includes('already exists')) {
      return error(res, err.message, 409)
    }
    next(err)
  }
}

export default {
  getModules,
  getByModule,
  update,
  updateBulk,
  create
}