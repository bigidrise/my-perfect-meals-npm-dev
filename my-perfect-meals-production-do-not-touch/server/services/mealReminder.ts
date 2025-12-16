import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
dayjs.extend(utc); 
dayjs.extend(tz);

import { db } from "../db";
import { userSmsSettings, mealReminder } from "../db/schema/sms";
import { and, eq } from "drizzle-orm";
import { scheduleSmsAt } from "./sms";

function withinQuietHours(localISO: string, quietStart: string, quietEnd: string) {
  // Check if time falls between quietStart..24:00 or 00:00..quietEnd
  const t = dayjs(localISO);
  const dayStr = t.format("YYYY-MM-DD");
  const qs = dayjs(`${dayStr}T${quietStart}`);
  const qe = dayjs(`${dayStr}T${quietEnd}`);
  
  if (quietStart < quietEnd) { // same day window
    return t.isAfter(qs) && t.isBefore(qe);
  }
  // window crosses midnight
  return t.isAfter(qs) || t.isBefore(qe);
}

export async function createMealRemindersForWeek(params: {
  userId: string;
  weekStart: string;     // YYYY-MM-DD
  planData: any;         // your saved weekly plan blob
}) {
  const { userId, weekStart, planData } = params;
  
  console.log(`Creating meal reminders for user ${userId}, week ${weekStart}`);
  
  const settings = (await db.select().from(userSmsSettings).where(eq(userSmsSettings.userId, userId))).at(0);
  if (!settings || !settings.consent) {
    console.log("No SMS consent or settings found");
    return { scheduled: 0, reason: "no_consent_or_settings" };
  }

  // Cancel existing upcoming reminders for this week (if regenerating)
  await db.update(mealReminder)
    .set({ cancelled: true })
    .where(and(
      eq(mealReminder.userId, userId),
      eq(mealReminder.weekStart, weekStart),
      eq(mealReminder.sent, false)
    ));

  const tzName = settings.timezone || "America/Chicago";
  let scheduled = 0;

  for (const day of planData?.days || []) {
    for (const meal of (day.meals || [])) {
      // Expect each meal to have a local time string like "12:30"
      const local = dayjs.tz(`${day.date}T${meal.time || "12:00"}`, tzName);
      
      // Respect quiet hours: if inside quiet window, push to quietEnd
      let sendLocal = local;
      if (withinQuietHours(local.format(), settings.quietStart, settings.quietEnd)) {
        const [h, m] = settings.quietEnd.split(":").map(Number);
        sendLocal = local.hour(h).minute(m).second(0);
        if (sendLocal.isBefore(local)) sendLocal = sendLocal.add(1, "day"); // ensure after meal time
      }
      
      const sendZ = sendLocal.toDate().toISOString();

      const body = `🍽️ ${meal.name} at ${local.format("h:mm A")}.\n` +
                   `${meal.calories ? `${meal.calories} kcal • ` : ""}` +
                   `Tap to view: My Perfect Meals`;

      const inserted = (await db.insert(mealReminder).values({
        userId, 
        weekStart, 
        mealDateTimeZ: sendZ, 
        localTime: local.format("YYYY-MM-DDTHH:mm"),
        title: meal.type || "Meal", 
        summary: `${meal.name}${meal.calories ? ` • ${meal.calories} kcal` : ""}`,
      }).returning()).at(0);

      const jobId = await scheduleSmsAt(sendZ, {
        userId, 
        toE164: settings.phoneE164, 
        body, 
        reminderId: inserted!.id
      });

      await db.update(mealReminder)
        .set({ jobId })
        .where(eq(mealReminder.id, inserted!.id));
        
      scheduled++;
      console.log(`Scheduled SMS for ${meal.name} at ${sendZ}`);
    }
  }

  console.log(`Successfully scheduled ${scheduled} meal reminders`);
  return { scheduled };
}