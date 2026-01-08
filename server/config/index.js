import dotenv from 'dotenv'

dotenv.config()

export default {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'adminlte_db',
    connectionLimit: parseInt(process.env.DB_POOL_SIZE) || 10,
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '30m',      // Access token: 30 min
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',     // Refresh token: 7 días
    refreshExpiresInMs: 7 * 24 * 60 * 60 * 1000,                   // 7 días en ms (para BD)
  },
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
}