import { Router } from 'express';
import { PropertyManagerController } from '../controllers/pm.controller';
import { authMiddleware } from '../middlewares/auth';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.handler';
import { body } from 'express-validator';

const router: Router = Router();
const pmController = new PropertyManagerController();

router.use(authMiddleware);
router.use(roleMiddleware(['property_manager']));

router.get('/buildings', pmController.getBuildings);
router.get('/dashboard', pmController.getDashboard);
router.get('/analytics', pmController.getAnalytics);
router.get('/reports/export', pmController.exportReports);
router.get('/receipts/pending', pmController.getPendingReceipts);
router.post('/receipts/:receiptId/accept', pmController.acceptReceipt);
router.post('/receipts/:receiptId/reject', pmController.rejectReceipt);
router.patch(
    '/units/:id/cycle',
    validate([body('cycleMonths').isInt({ min: 1, max: 12 })]),
    pmController.updateUnitCycle
);
router.get('/tenants/:id/history', pmController.getTenantHistory);
router.get('/notifications', pmController.getNotifications);
router.post('/notifications/:id/read', pmController.markNotificationRead);
router.post('/notifications/read-all', pmController.markAllNotificationsRead);

router.get('/profile', pmController.getProfile);
router.put('/notification-email', pmController.updateNotificationEmail);

// PM reads their own permissions (assigned by owner)
router.get('/my-permissions', pmController.getMyPermissions);

export default router;
