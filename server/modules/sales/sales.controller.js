import salesService from './sales.service.js'
import { success } from '../../utils/response.js'
import { buildTicketPdfForSale } from './sales.ticketPdf.service.js'

export const getAll = async (req, res, next) => {
  try {
    const filters = {
      date_from: req.query.date_from,
      date_to: req.query.date_to,
      status_id: req.query.status_id,
      is_reweigh: req.query.is_reweigh,
      ticket_number: req.query.ticket_number
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
    const { date_from, date_to, ticket_number } = req.query
    const summary = await salesService.getSummary(date_from, date_to, ticket_number)
    success(res, summary)
  } catch (error) { next(error) }
}
export const downloadTicketPdf = async (req, res) => {
  try {
    const saleId = Number(req.params.saleId)
    if (!saleId) return res.status(400).json({ success:false, message:'Invalid saleId' })

    const { doc, filename } = await buildTicketPdfForSale(saleId) 
    // buildTicketPdfForSale debe regresar un PDFDocument (doc) ya “pipeable”

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename || `ticket-${saleId}.pdf`}"`)

    doc.pipe(res)
    doc.end()
  } catch (e) {
    console.error(e)
    return res.status(500).json({ success:false, message:'Could not generate ticket PDF' })
  }
}
export default { getAll, getById, updatePaymentMethod, cancelSale, getSummary,downloadTicketPdf }