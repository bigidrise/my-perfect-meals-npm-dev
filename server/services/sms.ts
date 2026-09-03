import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import tz from "dayjs/plugin/timezone.js";
dayjs.extend(utc); 
dayjs.extend(tz);

import { smsQueue, defaultJobOpts, SmsJobData } from "../queues/index";
import twilio from "twilio";

const hasTwilioCreds =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.TWILIO_FROM_NUMBER;

const twClient = hasTwilioCreds
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;
const FROM = process.env.TWILIO_FROM_NUMBER ?? null;

if (!hasTwilioCreds) {
  console.warn(
    "[SMS] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER not fully configured — SMS notifications disabled."
  );
}

export async function scheduleSmsAt(dtISO: string, data: SmsJobData) {
  const delay = Math.max(0, dayjs(dtISO).diff(dayjs(), "millisecond"));
  const job = await smsQueue.add("sendSms", data, { ...defaultJobOpts, delay });
  return job.id as string;
}

export async function sendNow(data: SmsJobData) {
  if (!twClient || !FROM) {
    console.warn(
      `[SMS] Twilio not configured — skipped sending SMS to ${data.toE164} | body: "${data.body}"`
    );
    return null;
  }
  const msg = await twClient.messages.create({ 
    from: FROM, 
    to: data.toE164, 
    body: data.body 
  });
  return msg;
}
