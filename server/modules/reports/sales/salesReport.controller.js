import * as SalesReportService from './salesReport.service.js'
import { success } from '../../../utils/response.js'

export const getData = async (req, res, next) => {
  try {
    const filters = {
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null,
      transaction_type: req.query.transaction_type || 'all',
      customer_id: req.query.customer_id || 'all',
      user_id: req.query.user_id || 'all',
      payment_method_id: req.query.payment_method_id || 'all',
      status_id: req.query.status_id || 'all'
    }
    const result = await SalesReportService.getData(filters)
    success(res, result)
  } catch (error) { next(error) }
}

export const getFilterOptions = async (req, res, next) => {
  try {
    const options = await SalesReportService.getFilterOptions()
    success(res, options)
  } catch (error) { next(error) }
}

export const downloadPdf = async (req, res, next) => {
  try {
    const filters = {
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null,
      transaction_type: req.query.transaction_type || 'all',
      customer_id: req.query.customer_id || 'all',
      user_id: req.query.user_id || 'all',
      payment_method_id: req.query.payment_method_id || 'all',
      status_id: req.query.status_id || 'all'
    }
    
    const buffer = await SalesReportService.generatePdf(filters)
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.pdf`)
    res.send(buffer)
  } catch (error) { next(error) }
}

export const downloadExcel = async (req, res, next) => {
  try {
    const filters = {
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null,
      transaction_type: req.query.transaction_type || 'all',
      customer_id: req.query.customer_id || 'all',
      user_id: req.query.user_id || 'all',
      payment_method_id: req.query.payment_method_id || 'all',
      status_id: req.query.status_id || 'all'
    }
    
    const buffer = await SalesReportService.generateExcel(filters)
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.xlsx`)
    res.send(buffer)
  } catch (error) { next(error) }
}

export default { getData, getFilterOptions, downloadPdf, downloadExcel }