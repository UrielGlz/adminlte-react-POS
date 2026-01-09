import { Router } from 'express'
import customersController from './customers.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('customers.read'), customersController.getAll)
router.get('/:id', requirePermission('customers.read'), customersController.getById)
router.post('/', requirePermission('customers.write'), customersController.create)
router.put('/:id', requirePermission('customers.write'), customersController.update)
router.delete('/:id', requirePermission('customers.write'), customersController.remove)

export default router