import { Router } from 'express';
import { TenantController } from '../controllers/tenant.controller';
import { authMiddleware } from '../middlewares/auth';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.handler';
import { body } from 'express-validator';
import { upload } from '../middlewares/upload';

const router: Router = Router();
const tenantController = new TenantController();

router.use(authMiddleware);
router.use(roleMiddleware(['tenant']));

router.get('/my-units', tenantController.getMyUnits);
router.get('/dashboard', tenantController.getDashboard);
router.get('/notifications', tenantController.getNotifications);
router.put('/notifications/:id/read', tenantController.markNotificationRead);
router.put('/notifications/read-all', tenantController.markAllNotificationsRead);
router.get('/due-payments', tenantController.getDuePayments);
router.get('/units/:unitId/payment-methods', tenantController.getOwnerPaymentMethods);
router.post(
    '/receipts',
    upload.single('receipt'),
    validate([
        body('unitId').notEmpty().withMessage('Unit ID is required'),
    ]),
    tenantController.uploadReceipt
);
router.get('/payment-history/:unitId', tenantController.getPaymentHistory);
router.post('/fcm-token', tenantController.updateFcmToken);
router.put('/notification-email', tenantController.updateNotificationEmail);

export default router;
