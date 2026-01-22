import { Router } from 'express'
import * as DriverProductsController from './driverProducts.controller.js'
import { authenticate, requirePermission } from '../../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('catalogs.driver_products.read'), DriverProductsController.getAll)
router.get('/:id', requirePermission('catalogs.driver_products.read'), DriverProductsController.getById)
router.post('/', requirePermission('catalogs.driver_products.write'), DriverProductsController.create)
router.put('/:id', requirePermission('catalogs.driver_products.write'), DriverProductsController.update)
router.delete('/:id', requirePermission('catalogs.driver_products.write'), DriverProductsController.remove)

export default router