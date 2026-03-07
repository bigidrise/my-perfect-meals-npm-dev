import { Router } from 'express';
import { PushNotificationService } from '../services/pushNotificationService';
import { requireAuth, AuthenticatedRequest } from '../middleware/requireAuth';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: PushNotificationService.getVapidPublicKey() });
});

router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const { subscription } = req.body;

    if (!subscription) {
      return res.status(400).json({
        error: 'subscription is required'
      });
    }

    const result = await PushNotificationService.subscribeToPush(authUser.id, subscription);

    if (result.success) {
      try {
        const [user] = await db
          .select({ pushTokens: users.pushTokens })
          .from(users)
          .where(eq(users.id, authUser.id))
          .limit(1);

        const existing: any[] = (user?.pushTokens as any[]) || [];
        const isDuplicate = existing.some(
          (sub: any) => sub.endpoint === subscription.endpoint
        );

        if (!isDuplicate) {
          const updated = [...existing, subscription];
          await db
            .update(users)
            .set({ pushTokens: updated })
            .where(eq(users.id, authUser.id));
          console.log(`📨 Push subscription persisted to DB for user ${authUser.id} (${updated.length} total)`);
        }
      } catch (dbErr) {
        console.error('Failed to persist push subscription to DB:', dbErr);
      }
    }

    if (result.success) {
      res.json({ success: true, message: 'Subscribed to push notifications' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Push subscription error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/unsubscribe', requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;

    const result = await PushNotificationService.unsubscribe(authUser.id);

    try {
      await db
        .update(users)
        .set({ pushTokens: [] })
        .where(eq(users.id, authUser.id));
    } catch (dbErr) {
      console.error('Failed to clear push tokens from DB:', dbErr);
    }

    if (result.success) {
      res.json({ success: true, message: 'Unsubscribed from push notifications' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/test', requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const { title, body } = req.body;

    const result = await PushNotificationService.sendNotification(authUser.id, {
      title: title || 'Test Notification',
      body: body || 'This is a test notification from My Perfect Meals!',
      icon: '/notification-icon.png',
      tag: 'test-notification',
      url: '/dashboard'
    });

    if (result.success) {
      res.json({ success: true, message: 'Test notification sent' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Send test notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/meal-reminder', requireAuth, async (req, res) => {
  try {
    const authUser = (req as AuthenticatedRequest).authUser;
    const { mealType, time } = req.body;

    if (!mealType || !time) {
      return res.status(400).json({
        error: 'mealType and time are required'
      });
    }

    const result = await PushNotificationService.sendMealReminder(authUser.id, mealType, time);

    if (result.success) {
      res.json({ success: true, message: 'Meal reminder sent' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Send meal reminder error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
