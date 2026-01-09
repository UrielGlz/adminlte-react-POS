import { query } from '../../config/database.js'
import { NotFoundError, ConflictError } from '../../utils/errors.js'

/**
 * Obtener todos los productos
 */
export const getAll = async (includeInactive = false) => {
  let sql = `
    SELECT p.product_id, p.code, p.name, p.unit, p.taxable, 
           p.default_tax_rate_id, p.default_price, p.currency, p.meta,
           p.is_active, p.created_at, p.updated_at,
           t.name as tax_rate_name, t.percent as tax_rate_percent
    FROM products p
    LEFT JOIN tax_rates t ON p.default_tax_rate_id = t.tax_rate_id
  `
  
  if (!includeInactive) {
    sql += ` WHERE p.is_active = 1`
  }
  
  sql += ` ORDER BY p.name ASC`
  
  return await query(sql)
}

/**
 * Obtener por ID
 */
export const getById = async (productId) => {
  const items = await query(
    `SELECT p.product_id, p.code, p.name, p.unit, p.taxable, 
            p.default_tax_rate_id, p.default_price, p.currency, p.meta,
            p.is_active, p.created_at, p.updated_at,
            t.name as tax_rate_name, t.percent as tax_rate_percent
     FROM products p
     LEFT JOIN tax_rates t ON p.default_tax_rate_id = t.tax_rate_id
     WHERE p.product_id = ?`,
    [productId]
  )

  if (items.length === 0) {
    throw new NotFoundError('Product not found')
  }

  // Contar uso en sale_lines
  const usage = await query(
    'SELECT COUNT(*) as count FROM sale_lines WHERE product_id = ?',
    [productId]
  )

  const item = items[0]
  item.usage_count = usage[0].count

  // Parse meta JSON
  if (item.meta) {
    try {
      item.meta = JSON.parse(item.meta)
    } catch (e) {
      item.meta = {}
    }
  }

  return item
}

/**
 * Crear producto
 */
export const create = async (data) => {
  const { code, name, unit, taxable = false, default_tax_rate_id, default_price, currency = 'USD', meta, is_active = true } = data

  // Verificar código único
  const existing = await query(
    'SELECT product_id FROM products WHERE code = ?',
    [code.toUpperCase()]
  )

  if (existing.length > 0) {
    throw new ConflictError(`Product code "${code}" already exists`)
  }

  const result = await query(
    `INSERT INTO products (code, name, unit, taxable, default_tax_rate_id, default_price, currency, meta, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      code.toUpperCase(),
      name,
      unit || 'service',
      taxable ? 1 : 0,
      default_tax_rate_id || null,
      default_price || 0,
      currency,
      meta ? JSON.stringify(meta) : null,
      is_active ? 1 : 0
    ]
  )

  return await getById(result.insertId)
}

/**
 * Actualizar producto
 */
export const update = async (productId, data) => {
  const { code, name, unit, taxable, default_tax_rate_id, default_price, currency, meta, is_active } = data

  // Verificar que existe
  const existing = await query(
    'SELECT product_id, code FROM products WHERE product_id = ?',
    [productId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Product not found')
  }

  // Si cambia el código, verificar que no exista
  if (code && code.toUpperCase() !== existing[0].code) {
    const duplicate = await query(
      'SELECT product_id FROM products WHERE code = ? AND product_id != ?',
      [code.toUpperCase(), productId]
    )

    if (duplicate.length > 0) {
      throw new ConflictError(`Product code "${code}" already exists`)
    }
  }

  await query(
    `UPDATE products 
     SET code = ?, name = ?, unit = ?, taxable = ?, default_tax_rate_id = ?, 
         default_price = ?, currency = ?, meta = ?, is_active = ?, updated_at = NOW()
     WHERE product_id = ?`,
    [
      code ? code.toUpperCase() : existing[0].code,
      name,
      unit || 'service',
      taxable !== undefined ? (taxable ? 1 : 0) : 0,
      default_tax_rate_id || null,
      default_price || 0,
      currency || 'USD',
      meta ? JSON.stringify(meta) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      productId
    ]
  )

  return await getById(productId)
}

/**
 * Eliminar producto
 */
export const remove = async (productId) => {
  const existing = await query(
    'SELECT product_id FROM products WHERE product_id = ?',
    [productId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Product not found')
  }

  // Verificar uso
  const usage = await query(
    'SELECT COUNT(*) as count FROM sale_lines WHERE product_id = ?',
    [productId]
  )

  if (usage[0].count > 0) {
    throw new ConflictError(`Cannot delete. This product is used in ${usage[0].count} sale(s).`)
  }

  await query('DELETE FROM products WHERE product_id = ?', [productId])

  return true
}

/**
 * Obtener tax rates para dropdown
 */
export const getTaxRates = async () => {
  return await query(
    `SELECT tax_rate_id, code, name, percent 
     FROM tax_rates 
     WHERE is_active = 1 
     ORDER BY name`
  )
}

export default {
  getAll,
  getById,
  create,
  update,
  remove,
  getTaxRates,
}