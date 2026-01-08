import { Router } from 'express'
import * as StatsController from './stats.controller.js'

const router = Router()

/**
 * Stats Routes
 * Base: /api/stats
 */

router.get('/', StatsController.getDashboard)

export default router
