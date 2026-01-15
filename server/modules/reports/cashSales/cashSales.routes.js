import { Router } from 'express'
import * as CashSalesController from './cashSales.controller.js'
import { authenticate, requirePermission } from '../../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('reports.cash_sales'), CashSalesController.getData)
router.get('/filters', requirePermission('reports.cash_sales'), CashSalesController.getFilterOptions)
router.get('/pdf', requirePermission('reports.cash_sales'), CashSalesController.downloadPdf)
router.get('/excel', requirePermission('reports.cash_sales'), CashSalesController.downloadExcel)

export default router