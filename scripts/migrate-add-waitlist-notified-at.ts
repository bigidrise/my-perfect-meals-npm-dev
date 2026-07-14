/**
 * Migration: Add notified_at column to user_certifications
 *
 * Tracks when a waitlisted user was sent an enrollment notification email.
 * Used by the notify-waitlist endpoint to prevent duplicate sends.
 *
 * Run once: npx tsx scripts/migrate-add-waitlist-notified-at.ts
 * Idempotent — uses IF NOT EXISTS.
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log("[migrate-waitlist-notified-at] Running migration...");

  await pool.query(`
    ALTER TABLE user_certifications
      ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP WITH TIME ZONE;
  `);

  console.log("[migrate-waitlist-notified-at] ✅ notified_at added to user_certifications (or already existed).");

  await pool.end();
}

run().catch((err) => {
  console.error("[migrate-waitlist-notified-at] ❌ Migration failed:", err);
  process.exit(1);
});
