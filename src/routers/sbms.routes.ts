import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth'
import {
  BookingController,
  IssueController,
  ProviderController,
  WorkPostController,
} from '../controllers/sbms.controller'

const router = Router()

router.get('/providers/nearby', ProviderController.nearby)
router.get('/providers/:id', ProviderController.get)
router.post('/providers', authMiddleware, ProviderController.create)
router.patch('/providers/me', authMiddleware, ProviderController.updateMine)
router.post('/providers/me/services', authMiddleware, ProviderController.createService)

router.get('/work-posts/feed', WorkPostController.feed)
router.post('/work-posts', authMiddleware, WorkPostController.create)
router.get('/work-posts/:id/consent', authMiddleware, WorkPostController.consentRequest)
router.post('/work-posts/:id/consent', authMiddleware, WorkPostController.consent)

router.get('/bookings', authMiddleware, BookingController.list)
router.post('/bookings', authMiddleware, BookingController.create)
router.patch('/bookings/:id/status', authMiddleware, BookingController.updateStatus)

router.post('/issues', authMiddleware, IssueController.create)

export default router
