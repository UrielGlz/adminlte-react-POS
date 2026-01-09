import { Router } from 'express'
import productsController from './products.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/', requirePermission('catalogs.read'), productsController.getAll)
router.get('/tax-rates', requirePermission('catalogs.read'), productsController.getTaxRates)
router.get('/:id', requirePermission('catalogs.read'), productsController.getById)
router.post('/', requirePermission('catalogs.write'), productsController.create)
router.put('/:id', requirePermission('catalogs.write'), productsController.update)
router.delete('/:id', requirePermission('catalogs.write'), productsController.remove)

export default router