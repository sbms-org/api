import { Router } from 'express'
import { AdminSbmsController } from '../controllers/sbms.controller'
import { authMiddleware } from '../middlewares/auth'
import { roleMiddleware } from '../middlewares/role.middleware'

const router = Router()

router.use(authMiddleware, roleMiddleware(['admin']))

router.get('/dashboard', AdminSbmsController.reports)
router.get('/users', AdminSbmsController.listUsers)
router.patch('/users/:id', AdminSbmsController.updateUser)
router.get('/providers/verification', AdminSbmsController.listVerifications)
router.patch('/providers/verification', AdminSbmsController.reviewVerification)
router.get('/work-posts/moderation', AdminSbmsController.listModeration)
router.patch('/work-posts/moderation', AdminSbmsController.reviewModeration)
router.get('/issues', AdminSbmsController.listIssues)
router.patch('/issues', AdminSbmsController.updateIssue)
router.get('/reports', AdminSbmsController.reports)
router.get('/activity-logs', AdminSbmsController.listActivityLogs)
router.get('/settings', AdminSbmsController.getSettings)
router.patch('/settings', AdminSbmsController.patchSettings)
router.put('/settings', AdminSbmsController.patchSettings)

export default router
