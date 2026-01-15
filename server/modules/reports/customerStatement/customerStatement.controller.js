import * as CustomerStatementService from './customerStatement.service.js'
import { success } from '../../../utils/response.js'

export const getData = async (req, res, next) => {
  try {
    const filters = {
      customer_id: req.query.customer_id || null,
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null
    }
    const result = await CustomerStatementService.getData(filters)
    success(res, result)
  } catch (error) { next(error) }
}

export const getFilterOptions = async (req, res, next) => {
  try {
    const options = await CustomerStatementService.getFilterOptions()
    success(res, options)
  } catch (error) { next(error) }
}

export const downloadPdf = async (req, res, next) => {
  try {
    const filters = {
      customer_id: req.query.customer_id || null,
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null
    }

    if (!filters.customer_id) {
      return res.status(400).json({ success: false, message: 'Customer is required' })
    }
    
    const buffer = await CustomerStatementService.generatePdf(filters)
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=customer-statement-${Date.now()}.pdf`)
    res.send(buffer)
  } catch (error) { next(error) }
}

export const downloadExcel = async (req, res, next) => {
  try {
    const filters = {
      customer_id: req.query.customer_id || null,
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null
    }

    if (!filters.customer_id) {
      return res.status(400).json({ success: false, message: 'Customer is required' })
    }
    
    const buffer = await CustomerStatementService.generateExcel(filters)
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=customer-statement-${Date.now()}.xlsx`)
    res.send(buffer)
  } catch (error) { next(error) }
}

export default { getData, getFilterOptions, downloadPdf, downloadExcel }