import reassignmentService from './reassignment.service.js'
import { success } from '../../utils/response.js'

export const getReasons = async (req, res, next) => {
  try {
    const items = await reassignmentService.getReasons()
    success(res, items)
  } catch (error) { next(error) }
}

export const getHistory = async (req, res, next) => {
  try {
    const items = await reassignmentService.getHistory(req.params.saleUid)
    success(res, items)
  } catch (error) { next(error) }
}

export const reassignCustomer = async (req, res, next) => {
  try {
    const result = await reassignmentService.reassignCustomer(
      req.params.saleUid,
      req.body,
      req.user.userId
    )
    success(res, result, result.message)
  } catch (error) { next(error) }
}

export default { getReasons, getHistory, reassignCustomer }