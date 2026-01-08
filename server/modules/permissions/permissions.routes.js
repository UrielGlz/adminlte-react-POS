import { Router } from 'express'
import permissionsController from './permissions.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()

// Todas las rutas requieren autenticación
router.use(authenticate)

// GET /api/permissions - Obtener todos (agrupados)
router.get('/', requirePermission('roles.read'), permissionsController.getAll)

// GET /api/permissions/list - Lista plana
router.get('/list', requirePermission('roles.read'), permissionsController.getList)

// GET /api/permissions/modules - Lista de módulos únicos
router.get('/modules', requirePermission('roles.read'), permissionsController.getModules)

// GET /api/permissions/:id - Obtener por ID
router.get('/:id', requirePermission('roles.read'), permissionsController.getById)

// POST /api/permissions - Crear
router.post('/', requirePermission('roles.write'), permissionsController.create)

// PUT /api/permissions/:id - Actualizar
router.put('/:id', requirePermission('roles.write'), permissionsController.update)

// DELETE /api/permissions/:id - Eliminar
router.delete('/:id', requirePermission('roles.write'), permissionsController.remove)

export default router