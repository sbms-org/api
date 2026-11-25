import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middlewares/auth';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.handler';
import { body } from 'express-validator';
import { AdminSbmsController } from '../controllers/sbms.controller';

const router: Router = Router();
const adminController = new AdminController();

router.use(authMiddleware);
router.use(roleMiddleware(['admin']));

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// ServiceBook Management System
router.get('/providers/verification', AdminSbmsController.listVerifications);
router.patch('/providers/verification', AdminSbmsController.reviewVerification);
router.get('/work-posts/moderation', AdminSbmsController.listModeration);
router.patch('/work-posts/moderation', AdminSbmsController.reviewModeration);
router.get('/issues', AdminSbmsController.listIssues);
router.patch('/issues', AdminSbmsController.updateIssue);
router.get('/reports', AdminSbmsController.reports);
router.get('/activity-logs', AdminSbmsController.listActivityLogs);
router.patch('/settings', AdminSbmsController.patchSettings);

// Owners
router.get('/owners', adminController.getOwners);
router.get('/owners/pending', adminController.getPendingOwners);
router.get('/owners/:id', adminController.getOwner);
router.put('/owners/:id/status', validate([body('status').isIn(['ACTIVE', 'SUSPENDED', 'TERMINATED'])]), adminController.updateOwnerStatus);
router.post('/owners/:id/approve', adminController.approveOwner);
router.post('/owners/:id/reject', adminController.rejectOwner);

// Tenants
router.get('/tenants', adminController.getTenants);

// Buildings
router.get('/buildings/pending', adminController.getPendingBuildings);
router.get('/buildings/:id', adminController.getBuilding);
router.post('/buildings/:id/approve', validate([body('confirmedTotalUnits').isInt()]), adminController.approveBuilding);
router.post('/buildings/:id/reject', validate([body('reason').notEmpty()]), adminController.rejectBuilding);

// Transactions
router.get('/transactions', adminController.getTransactions);

// Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);

// Payment Methods
router.get('/payment-methods', adminController.getPaymentMethods);
router.get('/payment-methods/:id', adminController.getPaymentMethod);
router.post('/payment-methods', validate([
    body('name').notEmpty(),
    body('type').isIn(['BANK', 'MOBILE_MONEY', 'CASH'])
]), adminController.createPaymentMethod);
router.put('/payment-methods/:id', adminController.updatePaymentMethod);
router.delete('/payment-methods/:id', adminController.deletePaymentMethod);
router.patch('/payment-methods/:id/toggle', adminController.togglePaymentMethod);

// System Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);
router.get('/settings/:key', adminController.getSetting);
router.put('/settings/:key', adminController.updateSetting);

// Charts Data
router.get('/charts', adminController.getChartData);

// Notification Templates
const { NotificationTemplateController } = require('../controllers/notification_template.controller');
const templateController = new NotificationTemplateController();
router.get('/notification-templates', templateController.getTemplates);
router.get('/notification-templates/:id', templateController.getTemplate);
router.post('/notification-templates', validate([
    body('template_key').notEmpty(),
    body('title').notEmpty(),
    body('message_template').notEmpty()
]), templateController.createTemplate);
router.put('/notification-templates/:id', templateController.updateTemplate);
router.delete('/notification-templates/:id', templateController.deleteTemplate);

// Notification System Settings
router.get('/notification-settings', adminController.getNotificationSystemSettings);
router.put('/notification-settings/:notificationType', validate([
    body('enabled').isBoolean()
]), adminController.updateNotificationSystemSetting);

export default router;
