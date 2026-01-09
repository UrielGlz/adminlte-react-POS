import { query } from '../../config/database.js'
import { NotFoundError, ConflictError } from '../../utils/errors.js'

/**
 * Obtener todos los status, opcionalmente filtrados por módulo
 */
export const getAll = async (module = null) => {
  let sql = `
    SELECT status_id, module, code, label, sort_order, is_final, is_active, created_at, updated_at
    FROM status_catalogo
  `
  const params = []

  if (module) {
    sql += ` WHERE module = ?`
    params.push(module.toUpperCase())
  }

  sql += ` ORDER BY module, sort_order ASC`

  return await query(sql, params)
}

/**
 * Obtener status agrupados por módulo
 */
export const getGrouped = async () => {
  const items = await getAll()
  
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.module]) {
      acc[item.module] = []
    }
    acc[item.module].push(item)
    return acc
  }, {})

  const modules = [...new Set(items.map(i => i.module))].sort()

  return {
    all: items,
    grouped,
    modules
  }
}

/**
 * Obtener por ID
 */
export const getById = async (statusId) => {
  const items = await query(
    `SELECT status_id, module, code, label, sort_order, is_final, is_active, created_at, updated_at
     FROM status_catalogo 
     WHERE status_id = ?`,
    [statusId]
  )

  if (items.length === 0) {
    throw new NotFoundError('Status not found')
  }

  return items[0]
}

/**
 * Obtener por módulo y código
 */
export const getByModuleAndCode = async (module, code) => {
  const items = await query(
    `SELECT status_id, module, code, label, sort_order, is_final, is_active
     FROM status_catalogo 
     WHERE module = ? AND code = ?`,
    [module.toUpperCase(), code.toUpperCase()]
  )

  return items.length > 0 ? items[0] : null
}

/**
 * Crear nuevo status
 */
export const create = async (data) => {
  const { module, code, label, sort_order, is_final = false, is_active = true } = data

  // Verificar duplicado
  const existing = await query(
    'SELECT status_id FROM status_catalogo WHERE module = ? AND code = ?',
    [module.toUpperCase(), code.toUpperCase()]
  )

  if (existing.length > 0) {
    throw new ConflictError(`Status code "${code}" already exists in module "${module}"`)
  }

  // Obtener siguiente sort_order si no se proporciona
  let finalSortOrder = sort_order
  if (finalSortOrder === undefined || finalSortOrder === null) {
    const maxOrder = await query(
      `SELECT COALESCE(MAX(sort_order), 0) + 10 as next_order 
       FROM status_catalogo 
       WHERE module = ?`,
      [module.toUpperCase()]
    )
    finalSortOrder = maxOrder[0].next_order
  }

  const result = await query(
    `INSERT INTO status_catalogo (module, code, label, sort_order, is_final, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      module.toUpperCase(),
      code.toUpperCase(),
      label,
      finalSortOrder,
      is_final ? 1 : 0,
      is_active ? 1 : 0
    ]
  )

  return await getById(result.insertId)
}

/**
 * Actualizar status
 */
export const update = async (statusId, data) => {
  const { module, code, label, sort_order, is_final, is_active } = data

  // Verificar que existe
  const existing = await query(
    'SELECT status_id, module, code FROM status_catalogo WHERE status_id = ?',
    [statusId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Status not found')
  }

  // Si cambia module+code, verificar que no exista
  const newModule = module ? module.toUpperCase() : existing[0].module
  const newCode = code ? code.toUpperCase() : existing[0].code

  if (newModule !== existing[0].module || newCode !== existing[0].code) {
    const duplicate = await query(
      'SELECT status_id FROM status_catalogo WHERE module = ? AND code = ? AND status_id != ?',
      [newModule, newCode, statusId]
    )

    if (duplicate.length > 0) {
      throw new ConflictError(`Status code "${newCode}" already exists in module "${newModule}"`)
    }
  }

  await query(
    `UPDATE status_catalogo 
     SET module = ?, code = ?, label = ?, sort_order = ?, is_final = ?, is_active = ?, updated_at = NOW()
     WHERE status_id = ?`,
    [
      newModule,
      newCode,
      label,
      sort_order,
      is_final !== undefined ? (is_final ? 1 : 0) : existing[0].is_final,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      statusId
    ]
  )

  return await getById(statusId)
}

/**
 * Eliminar status
 */
export const remove = async (statusId) => {
  // Verificar que existe
  const existing = await query(
    'SELECT status_id, module, code FROM status_catalogo WHERE status_id = ?',
    [statusId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Status not found')
  }

  // Verificar uso según el módulo
  const { module, code } = existing[0]
  let usageCount = 0

  if (module === 'SALES') {
    const usage = await query(
      'SELECT COUNT(*) as count FROM sales WHERE sale_status_id = ?',
      [statusId]
    )
    usageCount = usage[0].count
  } else if (module === 'PAYMENTS') {
    const usage = await query(
      'SELECT COUNT(*) as count FROM payments WHERE payment_status_id = ?',
      [statusId]
    )
    usageCount = usage[0].count
  } else if (module === 'TICKETS') {
    const usage = await query(
      'SELECT COUNT(*) as count FROM tickets WHERE ticket_status_id = ?',
      [statusId]
    )
    usageCount = usage[0].count
  }

  if (usageCount > 0) {
    throw new ConflictError(`Cannot delete. This status is used by ${usageCount} record(s).`)
  }

  await query('DELETE FROM status_catalogo WHERE status_id = ?', [statusId])

  return true
}

/**
 * Obtener lista de módulos únicos
 */
export const getModules = async () => {
  const modules = await query(
    `SELECT DISTINCT module FROM status_catalogo ORDER BY module`
  )
  return modules.map(m => m.module)
}

export default {
  getAll,
  getGrouped,
  getById,
  getByModuleAndCode,
  create,
  update,
  remove,
  getModules,
}