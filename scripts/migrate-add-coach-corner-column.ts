/**
 * Migration: Add coach_profile_completed_at column to coaching_profiles table
 *
 * Run once: npx tsx scripts/migrate-add-coach-corner-column.ts
 * Idempotent — uses IF NOT EXISTS.
 */

import { Pool } from "pg";
import { getDatabaseTlsConfig } from "../server/lib/databaseTls";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: getDatabaseTlsConfig(process.env.DATABASE_URL, { requireTls: true }),
});

async function run() {
  console.log("[migrate-coach-corner] Running Coach's Corner column migration...");

  await pool.query(`
    ALTER TABLE coaching_profiles
      ADD COLUMN IF NOT EXISTS coach_profile_completed_at TIMESTAMP WITH TIME ZONE;
  `);

  console.log("[migrate-coach-corner] ✅ coach_profile_completed_at added (or already existed).");

  await pool.end();
}

run().catch((err) => {
  console.error("[migrate-coach-corner] ❌ Migration failed:", err);
  process.exit(1);
});
