import { sql } from "drizzle-orm";

export async function runPilotProgramMigration(database: { execute: (query: any) => Promise<any> }): Promise<void> {
  await database.execute(sql`
    ALTER TABLE businesses
      ADD COLUMN IF NOT EXISTS client_capacity integer
  `);
  await database.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'businesses_client_capacity_check'
      ) THEN
        ALTER TABLE businesses
          ADD CONSTRAINT businesses_client_capacity_check
          CHECK (client_capacity IS NULL OR client_capacity >= 0);
      END IF;
    END $$;
  `);

  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS organizational_pilot_authorizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_name text NOT NULL,
      champion_email text NOT NULL,
      normalized_champion_email text NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'approved', 'claimed', 'rejected', 'revoked', 'expired')),
      professional_capacity integer NOT NULL CHECK (professional_capacity > 0),
      client_capacity integer NOT NULL CHECK (client_capacity >= 0),
      duration_days integer NOT NULL DEFAULT 30
        CHECK (duration_days BETWEEN 1 AND 365),
      claim_token_hash text UNIQUE,
      claim_token_expires_at timestamptz,
      business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
      requested_at timestamptz,
      approved_at timestamptz,
      approved_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      claimed_at timestamptz,
      claimed_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      revoked_at timestamptz,
      revoked_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      revocation_reason text,
      created_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS organizational_pilots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      authorization_id uuid NOT NULL UNIQUE REFERENCES organizational_pilot_authorizations(id) ON DELETE RESTRICT,
      name text NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'preparing'
        CHECK (status IN ('preparing', 'active', 'completed', 'cancelled', 'revoked')),
      professional_capacity integer NOT NULL CHECK (professional_capacity > 0),
      client_capacity integer NOT NULL CHECK (client_capacity >= 0),
      duration_days integer NOT NULL DEFAULT 30 CHECK (duration_days BETWEEN 1 AND 365),
      champion_business_member_id uuid REFERENCES business_members(id) ON DELETE SET NULL,
      pilot_start_at timestamptz,
      pilot_end_at timestamptz,
      started_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      completed_at timestamptz,
      cancelled_at timestamptz,
      revoked_at timestamptz,
      created_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT organizational_pilots_window_check CHECK (
        (status = 'preparing' AND pilot_start_at IS NULL AND pilot_end_at IS NULL)
        OR
        (status IN ('active', 'completed') AND pilot_start_at IS NOT NULL AND pilot_end_at IS NOT NULL AND pilot_end_at > pilot_start_at)
        OR
        (
          status IN ('cancelled', 'revoked')
          AND (
            (pilot_start_at IS NULL AND pilot_end_at IS NULL)
            OR
            (pilot_start_at IS NOT NULL AND pilot_end_at IS NOT NULL AND pilot_end_at > pilot_start_at)
          )
        )
      )
    )
  `);
  await database.execute(sql`
    DO $$
    DECLARE constraint_name text;
    BEGIN
      FOR constraint_name IN
        SELECT c.conname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
         WHERE t.relname = 'organizational_pilots'
           AND c.contype = 'c'
           AND pg_get_constraintdef(c.oid) LIKE '%pilot_start_at%'
      LOOP
        EXECUTE format('ALTER TABLE organizational_pilots DROP CONSTRAINT %I', constraint_name);
      END LOOP;
      ALTER TABLE organizational_pilots
        ADD CONSTRAINT organizational_pilots_window_check CHECK (
          (status = 'preparing' AND pilot_start_at IS NULL AND pilot_end_at IS NULL)
          OR
          (status IN ('active', 'completed') AND pilot_start_at IS NOT NULL AND pilot_end_at IS NOT NULL AND pilot_end_at > pilot_start_at)
          OR
          (
            status IN ('cancelled', 'revoked')
            AND (
              (pilot_start_at IS NULL AND pilot_end_at IS NULL)
              OR
              (pilot_start_at IS NOT NULL AND pilot_end_at IS NOT NULL AND pilot_end_at > pilot_start_at)
            )
          )
        );
    END $$;
  `);

  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS organizational_pilot_participants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pilot_id uuid NOT NULL REFERENCES organizational_pilots(id) ON DELETE CASCADE,
      user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      business_member_id uuid REFERENCES business_members(id) ON DELETE SET NULL,
      business_invitation_id uuid REFERENCES business_invitations(id) ON DELETE SET NULL,
      participant_name text,
      email text NOT NULL,
      normalized_email text NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'active', 'removed', 'replaced')),
      population_type varchar(20) NOT NULL
        CHECK (population_type IN ('professional', 'client')),
      participant_role varchar(32) NOT NULL,
      accepted_at timestamptz,
      removed_at timestamptz,
      replaced_by_participant_id uuid,
      created_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (pilot_id, normalized_email),
      CHECK (user_id IS NOT NULL OR status = 'pending')
    )
  `);

  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS organizational_pilot_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      pilot_id uuid NOT NULL REFERENCES organizational_pilots(id) ON DELETE CASCADE,
      actor_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
      event_type varchar(50) NOT NULL,
      entity_type varchar(40) NOT NULL,
      entity_id text,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS organizational_pilot_authorizations_champion_status_idx
      ON organizational_pilot_authorizations(normalized_champion_email, status)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS organizational_pilot_authorizations_business_idx
      ON organizational_pilot_authorizations(business_id)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS organizational_pilots_business_status_idx
      ON organizational_pilots(business_id, status)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS organizational_pilots_active_window_idx
      ON organizational_pilots(status, pilot_start_at, pilot_end_at)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS organizational_pilot_participants_capacity_idx
      ON organizational_pilot_participants(pilot_id, population_type, status)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS organizational_pilot_participants_user_status_idx
      ON organizational_pilot_participants(user_id, status)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS organizational_pilot_participants_invitation_idx
      ON organizational_pilot_participants(business_invitation_id)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS organizational_pilot_events_history_idx
      ON organizational_pilot_events(pilot_id, created_at DESC)
  `);
}