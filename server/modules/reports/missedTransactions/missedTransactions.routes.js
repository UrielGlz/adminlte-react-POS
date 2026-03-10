import { Router } from 'express'
import * as MissedTransactionsController from './missedTransactions.controller.js'
import { authenticate, requirePermission } from '../../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('reports.missed_transactions'), MissedTransactionsController.getData)
router.get('/filters', requirePermission('reports.missed_transactions'), MissedTransactionsController.getFilterOptions)
router.get('/pdf', requirePermission('reports.missed_transactions'), MissedTransactionsController.downloadPdf)
router.get('/excel', requirePermission('reports.missed_transactions'), MissedTransactionsController.downloadExcel)

export default router