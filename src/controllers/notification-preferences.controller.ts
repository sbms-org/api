import { Request, Response, NextFunction } from 'express';
import { unifiedNotificationService } from '../services/unified-notification.service';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../configurations/logger';
import { UUID } from 'crypto';
import { NotificationTypeKey } from '../Entities/notification_preferences';

export class NotificationPreferencesController {

  getPreferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as UUID;
      const prefs = await unifiedNotificationService.getUserPreferences(userId);
      return ApiResponse.success(res, prefs);
    } catch (error) {
      logger.error('Error getting notification preferences:', error);
      return next(error);
    }
  };

  updateGlobalPreferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as UUID;
      const { in_app_enabled, push_enabled, email_enabled } = req.body;

      const prefs = await unifiedNotificationService.updateUserPreferences(userId, {
        in_app_enabled,
        push_enabled,
        email_enabled,
      });

      return ApiResponse.success(res, prefs, 'Notification preferences updated');
    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      return next(error);
    }
  };

  updateTypePreference = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as UUID;
      const { notificationType } = req.params;
      const { channel, enabled } = req.body;

      await unifiedNotificationService.updateNotificationTypePreference(
        userId,
        notificationType as NotificationTypeKey,
        channel,
        enabled
      );

      return ApiResponse.success(res, null, 'Notification type preference updated');
    } catch (error) {
      logger.error('Error updating notification type preference:', error);
      return next(error);
    }
  };

  updateAllTypePreferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as UUID;
      const { notification_types } = req.body;

      const prefs = await unifiedNotificationService.updateUserPreferences(userId, {
        notification_types,
      });

      return ApiResponse.success(res, prefs, 'All notification preferences updated');
    } catch (error) {
      logger.error('Error updating all notification preferences:', error);
      return next(error);
    }
  };
}
