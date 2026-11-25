import { Router } from 'express';
import { Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { unifiedNotificationService } from '../services/unified-notification.service';
import { firebaseService } from '../services/firebase.service';
import { emailService } from '../services/email.service';
import { ApiResponse } from '../utils/ApiResponse';
import { UUID } from 'crypto';

const router: Router = Router();

// Test unified notification
router.post('/notification', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as UUID;
    const { title, message, type } = req.body;

    await unifiedNotificationService.sendNotification(
      userId,
      title || 'Test Notification',
      message || 'This is a test notification',
      type || 'general'
    );

    return ApiResponse.success(res, null, 'Test notification sent');
  } catch (error) {
    return ApiResponse.error(res, 'Failed to send test notification');
  }
});

// Test Firebase push notification
router.post('/push', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { fcm_token, title, message } = req.body;

    if (!fcm_token) {
      return ApiResponse.error(res, 'FCM token required', 400);
    }

    const success = await firebaseService.sendPushNotification(
      fcm_token,
      title || 'Test Push',
      message || 'This is a test push notification'
    );

    return ApiResponse.success(res, { success }, success ? 'Push notification sent' : 'Failed to send push');
  } catch (error) {
    return ApiResponse.error(res, 'Failed to send push notification');
  }
});

// Test email notification
router.post('/email', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { to, title, message } = req.body;

    if (!to) {
      return ApiResponse.error(res, 'Email address required', 400);
    }

    const success = await emailService.sendNotificationEmail(
      to,
      title || 'Test Email',
      message || 'This is a test email notification'
    );

    return ApiResponse.success(res, { success }, success ? 'Email sent' : 'Failed to send email');
  } catch (error) {
    return ApiResponse.error(res, 'Failed to send email');
  }
});

// Check notification system status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const firebaseConfigured = !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const emailConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

    return ApiResponse.success(res, {
      firebase: {
        configured: firebaseConfigured,
        path: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'Not set'
      },
      email: {
        configured: emailConfigured,
        host: process.env.SMTP_HOST || 'Not set',
        user: process.env.SMTP_USER || 'Not set'
      }
    });
  } catch (error) {
    return ApiResponse.error(res, 'Failed to check status');
  }
});

export default router;
