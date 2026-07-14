import webpush from "web-push";

const vapidConfigured =
  !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;

if (vapidConfigured) {
  webpush.setVapidDetails(
    "mailto:support@myperfectmeals.app",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
} else {
  console.warn(
    "[Push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not configured — push notifications disabled."
  );
}

export async function sendPushToSubscription(sub: any, payload: any) {
  if (!vapidConfigured) {
    const endpoint = typeof sub === "object" && sub?.endpoint ? sub.endpoint : String(sub);
    const title = typeof payload === "object" && payload?.title ? payload.title : "(no title)";
    console.warn(
      `[Push] VAPID keys not configured — skipped sending push to ${endpoint} | title: "${title}"`
    );
    return;
  }
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
