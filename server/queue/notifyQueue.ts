import { Queue, Worker } from "bullmq";
// import IORedis from "ioredis"; // Temporarily disabled
import { sendPushToSubscription } from "../services/push";
import { sendSMS } from "../smsService";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";

// Redis connection temporarily disabled to fix ENOTFOUND errors
let redis: any = null;
console.log('📡 Redis notifications temporarily disabled to prevent connection errors');

// Notification queue
export const notifyQueue = redis ? new Queue("notify", { connection: redis }) : null;

// Queue a notification job
export async function enqueueNotifyJob(data: {
  userId: string;
  slot: string;
  channel: "push" | "sms" | "local";
  fireAtUTC: string;
}) {
  if (!notifyQueue) {
    console.warn("Redis queue not available, notification not scheduled");
    return;
  }

  const delay = new Date(data.fireAtUTC).getTime() - Date.now();
  
  if (delay <= 0) {
    console.warn(`Notification time is in the past: ${data.fireAtUTC}`);
    return;
  }

  try {
    await notifyQueue.add("meal-reminder", data, {
      delay,
      removeOnComplete: 10,
      removeOnFail: 5,
    });
    console.log(`✅ Notification scheduled for ${data.fireAtUTC} (${data.channel})`);
  } catch (error) {
    console.error("Failed to enqueue notification:", error);
  }
}

// Worker to process notifications
export const notifyWorker = redis ? new Worker("notify", async (job) => {
  const { userId, slot, channel } = job.data;

  try {
    console.log(`🔔 Processing ${channel} notification for ${userId} - ${slot}`);

    if (channel === "push") {
      await sendPushNotification(userId, slot);
    } else if (channel === "sms") {
      await sendSMSNotification(userId, slot);
    }

    console.log(`✅ ${channel} notification sent for ${slot}`);
  } catch (error) {
    console.error(`❌ Failed to send ${channel} notification:`, error);
    throw error; // Let BullMQ handle retries
  }
}, { connection: redis }) : null;

async function sendPushNotification(userId: string, slot: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("User not found");

  const pushTokens: any[] = (user.pushTokens as any[]) || [];
  if (!pushTokens.length) throw new Error("No push subscriptions");

  const payload = {
    title: `🍽️ ${slot.charAt(0).toUpperCase() + slot.slice(1)} Time!`,
    body: `Don't forget your ${slot}. Tap to view your meal plan.`,
    data: { 
      url: "/weekly",
      slot,
      userId,
      jobId: `${userId}-${slot}-${Date.now()}`, // unique job identifier
      timestamp: new Date().toISOString()
    }
  };

  // Send to all active subscriptions
  const promises = pushTokens.map(async (sub) => {
    try {
      await sendPushToSubscription(sub, payload);
    } catch (error: any) {
      if (error.statusCode === 410) {
        console.log(`🗑️ Removing expired push subscription for ${userId}`);
        // TODO: Remove expired subscription from database
      }
      throw error;
    }
  });

  await Promise.allSettled(promises);
}

async function sendSMSNotification(userId: string, slot: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.phone || !user.smsOptIn) {
    throw new Error("User not found or SMS not enabled");
  }

  console.log(`📱 Sending SMS to ${user.phone}: Time for ${slot}!`);
  
  // Send actual SMS notification
  const success = await sendSMS(user.phone, `🍽️ Time for ${slot}! Check your meal plan: ${process.env.FRONTEND_URL || 'https://myapp.replit.app'}/weekly`);
  
  if (!success) {
    throw new Error(`Failed to send SMS to ${user.phone}`);
  }
}

// Cleanup worker on shutdown
process.on('SIGTERM', async () => {
  if (notifyWorker) {
    await notifyWorker.close();
  }
  if (redis) {
    redis.disconnect();
  }
});