import { Router } from 'express'
import * as PaymentMethodsController from './paymentMethods.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('catalogs.read'), PaymentMethodsController.getAll)
router.get('/:id', requirePermission('catalogs.read'), PaymentMethodsController.getById)
router.post('/', requirePermission('catalogs.write'), PaymentMethodsController.create)
router.put('/:id', requirePermission('catalogs.write'), PaymentMethodsController.update)
router.delete('/:id', requirePermission('catalogs.write'), PaymentMethodsController.remove)

export default router