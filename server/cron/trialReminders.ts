/**
 * Trial expiry reminder cron
 *
 * Runs daily at 9 AM (server time). Sends a Resend email to users whose
 * free trial is about to expire — at the 6-day, 5-day, 3-day, and final-day
 * milestones. Each milestone is written to `users.trial_reminders_sent` so
 * it is never sent twice even if the cron fires more than once in a day.
 *
 * Milestones:       days_remaining ≈  6  5  3  1
 * Column values:    "day_6"  "day_5"  "day_3"  "day_1"
 */

import cron from "node-cron";
import { db } from "../db";
import { users } from "../../shared/schema";
import { sql, and, isNotNull, gt, lte } from "drizzle-orm";
import { sendTrialExpiryReminderEmail } from "../services/emailService";

const MILESTONES: { key: string; daysRemaining: number }[] = [
  { key: "day_6", daysRemaining: 6 },
  { key: "day_5", daysRemaining: 5 },
  { key: "day_3", daysRemaining: 3 },
  { key: "day_1", daysRemaining: 1 },
];

export async function runTrialExpiryReminders(): Promise<void> {
  const now = new Date();

  for (const milestone of MILESTONES) {
    const { key, daysRemaining } = milestone;

    // Window: trial_ends_at is between (now + N days - 1 hour) and (now + N days + 23 hours).
    // This gives a 24-hour window so a single daily run always catches users in this bucket.
    const windowStart = new Date(now.getTime() + (daysRemaining - 1) * 24 * 60 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() +  daysRemaining      * 24 * 60 * 60 * 1000);

    try {
      // Fetch users in the window whose trial is still active (FREE plan — no paid subscription)
      // and who have NOT yet received this milestone email.
      const candidates = await db
        .select({ id: users.id, email: users.email, firstName: users.firstName, trialEndsAt: users.trialEndsAt, trialRemindersSent: users.trialRemindersSent, planLookupKey: users.planLookupKey })
        .from(users)
        .where(
          and(
            isNotNull(users.trialEndsAt),
            gt(users.trialEndsAt, windowStart),
            lte(users.trialEndsAt, windowEnd),
            // Only remind users who are on trial (no paid plan)
            sql`(${users.planLookupKey} IS NULL OR ${users.planLookupKey} = '')`,
            // Skip if milestone already sent
            sql`NOT (${users.trialRemindersSent} @> ARRAY[${key}]::text[])`
          )
        );

      console.log(`📅 [trial-reminders] ${key}: ${candidates.length} user(s) to notify`);

      for (const user of candidates) {
        try {
          if (!user.email) continue;

          await sendTrialExpiryReminderEmail({
            to: user.email,
            firstName: user.firstName || "there",
            daysRemaining,
            trialEndsAt: user.trialEndsAt!,
          });

          // Mark milestone as sent
          await db.execute(
            sql`UPDATE users
                SET trial_reminders_sent = array_append(COALESCE(trial_reminders_sent, '{}'), ${key})
                WHERE id = ${user.id}`
          );

          console.log(`✅ [trial-reminders] ${key} sent to user ${user.id}`);
        } catch (err) {
          console.error(`❌ [trial-reminders] failed for user ${user.id}:`, err);
        }
      }
    } catch (err) {
      console.error(`❌ [trial-reminders] query error for ${key}:`, err);
    }
  }
}

export function initTrialReminderCron(): void {
  // 9:00 AM daily
  cron.schedule("0 9 * * *", async () => {
    try {
      await runTrialExpiryReminders();
    } catch (err) {
      console.error("❌ [trial-reminders] cron error:", err);
    }
  });

  console.log("📅 Trial expiry reminder cron initialized (daily 9 AM)");
}
