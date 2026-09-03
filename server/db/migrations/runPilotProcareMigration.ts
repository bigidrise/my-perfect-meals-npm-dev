import { sql } from "drizzle-orm";

export async function runPilotProcareMigration(database: { execute: (query: any) => Promise<any> }): Promise<void> {
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS pilot_procare_grants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_user_id varchar(255) NOT NULL REFERENCES users(id),
      granted_by_user_id varchar(255) NOT NULL REFERENCES users(id),
      starts_at timestamptz NOT NULL DEFAULT now(),
      ends_at timestamptz NOT NULL,
      seat_limit integer NOT NULL DEFAULT 5 CHECK (seat_limit > 0),
      reason text NOT NULL,
      revoked_at timestamptz,
      revoked_by_user_id varchar(255) REFERENCES users(id),
      revocation_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (ends_at > starts_at)
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS pilot_procare_grants_provider_history_idx
      ON pilot_procare_grants(provider_user_id, created_at DESC)
  `);
  await database.execute(sql`ALTER TABLE trial_access_invites ADD COLUMN IF NOT EXISTS pilot_grant_id uuid REFERENCES pilot_procare_grants(id)`);
  await database.execute(sql`ALTER TABLE trial_access_invites ADD COLUMN IF NOT EXISTS provider_user_id varchar(255) REFERENCES users(id)`);
  await database.execute(sql`ALTER TABLE trial_grants ADD COLUMN IF NOT EXISTS pilot_grant_id uuid REFERENCES pilot_procare_grants(id)`);
  await database.execute(sql`ALTER TABLE trial_grants ADD COLUMN IF NOT EXISTS provider_user_id varchar(255) REFERENCES users(id)`);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS trial_access_invites_pilot_grant_idx
      ON trial_access_invites(pilot_grant_id, revoked_at)
  `);
}