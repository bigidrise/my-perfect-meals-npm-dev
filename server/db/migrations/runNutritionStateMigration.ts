// server/db/migrations/runNutritionStateMigration.ts
//
// Boot migration for Daily Nutrition State (#690).
// Idempotent — safe to run on every boot.
//
// Adds:
//   daily_nutrition_prescriptions.meals_per_day              INTEGER
//   daily_nutrition_prescriptions.starch_meals_per_day       INTEGER
//   daily_nutrition_prescriptions.starch_distribution_strategy TEXT
//   macro_logs.board_item_reference                          TEXT
//   macro_logs_board_item_ref_idx  (partial index on non-null board refs)

import { db } from "../../db";
import { sql } from "drizzle-orm";

export async function runNutritionStateMigration(): Promise<void> {
  try {
    // 1. Meal-plan config snapshot columns on daily_nutrition_prescriptions
    await db.execute(sql`
      ALTER TABLE daily_nutrition_prescriptions
        ADD COLUMN IF NOT EXISTS meals_per_day               INTEGER,
        ADD COLUMN IF NOT EXISTS starch_meals_per_day        INTEGER,
        ADD COLUMN IF NOT EXISTS starch_distribution_strategy TEXT
    `);

    // 2. Board-item reservation identity on macro_logs
    await db.execute(sql`
      ALTER TABLE macro_logs
        ADD COLUMN IF NOT EXISTS board_item_reference TEXT
    `);

    // 3. Unique partial index — enforces one macro_log per board item.
    // UNIQUE so a second log attempt for the same board_item_reference is
    // rejected by the DB (23505), surfaced as ALREADY_LOGGED to the caller.
    // The (user_id, board_item_reference) compound form is intentionally NOT
    // used — reservation uniqueness is per-item, not per-user, so cross-user
    // DoS via duplicate claim is also blocked at the DB layer.
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS macro_logs_board_item_ref_uniq
        ON macro_logs (board_item_reference)
        WHERE board_item_reference IS NOT NULL
    `);

    console.log("✅ Nutrition State migration complete (prescription snapshot cols, macro_logs.board_item_reference)");
  } catch (err: any) {
    console.error("❌ Nutrition State migration failed:", err.message);
    throw err;
  }
}
