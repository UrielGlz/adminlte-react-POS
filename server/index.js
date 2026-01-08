/**
 * AdminLTE API Server
 * Entry Point
 */

import app from './app.js'
import config from './config/index.js'
import { testConnection } from './config/database.js'
import logger from './utils/logger.js'

const startServer = async () => {
  // Banner
  console.log('\n')
  console.log('╔═══════════════════════════════════════════════════════╗')
  console.log('║           AdminLTE React - API Server                 ║')
  console.log('╚═══════════════════════════════════════════════════════╝')
  console.log('\n')

  // Probar conexión a la base de datos
  logger.info('Connecting to database...')
  const dbConnected = await testConnection()
  
  if (!dbConnected) {
    logger.error('Could not connect to database. Exiting...')
    process.exit(1)
  }

  // Iniciar servidor
  app.listen(config.port, () => {
    logger.info(`🚀 Server running on http://localhost:${config.port}`)
    logger.info(`📊 API available at http://localhost:${config.port}/api`)
    logger.info(`🔧 Environment: ${config.nodeEnv}`)
    console.log('\n')
    console.log('Available endpoints:')
    console.log('  GET    /api/health')
    console.log('  GET    /api/users')
    console.log('  GET    /api/users/stats')
    console.log('  GET    /api/users/:id')
    console.log('  POST   /api/users')
    console.log('  PUT    /api/users/:id')
    console.log('  DELETE /api/users/:id')
    console.log('  GET    /api/stats')
    console.log('\n')
  })
}

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason, promise })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...')
  process.exit(0)
})

// Iniciar
startServer()
