import { Router } from 'express'
import * as CustomerStatementController from './customerStatement.controller.js'
import { authenticate, requirePermission } from '../../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('reports.customer_statement'), CustomerStatementController.getData)
router.get('/filters', requirePermission('reports.customer_statement'), CustomerStatementController.getFilterOptions)
router.get('/pdf', requirePermission('reports.customer_statement'), CustomerStatementController.downloadPdf)
router.get('/excel', requirePermission('reports.customer_statement'), CustomerStatementController.downloadExcel)

export default router