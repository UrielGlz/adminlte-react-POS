import * as SaleDriverInfoService from './saleDriverInfo.service.js'
import { success, paginated } from '../../../utils/response.js'

export const getAll = async (req, res, next) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      search: req.query.search || '',
      account_number: req.query.account_number || null,
      license_state: req.query.license_state || null,
      driver_product_id: req.query.driver_product_id || null,
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null
    }

    const { items, pagination } = await SaleDriverInfoService.getAll(options)
    
    return res.json({
      success: true,
      data: items,
      pagination
    })
  } catch (error) { next(error) }
}

export const getById = async (req, res, next) => {
  try {
    const item = await SaleDriverInfoService.getById(req.params.id)
    success(res, item)
  } catch (error) { next(error) }
}

export const getStats = async (req, res, next) => {
  try {
    const stats = await SaleDriverInfoService.getStats()
    success(res, stats)
  } catch (error) { next(error) }
}

export default { getAll, getById, getStats }