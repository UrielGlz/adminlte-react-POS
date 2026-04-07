import reweighConversionService from './reweighConversion.service.js'
import { success, created } from '../../utils/response.js'

export const getReweighProducts = async (req, res, next) => {
  try {
    const data = await reweighConversionService.getReweighProducts()
    success(res, data)
  } catch (error) { next(error) }
}

export const convertToReweigh = async (req, res, next) => {
  try {
    const result = await reweighConversionService.convertToReweigh(
      req.params.saleUid,
      req.body,
      req.user.userId
    )
    created(res, result, 'Sale converted to Reweigh successfully')
  } catch (error) { next(error) }
}

export default { getReweighProducts, convertToReweigh }
