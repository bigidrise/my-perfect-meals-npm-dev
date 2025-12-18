import { Router } from "express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { sendPushToSubscription } from "../services/push";

const router = Router();

// Test endpoint to send a push notification immediately
router.post("/notify/push-test", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Get user's push subscriptions
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const subs: any[] = (user.pushTokens as any[]) || [];
    if (!subs.length) {
      return res.status(400).json({ error: "No push subscriptions found for this user" });
    }

    // Send test notification to the latest subscription
    const latestSub = subs.at(-1);
    const payload = {
      title: "Push is live 🎉",
      body: "Meal reminders are ready to go!",
      data: { url: "/weekly" }
    };

    await sendPushToSubscription(latestSub, payload);

    console.log(`✅ Test push sent to user ${userId}`);
    res.json({ 
      success: true, 
      message: "Test push notification sent",
      subscriptionsCount: subs.length 
    });

  } catch (error: any) {
    console.error("❌ Failed to send test push:", error);
    
    // Handle expired subscriptions
    if (error.statusCode === 410) {
      return res.status(410).json({ 
        error: "Push subscription expired", 
        action: "Please re-register for push notifications" 
      });
    }

    res.status(500).json({ error: "Failed to send test push notification" });
  }
});

// Schedule a test push for 2 minutes from now
router.post("/notify/push-test-delayed", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Schedule a push for 2 minutes from now
    const delayMs = 2 * 60 * 1000; // 2 minutes
    setTimeout(async () => {
      try {
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        const subs: any[] = (user?.pushTokens as any[]) || [];
        
        if (subs.length) {
          const payload = {
            title: "⏰ Scheduled Push Test",
            body: "This is your 2-minute delayed test notification!",
            data: { url: "/weekly" }
          };
          
          await sendPushToSubscription(subs.at(-1), payload);
          console.log(`✅ Delayed test push sent to user ${userId}`);
        }
      } catch (error) {
        console.error("❌ Failed to send delayed push:", error);
      }
    }, delayMs);

    res.json({ 
      success: true, 
      message: "Test push scheduled for 2 minutes from now" 
    });

  } catch (error) {
    console.error("❌ Failed to schedule delayed push:", error);
    res.status(500).json({ error: "Failed to schedule test push" });
  }
});

export default router;