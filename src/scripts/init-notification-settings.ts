import { dataSource } from '../configurations/db.config';
import { SystemSettings } from '../Entities/system_settings';
import logger from '../configurations/logger';

const notificationTypes = [
  'payment_due',
  'payment_overdue',
  'receipt_uploaded',
  'receipt_approved',
  'receipt_rejected',
  'lease_expiring',
  'lease_update',
  'maintenance_request',
  'maintenance_scheduled',
  'tenant_message',
  'owner_message',
  'building_announcement',
  'welcome'
];

async function initializeNotificationSettings() {
  try {
    await dataSource.initialize();
    logger.info('Database connected');

    const settingsRepo = dataSource.getRepository(SystemSettings);

    for (const type of notificationTypes) {
      const key = `notification_${type}_enabled`;
      const existing = await settingsRepo.findOne({ where: { setting_key: key } });

      if (!existing) {
        const setting = settingsRepo.create({
          setting_key: key,
          setting_value: 'true',
          category: 'notifications',
          description: `Enable/disable ${type} notifications system-wide`,
        });
        await settingsRepo.save(setting);
        logger.info(`Created setting: ${key}`);
      } else {
        logger.info(`Setting already exists: ${key}`);
      }
    }

    logger.info('Notification settings initialized successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error initializing notification settings:', error);
    process.exit(1);
  }
}

initializeNotificationSettings();
