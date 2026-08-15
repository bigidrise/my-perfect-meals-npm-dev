// server/db/migrations/runMealImageValidationMigration.ts
// Boot migration: adds vision-validation columns to meal_image_cache.
// Idempotent — safe to run on every boot. (Do not use drizzle-kit push.)

import { db } from "../../db";
import { sql } from "drizzle-orm";

export async function runMealImageValidationMigration(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE meal_image_cache
        ADD COLUMN IF NOT EXISTS validation_status TEXT,
        ADD COLUMN IF NOT EXISTS validation_model TEXT,
        ADD COLUMN IF NOT EXISTS validation_reason TEXT,
        ADD COLUMN IF NOT EXISTS recipe_signature TEXT
    `);
    console.log("✅ Meal image validation migration complete (meal_image_cache validation columns)");
  } catch (err: any) {
    console.error("❌ Meal image validation migration failed:", err.message);
    throw err;
  }
}
