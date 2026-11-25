import { Router } from 'express';
import { OwnerController } from '../controllers/owner.controller';
import { authMiddleware } from '../middlewares/auth';
import { roleMiddleware } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.handler';
import { body } from 'express-validator';
import { upload } from '../middlewares/upload';

const router: Router = Router();
const ownerController = new OwnerController();

router.use(authMiddleware);
// Default for most owner routes is both Owner and PM
const ownerOrPM = roleMiddleware(['owner', 'property_manager']);
const ownerOnly = roleMiddleware(['owner']);

router.post(
    '/buildings',
    ownerOnly,
    upload.fields([
        { name: 'property_deed', maxCount: 1 },
        { name: 'certificate_of_title', maxCount: 1 },
        { name: 'business_tin_number_url', maxCount: 1 }
    ]),
    ownerController.createBuilding
);

router.put(
    '/buildings/:id',
    ownerOrPM, // PMs might update building info like address? User didn't specify.
    upload.fields([
        { name: 'property_deed', maxCount: 1 },
        { name: 'certificate_of_title', maxCount: 1 },
        { name: 'business_tin_number_url', maxCount: 1 }
    ]),
    ownerController.updateBuilding
);

router.get('/buildings', ownerOrPM, ownerController.getBuildings);
router.get('/buildings/:id', ownerOrPM, ownerController.getBuilding);
router.get('/reports/export', ownerOrPM, ownerController.exportReports);
router.get('/buildings/:id/units', ownerOrPM, ownerController.getUnits);
router.get('/units/:id', ownerOrPM, ownerController.getUnit);
router.post('/units/:unitId/assign-tenant',
    ownerOrPM,
    upload.single('lease_document'),
    ownerController.assignTenant
);
router.post('/units/:unitId/terminate-tenant', ownerOrPM, ownerController.terminateTenantAssignment);

// manual notification endpoint when owner/pm wants to alert tenant of upcoming due rent
router.post('/units/:unitId/notify-due', ownerOrPM, ownerController.notifyTenantDue);
router.post(
    '/units/:unitId/register-tenant',
    ownerOrPM,
    validate([
        body('mobile').notEmpty(),
        body('fullname').notEmpty()
    ]),
    ownerController.registerTenantForUnit
);
router.post(
    '/units/:unitId/verify-otp',
    ownerOrPM,
    validate([
        body('mobile').notEmpty(),
        body('otp').notEmpty()
    ]),
    ownerController.verifyTenantOtp
);
router.get('/pending-receipts', ownerOrPM, ownerController.getPendingReceipts);
router.get('/tenants', ownerOrPM, ownerController.getTenants);
// details for a specific tenant (works for owner or PM)
router.get('/tenants/:tenantId', ownerOrPM, ownerController.getTenantDetails);
router.post('/receipts/:receiptId/accept', ownerOrPM, ownerController.acceptReceipt);
router.post('/receipts/:receiptId/reject', ownerOrPM, ownerController.rejectReceipt);
router.get('/dashboard', ownerOrPM, ownerController.getDashboard);
router.get('/analytics', ownerOrPM, ownerController.getAnalytics);

router.get('/property-managers', ownerOnly, ownerController.getPropertyManagers);
router.get('/property-managers/:id', ownerOnly, ownerController.getPropertyManagerDetails);

router.post(
    '/property-managers',
    ownerOnly,
    validate([
        body('mobile').notEmpty(),
        body('fullname').notEmpty()
    ]),
    ownerController.assignPropertyManager
);

router.post(
    '/property-managers/verify',
    ownerOnly,
    validate([
        body('mobile').notEmpty(),
        body('otp').notEmpty()
    ]),
    ownerController.verifyPropertyManager
);

router.post('/property-managers/:pmId/assignments', ownerOnly, ownerController.assignBuildingsToPM);
router.delete('/property-managers/:id', ownerOnly, ownerController.revokePropertyManager);
router.get('/notifications', ownerOrPM, ownerController.getNotifications);
router.post('/notifications/:id/read', ownerOrPM, ownerController.markNotificationRead);
router.post('/notifications/read-all', ownerOrPM, ownerController.markAllNotificationsRead);

router.get('/profile', ownerOrPM, ownerController.getProfile);
router.put('/notification-email', ownerOnly, ownerController.updateNotificationEmail);

export default router;
