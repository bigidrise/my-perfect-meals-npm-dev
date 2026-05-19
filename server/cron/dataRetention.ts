import cron from "node-cron";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function initDataRetentionCron() {
  cron.schedule("0 2 * * *", async () => {
    const tag = "[DataRetention]";
    try {
      // ── Step 1: Compress old meal logs into monthly behavioral summaries ──
      // Runs BEFORE deletion so intelligence is preserved.
      // Aggregates every user+month that falls outside the 365-day retention
      // window into a single summary row. Upserts so re-runs are safe.
      await db.execute(sql`
        INSERT INTO user_behavior_monthly_summary (
          user_id,
          month,
          avg_protein,
          avg_carbs,
          avg_fat,
          avg_calories,
          meal_consistency_score,
          adherence_percentage,
          top_meal_types,
          top_diet_patterns,
          summarized_at
        )
        SELECT
          user_id,
          DATE_TRUNC('month', date)::date                                   AS month,
          ROUND(AVG(protein::numeric), 1)                                   AS avg_protein,
          ROUND(AVG(carbs::numeric), 1)                                     AS avg_carbs,
          ROUND(AVG(fat::numeric), 1)                                       AS avg_fat,
          ROUND(AVG(calories::numeric), 0)                                  AS avg_calories,
          ROUND(
            COUNT(DISTINCT date)::numeric /
            EXTRACT(DAY FROM (
              DATE_TRUNC('month', date) + INTERVAL '1 month' - INTERVAL '1 day'
            )) * 100, 1
          )                                                                  AS meal_consistency_score,
          ROUND(
            COUNT(DISTINCT date)::numeric /
            EXTRACT(DAY FROM (
              DATE_TRUNC('month', date) + INTERVAL '1 month' - INTERVAL '1 day'
            )) * 100, 1
          )                                                                  AS adherence_percentage,
          jsonb_build_object(
            'breakfast', COUNT(*) FILTER (WHERE meal_slot = 'breakfast'),
            'lunch',     COUNT(*) FILTER (WHERE meal_slot = 'lunch'),
            'dinner',    COUNT(*) FILTER (WHERE meal_slot = 'dinner'),
            'snack',     COUNT(*) FILTER (WHERE meal_slot = 'snack')
          )                                                                  AS top_meal_types,
          jsonb_build_object(
            'generated', COUNT(*) FILTER (WHERE source = 'generated'),
            'barcode',   COUNT(*) FILTER (WHERE source = 'barcode'),
            'manual',    COUNT(*) FILTER (WHERE source = 'manual')
          )                                                                  AS top_diet_patterns,
          NOW()                                                              AS summarized_at
        FROM meal_logs_enhanced
        WHERE date < CURRENT_DATE - INTERVAL '365 days'
        GROUP BY user_id, DATE_TRUNC('month', date)
        ON CONFLICT (user_id, month) DO UPDATE SET
          avg_protein           = EXCLUDED.avg_protein,
          avg_carbs             = EXCLUDED.avg_carbs,
          avg_fat               = EXCLUDED.avg_fat,
          avg_calories          = EXCLUDED.avg_calories,
          meal_consistency_score = EXCLUDED.meal_consistency_score,
          adherence_percentage  = EXCLUDED.adherence_percentage,
          top_meal_types        = EXCLUDED.top_meal_types,
          top_diet_patterns     = EXCLUDED.top_diet_patterns,
          summarized_at         = EXCLUDED.summarized_at
      `);
      console.log(`${tag} Behavioral summaries compressed`);

      // ── Step 2: Purge raw meal logs older than 365 days ──
      // Safe to delete now — intelligence is preserved in monthly summaries.
      const meals = await db.execute(sql`
        DELETE FROM meal_logs_enhanced
        WHERE date < CURRENT_DATE - INTERVAL '365 days'
      `);
      console.log(`${tag} Purged ${(meals as any).rowCount ?? 0} raw meal log rows older than 365 days`);

      // ── Step 3: Evict stale generated meal cache ──
      // Generated meals are reproducible — no need to keep entries
      // that haven't been accessed in 90 days.
      const cache = await db.execute(sql`
        DELETE FROM generated_meals_cache
        WHERE last_accessed_at < NOW() - INTERVAL '90 days'
      `);
      console.log(`${tag} Purged ${(cache as any).rowCount ?? 0} stale generated meal cache entries`);

    } catch (err) {
      console.error(`${tag} Cron error:`, err);
    }
  });

  console.log("[DataRetention] Scheduled: daily 2:00 AM — compress → purge meal logs >365d, evict cache >90d");
}
