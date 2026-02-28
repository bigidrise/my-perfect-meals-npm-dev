import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import webpush from "web-push";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails("mailto:support@myperfectmeals.app", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  } catch {}
}

export async function notifyMessageRecipient(recipientUserId: string, senderLabel: string) {
  try {
    const [user] = await db
      .select({ pushTokens: users.pushTokens })
      .from(users)
      .where(eq(users.id, recipientUserId))
      .limit(1);

    const tokens: any[] = Array.isArray(user?.pushTokens) ? user.pushTokens : [];
    if (tokens.length === 0) return;

    const payload = JSON.stringify({
      title: "New Message",
      body: `${senderLabel} sent you a message. Tap to view.`,
      data: { url: "/more" },
    });

    await Promise.allSettled(
      tokens.map((sub) => webpush.sendNotification(sub, payload).catch(() => null))
    );
  } catch (err) {
    console.error("[TabletNotify] Failed to send push:", err);
  }
}
