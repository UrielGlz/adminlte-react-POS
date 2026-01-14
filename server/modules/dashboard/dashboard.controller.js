import dashboardService from './dashboard.service.js'
import { success } from '../../utils/response.js'

export const getFullDashboard = async (req, res, next) => {
  try {
    const role = req.user?.role_code || 'OPERATOR'
    const data = await dashboardService.getFullDashboard(role)
    success(res, data)
  } catch (error) { next(error) }
}

export const getTodaySummary = async (req, res, next) => {
  try {
    const data = await dashboardService.getTodaySummary()
    success(res, data)
  } catch (error) { next(error) }
}

export const getSalesTrend = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7
    const data = await dashboardService.getSalesTrend(days)
    success(res, data)
  } catch (error) { next(error) }
}

export const getSalesByHour = async (req, res, next) => {
  try {
    const date = req.query.date || null
    const data = await dashboardService.getSalesByHour(date)
    success(res, data)
  } catch (error) { next(error) }
}

export const getSalesByCategory = async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query
    const data = await dashboardService.getSalesByCategory(date_from, date_to)
    success(res, data)
  } catch (error) { next(error) }
}

export const getPaymentMethods = async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query
    const data = await dashboardService.getSalesByPaymentMethod(date_from, date_to)
    success(res, data)
  } catch (error) { next(error) }
}

export const getTopCustomers = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5
    const { date_from, date_to } = req.query
    const data = await dashboardService.getTopCustomers(limit, date_from, date_to)
    success(res, data)
  } catch (error) { next(error) }
}

export const getCreditSummary = async (req, res, next) => {
  try {
    const data = await dashboardService.getCreditSummary()
    success(res, data)
  } catch (error) { next(error) }
}

export const getOperatorStats = async (req, res, next) => {
  try {
    const { date_from, date_to } = req.query
    const data = await dashboardService.getOperatorStats(date_from, date_to)
    success(res, data)
  } catch (error) { next(error) }
}

export default {
  getFullDashboard,
  getTodaySummary,
  getSalesTrend,
  getSalesByHour,
  getSalesByCategory,
  getPaymentMethods,
  getTopCustomers,
  getCreditSummary,
  getOperatorStats
}