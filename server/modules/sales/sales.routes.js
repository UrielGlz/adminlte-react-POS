import { Router } from 'express'
import salesController from './sales.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('sales.read'), salesController.getAll)
router.get('/summary', requirePermission('sales.read'), salesController.getSummary)
router.get('/:id', requirePermission('sales.read'), salesController.getById)
router.put('/:id/payment-method', requirePermission('sales.write'), salesController.updatePaymentMethod)
router.put('/:id/cancel', requirePermission('sales.write'), salesController.cancelSale)

export default router