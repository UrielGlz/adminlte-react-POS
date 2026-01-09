import salesService from './sales.service.js'
import { success } from '../../utils/response.js'

export const getAll = async (req, res, next) => {
  try {
    const filters = {
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      status_id: req.query.status_id,
      is_reweigh: req.query.is_reweigh
    }
    const items = await salesService.getAll(filters)
    success(res, items)
  } catch (error) { next(error) }
}

export const getById = async (req, res, next) => {
  try {
    const item = await salesService.getById(req.params.id)
    success(res, item)
  } catch (error) { next(error) }
}

export const updatePaymentMethod = async (req, res, next) => {
  try {
    const { method_id } = req.body
    const item = await salesService.updatePaymentMethod(req.params.id, method_id)
    success(res, item, 'Payment method updated')
  } catch (error) { next(error) }
}

export const cancelSale = async (req, res, next) => {
  try {
    const { reason_id } = req.body
    const item = await salesService.cancelSale(req.params.id, reason_id)
    success(res, item, 'Sale cancelled')
  } catch (error) { next(error) }
}

export const getSummary = async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query
    const summary = await salesService.getSummary(date_from, date_to)
    success(res, summary)
  } catch (error) { next(error) }
}

export default { getAll, getById, updatePaymentMethod, cancelSale, getSummary }