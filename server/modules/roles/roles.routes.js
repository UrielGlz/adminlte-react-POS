import { Router } from 'express'
import rolesController from './roles.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()

// Todas las rutas requieren autenticación
router.use(authenticate)

// GET /api/roles - Listar roles (requiere roles.read)
router.get('/', requirePermission('roles.read'), rolesController.getAll)

// GET /api/roles/:id - Obtener rol por ID
router.get('/:id', requirePermission('roles.read'), rolesController.getById)

// POST /api/roles - Crear rol (requiere roles.write)
router.post('/', requirePermission('roles.write'), rolesController.create)

// PUT /api/roles/:id - Actualizar rol
router.put('/:id', requirePermission('roles.write'), rolesController.update)

// DELETE /api/roles/:id - Eliminar rol
router.delete('/:id', requirePermission('roles.write'), rolesController.remove)

// PUT /api/roles/:id/permissions - Asignar permisos
router.put('/:id/permissions', requirePermission('roles.write'), rolesController.assignPermissions)

export default router