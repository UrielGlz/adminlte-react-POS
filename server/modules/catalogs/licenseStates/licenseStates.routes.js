import { Router } from 'express'
import * as LicenseStatesController from './licenseStates.controller.js'
import { authenticate, requirePermission } from '../../../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', requirePermission('catalogs.read'), LicenseStatesController.getAll)
router.get('/country/:country', requirePermission('catalogs.read'), LicenseStatesController.getByCountry)
router.get('/:id', requirePermission('catalogs.read'), LicenseStatesController.getById)
router.post('/', requirePermission('catalogs.write'), LicenseStatesController.create)
router.put('/:id', requirePermission('catalogs.write'), LicenseStatesController.update)
router.delete('/:id', requirePermission('catalogs.write'), LicenseStatesController.remove)

export default router