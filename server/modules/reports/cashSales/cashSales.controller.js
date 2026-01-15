import * as CashSalesService from './cashSales.service.js'
import { success } from '../../../utils/response.js'

export const getData = async (req, res, next) => {
  try {
    const filters = {
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null,
      payment_method: req.query.payment_method || 'all',
      product_type: req.query.product_type || 'all',
      sale_status: req.query.sale_status || 'all'
    }
    const result = await CashSalesService.getData(filters)
    success(res, result)
  } catch (error) { next(error) }
}

export const getFilterOptions = async (req, res, next) => {
  try {
    const options = await CashSalesService.getFilterOptions()
    success(res, options)
  } catch (error) { next(error) }
}

export const downloadPdf = async (req, res, next) => {
  try {
    const filters = {
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null,
      payment_method: req.query.payment_method || 'all',
      product_type: req.query.product_type || 'all',
      sale_status: req.query.sale_status || 'all'
    }
    
    const buffer = await CashSalesService.generatePdf(filters)
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=cash-sales-${Date.now()}.pdf`)
    res.send(buffer)
  } catch (error) { next(error) }
}

export const downloadExcel = async (req, res, next) => {
  try {
    const filters = {
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null,
      payment_method: req.query.payment_method || 'all',
      product_type: req.query.product_type || 'all',
      sale_status: req.query.sale_status || 'all'
    }
    
    const buffer = await CashSalesService.generateExcel(filters)
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=cash-sales-${Date.now()}.xlsx`)
    res.send(buffer)
  } catch (error) { next(error) }
}

export default { getData, getFilterOptions, downloadPdf, downloadExcel }