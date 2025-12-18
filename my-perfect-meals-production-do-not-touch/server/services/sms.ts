import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjs.extend(utc); 
dayjs.extend(tz);

import { smsQueue, defaultJobOpts, SmsJobData } from "../queues/index";
import twilio from "twilio";

const twClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = process.env.TWILIO_FROM_NUMBER!;

export async function scheduleSmsAt(dtISO: string, data: SmsJobData) {
  const delay = Math.max(0, dayjs(dtISO).diff(dayjs(), "millisecond"));
  const job = await smsQueue.add("sendSms", data, { ...defaultJobOpts, delay });
  return job.id as string;
}

export async function sendNow(data: SmsJobData) {
  const msg = await twClient.messages.create({ 
    from: FROM, 
    to: data.toE164, 
    body: data.body 
  });
  return msg;
}