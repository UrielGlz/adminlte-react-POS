import { query } from '../../config/database.js'
import { NotFoundError, ConflictError } from '../../utils/errors.js'

/**
 * Obtener menú filtrado por permisos del usuario (para el sidebar)
 */
export const getNavigation = async (userPermissions) => {
  const items = await query(
    `SELECT nav_id, parent_id, type, label, icon, route, permission_code, sort_order
     FROM navigation_items
     WHERE is_active = 1
     ORDER BY sort_order ASC`
  )

  const allowedItems = items.filter(item => {
    if (!item.permission_code) return true
    return userPermissions.includes(item.permission_code)
  })

  const buildTree = (parentId = null) => {
    return allowedItems
      .filter(item => item.parent_id === parentId)
      .map(item => {
        const node = {
          id: item.nav_id,
          type: item.type,
          label: item.label,
        }

        if (item.icon) node.icon = item.icon
        if (item.route) node.to = item.route

        if (item.type === 'tree') {
          const children = buildTree(item.nav_id)
          if (children.length > 0) {
            node.children = children
          }
        }

        return node
      })
  }

  return buildTree(null)
}

// =============================================
// ADMIN CRUD FUNCTIONS
// =============================================

/**
 * Obtener todos los items (para administración)
 */
export const getAllAdmin = async () => {
  const items = await query(
    `SELECT n.nav_id, n.parent_id, n.type, n.label, n.icon, n.route, 
            n.permission_code, n.sort_order, n.is_active, n.created_at,
            p.label as parent_label
     FROM navigation_items n
     LEFT JOIN navigation_items p ON n.parent_id = p.nav_id
     ORDER BY n.sort_order ASC`
  )

  // También devolver como árbol para visualización
  const buildAdminTree = (parentId = null, level = 0) => {
    return items
      .filter(item => item.parent_id === parentId)
      .map(item => ({
        ...item,
        level,
        children: buildAdminTree(item.nav_id, level + 1)
      }))
  }

  return {
    flat: items,
    tree: buildAdminTree(null)
  }
}

/**
 * Obtener item por ID
 */
export const getById = async (navId) => {
  const items = await query(
    `SELECT nav_id, parent_id, type, label, icon, route, 
            permission_code, sort_order, is_active, created_at
     FROM navigation_items 
     WHERE nav_id = ?`,
    [navId]
  )

  if (items.length === 0) {
    throw new NotFoundError('Navigation item not found')
  }

  return items[0]
}

/**
 * Crear nuevo item
 */
export const create = async (data) => {
  const { 
    parent_id, 
    type, 
    label, 
    icon, 
    route, 
    permission_code, 
    sort_order, 
    is_active = true 
  } = data

  // Validar tipo
  if (!['header', 'link', 'tree'].includes(type)) {
    throw new ConflictError('Invalid type. Must be: header, link, or tree')
  }

  // Validar parent_id si se proporciona
  if (parent_id) {
    const parent = await query(
      'SELECT nav_id, type FROM navigation_items WHERE nav_id = ?',
      [parent_id]
    )
    if (parent.length === 0) {
      throw new NotFoundError('Parent item not found')
    }
    if (parent[0].type !== 'tree') {
      throw new ConflictError('Parent must be of type "tree"')
    }
  }

  // Validar permission_code si se proporciona
  if (permission_code) {
    const perm = await query(
      'SELECT permission_id FROM permissions WHERE code = ?',
      [permission_code]
    )
    if (perm.length === 0) {
      throw new NotFoundError(`Permission code "${permission_code}" not found`)
    }
  }

  // Obtener siguiente sort_order si no se proporciona
  let finalSortOrder = sort_order
  if (finalSortOrder === undefined || finalSortOrder === null) {
    const maxOrder = await query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order 
       FROM navigation_items 
       WHERE parent_id ${parent_id ? '= ?' : 'IS NULL'}`,
      parent_id ? [parent_id] : []
    )
    finalSortOrder = maxOrder[0].next_order
  }

  const result = await query(
    `INSERT INTO navigation_items 
     (parent_id, type, label, icon, route, permission_code, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      parent_id || null,
      type,
      label,
      icon || null,
      route || null,
      permission_code || null,
      finalSortOrder,
      is_active ? 1 : 0
    ]
  )

  return await getById(result.insertId)
}

/**
 * Actualizar item
 */
export const update = async (navId, data) => {
  const { 
    parent_id, 
    type, 
    label, 
    icon, 
    route, 
    permission_code, 
    sort_order, 
    is_active 
  } = data

  // Verificar que existe
  const existing = await query(
    'SELECT nav_id FROM navigation_items WHERE nav_id = ?',
    [navId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Navigation item not found')
  }

  // Validar tipo si se proporciona
  if (type && !['header', 'link', 'tree'].includes(type)) {
    throw new ConflictError('Invalid type. Must be: header, link, or tree')
  }

  // No permitir que un item sea su propio padre
  if (parent_id && parseInt(parent_id) === parseInt(navId)) {
    throw new ConflictError('An item cannot be its own parent')
  }

  // Validar parent_id si se proporciona
  if (parent_id) {
    const parent = await query(
      'SELECT nav_id, type FROM navigation_items WHERE nav_id = ?',
      [parent_id]
    )
    if (parent.length === 0) {
      throw new NotFoundError('Parent item not found')
    }
    if (parent[0].type !== 'tree') {
      throw new ConflictError('Parent must be of type "tree"')
    }

    // Verificar que no se cree un ciclo (el padre no puede ser hijo del item actual)
    const isChild = await checkIsChild(navId, parent_id)
    if (isChild) {
      throw new ConflictError('Cannot set a child item as parent (circular reference)')
    }
  }

  // Validar permission_code si se proporciona
  if (permission_code) {
    const perm = await query(
      'SELECT permission_id FROM permissions WHERE code = ?',
      [permission_code]
    )
    if (perm.length === 0) {
      throw new NotFoundError(`Permission code "${permission_code}" not found`)
    }
  }

  await query(
    `UPDATE navigation_items 
     SET parent_id = ?, type = ?, label = ?, icon = ?, route = ?, 
         permission_code = ?, sort_order = ?, is_active = ?
     WHERE nav_id = ?`,
    [
      parent_id !== undefined ? (parent_id || null) : existing.parent_id,
      type,
      label,
      icon || null,
      route || null,
      permission_code || null,
      sort_order,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      navId
    ]
  )

  return await getById(navId)
}

/**
 * Verificar si un item es hijo de otro (para evitar ciclos)
 */
const checkIsChild = async (parentId, potentialChildId) => {
  const children = await query(
    'SELECT nav_id FROM navigation_items WHERE parent_id = ?',
    [parentId]
  )

  for (const child of children) {
    if (child.nav_id === parseInt(potentialChildId)) {
      return true
    }
    const isGrandChild = await checkIsChild(child.nav_id, potentialChildId)
    if (isGrandChild) return true
  }

  return false
}

/**
 * Eliminar item
 */
export const remove = async (navId) => {
  // Verificar que existe
  const existing = await query(
    'SELECT nav_id, type FROM navigation_items WHERE nav_id = ?',
    [navId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Navigation item not found')
  }

  // Verificar si tiene hijos
  const children = await query(
    'SELECT COUNT(*) as count FROM navigation_items WHERE parent_id = ?',
    [navId]
  )

  if (children[0].count > 0) {
    throw new ConflictError(`Cannot delete. This item has ${children[0].count} child item(s). Delete or reassign them first.`)
  }

  await query('DELETE FROM navigation_items WHERE nav_id = ?', [navId])

  return true
}

/**
 * Reordenar items
 */
export const reorder = async (items) => {
  // items = [{ nav_id: 1, sort_order: 0 }, { nav_id: 2, sort_order: 1 }, ...]
  for (const item of items) {
    await query(
      'UPDATE navigation_items SET sort_order = ? WHERE nav_id = ?',
      [item.sort_order, item.nav_id]
    )
  }

  return await getAllAdmin()
}

/**
 * Obtener items que pueden ser padre (type = 'tree')
 */
export const getParentOptions = async (excludeId = null) => {
  let sql = `SELECT nav_id, label FROM navigation_items WHERE type = 'tree'`
  const params = []

  if (excludeId) {
    sql += ` AND nav_id != ?`
    params.push(excludeId)
  }

  sql += ` ORDER BY sort_order ASC`

  return await query(sql, params)
}

/**
 * Obtener todos los permission codes disponibles (para dropdown)
 */
export const getPermissionOptions = async () => {
  return await query(
    `SELECT code, name, module FROM permissions ORDER BY module, code`
  )
}

export default {
  getNavigation,
  getAllAdmin,
  getById,
  create,
  update,
  remove,
  reorder,
  getParentOptions,
  getPermissionOptions,
}