import mysql from 'mysql2/promise'
import config from './index.js'
import logger from '../utils/logger.js'

// Crear pool de conexiones
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
})

/**
 * Ejecutar query con parámetros
 * @param {string} sql - Query SQL
 * @param {Array} params - Parámetros para la query
 * @returns {Promise<Array>} Resultados
 */
export const query = async (sql, params = []) => {
  try {
    const [results] = await pool.execute(sql, params)
    return results
  } catch (error) {
    logger.error('Database query error:', { sql, error: error.message })
    throw error
  }
}

/**
 * Obtener una conexión del pool (para transacciones)
 * @returns {Promise<Connection>}
 */
export const getConnection = async () => {
  return await pool.getConnection()
}

/**
 * Ejecutar múltiples queries en una transacción
 * @param {Function} callback - Función que recibe la conexión
 * @returns {Promise<any>}
 */
export const transaction = async (callback) => {
  const connection = await pool.getConnection()
  
  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/**
 * Probar conexión a la base de datos
 * @returns {Promise<boolean>}
 */
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection()
    logger.info('✅ Database connected successfully', {
      host: config.db.host,
      database: config.db.database,
    })
    connection.release()
    return true
  } catch (error) {
    logger.error('❌ Database connection failed:', error.message)
    return false
  }
}

/**
 * Cerrar todas las conexiones del pool
 */
export const closePool = async () => {
  await pool.end()
  logger.info('Database pool closed')
}

export default pool
