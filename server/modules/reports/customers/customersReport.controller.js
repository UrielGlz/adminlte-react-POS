import * as CustomersReportService from './customersReport.service.js'
import { success } from '../../../utils/response.js'

export const getData = async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status || 'all',
      has_credit: req.query.has_credit || 'all'
    }
    const result = await CustomersReportService.getData(filters)
    success(res, result)
  } catch (error) { next(error) }
}

export const downloadPdf = async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status || 'all',
      has_credit: req.query.has_credit || 'all'
    }
    
    const buffer = await CustomersReportService.generatePdf(filters)
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=customers-report-${Date.now()}.pdf`)
    res.send(buffer)
  } catch (error) { next(error) }
}

export const downloadExcel = async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status || 'all',
      has_credit: req.query.has_credit || 'all'
    }
    
    const buffer = await CustomersReportService.generateExcel(filters)
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=customers-report-${Date.now()}.xlsx`)
    res.send(buffer)
  } catch (error) { next(error) }
}

export default { getData, downloadPdf, downloadExcel }