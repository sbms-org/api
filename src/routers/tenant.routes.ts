import { Router } from 'express';
import { TenantController } from '../controllers/tenant.controller';
import { authMiddleware } from '../middlewares/auth';
import { roleMiddleware } from '../middlewares/role.middleware';

import { body, param } from 'express-validator';
import { validate } from '../middlewares/validate.handler';

const router: Router = Router();
const tenantController = new TenantController();

router.use(authMiddleware);
router.use(roleMiddleware(['tenant', 'owner']));

router.get('/', tenantController.getTenants);

router.post(
    '/',
    validate([
        body('fullname').notEmpty().withMessage('Full name is required'),
        body('mobile').isMobilePhone('any').withMessage('Invalid mobile number'),
    ]),
    tenantController.createTenant
);

router.get(
    '/:id',
    validate([param('id').isUUID().withMessage('Invalid tenant ID')]),
    tenantController.getTenant
);

router.put(
    '/:id',
    validate([param('id').isUUID().withMessage('Invalid tenant ID')]),
    tenantController.updateTenant
);

router.delete(
    '/:id',
    validate([param('id').isUUID().withMessage('Invalid tenant ID')]),
    tenantController.deleteTenant
);

export default router;