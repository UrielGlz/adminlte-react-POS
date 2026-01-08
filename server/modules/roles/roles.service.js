import { query } from '../../config/database.js'
import { NotFoundError, ConflictError } from '../../utils/errors.js'

/**
 * Obtener todos los roles
 */
export const getAll = async () => {
  const roles = await query(
    `SELECT r.role_id, r.code, r.name, r.description, r.is_active, r.created_at,
            COUNT(rp.permission_id) as permissions_count,
            (SELECT COUNT(*) FROM users u WHERE u.role_code = r.code) as users_count
     FROM roles r
     LEFT JOIN role_permissions rp ON r.role_id = rp.role_id
     GROUP BY r.role_id
     ORDER BY r.role_id ASC`
  )
  return roles
}

/**
 * Obtener rol por ID con sus permisos
 */
export const getById = async (roleId) => {
  // Obtener rol
  const roles = await query(
    `SELECT role_id, code, name, description, is_active, created_at
     FROM roles WHERE role_id = ?`,
    [roleId]
  )

  if (roles.length === 0) {
    throw new NotFoundError('Role not found')
  }

  const role = roles[0]

  // Obtener permisos asignados
  const permissions = await query(
    `SELECT p.permission_id, p.code, p.name, p.module
     FROM permissions p
     INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
     WHERE rp.role_id = ?
     ORDER BY p.module, p.code`,
    [roleId]
  )

  role.permissions = permissions
  role.permission_ids = permissions.map(p => p.permission_id)

  return role
}

/**
 * Crear nuevo rol
 */
export const create = async (data) => {
  const { code, name, description, is_active = true, permission_ids = [] } = data

  // Verificar código único
  const existing = await query(
    'SELECT role_id FROM roles WHERE code = ?',
    [code.toUpperCase()]
  )

  if (existing.length > 0) {
    throw new ConflictError('Role code already exists')
  }

  // Insertar rol
  const result = await query(
    `INSERT INTO roles (code, name, description, is_active)
     VALUES (?, ?, ?, ?)`,
    [code.toUpperCase(), name, description || null, is_active ? 1 : 0]
  )

  const roleId = result.insertId

  // Asignar permisos si se proporcionaron
  if (permission_ids.length > 0) {
    await assignPermissions(roleId, permission_ids)
  }

  return await getById(roleId)
}


/**
 * Actualizar rol
 */
export const update = async (roleId, data) => {
  const { code, name, description, is_active, permission_ids } = data  // ← Agregado permission_ids

  // Verificar que existe
  const existing = await query(
    'SELECT role_id, code FROM roles WHERE role_id = ?',
    [roleId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Role not found')
  }

  // Si cambia el código, verificar que no exista
  if (code && code.toUpperCase() !== existing[0].code) {
    const duplicate = await query(
      'SELECT role_id FROM roles WHERE code = ? AND role_id != ?',
      [code.toUpperCase(), roleId]
    )

    if (duplicate.length > 0) {
      throw new ConflictError('Role code already exists')
    }

    // Actualizar usuarios que tenían el código anterior
    await query(
      'UPDATE users SET role_code = ? WHERE role_code = ?',
      [code.toUpperCase(), existing[0].code]
    )
  }

  // Actualizar rol
  await query(
    `UPDATE roles 
     SET code = ?, name = ?, description = ?, is_active = ?
     WHERE role_id = ?`,
    [
      code ? code.toUpperCase() : existing[0].code,
      name,
      description || null,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      roleId
    ]
  )

  // ← NUEVO: Actualizar permisos si se proporcionaron
  if (permission_ids !== undefined) {
    // Eliminar permisos actuales
    await query('DELETE FROM role_permissions WHERE role_id = ?', [roleId])

    // Insertar nuevos permisos
    if (permission_ids.length > 0) {
      const values = permission_ids.map(pid => `(${roleId}, ${pid})`).join(', ')
      await query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`
      )
    }
  }

  return await getById(roleId)
}

/**
 * Eliminar rol
 */
export const remove = async (roleId) => {
  // Verificar que existe
  const existing = await query(
    'SELECT role_id, code FROM roles WHERE role_id = ?',
    [roleId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Role not found')
  }

  // Verificar que no tenga usuarios asignados
  const usersWithRole = await query(
    'SELECT COUNT(*) as count FROM users WHERE role_code = ?',
    [existing[0].code]
  )

  if (usersWithRole[0].count > 0) {
    throw new ConflictError(`Cannot delete role. ${usersWithRole[0].count} user(s) are assigned to this role.`)
  }

  // Eliminar permisos del rol
  await query('DELETE FROM role_permissions WHERE role_id = ?', [roleId])

  // Eliminar rol
  await query('DELETE FROM roles WHERE role_id = ?', [roleId])

  return true
}

/**
 * Asignar permisos a un rol (reemplaza los existentes)
 */
export const assignPermissions = async (roleId, permissionIds) => {
  // Verificar que el rol existe
  const existing = await query(
    'SELECT role_id FROM roles WHERE role_id = ?',
    [roleId]
  )

  if (existing.length === 0) {
    throw new NotFoundError('Role not found')
  }

  // Eliminar permisos actuales
  await query('DELETE FROM role_permissions WHERE role_id = ?', [roleId])

  // Insertar nuevos permisos
  if (permissionIds.length > 0) {
    const values = permissionIds.map(pid => `(${roleId}, ${pid})`).join(', ')
    await query(
      `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`
    )
  }

  return await getById(roleId)
}

/**
 * Obtener todos los permisos (para el formulario de checkboxes)
 */
export const getAllPermissions = async () => {
  const permissions = await query(
    `SELECT permission_id, code, name, module, description
     FROM permissions
     ORDER BY module, code`
  )

  // Agrupar por módulo
  const grouped = permissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = []
    }
    acc[perm.module].push(perm)
    return acc
  }, {})

  return {
    all: permissions,
    grouped: grouped
  }
}

export default {
  getAll,
  getById,
  create,
  update,
  remove,
  assignPermissions,
  getAllPermissions,
}