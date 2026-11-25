import { Router } from 'express';
import { UserProfileController } from '../controllers/user-profile.controller';
import { authMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validate.handler';
import { body } from 'express-validator';

const router: Router = Router();
const controller = new UserProfileController();

router.use(authMiddleware);

router.get('/profile', controller.getProfile);
router.put('/fcm-token', validate([
    body('fcm_token').notEmpty()
]), controller.updateFcmToken);
router.put('/notification-email', validate([
    body('notification_email').optional().isEmail()
]), controller.updateNotificationEmail);

export default router;
