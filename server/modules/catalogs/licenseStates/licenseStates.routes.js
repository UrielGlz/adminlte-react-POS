import { Router } from 'express'
import * as LicenseStatesController from './licenseStates.controller.js'
import { authenticate, requirePermission } from '../../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('catalogs.license_states.read'), LicenseStatesController.getAll)
router.get('/country/:country', requirePermission('catalogs.license_states.read'), LicenseStatesController.getByCountry)
router.get('/:id', requirePermission('catalogs.license_states.read'), LicenseStatesController.getById)
router.post('/', requirePermission('catalogs.license_states.write'), LicenseStatesController.create)
router.put('/:id', requirePermission('catalogs.license_states.write'), LicenseStatesController.update)
router.delete('/:id', requirePermission('catalogs.license_states.write'), LicenseStatesController.remove)

export default router