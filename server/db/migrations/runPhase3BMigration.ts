/**
 * Phase 3B Migration — Platform Observability Infrastructure
 *
 * Creates:
 *   platform_activity_events   — behavioral event stream (usage/engagement/consumption/outcome)
 *   daily_nutrition_prescriptions — persisted Resolver output for adherence tracking
 *
 * Idempotent: all statements use IF NOT EXISTS.
 * Safe to re-run on every boot.
 */

import { sql } from "drizzle-orm";

export async function runPhase3BMigration(
  db: Parameters<typeof import("drizzle-orm/node-postgres").drizzle>[0] extends never
    ? any
    : any
): Promise<void> {
  // ── platform_activity_events ──────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS platform_activity_events (
      id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id   text        NOT NULL,
      subject_type    text        NOT NULL DEFAULT 'user',
      subject_id      text        NOT NULL,
      event_type      text        NOT NULL,
      event_class     text        NOT NULL,
      source_feature  text,
      entity_type     text,
      entity_id       text,
      metadata        jsonb,
      occurred_at     timestamptz NOT NULL DEFAULT NOW(),
      created_at      timestamptz NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pae_owner_occurred_idx
      ON platform_activity_events (owner_user_id, occurred_at)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pae_subject_occurred_idx
      ON platform_activity_events (subject_id, subject_type, occurred_at)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pae_owner_event_type_idx
      ON platform_activity_events (owner_user_id, event_type, occurred_at)
  `);

  // ── daily_nutrition_prescriptions ─────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS daily_nutrition_prescriptions (
      id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              text        NOT NULL,
      date                 date        NOT NULL,
      target_calories      numeric,
      target_protein       numeric,
      target_total_carbs   numeric,
      target_starchy_carbs numeric,
      target_fibrous_carbs numeric,
      target_fat           numeric,
      source               text        NOT NULL DEFAULT 'macro_calculator',
      source_version       text,
      performance_day_type text,
      created_at           timestamptz NOT NULL DEFAULT NOW(),
      updated_at           timestamptz NOT NULL DEFAULT NOW(),
      CONSTRAINT dnp_user_date_uniq UNIQUE (user_id, date)
    )
  `);

  console.log(
    "✅ Phase 3B migration complete (platform_activity_events, daily_nutrition_prescriptions)"
  );
}
