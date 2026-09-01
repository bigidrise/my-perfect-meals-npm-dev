import { sql } from "drizzle-orm";

export async function runPilotProgramMigration(database: { execute: (query: any) => Promise<any> }): Promise<void> {
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS pilot_programs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      organization_name text NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('preparing', 'active', 'completed')),
      duration_days integer NOT NULL DEFAULT 30
        CHECK (duration_days BETWEEN 1 AND 365),
      pilot_start_at timestamptz,
      pilot_end_at timestamptz,
      created_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS pilot_participants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      program_id uuid NOT NULL REFERENCES pilot_programs(id) ON DELETE CASCADE,
      user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      participant_name text,
      email text NOT NULL,
      normalized_email text NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'expired', 'revoked')),
      entitlement_key varchar(64) NOT NULL DEFAULT 'pilot_full_access'
        CHECK (entitlement_key = 'pilot_full_access'),
      source varchar(50) NOT NULL DEFAULT 'admin_pilot_program',
      requires_password_setup boolean NOT NULL DEFAULT false,
      activation_token_hash text,
      activation_token_expires_at timestamptz,
      activation_sent_at timestamptz,
      activated_at timestamptz,
      starts_at timestamptz,
      expires_at timestamptz,
      revoked_at timestamptz,
      created_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (program_id, normalized_email)
    )
  `);

  await database.execute(sql`
    ALTER TABLE pilot_programs
      ADD COLUMN IF NOT EXISTS pilot_start_at timestamptz,
      ADD COLUMN IF NOT EXISTS pilot_end_at timestamptz
  `);
  await database.execute(sql`
    ALTER TABLE pilot_programs DROP CONSTRAINT IF EXISTS pilot_programs_status_check
  `);
  await database.execute(sql`
    ALTER TABLE pilot_programs
      ADD CONSTRAINT pilot_programs_status_check
      CHECK (status IN ('preparing', 'active', 'completed'))
  `);
  await database.execute(sql`
    ALTER TABLE pilot_programs ALTER COLUMN status SET DEFAULT 'preparing'
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS pilot_participants_user_status_idx
      ON pilot_participants(user_id, status, expires_at)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS pilot_participants_email_idx
      ON pilot_participants(normalized_email, created_at DESC)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS pilot_participants_activation_token_idx
      ON pilot_participants(activation_token_hash, activation_token_expires_at)
  `);
}