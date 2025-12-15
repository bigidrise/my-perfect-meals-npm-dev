import { Router } from "express";
import { db } from "../db";
import { mealSchedule, notificationJobs, users } from "../../shared/schema";
import { next7Dates, toUTC } from "../services/scheduleUtil";
import { enqueueNotifyJob } from "../queue/notifyQueue";
import { eq } from "drizzle-orm";

const router = Router();

// Save schedule & (re)build jobs
router.post("/meal-schedule", async (req, res) => {
  try {
    const { userId, startDateISO, tz, wakeISO, sleepISO, counts, times, notify, channels } = req.body;
    // times can be provided directly (preferred) or auto-spaced from wake/sleep before this call

    // Upsert 7 days of meal_schedule
    const dates = next7Dates(startDateISO, tz);
    for (const d of dates) {
      await db.insert(mealSchedule).values({
        userId, 
        date: d,
        breakfastAt: times.breakfast_at || null,
        lunchAt: times.lunch_at || null,
        dinnerAt: times.dinner_at || null,
        snackTimes: JSON.stringify(times.snack_times || []),
        notifyBreakfast: !!notify.breakfast,
        notifyLunch: !!notify.lunch,
        notifyDinner: !!notify.dinner,
        notifySnacks: !!notify.snacks,
      }).onConflictDoUpdate({
        target: [mealSchedule.userId, mealSchedule.date],
        set: {
          breakfastAt: times.breakfast_at || null,
          lunchAt: times.lunch_at || null,
          dinnerAt: times.dinner_at || null,
          snackTimes: JSON.stringify(times.snack_times || []),
          notifyBreakfast: !!notify.breakfast,
          notifyLunch: !!notify.lunch,
          notifyDinner: !!notify.dinner,
          notifySnacks: !!notify.snacks,
        },
      });
    }

    // Build jobs
    const ch: ("push"|"sms"|"local")[] = channels?.length ? channels : ["push"];
    for (const d of dates) {
      if (notify.breakfast && times.breakfast_at) {
        for (const c of ch) await scheduleJob(userId, "breakfast", d, times.breakfast_at, tz, c);
      }
      if (notify.lunch && times.lunch_at) {
        for (const c of ch) await scheduleJob(userId, "lunch", d, times.lunch_at, tz, c);
      }
      if (notify.dinner && times.dinner_at) {
        for (const c of ch) await scheduleJob(userId, "dinner", d, times.dinner_at, tz, c);
      }
      if (notify.snacks && (times.snack_times||[]).length) {
        for (let i=0;i<times.snack_times.length;i++){
          for (const c of ch) await scheduleJob(userId, `snack#${i+1}`, d, times.snack_times[i], tz, c);
        }
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Error saving meal schedule:", error);
    res.status(500).json({ error: "Failed to save meal schedule" });
  }
});

async function scheduleJob(userId:string, slot:string, isoDate:string, hhmm:string, tz:string, channel:"push"|"sms"|"local") {
  const fireAtUTC = toUTC(isoDate, hhmm, tz);
  
  // Add to BullMQ queue for actual processing
  await enqueueNotifyJob({ userId, slot, channel, fireAtUTC });
  
  // Store in database for tracking
  await db.insert(notificationJobs).values({ 
    userId,
    slot,
    fireAtUtc: new Date(fireAtUTC),
    channel,
    status: "scheduled"
  }).onConflictDoNothing();
}

export default router;