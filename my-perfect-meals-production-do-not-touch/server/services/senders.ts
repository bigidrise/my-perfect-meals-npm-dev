import webpush from "web-push";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import twilio from "twilio";

// Only set VAPID details if keys are available
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:support@myperfectmeals.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function sendPush(userId: string, slot: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  const tokens: any[] = (u?.pushTokens as any[]) || [];
  const payload = JSON.stringify({ 
    title: "Meal reminder", 
    body: `Time to eat: ${slot}`, 
    data: { slot } 
  });
  await Promise.all(tokens.map(t => webpush.sendNotification(t, payload).catch(()=>null)));
}

const tw = process.env.TWILIO_SID && process.env.TWILIO_TOKEN 
  ? twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN)
  : null;

export async function sendSMS(userId: string, slot: string) {
  if (!tw || !process.env.TWILIO_FROM) return;
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u?.smsOptIn || !u?.phone) return;
  await tw.messages.create({
    from: process.env.TWILIO_FROM,
    to: u.phone,
    body: `My Perfect Meals: Time for ${slot}. Reply SNOOZE for 10m, SKIP to skip.`,
  });
}

export async function sendLocal() { 
  /* no-op: local notifications are client-side */ 
}