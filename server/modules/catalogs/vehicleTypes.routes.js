import { Router } from 'express'
import * as VehicleTypesController from './vehicleTypes.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('catalogs.read'), VehicleTypesController.getAll)
router.get('/:id', requirePermission('catalogs.read'), VehicleTypesController.getById)
router.post('/', requirePermission('catalogs.write'), VehicleTypesController.create)
router.put('/:id', requirePermission('catalogs.write'), VehicleTypesController.update)
router.delete('/:id', requirePermission('catalogs.write'), VehicleTypesController.remove)

export default router