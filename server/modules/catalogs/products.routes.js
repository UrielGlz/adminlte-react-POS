import { Router } from 'express'
import productsController from './products.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/', requirePermission('catalogs.products.read'), productsController.getAll)
router.get('/tax-rates', requirePermission('catalogs.products.read'), productsController.getTaxRates)
router.get('/:id', requirePermission('catalogs.products.read'), productsController.getById)
router.post('/', requirePermission('catalogs.products.write'), productsController.create)
router.put('/:id', requirePermission('catalogs.products.write'), productsController.update)
router.delete('/:id', requirePermission('catalogs.products.write'), productsController.remove)

export default router