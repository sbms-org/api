import * as admin from 'firebase-admin';
import logger from '../configurations/logger';
import path from 'path';
import { getApps } from 'firebase-admin/app';

export class FirebaseService {
  // private static instance: FirebaseService;
  private initialized: boolean = false;

  constructor() {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      if (this.initialized) return;

       if (getApps().length > 0) {
      this.initialized = true; // Mark as true so notifications can proceed
      logger.info('Firebase Admin SDK: Reusing existing app instance.');
      return;
    }

      // const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      const serviceAccountPath = path.resolve(process.cwd(), 'firebase.json');

      if (!serviceAccountPath) {
        logger.warn('Firebase credentials not configured. Push notifications will be disabled.');
        return;
      }

      admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath),
        });

      this.initialized = true;
      logger.info('Firebase Admin SDK initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Firebase Admin SDK:', error);
      this.initialized = false;
    }
  }

  /**
   * Send push notification to a single device
   */
  async sendPushNotification(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<boolean> {
    if (!this.initialized) {
      logger.warn('Firebase not initialized. Skipping push notification.');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'pms_notifications',
            priority: 'high' as any,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      logger.info(`Push notification sent successfully: ${response}`);
      return true;
    } catch (error: any) {
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        logger.warn(`Invalid FCM token: ${fcmToken}`);
      } else {
        logger.error('Error sending push notification:', error);
      }
      return false;
    }
  }

  /**
   * Send push notification to multiple devices
   */
  async sendMulticastNotification(
    fcmTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.initialized) {
      logger.warn('Firebase not initialized. Skipping push notifications.');
      return { successCount: 0, failureCount: fcmTokens.length };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'pms_notifications',
            priority: 'high' as any,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      logger.info(`Multicast notification sent: ${response.successCount} success, ${response.failureCount} failures`);
      
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      logger.error('Error sending multicast notification:', error);
      return { successCount: 0, failureCount: fcmTokens.length };
    }
  }
}

export const firebaseService = new FirebaseService();