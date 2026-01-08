import { Router } from 'express'
import * as UsersController from './users.controller.js'
// import { authenticate, authorize } from '../../middleware/auth.js'

const router = Router()

/**
 * Users Routes
 * Base: /api/users
 */

// Rutas públicas (o protegerlas con middleware)
router.get('/', UsersController.getAll)
router.get('/stats', UsersController.getStats)
router.get('/:id', UsersController.getById)
router.post('/', UsersController.create)
router.put('/:id', UsersController.update)
router.delete('/:id', UsersController.remove)

// Ejemplo de rutas protegidas (descomentar cuando implementes auth)
// router.get('/', authenticate, UsersController.getAll)
// router.post('/', authenticate, authorize('admin'), UsersController.create)
// router.delete('/:id', authenticate, authorize('admin'), UsersController.remove)

export default router
