import { Router } from 'express'
import * as SalesReportController from './salesReport.controller.js'
import { authenticate, requirePermission } from '../../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('reports.sales'), SalesReportController.getData)
router.get('/filters', requirePermission('reports.sales'), SalesReportController.getFilterOptions)
router.get('/pdf', requirePermission('reports.sales'), SalesReportController.downloadPdf)
router.get('/excel', requirePermission('reports.sales'), SalesReportController.downloadExcel)

export default router