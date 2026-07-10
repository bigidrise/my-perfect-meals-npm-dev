/**
 * Migration: Add Coach's Corner Onboarding V1 behavioral-variable columns
 * to coaching_profiles.
 *
 * Adds:
 *   - off_track_causes (text[])
 *   - progress_mindset
 *   - trust_style
 *   - overwhelm_response
 *   - decision_style
 *   - eating_driver
 *   - craving_response
 *   - hardest_part
 *   - activity_level
 *   - active_days_per_week (smallint)
 *   - plan_start_stage
 *   - motivation_driver
 *   - goal_type
 *
 * Run once: npx tsx scripts/migrate-add-coach-corner-onboarding-v1.ts
 * Idempotent — uses IF NOT EXISTS.
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log("[migrate-coach-corner-onboarding-v1] Running migration...");

  await pool.query(`
    ALTER TABLE coaching_profiles
      ADD COLUMN IF NOT EXISTS off_track_causes TEXT[],
      ADD COLUMN IF NOT EXISTS progress_mindset TEXT,
      ADD COLUMN IF NOT EXISTS trust_style TEXT,
      ADD COLUMN IF NOT EXISTS overwhelm_response TEXT,
      ADD COLUMN IF NOT EXISTS decision_style TEXT,
      ADD COLUMN IF NOT EXISTS eating_driver TEXT,
      ADD COLUMN IF NOT EXISTS craving_response TEXT,
      ADD COLUMN IF NOT EXISTS hardest_part TEXT,
      ADD COLUMN IF NOT EXISTS activity_level TEXT,
      ADD COLUMN IF NOT EXISTS active_days_per_week SMALLINT,
      ADD COLUMN IF NOT EXISTS plan_start_stage TEXT,
      ADD COLUMN IF NOT EXISTS motivation_driver TEXT,
      ADD COLUMN IF NOT EXISTS goal_type TEXT;
  `);

  console.log("[migrate-coach-corner-onboarding-v1] ✅ Columns added (or already existed).");

  await pool.end();
}

run().catch((err) => {
  console.error("[migrate-coach-corner-onboarding-v1] ❌ Migration failed:", err);
  process.exit(1);
});
