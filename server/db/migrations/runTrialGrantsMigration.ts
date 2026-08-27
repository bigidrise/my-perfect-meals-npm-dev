/**
 * Trial Grants Migration
 *
 * Adds trial attribution columns and creates the trial grant/access tables.
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
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_access_type VARCHAR(20)
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

    // Pre-registration allowlist. No trial start/end dates live here: those
    // dates are stamped on users only when a matching account is created.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS trial_access_invites (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        normalized_email    TEXT NOT NULL,
        access_type         VARCHAR(20) NOT NULL CHECK (access_type IN ('pilot', 'client')),
        duration_days       INTEGER NOT NULL DEFAULT 30 CHECK (duration_days BETWEEN 1 AND 365),
        invited_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        invited_by_user_id  VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        notes               TEXT,
        activated_at        TIMESTAMPTZ,
        activated_user_id   VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
        revoked_at          TIMESTAMPTZ
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS trial_access_invites_email_history_idx
        ON trial_access_invites (normalized_email, invited_at DESC)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS trial_access_invites_activated_user_idx
        ON trial_access_invites (activated_user_id)
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS trial_access_invites_one_pending_email_idx
        ON trial_access_invites (normalized_email)
        WHERE activated_at IS NULL AND revoked_at IS NULL
    `);

    // Backfill trial_source = 'standard_signup' for existing accounts that
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
