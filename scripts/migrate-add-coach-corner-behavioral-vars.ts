/**
 * Migration: Add typed behavioral variable columns to coaching_profiles
 * for the Coach's Corner Living Behavioral Profile.
 *
 * Adds:
 *   - setback_response       (behavioral variable: resilience pattern)
 *   - stress_response        (behavioral variable: stress-eating pattern)
 *   - recovery_preference    (behavioral variable: preferred recovery lever)
 *
 * Also adds progress-slowed loop support columns:
 *   - progress_slowed_plan_start_at
 *   - progress_slowed_last_intent
 *   - progress_slowed_last_recommendation
 *   - progress_slowed_last_at
 *
 * Run once: npx tsx scripts/migrate-add-coach-corner-behavioral-vars.ts
 * Idempotent — uses IF NOT EXISTS.
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log("[migrate-coach-corner-behavioral-vars] Running migration...");

  await pool.query(`
    ALTER TABLE coaching_profiles
      ADD COLUMN IF NOT EXISTS setback_response TEXT,
      ADD COLUMN IF NOT EXISTS stress_response TEXT,
      ADD COLUMN IF NOT EXISTS recovery_preference TEXT,
      ADD COLUMN IF NOT EXISTS progress_slowed_last_intent TEXT,
      ADD COLUMN IF NOT EXISTS progress_slowed_last_recommendation TEXT,
      ADD COLUMN IF NOT EXISTS progress_slowed_last_at TIMESTAMP WITH TIME ZONE;
  `);

  console.log(
    "[migrate-coach-corner-behavioral-vars] ✅ Columns added (or already existed)."
  );

  await pool.end();
}

run().catch((err) => {
  console.error("[migrate-coach-corner-behavioral-vars] ❌ Migration failed:", err);
  process.exit(1);
});
