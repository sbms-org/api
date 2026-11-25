import { Request, Response, NextFunction } from 'express';
import { dataSource } from '../configurations/db.config';
import { User } from '../Entities/user';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../configurations/logger';
import { UUID } from 'crypto';

export class UserProfileController {
  private userRepo = dataSource.getRepository(User);

  updateFcmToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as UUID;
      const { fcm_token, device_id, device_platform } = req.body;

      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) return ApiResponse.error(res, 'User not found', 404);

      user.fcm_token = fcm_token;
      if (device_id) user.device_id = device_id;
      if (device_platform) user.device_platform = device_platform;

      await this.userRepo.save(user);

      return ApiResponse.success(res, null, 'FCM token updated');
    } catch (error) {
      logger.error('Error updating FCM token:', error);
      return next(error);
    }
  };

  updateNotificationEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as UUID;
      const { notification_email } = req.body;

      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) return ApiResponse.error(res, 'User not found', 404);

      user.notification_email = notification_email || null;
      await this.userRepo.save(user);

      return ApiResponse.success(res, { notification_email: user.notification_email }, 'Notification email updated');
    } catch (error) {
      logger.error('Error updating notification email:', error);
      return next(error);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id as UUID;

      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) return ApiResponse.error(res, 'User not found', 404);

      const { otp_code, otp_expires, fcm_token, ...profile } = user;

      return ApiResponse.success(res, profile);
    } catch (error) {
      logger.error('Error getting profile:', error);
      return next(error);
    }
  };
}
