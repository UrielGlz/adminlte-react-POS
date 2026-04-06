import manualTicketService from './manualTicket.service.js'
import { success, created } from '../../utils/response.js'

export const getFormCatalogs = async (req, res, next) => {
  try {
    const data = await manualTicketService.getFormCatalogs()
    success(res, data)
  } catch (error) { next(error) }
}

export const createManualTicket = async (req, res, next) => {
  try {
    const result = await manualTicketService.createManualTicket(req.body, req.user.userId, req.user.siteId)
    created(res, result, 'Manual ticket created successfully')
  } catch (error) { next(error) }
}

export default { getFormCatalogs, createManualTicket }
