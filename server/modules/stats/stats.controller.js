import * as StatsService from './stats.service.js'
import response from '../../utils/response.js'
import logger from '../../utils/logger.js'

/**
 * GET /api/stats
 * Obtener estadísticas del dashboard
 */
export const getDashboard = async (req, res, next) => {
  try {
    const stats = await StatsService.getDashboardStats()
    
    logger.info('📊 Stats del dashboard:', stats)
    
    return response.success(res, stats)
  } catch (error) {
    next(error)
  }
}

export default { getDashboard }
