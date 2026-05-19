import cron from "node-cron";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function initDataRetentionCron() {
  cron.schedule("0 2 * * *", async () => {
    const tag = "[DataRetention]";
    try {
      const meals = await db.execute(sql`
        DELETE FROM meal_logs_enhanced
        WHERE date < CURRENT_DATE - INTERVAL '365 days'
      `);
      console.log(`${tag} Purged ${(meals as any).rowCount ?? 0} meal log rows older than 365 days`);

      const cache = await db.execute(sql`
        DELETE FROM generated_meals_cache
        WHERE last_accessed_at < NOW() - INTERVAL '90 days'
      `);
      console.log(`${tag} Purged ${(cache as any).rowCount ?? 0} stale generated meal cache entries`);
    } catch (err) {
      console.error(`${tag} Cron error:`, err);
    }
  });

  console.log("[DataRetention] Scheduled: daily 2:00 AM — meal logs >365d, meal cache >90d");
}
