import { Router } from 'express'
import vehicleTypesController from './vehicleTypes.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('catalogs.read'), vehicleTypesController.getAll)
router.get('/:id', requirePermission('catalogs.read'), vehicleTypesController.getById)
router.post('/', requirePermission('catalogs.write'), vehicleTypesController.create)
router.put('/:id', requirePermission('catalogs.write'), vehicleTypesController.update)
router.delete('/:id', requirePermission('catalogs.write'), vehicleTypesController.remove)

export default router