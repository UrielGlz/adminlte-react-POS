import { query } from '../../config/database.js'
import { NotFoundError, ConflictError } from '../../utils/errors.js'

/**
 * Obtener todos los permisos
 */
export const getAll = async () => {
  const permissions = await query(
    `SELECT p.permission_id, p.code, p.name, p.module, p.description, p.created_at,
            (SELECT COUNT(*) FROM role_permissions rp WHERE rp.permission_id = p.permission_id) as roles_count,
            (SELECT COUNT(*) FROM navigation_items n WHERE n.permission_code = p.code) as nav_items_count
     FROM permissions p
     ORDER BY p.module, p.code`
  )
  return permissions
}

/**
 * Obtener permisos agrupados por módulo
 */
export const getGrouped = async () => {
  const permissions = await getAll()
  
  const grouped = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = []
    }
    acc[perm.module].push(perm)
    return acc
  }, {})

  return {
    all: permissions,
    grouped: grouped,
    modules: [...new Set(permissions.map(p => p.module))].sort()
  }
}

/**
 * Obtener permiso por ID
 */
export const getById = async (permissionId) => {
  const permissions = await query(
    `SELECT permission_id, code, name, module, description, created_at
     FROM permissions 
     WHERE permission_id = ?`,
    [permissionId]
  )

  if (permissions.length === 0) {
    throw new NotFoundError('Permission not found')
  }

  const permission = permissions[0]

  // Obtener roles que tienen este permiso
  const roles = await query(
    `SELECT r.role_id, r.code, r.name
     FROM roles r
     INNER JOIN role_permissions rp ON r.role_id = rp.role_id
     WHERE rp.permission_id = ?
     ORDER BY r.name`,
    [permissionId]
  )

  // Obtener items de navegación que usan este permiso
  const navItems = await query(
    `SELECT nav_id, label, route
     FROM navigation_items
     WHERE permission_code = ?`,
    [permission.code]
  )

  permission.roles = roles
  permission.nav_items = navItems

  return permission
}

/**
 * Crear nuevo permiso
 */
export const create = async (data) => {
  const { code, name, module, description } = data

  // Validar que code tenga formato correcto (module.action)
  if (!code || !code.includes('.')) {
    throw new ConflictError('Code must be in format: module.action (e.g., users.read)')
  }

  // Verificar código único
  const existing = await query(
    'SELECT permission_id FROM permissions WHERE code = ?',
    [code.toLowerCase()]
  )

  if (existing.length > 0) {
    throw new ConflictError('Permission code already exists')
  }

  const result = await query(
    `INSERT INTO permissions (code, name, module, description)
     VALUES (?, ?, ?, ?)`,
    [
      code.toLowerCase(),
      name,
      module.toLowerCase(),
      description || null
    ]
  )

  return await getById(result.insertId)
}

/**
 * Actualizar permiso
 */
export const update = async (permissionId, data) => {
  const { code, name, module, description } = data

  // Verificar que existe
  const existing = await query(
    'SELECT permission_id, code FROM permissions WHERE permission_id = ?',
    [permissionId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Permission not found')
  }

  const oldCode = existing[0].code

  // Validar formato del código
  if (code && !code.includes('.')) {
    throw new ConflictError('Code must be in format: module.action (e.g., users.read)')
  }

  // Si cambia el código, verificar que no exista
  if (code && code.toLowerCase() !== oldCode) {
    const duplicate = await query(
      'SELECT permission_id FROM permissions WHERE code = ? AND permission_id != ?',
      [code.toLowerCase(), permissionId]
    )

    if (duplicate.length > 0) {
      throw new ConflictError('Permission code already exists')
    }

    // Actualizar navigation_items que usaban el código anterior
    await query(
      'UPDATE navigation_items SET permission_code = ? WHERE permission_code = ?',
      [code.toLowerCase(), oldCode]
    )
  }

  await query(
    `UPDATE permissions 
     SET code = ?, name = ?, module = ?, description = ?
     WHERE permission_id = ?`,
    [
      code ? code.toLowerCase() : oldCode,
      name,
      module.toLowerCase(),
      description || null,
      permissionId
    ]
  )

  return await getById(permissionId)
}

/**
 * Eliminar permiso
 */
export const remove = async (permissionId) => {
  // Verificar que existe
  const existing = await query(
    'SELECT permission_id, code FROM permissions WHERE permission_id = ?',
    [permissionId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Permission not found')
  }

  // Verificar que no esté asignado a roles
  const rolesCount = await query(
    'SELECT COUNT(*) as count FROM role_permissions WHERE permission_id = ?',
    [permissionId]
  )

  if (rolesCount[0].count > 0) {
    throw new ConflictError(`Cannot delete. This permission is assigned to ${rolesCount[0].count} role(s). Remove it from roles first.`)
  }

  // Verificar que no esté usado en navigation_items
  const navCount = await query(
    'SELECT COUNT(*) as count FROM navigation_items WHERE permission_code = ?',
    [existing[0].code]
  )

  if (navCount[0].count > 0) {
    throw new ConflictError(`Cannot delete. This permission is used by ${navCount[0].count} navigation item(s). Update them first.`)
  }

  await query('DELETE FROM permissions WHERE permission_id = ?', [permissionId])

  return true
}

/**
 * Obtener lista de módulos únicos (para dropdown)
 */
export const getModules = async () => {
  const modules = await query(
    `SELECT DISTINCT module FROM permissions ORDER BY module`
  )
  return modules.map(m => m.module)
}

export default {
  getAll,
  getGrouped,
  getById,
  create,
  update,
  remove,
  getModules,
}