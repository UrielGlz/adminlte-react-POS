import { Router } from 'express'
import dashboardController from './dashboard.controller.js'
import { authenticate } from '../../middleware/auth.js'

const router = Router()
router.use(authenticate)

// Dashboard completo (ajusta datos según rol)
router.get('/', dashboardController.getFullDashboard)

// Endpoints individuales
router.get('/today', dashboardController.getTodaySummary)
router.get('/trend', dashboardController.getSalesTrend)
router.get('/hourly', dashboardController.getSalesByHour)
router.get('/by-category', dashboardController.getSalesByCategory)
router.get('/payment-methods', dashboardController.getPaymentMethods)
router.get('/top-customers', dashboardController.getTopCustomers)
router.get('/credit-summary', dashboardController.getCreditSummary)
router.get('/operators', dashboardController.getOperatorStats)

export default router