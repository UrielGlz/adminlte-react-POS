import { Router } from 'express'
import customersReportRoutes from './customers/customersReport.routes.js'
import salesReportRoutes from './sales/salesReport.routes.js'
import customerStatementRoutes from './customerStatement/customerStatement.routes.js'
import cashSalesRoutes from './cashSales/cashSales.routes.js'

const router = Router()

router.use('/customers', customersReportRoutes)
router.use('/sales', salesReportRoutes)
router.use('/customer-statement', customerStatementRoutes)
router.use('/cash-sales', cashSalesRoutes)

export default router