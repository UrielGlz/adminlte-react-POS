import { Router } from 'express'
import * as VehicleTypesController from './vehicleTypes.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('catalogs.vehicle_types.read'), VehicleTypesController.getAll)
router.get('/:id', requirePermission('catalogs.vehicle_types.read'), VehicleTypesController.getById)
router.post('/', requirePermission('catalogs.vehicle_types.write'), VehicleTypesController.create)
router.put('/:id', requirePermission('catalogs.vehicle_types.write'), VehicleTypesController.update)
router.delete('/:id', requirePermission('catalogs.vehicle_types.write'), VehicleTypesController.remove)

export default router