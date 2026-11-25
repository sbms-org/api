import { Router } from 'express';
import ownerPaymentMethodController from '../controllers/owner-payment-method.controller';
import { authMiddleware } from '../middlewares/auth';
import { roleMiddleware } from '../middlewares/role.middleware';

const router: Router = Router();

// Owner routes
router.get('/available', authMiddleware, ownerPaymentMethodController.getAvailablePaymentMethods);
router.get('/my-methods', authMiddleware, ownerPaymentMethodController.getOwnerPaymentMethods);
router.post('/my-methods', authMiddleware, roleMiddleware(['owner']), ownerPaymentMethodController.addOwnerPaymentMethod);
router.put('/my-methods/:id', authMiddleware, roleMiddleware(['owner']), ownerPaymentMethodController.updateOwnerPaymentMethod);
router.delete('/my-methods/:id', authMiddleware, roleMiddleware(['owner']), ownerPaymentMethodController.deleteOwnerPaymentMethod);

// Tenant routes
router.get('/building/:buildingId', authMiddleware, ownerPaymentMethodController.getPaymentMethodsForBuilding);

export default router;
