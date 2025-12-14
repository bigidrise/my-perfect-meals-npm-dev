import { Router } from 'express';
import { PushNotificationService } from '../services/pushNotificationService';

const router = Router();

// Get VAPID public key for client subscription
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: PushNotificationService.getVapidPublicKey() });
});

// Subscribe to push notifications
router.post('/subscribe', async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    
    if (!userId || !subscription) {
      return res.status(400).json({ 
        error: 'userId and subscription are required' 
      });
    }

    const result = await PushNotificationService.subscribeToPush(userId, subscription);
    
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

// Unsubscribe from push notifications
router.post('/unsubscribe', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const result = await PushNotificationService.unsubscribe(userId);
    
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

// Send test notification (for development/testing)
router.post('/test', async (req, res) => {
  try {
    const { userId, title, body } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const result = await PushNotificationService.sendNotification(userId, {
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

// Send meal reminder notification
router.post('/meal-reminder', async (req, res) => {
  try {
    const { userId, mealType, time } = req.body;
    
    if (!userId || !mealType || !time) {
      return res.status(400).json({ 
        error: 'userId, mealType, and time are required' 
      });
    }

    const result = await PushNotificationService.sendMealReminder(userId, mealType, time);
    
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