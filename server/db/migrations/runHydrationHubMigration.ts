import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * Phase 1 intentionally extends the legacy water ledger instead of activating
 * hydration_intake_events as a second editable source of truth.
 */
export async function runHydrationHubMigration(db: NodePgDatabase<any>) {
  await db.execute(sql`
    ALTER TABLE water_logs
      ADD COLUMN IF NOT EXISTS beverage_class TEXT NOT NULL DEFAULT 'water'
  `);
  await db.execute(sql`
    ALTER TABLE water_logs
      ADD COLUMN IF NOT EXISTS event_timezone TEXT,
      ADD COLUMN IF NOT EXISTS event_local_date TEXT
  `);
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS timezone_updated_at TIMESTAMPTZ
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hydration_hub_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      consented BOOLEAN NOT NULL DEFAULT false,
      preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
      opted_out_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hydration_hub_barriers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      barrier_code TEXT NOT NULL,
      note TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT hydration_hub_barriers_user_code_uniq UNIQUE (user_id, barrier_code)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS hydration_hub_barriers_user_active_idx
      ON hydration_hub_barriers (user_id, active)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hydration_hub_interventions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      barrier_code TEXT NOT NULL,
      option_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      destination_type TEXT NOT NULL DEFAULT 'guidance',
      destination_ref TEXT,
      provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS hydration_hub_interventions_user_created_idx
      ON hydration_hub_interventions (user_id, created_at DESC)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hydration_hub_intervention_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      intervention_id UUID NOT NULL REFERENCES hydration_hub_interventions(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS hydration_hub_intervention_events_idx
      ON hydration_hub_intervention_events (intervention_id, created_at DESC)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS hydration_hub_intervention_events_user_idx
      ON hydration_hub_intervention_events (user_id, created_at DESC)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hydration_hub_liquid_protocols (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      protocol_type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'user_entered',
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      original_instruction_text TEXT NOT NULL,
      starts_on DATE NOT NULL,
      ends_on DATE NOT NULL,
      review_on DATE,
      allowed_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
      restricted_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
      texture_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
      explicit_timing_text TEXT,
      unresolved_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      execution_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft',
      confirmed_at TIMESTAMPTZ,
      activated_at TIMESTAMPTZ,
      expired_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT hydration_hub_liquid_protocols_date_order
        CHECK (starts_on <= ends_on AND (review_on IS NULL OR review_on >= starts_on)),
      CONSTRAINT hydration_hub_liquid_protocols_source_verification
        CHECK (source <> 'professional_workflow' OR verification_status = 'professionally_verified')
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS hydration_hub_liquid_protocols_user_status_idx
      ON hydration_hub_liquid_protocols (user_id, status)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS hydration_hub_liquid_protocols_user_created_idx
      ON hydration_hub_liquid_protocols (user_id, created_at DESC)
  `);
  console.log("✅ [migration] hydration hub schema complete");
}