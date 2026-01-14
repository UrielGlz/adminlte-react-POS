import { query } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'

/**
 * Sale Driver Info Service
 * Catálogo de información de conductores (READONLY)
 * Datos capturados desde el POS durante las transacciones
 */

export const getAll = async (options = {}) => {
  const {
    page = 1,
    limit = 20,
    search = '',
    account_number = null,
    license_state = null,
    driver_product_id = null,
    date_from = null,
    date_to = null
  } = options

  const offset = (page - 1) * limit
  const params = []

  let sql = `
    SELECT 
      sdi.*,
      dp.code AS product_code,
      dp.name AS product_name,
      vt.code AS vehicle_type_code,
      vt.name AS vehicle_type_name
    FROM sale_driver_info sdi
    LEFT JOIN driver_products dp ON sdi.driver_product_id = dp.product_id
    LEFT JOIN vehicle_types vt ON sdi.vehicle_type_id = vt.vehicle_type_id
    WHERE 1=1
  `

  // Filtro de búsqueda
  if (search) {
    sql += ` AND (
      sdi.driver_first_name LIKE ? OR 
      sdi.driver_last_name LIKE ? OR 
      sdi.account_name LIKE ? OR 
      sdi.vehicle_plates LIKE ? OR
      sdi.license_number LIKE ? OR
      sdi.sale_uid LIKE ?
    )`
    const searchTerm = `%${search}%`
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm)
  }

  // Filtro por cuenta
  if (account_number) {
    sql += ` AND sdi.account_number = ?`
    params.push(account_number)
  }

  // Filtro por estado de licencia
  if (license_state) {
    sql += ` AND sdi.license_state = ?`
    params.push(license_state)
  }

  // Filtro por producto
  if (driver_product_id) {
    sql += ` AND sdi.driver_product_id = ?`
    params.push(driver_product_id)
  }

  // Filtro por rango de fechas
  if (date_from) {
    sql += ` AND DATE(sdi.created_at) >= ?`
    params.push(date_from)
  }
  if (date_to) {
    sql += ` AND DATE(sdi.created_at) <= ?`
    params.push(date_to)
  }

  // Contar total
  const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM')
  const countResult = await query(countSql, params)
  const total = countResult[0]?.total || 0

  // Ordenar y paginar
  sql += ` ORDER BY sdi.created_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  const items = await query(sql, params)

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

export const getById = async (id) => {
  const sql = `
    SELECT 
      sdi.*,
      dp.code AS product_code,
      dp.name AS product_name,
      vt.code AS vehicle_type_code,
      vt.name AS vehicle_type_name
    FROM sale_driver_info sdi
    LEFT JOIN driver_products dp ON sdi.driver_product_id = dp.product_id
    LEFT JOIN vehicle_types vt ON sdi.vehicle_type_id = vt.vehicle_type_id
    WHERE sdi.id_driver_info = ?
  `
  const result = await query(sql, [id])
  if (result.length === 0) throw new NotFoundError('Driver info not found')
  return result[0]
}

/**
 * Obtener estadísticas para los filtros
 */
export const getStats = async () => {
  // Cuentas únicas
  const accounts = await query(`
    SELECT DISTINCT account_number, account_name 
    FROM sale_driver_info 
    WHERE account_number IS NOT NULL AND account_number != ''
    ORDER BY account_name
  `)

  // Estados de licencia únicos
  const licenseStates = await query(`
    SELECT DISTINCT license_state 
    FROM sale_driver_info 
    WHERE license_state IS NOT NULL AND license_state != ''
    ORDER BY license_state
  `)

  // Productos únicos
  const products = await query(`
    SELECT DISTINCT dp.product_id, dp.code, dp.name
    FROM sale_driver_info sdi
    INNER JOIN driver_products dp ON sdi.driver_product_id = dp.product_id
    ORDER BY dp.name
  `)

  // Totales
  const totals = await query(`
    SELECT 
      COUNT(*) as total_records,
      COUNT(DISTINCT CONCAT(driver_first_name, driver_last_name)) as unique_drivers,
      COUNT(DISTINCT account_number) as unique_accounts,
      COUNT(DISTINCT vehicle_plates) as unique_vehicles
    FROM sale_driver_info
  `)

  return {
    accounts,
    licenseStates: licenseStates.map(l => l.license_state),
    products,
    totals: totals[0]
  }
}

export default { getAll, getById, getStats }