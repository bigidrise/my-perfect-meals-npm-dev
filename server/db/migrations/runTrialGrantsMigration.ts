/**
 * Trial Grants Migration
 *
 * Adds trial_source column to users and creates the trial_grants audit table.
 * trial_grants is the authoritative record of every trial ever issued —
 * who granted it, when, at what tier, and when it expires.
 *
 * Note: users.id is VARCHAR(255) (not UUID), so FK columns must match.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function runTrialGrantsMigration(db: NodePgDatabase<any>) {
  try {
    // 1. Add trial_source to users
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_source VARCHAR(50)
    `);

    // 2. Create trial_grants audit table
    //    users.id is VARCHAR(255) — FK columns must use the same type.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS trial_grants (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id             VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        granted_by_user_id  VARCHAR(255) REFERENCES users(id),
        trial_source        VARCHAR(50)  NOT NULL,
        trial_tier          VARCHAR(50)  NOT NULL DEFAULT 'ultimate',
        expires_to_tier     VARCHAR(50)  NOT NULL DEFAULT 'free',
        trial_started_at    TIMESTAMPTZ  NOT NULL,
        trial_ends_at       TIMESTAMPTZ  NOT NULL,
        granted_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
        notes               TEXT,
        is_superseded       BOOLEAN      NOT NULL DEFAULT false
      )
    `);

    // 3. Backfill trial_source = 'standard_signup' for existing accounts that
    //    have trial dates but no source tag yet.
    await db.execute(sql`
      UPDATE users
         SET trial_source = 'standard_signup'
       WHERE trial_started_at IS NOT NULL
         AND trial_source IS NULL
         AND plan_lookup_key IS NULL
    `);

    console.log("✅ [migration] trial_grants migration complete");
  } catch (err) {
    console.error("❌ [migration] trial_grants migration failed:", err);
    throw err;
  }
}
