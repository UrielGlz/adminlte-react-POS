import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'

// Middleware
import errorHandler, { notFoundHandler } from './middleware/errorHandler.js'
import logger from './utils/logger.js'

// Routes
import authRoutes from './modules/auth/auth.routes.js'
import navigationRoutes from './modules/navigation/navigation.routes.js'
import usersRoutes from './modules/users/users.routes.js'
import statsRoutes from './modules/stats/stats.routes.js'
import rolesRoutes from './modules/roles/roles.routes.js'
import permissionsRoutes from './modules/permissions/permissions.routes.js'
import statusCatalogRoutes from './modules/catalogs/statusCatalog.routes.js'
import paymentMethodsRoutes from './modules/catalogs/paymentMethods.routes.js'
import productsRoutes from './modules/catalogs/products.routes.js'

import vehicleTypesRoutes from './modules/catalogs/vehicleTypes.routes.js'
import customersRoutes from './modules/customers/customers.routes.js'
import salesRoutes from './modules/sales/sales.routes.js'

const app = express()

// ============ MIDDLEWARE DE SEGURIDAD ============
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ============ MIDDLEWARE DE PARSING ============
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(compression())

// ============ MIDDLEWARE DE LOGGING ============
app.use((req, res, next) => {
  logger.request(req)
  next()
})

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// ============ RUTAS DE MÓDULOS ============
app.use('/api/auth', authRoutes)
app.use('/api/navigation', navigationRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/roles', rolesRoutes)
app.use('/api/permissions', permissionsRoutes) 
app.use('/api/catalogs/status', statusCatalogRoutes)
app.use('/api/catalogs/payment-methods', paymentMethodsRoutes)
app.use('/api/catalogs/products', productsRoutes)
app.use('/api/catalogs/vehicle-types', vehicleTypesRoutes)
app.use('/api/customers', customersRoutes)
app.use('/api/sales', salesRoutes)

// ============ MANEJO DE ERRORES ============
app.use('/api/*', notFoundHandler)
app.use(errorHandler)

export default app