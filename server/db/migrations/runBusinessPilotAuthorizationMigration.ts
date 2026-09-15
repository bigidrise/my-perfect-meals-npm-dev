import { sql } from "drizzle-orm";

/**
 * BP1 schema only. Every statement is idempotent so development and production
 * boot paths converge on the same canonical table.
 */
export async function runBusinessPilotAuthorizationMigration(
  database: { execute: (query: any) => Promise<any> },
): Promise<void> {
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS business_pilot_authorizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      authorized_email text NOT NULL,
      normalized_authorized_email text NOT NULL,
      status varchar(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'converted')),
      created_by_user_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      starts_at timestamptz,
      expires_at timestamptz,
      duration_policy varchar(16) NOT NULL DEFAULT 'fixed'
        CHECK (duration_policy IN ('fixed', 'indefinite', 'custom')),
      duration_days integer
        CHECK (duration_days IS NULL OR duration_days BETWEEN 1 AND 3650),
      access_provenance varchar(32) NOT NULL DEFAULT 'business_pilot'
        CHECK (access_provenance = 'business_pilot'),
      claimed_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      claimed_at timestamptz,
      organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
      notes text,
      internal_metadata jsonb,
      revoked_at timestamptz,
      revoked_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      revoke_reason text,
      ended_at timestamptz,
      ended_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      end_reason text,
      converted_at timestamptz,
      converted_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      conversion_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT business_pilot_authorizations_dates_check
        CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
    )
  `);
  await database.execute(sql`
    ALTER TABLE business_pilot_authorizations
      ADD COLUMN IF NOT EXISTS duration_days integer
  `);
  await database.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'business_pilot_authorizations_duration_days_check'
      ) THEN
        ALTER TABLE business_pilot_authorizations
          ADD CONSTRAINT business_pilot_authorizations_duration_days_check
          CHECK (duration_days IS NULL OR duration_days BETWEEN 1 AND 3650);
      END IF;
    END $$;
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS business_pilot_authorizations_open_email_unique
      ON business_pilot_authorizations(normalized_authorized_email)
      WHERE status IN ('pending', 'active')
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS business_pilot_authorizations_email_status_idx
      ON business_pilot_authorizations(normalized_authorized_email, status)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS business_pilot_authorizations_claimed_user_idx
      ON business_pilot_authorizations(claimed_user_id)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS business_pilot_authorizations_organization_idx
      ON business_pilot_authorizations(organization_id)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS business_pilot_authorizations_status_window_idx
      ON business_pilot_authorizations(status, starts_at, expires_at)
  `);
}