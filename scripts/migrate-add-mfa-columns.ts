/**
 * Migration: Add MFA columns to users table
 *
 * Run once: npx tsx scripts/migrate-add-mfa-columns.ts
 * Idempotent — uses IF NOT EXISTS.
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log("[migrate-mfa] Running MFA column migration...");

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS mfa_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS mfa_secret     VARCHAR(128),
      ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB,
      ADD COLUMN IF NOT EXISTS mfa_enrolled_at  TIMESTAMP WITH TIME ZONE;
  `);

  console.log("[migrate-mfa] ✅ mfa_enabled, mfa_secret, mfa_backup_codes, mfa_enrolled_at added (or already existed).");

  await pool.end();
}

run().catch((err) => {
  console.error("[migrate-mfa] ❌ Migration failed:", err);
  process.exit(1);
});
