import { Router } from 'express'
import * as PosSettingsController from './posSettings.controller.js'
import { authenticate, requirePermission } from '../../../middleware/auth.js'

const router = Router()
router.use(authenticate)

// Obtener lista de módulos
router.get('/modules', requirePermission('settings.pos'), PosSettingsController.getModules)

// Obtener settings por módulo
router.get('/module/:module', requirePermission('settings.pos'), PosSettingsController.getByModule)

// Actualizar un setting
router.put('/:id', requirePermission('settings.pos'), PosSettingsController.update)

// Actualizar múltiples settings
router.put('/', requirePermission('settings.pos'), PosSettingsController.updateBulk)

// Crear nuevo setting
router.post('/', requirePermission('settings.pos'), PosSettingsController.create)

export default router