import webpush from 'web-push';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const VAPID_PUBLIC_KEY = 'BGbABpBmQ2rvqPu2aaKbN71kvmpNhhlBru1U-ZI6RslYX7A7ODZMt7opAF6F71_E5FgfbdvGjVPaojl0hdRj8P4';
const vapidConfigured = !!process.env.VAPID_PRIVATE_KEY;

if (vapidConfigured) {
  webpush.setVapidDetails(
    'mailto:support@myperfectmeals.com',
    VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY!
  );
} else {
  console.warn('[Push] VAPID_PRIVATE_KEY not configured — push notifications disabled.');
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  actions?: Array<{ action: string; title: string }>;
}

export class PushNotificationService {
  static getVapidPublicKey() {
    return VAPID_PUBLIC_KEY;
  }

  static async subscribeToPush(userId: string, subscription: any) {
    try {
      const [user] = await db.select({ pushTokens: users.pushTokens }).from(users).where(eq(users.id, userId)).limit(1);
      const existing: any[] = (user?.pushTokens as any[]) || [];
      const isDuplicate = existing.some((s: any) => s.endpoint === subscription.endpoint);
      if (!isDuplicate) {
        await db.update(users).set({ pushTokens: [...existing, subscription] }).where(eq(users.id, userId));
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  static async unsubscribe(userId: string) {
    try {
      await db.update(users).set({ pushTokens: [] }).where(eq(users.id, userId));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // Send to ALL registered devices for a user
  static async sendNotification(userId: string, payload: NotificationPayload) {
    if (!vapidConfigured) {
      console.warn(`[Push] VAPID not configured — skipped for user ${userId}`);
      return { success: false, error: 'Push notifications not configured' };
    }

    const [user] = await db.select({ pushTokens: users.pushTokens }).from(users).where(eq(users.id, userId)).limit(1);
    const subscriptions: any[] = (user?.pushTokens as any[]) || [];

    if (subscriptions.length === 0) {
      return { success: false, error: 'No subscriptions found' };
    }

    const notificationData = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/ChefMPMLogo-v2.png',
      badge: payload.badge || '/icons/ChefMPMLogo-v2.png',
      tag: payload.tag || 'mpm-notification',
      url: payload.url || '/hub',
      actions: payload.actions || [],
    });

    const staleEndpoints: string[] = [];
    let sentCount = 0;

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, notificationData);
          sentCount++;
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleEndpoints.push(sub.endpoint);
          } else {
            console.warn(`[Push] Delivery failed for user ${userId}:`, err.message);
          }
        }
      })
    );

    // Remove stale subscriptions reactively
    if (staleEndpoints.length > 0) {
      const fresh = subscriptions.filter((s) => !staleEndpoints.includes(s.endpoint));
      await db.update(users).set({ pushTokens: fresh }).where(eq(users.id, userId));
    }

    return { success: sentCount > 0, sentCount, staleRemoved: staleEndpoints.length };
  }

  static async sendMealReminder(userId: string, label: string, time: string) {
    return this.sendNotification(userId, {
      title: `🍽️ ${label}`,
      body: `Time for ${label} at ${time}. Tap to open My Perfect Meals.`,
      tag: `meal-reminder-${label.toLowerCase().replace(/\s+/g, '-')}`,
      url: '/hub',
    });
  }
}
