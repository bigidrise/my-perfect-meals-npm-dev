import webpush from "web-push";

// Configure VAPID details once on boot (only if keys are available)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:support@myperfectmeals.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn("⚠️ VAPID keys not configured - push notifications disabled");
}

export async function sendPushToSubscription(sub: any, payload: any) {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
    console.log("✅ Push notification sent successfully");
  } catch (error: any) {
    console.error("❌ Push notification failed:", error.message);
    if (error.statusCode === 410) {
      console.log("🗑️ Subscription expired, should remove from database");
    }
    throw error;
  }
}