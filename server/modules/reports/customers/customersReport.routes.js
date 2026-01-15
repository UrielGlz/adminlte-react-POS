import { Router } from 'express'
import * as CustomersReportController from './customersReport.controller.js'
import { authenticate, requirePermission } from '../../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('reports.sales'), CustomersReportController.getData)
router.get('/pdf', requirePermission('reports.sales'), CustomersReportController.downloadPdf)
router.get('/excel', requirePermission('reports.sales'), CustomersReportController.downloadExcel)

export default router