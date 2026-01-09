import { Router } from 'express'
import paymentMethodsController from './paymentMethods.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/', requirePermission('catalogs.read'), paymentMethodsController.getAll)
router.get('/:id', requirePermission('catalogs.read'), paymentMethodsController.getById)
router.post('/', requirePermission('catalogs.write'), paymentMethodsController.create)
router.put('/:id', requirePermission('catalogs.write'), paymentMethodsController.update)
router.delete('/:id', requirePermission('catalogs.write'), paymentMethodsController.remove)

export default router