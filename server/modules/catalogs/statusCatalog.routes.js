import { Router } from 'express'
import statusCatalogController from './statusCatalog.controller.js'
import { authenticate, requirePermission } from '../../middleware/auth.js'

const router = Router()

router.use(authenticate)

// GET /api/catalogs/status - Listar (con filtro opcional ?module=SALES)
router.get('/', requirePermission('catalogs.status.read'), statusCatalogController.getAll)

// GET /api/catalogs/status/modules - Lista de módulos
router.get('/modules', requirePermission('catalogs.status.read'), statusCatalogController.getModules)

// GET /api/catalogs/status/:id
router.get('/:id', requirePermission('catalogs.status.read'), statusCatalogController.getById)

// POST /api/catalogs/status
router.post('/', requirePermission('catalogs.status.write'), statusCatalogController.create)

// PUT /api/catalogs/status/:id
router.put('/:id', requirePermission('catalogs.status.write'), statusCatalogController.update)

// DELETE /api/catalogs/status/:id
router.delete('/:id', requirePermission('catalogs.status.write'), statusCatalogController.remove)

export default router