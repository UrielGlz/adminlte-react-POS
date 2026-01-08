import { Router } from 'express'
import navigationController from './navigation.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()

// =============================================
// RUTA PÚBLICA (para sidebar del usuario)
// =============================================
router.get('/', authenticate, navigationController.getNavigation)

// =============================================
// RUTAS ADMIN (requieren navigation.read/write)
// =============================================

// Opciones para dropdowns (antes de las rutas con :id)
router.get('/admin/options/parents', authenticate, requirePermission('navigation.read'), navigationController.getParentOptions)
router.get('/admin/options/permissions', authenticate, requirePermission('navigation.read'), navigationController.getPermissionOptions)

// CRUD Admin
router.get('/admin', authenticate, requirePermission('navigation.read'), navigationController.getAllAdmin)
router.get('/admin/:id', authenticate, requirePermission('navigation.read'), navigationController.getById)
router.post('/admin', authenticate, requirePermission('navigation.write'), navigationController.create)
router.put('/admin/reorder', authenticate, requirePermission('navigation.write'), navigationController.reorder)
router.put('/admin/:id', authenticate, requirePermission('navigation.write'), navigationController.update)
router.delete('/admin/:id', authenticate, requirePermission('navigation.write'), navigationController.remove)

export default router