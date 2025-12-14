import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  mealSchedule,
  notificationJobs,
  adherenceEvents,
  users,
} from "../../shared/schema";

export async function upsertDaySchedule(
  userId: string, 
  dateISO: string, 
  times: {
    breakfast_at?: string | null;
    lunch_at?: string | null;
    dinner_at?: string | null;
    snack_times?: string[];
  }, 
  notify: { b?: boolean; l?: boolean; d?: boolean; s?: boolean }
) {
  const row = {
    userId,
    date: dateISO,
    breakfastAt: times.breakfast_at ?? null,
    lunchAt: times.lunch_at ?? null,
    dinnerAt: times.dinner_at ?? null,
    snackTimes: JSON.stringify(times.snack_times ?? []),
    notifyBreakfast: !!notify.b,
    notifyLunch: !!notify.l,
    notifyDinner: !!notify.d,
    notifySnacks: !!notify.s,
  };
  
  // Use insert with onConflictDoUpdate for upsert functionality
  await db.insert(mealSchedule)
    .values(row)
    .onConflictDoUpdate({
      target: [mealSchedule.userId, mealSchedule.date],
      set: row,
    });
}

export async function addNotifyJob(
  userId: string, 
  slot: string, 
  fireAtUTC: string, 
  channel: "push" | "sms" | "local", 
  meta: any = {}
) {
  await db.insert(notificationJobs).values({
    userId,
    slot,
    fireAtUtc: new Date(fireAtUTC),
    channel,
    status: "scheduled",
    meta: JSON.stringify(meta),
  });
}

export async function markJobStatus(id: string, status: "sent" | "snoozed" | "skipped" | "ack") {
  await db.update(notificationJobs)
    .set({ status })
    .where(eq(notificationJobs.id, id));
}

export async function logAdherence(userId: string, slot: string, action: "ate" | "snooze" | "skip") {
  await db.insert(adherenceEvents).values({ 
    userId, 
    slot, 
    action 
  });
}

export async function getUserPushSubs(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return (user?.pushTokens as any[]) || [];
}