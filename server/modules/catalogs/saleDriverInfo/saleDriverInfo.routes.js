import { Router } from 'express'
import * as SaleDriverInfoController from './saleDriverInfo.controller.js'
import { authenticate, requirePermission } from '../../../middleware/auth.js'

const router = Router()
router.use(authenticate)

// Solo rutas de lectura (READONLY)
router.get('/', requirePermission('catalogs.read'), SaleDriverInfoController.getAll)
router.get('/stats', requirePermission('catalogs.read'), SaleDriverInfoController.getStats)
router.get('/:id', requirePermission('catalogs.read'), SaleDriverInfoController.getById)

export default router