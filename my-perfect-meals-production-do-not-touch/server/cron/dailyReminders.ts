// --- NEW: server/cron/dailyReminders.ts ---
import cron from "node-cron";
import { getUsersNeedingDailyJournalReminder, sendDailyJournalReminder } from "../services/reminderService";

export function initDailyReminderCron() {
  // Run every minute to check for reminders (in production, consider every 5-15 minutes)
  cron.schedule("* * * * *", async () => {
    try {
      const nowISO = new Date().toISOString();
      const users = await getUsersNeedingDailyJournalReminder(nowISO);
      console.log(`Loading ${users.length} existing reminders`);
      
      for (const user of users) {
        try {
          await sendDailyJournalReminder(user);
          console.log(`✅ Sent daily journal reminder to ${user.id}`);
        } catch (err) {
          console.error(`❌ Failed to send reminder to ${user.id}:`, err);
        }
      }
    } catch (err) {
      console.error("❌ Daily reminder cron error:", err);
    }
  });
  
  console.log("📅 Daily reminder cron initialized");
}