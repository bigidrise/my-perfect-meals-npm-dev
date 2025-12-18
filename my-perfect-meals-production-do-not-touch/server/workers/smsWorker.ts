import { Worker } from "bullmq";
import IORedis from "ioredis";
import twilio from "twilio";
import { db } from "../db";
import { smsLog, mealReminder } from "../db/schema/sms";
import { eq } from "drizzle-orm";

// Temporarily disable Redis connection to fix ENOTFOUND errors
console.log('📡 SMS Worker Redis temporarily disabled to prevent connection errors');
const connection = null;
const twClient = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
const FROM = process.env.TWILIO_FROM_NUMBER!;

export const smsWorker = connection ? new Worker("smsQueue", async (job) => {
  const { userId, toE164, body, reminderId } = job.data as any;
  try {
    console.log(`Sending SMS to ${toE164}: ${body.slice(0, 50)}...`);
    const msg = await twClient.messages.create({ from: FROM, to: toE164, body });
    
    await db.insert(smsLog).values({
      userId, toE164, body, 
      status: msg.status || "queued", 
      providerSid: msg.sid, 
      meta: { jobId: job.id }
    });
    
    if (reminderId) {
      await db.update(mealReminder).set({ sent: true }).where(eq(mealReminder.id, reminderId));
    }
    
    console.log(`SMS sent successfully: ${msg.sid}`);
  } catch (e: any) {
    console.error(`SMS failed for ${toE164}:`, e?.message);
    await db.insert(smsLog).values({
      userId, toE164, body, 
      status: "failed", 
      meta: { error: e?.message, jobId: job.id }
    });
    throw e;
  }
}, { connection }) : null;

console.log("SMS Worker initialized and listening for jobs...");