import { Router } from 'express';
import { NotificationPreferencesController } from '../controllers/notification-preferences.controller';
import { authMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validate.handler';
import { body } from 'express-validator';

const router: Router = Router();
const controller = new NotificationPreferencesController();

router.use(authMiddleware);

router.get('/', controller.getPreferences);
router.put('/global', validate([
    body('in_app_enabled').optional().isBoolean(),
    body('push_enabled').optional().isBoolean(),
    body('email_enabled').optional().isBoolean()
]), controller.updateGlobalPreferences);
router.put('/types', controller.updateAllTypePreferences);
router.put('/types/:notificationType', validate([
    body('channel').isIn(['in_app', 'push', 'email']),
    body('enabled').isBoolean()
]), controller.updateTypePreference);

export default router;
