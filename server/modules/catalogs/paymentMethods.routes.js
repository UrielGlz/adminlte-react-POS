import { Router } from 'express'
import * as PaymentMethodsController from './paymentMethods.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('catalogs.payment_methods.read'), PaymentMethodsController.getAll)
router.get('/:id', requirePermission('catalogs.payment_methods.read'), PaymentMethodsController.getById)
router.post('/', requirePermission('catalogs.payment_methods.write'), PaymentMethodsController.create)
router.put('/:id', requirePermission('catalogs.payment_methods.write'), PaymentMethodsController.update)
router.delete('/:id', requirePermission('catalogs.payment_methods.write'), PaymentMethodsController.remove)

export default router