/**
 * Migration: Add "I'm tired" loop support columns to coaching_profiles,
 * mirroring the existing progress-slowed continuity columns.
 *
 * Adds:
 *   - tired_last_intent
 *   - tired_last_recommendation
 *   - tired_last_at
 *
 * Run once: npx tsx scripts/migrate-add-coach-corner-tired.ts
 * Idempotent — uses IF NOT EXISTS.
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log("[migrate-coach-corner-tired] Running migration...");

  await pool.query(`
    ALTER TABLE coaching_profiles
      ADD COLUMN IF NOT EXISTS tired_last_intent TEXT,
      ADD COLUMN IF NOT EXISTS tired_last_recommendation TEXT,
      ADD COLUMN IF NOT EXISTS tired_last_at TIMESTAMP WITH TIME ZONE;
  `);

  console.log("[migrate-coach-corner-tired] ✅ Columns added (or already existed).");

  await pool.end();
}

run().catch((err) => {
  console.error("[migrate-coach-corner-tired] ❌ Migration failed:", err);
  process.exit(1);
});
