import { Router } from 'express';
import { BuildingController } from '../controllers/building.controller';
import { authMiddleware } from '../middlewares/auth';
import { roleMiddleware } from '../middlewares/role.middleware';

import { body, param } from 'express-validator';
import { validate } from '../middlewares/validate.handler';

const router: Router = Router();
const buildingController = new BuildingController();

router.use(authMiddleware);
router.use(roleMiddleware(['owner'])); // Only owners can manage buildings

// add validation methods for required controllers
router.get('/:id', buildingController.getAllBuildings);
router.get('/', buildingController.getBuildings);


router.post(
    '/create',
    validate([
        body('name').notEmpty().withMessage('Building name is required'),
        body('address').notEmpty().withMessage('Address is required'),
    ]),
    buildingController.createBuilding
);

router.get(
    '/:id',
    validate([
        param('id').isUUID().withMessage('Invalid building ID'),
    ]),
    buildingController.getBuilding
);

router.put(
    '/:id',
    validate([
        param('id').isUUID().withMessage('Invalid building ID'),
        body('name').optional().notEmpty(),
    ]),
    buildingController.updateBuilding
);

router.delete(
    '/:id',
    validate([
        param('id').isUUID().withMessage('Invalid building ID'),
    ]),
    buildingController.deleteBuilding
);

export default router;