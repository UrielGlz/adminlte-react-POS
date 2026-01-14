import { Router } from 'express'
import * as UsersController from './users.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()

/**
 * Users Routes
 * Base: /api/users
 */

// 👇 Todas las rutas protegidas para que req.user esté disponible
router.get('/', authenticate, UsersController.getAll)
router.get('/stats', authenticate, UsersController.getStats)
router.get('/:id', authenticate, UsersController.getById)
router.post('/', authenticate, requirePermission('users.write'), UsersController.create)
router.put('/:id', authenticate, requirePermission('users.write'), UsersController.update)
router.delete('/:id', authenticate, requirePermission('users.delete'), UsersController.remove)

export default router