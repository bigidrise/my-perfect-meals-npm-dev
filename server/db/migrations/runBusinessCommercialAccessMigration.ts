import { sql } from "drizzle-orm";

type MigrationDatabase = { execute: (query: any) => Promise<any> };

export async function runBusinessCommercialAccessMigration(
  database: MigrationDatabase,
): Promise<void> {
  await database.execute(sql`
    ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS commercial_access_mode text,
      ADD COLUMN IF NOT EXISTS commercial_access_started_at timestamptz,
      ADD COLUMN IF NOT EXISTS commercial_access_ends_at timestamptz
  `);
  await database.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'businesses_commercial_access_mode_check'
      ) THEN
        ALTER TABLE businesses
          ADD CONSTRAINT businesses_commercial_access_mode_check
          CHECK (
            commercial_access_mode IS NULL OR
            commercial_access_mode IN ('onboarding_pilot', 'paid', 'authorized_arrangement')
          );
      END IF;
    END $$;
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS business_access_grants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      grant_type text NOT NULL
        CHECK (grant_type = 'permanent_complimentary_business_access'),
      granted_by_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      reason text NOT NULL,
      granted_at timestamptz NOT NULL DEFAULT now(),
      revoked_at timestamptz,
      revoked_by_user_id text REFERENCES users(id) ON DELETE RESTRICT,
      revocation_reason text
    )
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS business_access_grants_one_active_grant
      ON business_access_grants(user_id, grant_type)
      WHERE revoked_at IS NULL
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS businesses_commercial_access_window_idx
      ON businesses(commercial_access_mode, commercial_access_ends_at)
  `);
  if (process.env.NODE_ENV === "production") return;

  // Development guided pilot ledger. Additive and idempotent; no commercial
  // dates are stored in these tables.
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS business_pilot_guidance (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pilot_id uuid NOT NULL REFERENCES organizational_pilots(id) ON DELETE CASCADE,
      organization_id uuid NOT NULL,
      program_version text NOT NULL,
      assignment_pack text NOT NULL,
      activated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT business_pilot_guidance_pilot_unique UNIQUE (pilot_id)
    )
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS business_pilot_completions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pilot_id uuid NOT NULL REFERENCES organizational_pilots(id) ON DELETE CASCADE,
      organization_id uuid NOT NULL,
      program_version text NOT NULL,
      assignment_key text NOT NULL,
      actor_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      completed boolean NOT NULL DEFAULT true,
      completed_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT business_pilot_completion_unique UNIQUE (organization_id, pilot_id, program_version, assignment_key)
    )
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS business_pilot_delivery_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pilot_id uuid NOT NULL REFERENCES organizational_pilots(id) ON DELETE CASCADE,
      recipient_email text NOT NULL,
      message_type text NOT NULL,
      week integer NOT NULL,
      purpose text NOT NULL DEFAULT 'operational',
      status text NOT NULL DEFAULT 'pending',
      attempts integer NOT NULL DEFAULT 0,
      next_retry_at timestamptz NOT NULL DEFAULT now(),
      lease_until timestamptz,
      provider_id text,
      failure text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT business_pilot_delivery_logical_unique UNIQUE (pilot_id, recipient_email, message_type, week)
    )
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS business_pilot_suppressions (
      recipient_email text NOT NULL,
      purpose text NOT NULL DEFAULT 'operational',
      reason text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
      ,CONSTRAINT business_pilot_suppression_unique UNIQUE (recipient_email, purpose)
    )
  `);
  await database.execute(sql`ALTER TABLE business_pilot_suppressions ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'operational'`);
  await database.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS business_pilot_suppression_unique ON business_pilot_suppressions(recipient_email, purpose)`);
}