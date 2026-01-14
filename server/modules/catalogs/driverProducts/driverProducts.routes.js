import { Router } from 'express'
import * as DriverProductsController from './driverProducts.controller.js'
import { authenticate, requirePermission } from '../../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('catalogs.read'), DriverProductsController.getAll)
router.get('/:id', requirePermission('catalogs.read'), DriverProductsController.getById)
router.post('/', requirePermission('catalogs.write'), DriverProductsController.create)
router.put('/:id', requirePermission('catalogs.write'), DriverProductsController.update)
router.delete('/:id', requirePermission('catalogs.write'), DriverProductsController.remove)

export default router