import { db } from '../db';
import { sql } from 'drizzle-orm';
import { PushNotificationService } from './pushNotificationService';

// Tracks what we already sent this minute to avoid double-fire
const sentThisMinute = new Map<string, string>(); // key: `${userId}:${slotId}` => minuteKey

function minuteKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;
}

async function fireReminders() {
  const mk = minuteKey();

  // Clean stale sent-cache entries from previous minutes
  for (const [k, v] of sentThisMinute) {
    if (v !== mk) sentThisMinute.delete(k);
  }

  try {
    // Load all enabled slots with their user's timezone
    const rows = (await db.execute(sql`
      SELECT
        rs.id,
        rs.user_id,
        rs.label,
        rs.time,
        u.timezone
      FROM user_reminder_slots rs
      JOIN users u ON u.id = rs.user_id
      WHERE rs.enabled = true
        AND rs.type = 'meal'
    `)).rows as Array<{
      id: string;
      user_id: string;
      label: string;
      time: string;
      timezone: string | null;
    }>;

    if (rows.length === 0) return;

    const now = new Date();

    for (const slot of rows) {
      const tz = slot.timezone || 'America/Chicago';

      // Get the user's current local time in their timezone
      const localTimeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: tz,
      });

      // Normalize both times to HH:MM for comparison
      const slotTime = slot.time.slice(0, 5); // already HH:MM
      const localHHMM = localTimeStr.slice(0, 5);

      if (slotTime !== localHHMM) continue;

      const cacheKey = `${slot.user_id}:${slot.id}`;
      if (sentThisMinute.get(cacheKey) === mk) continue; // already sent this minute
      sentThisMinute.set(cacheKey, mk);

      // Format display time (12h format)
      const [h, m] = slot.time.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      const displayTime = `${h12}:${m.toString().padStart(2, '0')} ${period}`;

      try {
        await PushNotificationService.sendMealReminder(slot.user_id, slot.label, displayTime);
        // Update last_sent_at
        await db.execute(sql`
          UPDATE user_reminder_slots SET last_sent_at = now() WHERE id = ${slot.id}::uuid
        `);
      } catch (err: any) {
        console.warn(`[ReminderScheduler] Failed to send reminder for slot ${slot.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[ReminderScheduler] Error during reminder check:', err.message);
  }
}

export function startReminderScheduler() {
  // Align to the next whole minute, then fire every 60s
  const now = new Date();
  const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  setTimeout(() => {
    fireReminders();
    setInterval(fireReminders, 60_000);
  }, msUntilNextMinute);

  console.log(`🔔 Reminder scheduler started — first check in ${Math.round(msUntilNextMinute / 1000)}s`);
}
