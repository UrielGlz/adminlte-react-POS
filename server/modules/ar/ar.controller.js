import * as ArService from './ar.service.js'
import { success } from '../../utils/response.js'

export const getCustomers = async (req, res, next) => {
  try {
    const customers = await ArService.getCustomersWithCredit()
    success(res, customers)
  } catch (error) {
    next(error)
  }
}

export const getCustomerSummary = async (req, res, next) => {
  try {
    const summary = await ArService.getCustomerSummary(req.params.id)
    success(res, summary)
  } catch (error) {
    next(error)
  }
}

export const getPendingTransactions = async (req, res, next) => {
  try {
    const data = await ArService.getPendingTransactions(req.params.id)
    success(res, data)
  } catch (error) {
    next(error)
  }
}

export const getPaymentHistory = async (req, res, next) => {
  try {
    const history = await ArService.getPaymentHistory(req.params.id)
    success(res, history)
  } catch (error) {
    next(error)
  }
}

export const getPaymentMethods = async (req, res, next) => {
  try {
    const methods = await ArService.getPaymentMethods()
    success(res, methods)
  } catch (error) {
    next(error)
  }
}

export const applyPayment = async (req, res, next) => {
  try {
    const userId = req.user?.userId || null
    const result = await ArService.applyPayment(req.body, userId)
    success(res, result, result.message, 201)
  } catch (error) {
    next(error)
  }
}

export const getPaymentDetail = async (req, res, next) => {
  try {
    const detail = await ArService.getPaymentDetail(req.params.id)
    success(res, detail)
  } catch (error) {
    next(error)
  }
}

export default {
  getCustomers,
  getCustomerSummary,
  getPendingTransactions,
  getPaymentHistory,
  getPaymentMethods,
  applyPayment,
  getPaymentDetail
}