import { Router } from 'express'
import salesController from './sales.controller.js'
import reassignmentController from './reassignment.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()
router.use(authenticate)
router.get('/:saleId/ticket.pdf', requirePermission('sales.read'), salesController.downloadTicketPdf)

router.get('/', requirePermission('sales.read'), salesController.getAll)

router.get('/summary', requirePermission('sales.read'), salesController.getSummary)

// Reassignment routes (must be before /:id to avoid conflicts)
router.get('/reassignment-reasons', requirePermission('sales.read'), reassignmentController.getReasons)
router.get('/:saleUid/reassignment-history', requirePermission('sales.read'), reassignmentController.getHistory)
router.post('/:saleUid/reassign-customer', requirePermission('sales.write'), reassignmentController.reassignCustomer)

router.get('/:id', requirePermission('sales.read'), salesController.getById)
router.put('/:id/payment-method', requirePermission('sales.write'), salesController.updatePaymentMethod)

router.put('/:id/cancel', requirePermission('sales.write'), salesController.cancelSale)

export default router