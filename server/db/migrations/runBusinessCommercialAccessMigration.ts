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
}