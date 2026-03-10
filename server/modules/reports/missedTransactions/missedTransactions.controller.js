import * as MissedTransactionsService from './missedTransactions.service.js'
import { success } from '../../../utils/response.js'

export const getData = async (req, res, next) => {
  try {
    const filters = {
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null
    }
    const result = await MissedTransactionsService.getData(filters)
    success(res, result)
  } catch (error) { next(error) }
}

export const getFilterOptions = async (req, res, next) => {
  try {
    const options = await MissedTransactionsService.getFilterOptions()
    success(res, options)
  } catch (error) { next(error) }
}

export const downloadPdf = async (req, res, next) => {
  try {
    const filters = {
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null
    }

    const buffer = await MissedTransactionsService.generatePdf(filters)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=missed-transactions-${Date.now()}.pdf`)
    res.send(buffer)
  } catch (error) { next(error) }
}

export const downloadExcel = async (req, res, next) => {
  try {
    const filters = {
      date_from: req.query.date_from || null,
      date_to: req.query.date_to || null
    }

    const buffer = await MissedTransactionsService.generateExcel(filters)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=missed-transactions-${Date.now()}.xlsx`)
    res.send(buffer)
  } catch (error) { next(error) }
}

export default { getData, getFilterOptions, downloadPdf, downloadExcel }