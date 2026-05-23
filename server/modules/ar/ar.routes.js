import { Router } from 'express'
import * as ArController from './ar.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()

router.use(authenticate)

// Customers
router.get('/customers', requirePermission('ar.read'), ArController.getCustomers)
router.get('/customers/:id/summary', requirePermission('ar.read'), ArController.getCustomerSummary)
router.get('/customers/:id/pending', requirePermission('ar.read'), ArController.getPendingTransactions)
router.get('/customers/:id/history', requirePermission('ar.read'), ArController.getPaymentHistory)

router.get('/payments/all-history', requirePermission('ar.read'), ArController.getAllPaymentHistory)
// Payment methods
router.get('/payment-methods', requirePermission('ar.read'), ArController.getPaymentMethods)
// Payments
router.post('/payments', requirePermission('ar.write'), ArController.applyPayment)
router.patch('/payments/:id/amount', requirePermission('ar.write'), ArController.adjustPaymentAmount)
router.get('/payments/:id', requirePermission('ar.read'), ArController.getPaymentDetail)


export default router