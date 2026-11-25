import { Repository } from 'typeorm';
import { dataSource } from '../configurations/db.config';
import { Notification } from '../Entities/notification';
import { NotificationPreferences, NotificationTypeKey } from '../Entities/notification_preferences';
import { User } from '../Entities/user';
import { SystemSettings } from '../Entities/system_settings';
import { emailService } from './email.service';
import logger from '../configurations/logger';
import { UUID } from 'crypto';
import { firebaseService } from './firebase.service';

export class UnifiedNotificationService {
  private static instance: UnifiedNotificationService;
  private notificationRepo: Repository<Notification>;
  private preferencesRepo: Repository<NotificationPreferences>;
  private userRepo: Repository<User>;
  private settingsRepo: Repository<SystemSettings>;

  private constructor() {
    this.notificationRepo = dataSource.getRepository(Notification);
    this.preferencesRepo = dataSource.getRepository(NotificationPreferences);
    this.userRepo = dataSource.getRepository(User);
    this.settingsRepo = dataSource.getRepository(SystemSettings);
  }

  static getInstance(): UnifiedNotificationService {
    if (!UnifiedNotificationService.instance) {
      UnifiedNotificationService.instance = new UnifiedNotificationService();
    }
    return UnifiedNotificationService.instance;
  }

  async sendNotification(
    userId: UUID,
    title: string,
    message: string,
    type: NotificationTypeKey,
    relatedEntityType?: string,
    relatedEntityId?: string,
    data?: Record<string, string>
  ): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        logger.warn(`User ${userId} not found`);
        return;
      }

      // Check system-level settings
      const systemEnabled = await this.isNotificationTypeEnabledSystem(type);
      if (!systemEnabled) {
        logger.info(`Notification type ${type} disabled at system level`);
        return;
      }

      // Get user preferences
      let prefs = await this.preferencesRepo.findOne({ where: { user_id: userId } });
      if (!prefs) {
        prefs = await this.createDefaultPreferences(userId);
      }

      const typePrefs = prefs.notification_types?.[type] || { in_app: true, push: true, email: false };

      // In-app notification
      if (prefs.in_app_enabled && typePrefs.in_app) {
        await this.createInAppNotification(userId, title, message, type, relatedEntityType, relatedEntityId);
      }

      // Push notification
      if (prefs.push_enabled && typePrefs.push && user.fcm_token) {
        await firebaseService.sendPushNotification(user.fcm_token, title, message, {
          type,
          ...data,
        });
      }

      // Email notification
      if (prefs.email_enabled && typePrefs.email && user.notification_email) {
        await emailService.sendNotificationEmail(user.notification_email, title, message);
      }
    } catch (error) {
      logger.error('Error sending unified notification:', error);
    }
  }

  private async createInAppNotification(
    userId: UUID,
    title: string,
    message: string,
    type: string,
    relatedEntityType?: string,
    relatedEntityId?: string
  ): Promise<void> {
    const notification = this.notificationRepo.create({
      title,
      message,
      type: type as any,
      user_id: userId,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
    });
    await this.notificationRepo.save(notification);
  }

  private async createDefaultPreferences(userId: UUID): Promise<NotificationPreferences> {
    const defaultTypes: Record<NotificationTypeKey, { in_app: boolean; push: boolean; email: boolean }> = {
      tenant_assignment: { in_app: true, push: true, email: false },
      tenant_assigned: { in_app: true, push: true, email: false },
      payment_due: { in_app: true, push: true, email: false },
      payment_overdue: { in_app: true, push: true, email: false },
      receipt_uploaded: { in_app: true, push: true, email: false },
      receipt_approved: { in_app: true, push: true, email: false },
      receipt_rejected: { in_app: true, push: true, email: false },
      lease_expiring: { in_app: true, push: true, email: false },
      lease_update: { in_app: true, push: true, email: false },
      maintenance_request: { in_app: true, push: true, email: false },
      maintenance_scheduled: { in_app: true, push: true, email: false },
      tenant_message: { in_app: true, push: true, email: false },
      owner_message: { in_app: true, push: true, email: false },
      building_announcement: { in_app: true, push: true, email: false },
      welcome: { in_app: true, push: true, email: false },
    };

    const prefs = this.preferencesRepo.create({
      user_id: userId,
      in_app_enabled: true,
      push_enabled: true,
      email_enabled: false,
      notification_types: defaultTypes,
    });

    return await this.preferencesRepo.save(prefs);
  }

  async getUserPreferences(userId: UUID): Promise<NotificationPreferences> {
    let prefs = await this.preferencesRepo.findOne({ where: { user_id: userId } });
    if (!prefs) {
      prefs = await this.createDefaultPreferences(userId);
    }
    return prefs;
  }

  async updateUserPreferences(
    userId: UUID,
    updates: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    let prefs = await this.getUserPreferences(userId);
    Object.assign(prefs, updates);
    return await this.preferencesRepo.save(prefs);
  }

  async updateNotificationTypePreference(
    userId: UUID,
    notificationType: NotificationTypeKey,
    channel: 'in_app' | 'push' | 'email',
    enabled: boolean
  ): Promise<void> {
    const prefs = await this.getUserPreferences(userId);
    if (!prefs.notification_types) {
      prefs.notification_types = {} as any;
    }
    if (!prefs.notification_types[notificationType]) {
      prefs.notification_types[notificationType] = { in_app: true, push: true, email: false };
    }
    prefs.notification_types[notificationType][channel] = enabled;
    await this.preferencesRepo.save(prefs);
  }

  private async isNotificationTypeEnabledSystem(type: NotificationTypeKey): Promise<boolean> {
    try {
      const setting = await this.settingsRepo.findOne({
        where: { setting_key: `notification_${type}_enabled` },
      });
      return setting ? setting.setting_value === 'true' : true;
    } catch {
      return true;
    }
  }

  async getSystemNotificationSettings(): Promise<Record<NotificationTypeKey, boolean>> {
    const types: NotificationTypeKey[] = [
      'payment_due', 'payment_overdue', 'receipt_uploaded', 'receipt_approved',
      'receipt_rejected', 'lease_expiring', 'lease_update', 'maintenance_request',
      'maintenance_scheduled', 'tenant_message', 'owner_message', 'building_announcement', 'welcome'
    ];

    const settings: Record<string, boolean> = {};
    for (const type of types) {
      settings[type] = await this.isNotificationTypeEnabledSystem(type);
    }
    return settings as Record<NotificationTypeKey, boolean>;
  }

  async updateSystemNotificationSetting(type: NotificationTypeKey, enabled: boolean): Promise<void> {
    const key = `notification_${type}_enabled`;
    let setting = await this.settingsRepo.findOne({ where: { setting_key: key } });
    
    if (setting) {
      setting.setting_value = enabled.toString();
    } else {
      setting = this.settingsRepo.create({
        setting_key: key,
        setting_value: enabled.toString(),
        category: 'notifications',
        description: `Enable/disable ${type} notifications system-wide`,
      });
    }
    
    await this.settingsRepo.save(setting);
  }
}

export const unifiedNotificationService = UnifiedNotificationService.getInstance();
