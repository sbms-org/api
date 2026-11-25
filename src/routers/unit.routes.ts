import { Router } from 'express';
import { UnitController } from '../controllers/unit.controller';
import { authMiddleware } from '../middlewares/auth';
import { roleMiddleware } from '../middlewares/role.middleware';

import { body, param } from 'express-validator';
import { validate } from '../middlewares/validate.handler';

const router: Router = Router();
const unitController = new UnitController();

router.use(authMiddleware); 
router.use(roleMiddleware(['owner']));


router.get(
    '/buildings/:buildingId/units',
    validate([param('buildingId').isUUID().withMessage('Invalid building ID')]),
    unitController.getUnits
);

router.post(
    '/buildings/:buildingId/units',
    validate([
        param('buildingId').isUUID().withMessage('Invalid building ID'),
        body('unit_number').notEmpty().withMessage('Unit number is required'),
    ]),
    unitController.createUnit
);

router.get(
    '/:id',
    validate([param('id').isUUID().withMessage('Invalid unit ID')]),
    unitController.getUnit
);

router.put(
    '/:id',
    validate([param('id').isUUID().withMessage('Invalid unit ID')]),
    unitController.updateUnit
);

router.delete(
    '/:id',
    validate([param('id').isUUID().withMessage('Invalid unit ID')]),
    unitController.deleteUnit
);

router.get(
    '/:id/payment-history',
    validate([param('id').isUUID().withMessage('Invalid unit ID')]),
    unitController.getPaymentHistory
);

export default router;