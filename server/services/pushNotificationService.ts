import webpush from 'web-push';
import { storage } from '../storage';

const VAPID_PUBLIC_KEY = 'BOX8GMIv1Y8E14t5Vc9elEjswXS-N-xvRVjqUsV2dGQwyXH0yyXvVUD94nyocUyG-V8f2Gdj4tfVzYaxKNHybqg';
const vapidConfigured = !!process.env.VAPID_PRIVATE_KEY;

if (vapidConfigured) {
  webpush.setVapidDetails(
    'mailto:support@perfectmeals.com',
    VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY!
  );
} else {
  console.warn(
    '[Push] VAPID_PRIVATE_KEY not configured — push notifications disabled.'
  );
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

export class PushNotificationService {
  static async subscribeToPush(userId: string, subscription: PushSubscription) {
    try {
      await storage.savePushSubscription(userId, subscription);
      console.log(`✅ Push subscription saved for user: ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Push subscription error:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendNotification(userId: string, payload: NotificationPayload) {
    if (!vapidConfigured) {
      console.warn(
        `[Push] VAPID_PRIVATE_KEY not configured — skipped sending push to user ${userId} | title: "${payload.title}"`
      );
      return { success: false, error: 'Push notifications not configured' };
    }

    try {
      const subscription = await storage.getPushSubscription(userId);
      if (!subscription) {
        console.log(`No push subscription found for user: ${userId}`);
        return { success: false, error: 'No subscription found' };
      }

      const notificationPayload = {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/notification-icon.png',
        badge: payload.badge || '/notification-badge.png',
        tag: payload.tag || 'meal-notification',
        url: payload.url || '/',
        actions: payload.actions || []
      };

      await webpush.sendNotification(
        subscription,
        JSON.stringify(notificationPayload)
      );

      console.log(`🔔 Push notification sent to user: ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Send notification error:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendMealReminder(userId: string, mealType: string, time: string) {
    const payload: NotificationPayload = {
      title: `🍽️ ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Reminder`,
      body: `It's time for your ${mealType} at ${time}! Tap to view your meal plan.`,
      icon: '/notification-icon.png',
      tag: `meal-reminder-${mealType}`,
      url: '/dashboard',
      actions: [
        { action: 'view', title: 'View Meals' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    return await this.sendNotification(userId, payload);
  }

  static async unsubscribe(userId: string) {
    try {
      await storage.removePushSubscription(userId);
      console.log(`❌ Push subscription removed for user: ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Unsubscribe error:', error);
      return { success: false, error: error.message };
    }
  }

  static getVapidPublicKey() {
    return VAPID_PUBLIC_KEY;
  }
}
