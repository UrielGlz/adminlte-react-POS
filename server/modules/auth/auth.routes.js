import { Router } from 'express'
import authController from './auth.controller.js'
import { authenticate } from '../../middleware/auth.js'

const router = Router()

// Rutas públicas
router.post('/login', authController.login)
router.post('/refresh', authController.refresh)

// Rutas protegidas
router.get('/me', authenticate, authController.getMe)
router.post('/logout', authenticate, authController.logout)

export default router