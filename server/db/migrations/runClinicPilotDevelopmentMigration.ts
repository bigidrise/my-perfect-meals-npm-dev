import type { SQL } from "drizzle-orm";

/** Creates clinic-patient pilot infrastructure only in Development. */
export async function runClinicPilotDevelopmentMigration(): Promise<void> {
  if ((process.env.NODE_ENV || "development") === "production") return;
  const { db } = await import("../../db");
  const { sql } = await import("drizzle-orm");
  const statements: SQL[] = [
    sql`CREATE TABLE IF NOT EXISTS clinic_pilot_enrollment_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      organization_id uuid, pilot_id uuid NOT NULL REFERENCES organizational_pilots(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE, status varchar(16) NOT NULL DEFAULT 'active',
      expires_at timestamptz, capacity integer NOT NULL, access_duration_days integer NOT NULL DEFAULT 30,
      created_by_user_id varchar(255) NOT NULL REFERENCES users(id),
      revoked_at timestamptz, revoked_by_user_id varchar(255) REFERENCES users(id), revoke_reason text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    sql`CREATE INDEX IF NOT EXISTS clinic_pilot_enrollment_links_pilot_status_idx ON clinic_pilot_enrollment_links(pilot_id, status)`,
    sql`CREATE TABLE IF NOT EXISTS clinic_trial_entitlements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pilot_id uuid NOT NULL REFERENCES organizational_pilots(id) ON DELETE CASCADE,
      link_id uuid NOT NULL REFERENCES clinic_pilot_enrollment_links(id), business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      organization_id uuid, participant_id uuid NOT NULL REFERENCES organizational_pilot_participants(id),
      status varchar(16) NOT NULL DEFAULT 'active', provenance varchar(32) NOT NULL DEFAULT 'clinical_trial',
      starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT clinic_trial_entitlements_user_pilot_unique UNIQUE(user_id, pilot_id)
    )`,
    sql`CREATE INDEX IF NOT EXISTS clinic_trial_entitlements_user_active_idx ON clinic_trial_entitlements(user_id, ends_at)`,
  ];
  for (const statement of statements) await db.execute(statement);
  await db.execute(sql`ALTER TABLE clinic_trial_entitlements ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES organizational_pilot_participants(id)`);
  await db.execute(sql`ALTER TABLE clinic_trial_entitlements ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'active'`);
  await db.execute(sql`ALTER TABLE clinic_trial_entitlements ADD COLUMN IF NOT EXISTS provenance varchar(32) NOT NULL DEFAULT 'clinical_trial'`);
  await db.execute(sql`ALTER TABLE clinic_pilot_enrollment_links ADD COLUMN IF NOT EXISTS access_duration_days integer NOT NULL DEFAULT 30`);
  await db.execute(sql`ALTER TABLE clinic_trial_entitlements ALTER COLUMN link_id DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE clinic_trial_entitlements ADD COLUMN IF NOT EXISTS business_invitation_id uuid REFERENCES business_invitations(id)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS professional_temporary_access_entitlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pilot_id uuid NOT NULL REFERENCES organizational_pilots(id) ON DELETE CASCADE,
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    participant_id uuid NOT NULL REFERENCES organizational_pilot_participants(id),
    business_invitation_id uuid NOT NULL REFERENCES business_invitations(id),
    professional_role varchar(32) NOT NULL,
    status varchar(16) NOT NULL DEFAULT 'active',
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT professional_temporary_access_invitation_unique UNIQUE(business_invitation_id)
  )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS professional_temporary_access_user_active_idx ON professional_temporary_access_entitlements(user_id, ends_at)`);
}