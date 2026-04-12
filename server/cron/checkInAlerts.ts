// server/cron/checkInAlerts.ts
// Background job that fires check-in reminders to both coach AND client
// at the time windows configured in their alert preferences.
//
// Runs every 20 minutes.
// Deduplication: alertsSent JSON column tracks which intervals have fired.

import cron from "node-cron";
import { db } from "../db";
import {
  checkInSchedules,
  checkInAlertPrefs,
  studios,
  clientNotes,
} from "../db/schema/studio";
import { users } from "../../shared/schema";
import { eq, and, gt, lte } from "drizzle-orm";

// Hours before check-in each interval represents
const INTERVAL_HOURS: Record<string, number> = {
  "1w":  168,  // 7 days
  "48h":  48,
  "24h":  24,
  "2h":    2,
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month:   "long",
    day:     "numeric",
    hour:    "numeric",
    minute:  "2-digit",
    timeZoneName: "short",
  });
}

async function sendCheckInAlerts() {
  const now = new Date();
  // Only look at non-done schedules within the next 2 weeks (or up to 2h overdue)
  const windowStart = new Date(now.getTime() - 2 * 3600 * 1000); // 2h ago
  const windowEnd   = new Date(now.getTime() + 14 * 24 * 3600 * 1000); // 2 weeks ahead

  const schedules = await db
    .select({
      s: checkInSchedules,
      studioOwner: studios.ownerUserId,
    })
    .from(checkInSchedules)
    .innerJoin(studios, eq(studios.id, checkInSchedules.studioId))
    .where(
      and(
        eq(checkInSchedules.done, false),
        gt(checkInSchedules.dueAt, windowStart),
        lte(checkInSchedules.dueAt, windowEnd),
      )
    );

  for (const { s, studioOwner } of schedules) {
    try {
      // Load studio alert preferences
      const [prefs] = await db
        .select()
        .from(checkInAlertPrefs)
        .where(eq(checkInAlertPrefs.studioId, s.studioId))
        .limit(1);

      if (prefs && !prefs.enabled) continue;
      const intervals: string[] = prefs?.intervals ?? ["24h", "1w"];

      const alertsSent: Record<string, boolean> = (s.alertsSent as Record<string, boolean>) ?? {};
      const newAlertsSent = { ...alertsSent };
      let didSend = false;

      const dueMs = s.dueAt.getTime();
      const nowMs = now.getTime();

      for (const interval of intervals) {
        if (alertsSent[interval]) continue; // already sent

        const triggerHours = INTERVAL_HOURS[interval];
        if (!triggerHours) continue;

        const triggerMs = dueMs - triggerHours * 3600 * 1000;

        // Fire if we're past the trigger time (with 30-min tolerance to avoid re-fire)
        if (nowMs >= triggerMs && nowMs < triggerMs + 30 * 60 * 1000) {
          // Load coach name
          const [coachUser] = await db
            .select({ firstName: users.firstName, nickname: users.nickname })
            .from(users)
            .where(eq(users.id, studioOwner))
            .limit(1);
          const coachName = coachUser?.nickname || coachUser?.firstName || "your coach";

          // Load client name
          const [clientUser] = await db
            .select({ firstName: users.firstName, nickname: users.nickname })
            .from(users)
            .where(eq(users.id, s.clientUserId))
            .limit(1);
          const clientName = clientUser?.nickname || clientUser?.firstName || "your client";

          const dateStr = formatDate(s.dueAt);

          // ── Coach alert (professional_only — only visible in coach dashboard) ──
          await db.insert(clientNotes).values({
            studioId: s.studioId,
            clientUserId: s.clientUserId,
            authorUserId: "system",
            noteType: "general",
            visibility: "professional_only",
            entryType: "message",
            sender: "pro",
            title: "Check-in Reminder",
            body: `📅 Reminder: Check-in with ${clientName} is scheduled for ${dateStr}.`,
            tags: ["system:check_in_reminder", `alert:${interval}`],
          });

          // ── Client alert (shared — appears in client's Tablet) ──────────────
          await db.insert(clientNotes).values({
            studioId: s.studioId,
            clientUserId: s.clientUserId,
            authorUserId: "system",
            noteType: "general",
            visibility: "shared_with_client",
            entryType: "message",
            sender: "pro",
            title: "Check-in Reminder",
            body: `📅 Reminder: Your check-in with ${coachName} is scheduled for ${dateStr}.`,
            tags: ["system:check_in_reminder", `alert:${interval}`],
          });

          newAlertsSent[interval] = true;
          didSend = true;

          console.log(
            `[CheckInAlerts] Fired ${interval} alert for client ${s.clientUserId} (dueAt: ${s.dueAt.toISOString()})`
          );
        }
      }

      if (didSend) {
        await db
          .update(checkInSchedules)
          .set({ alertsSent: newAlertsSent })
          .where(eq(checkInSchedules.id, s.id));
      }
    } catch (err) {
      console.error(`[CheckInAlerts] Error processing schedule ${s.id}:`, err);
    }
  }
}

export function initCheckInAlertCron() {
  // Run every 20 minutes
  cron.schedule("*/20 * * * *", async () => {
    try {
      await sendCheckInAlerts();
    } catch (err) {
      console.error("[CheckInAlerts] Cron error:", err);
    }
  });
  console.log("📅 Check-in alert cron initialized (every 20 min)");
}
