import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(tz);

import { db } from "../db";
import { userSmsSettings, mealReminder } from "../db/schema/sms";
import { eq, and, like } from "drizzle-orm";
import { scheduleSmsAt } from "./sms";

function withinQuietHours(localISO: string, quietStart: string, quietEnd: string) {
  const t = dayjs(localISO);
  const dayStr = t.format("YYYY-MM-DD");
  const qs = dayjs(`${dayStr}T${quietStart}`);
  const qe = dayjs(`${dayStr}T${quietEnd}`);
  if (quietStart < quietEnd) return t.isAfter(qs) && t.isBefore(qe);
  return t.isAfter(qs) || t.isBefore(qe);
}

export async function rescheduleSingleMealReminder({
  userId, weekStart, mealId, date, time, title, summary
}: {
  userId: string;
  weekStart: string;
  mealId: string;
  date: string;
  time: string;
  title?: string;
  summary?: string;
}) {
  const settings = (await db.select().from(userSmsSettings).where(eq(userSmsSettings.userId, userId))).at(0);
  if (!settings || !settings.consent) return { scheduled: false, reason: "no_consent_or_settings" };

  // Cancel prior unsent reminder for this specific meal
  await db.update(mealReminder)
    .set({ cancelled: true })
    .where(and(
      eq(mealReminder.userId, userId),
      eq(mealReminder.weekStart, weekStart),
      eq(mealReminder.sent, false),
      like(mealReminder.summary, `%${mealId}%`)
    ));

  const tzName = settings.timezone || "America/Chicago";
  const local = dayjs.tz(`${date}T${time}`, tzName);
  let sendLocal = local;
  
  if (withinQuietHours(local.format(), settings.quietStart, settings.quietEnd)) {
    const [h, m] = settings.quietEnd.split(":").map(Number);
    sendLocal = local.hour(h).minute(m).second(0);
    if (sendLocal.isBefore(local)) sendLocal = sendLocal.add(1, "day");
  }
  
  const sendZ = sendLocal.toDate().toISOString();

  const body = `🍽️ ${title || "Meal"} at ${local.format("h:mm A")}.\n${summary || ""}\nReply STOP to opt out.`;

  const inserted = (await db.insert(mealReminder).values({
    userId,
    weekStart,
    mealDateTimeZ: sendZ,
    localTime: local.format("YYYY-MM-DDTHH:mm"),
    title: title || "Meal",
    summary: `${summary || ""} • id:${mealId}`.trim(),
  }).returning()).at(0);

  const jobId = await scheduleSmsAt(sendZ, {
    userId,
    toE164: settings.phoneE164,
    body,
    reminderId: inserted!.id
  });

  await db.update(mealReminder).set({ jobId }).where(eq(mealReminder.id, inserted!.id));
  return { scheduled: true };
}