import { sql } from "drizzle-orm";

type MigrationDatabase = { execute: (query: any) => Promise<any> };

/**
 * BP1 attribution is an immutable, additive snapshot.  Existing rows remain
 * valid and nullable; new invitation/relationship writes fill these columns
 * from server-authorized workspace context.
 */
export async function runBp1OrganizationAttributionMigration(
  database: MigrationDatabase,
): Promise<void> {
  await database.execute(sql`
    ALTER TABLE business_invitations
      ADD COLUMN IF NOT EXISTS organization_id uuid,
      ADD COLUMN IF NOT EXISTS source_business_id uuid
  `);
  await database.execute(sql`
    ALTER TABLE care_invite
      ADD COLUMN IF NOT EXISTS organization_id uuid,
      ADD COLUMN IF NOT EXISTS location_id uuid,
      ADD COLUMN IF NOT EXISTS source_business_id uuid,
      ADD COLUMN IF NOT EXISTS partner_record_id text
  `);
  await database.execute(sql`
    ALTER TABLE studio_invites
      ADD COLUMN IF NOT EXISTS organization_id uuid,
      ADD COLUMN IF NOT EXISTS location_id uuid,
      ADD COLUMN IF NOT EXISTS source_business_id uuid,
      ADD COLUMN IF NOT EXISTS partner_record_id text
  `);
  await database.execute(sql`
    ALTER TABLE studio_memberships
      ADD COLUMN IF NOT EXISTS organization_id uuid,
      ADD COLUMN IF NOT EXISTS location_id uuid,
      ADD COLUMN IF NOT EXISTS source_business_id uuid,
      ADD COLUMN IF NOT EXISTS partner_record_id text
  `);
  await database.execute(sql`
    ALTER TABLE client_links
      ADD COLUMN IF NOT EXISTS organization_id uuid,
      ADD COLUMN IF NOT EXISTS location_id uuid,
      ADD COLUMN IF NOT EXISTS source_business_id uuid,
      ADD COLUMN IF NOT EXISTS partner_record_id text
  `);
  await database.execute(sql`
    ALTER TABLE client_subscriptions
      ADD COLUMN IF NOT EXISTS organization_id uuid,
      ADD COLUMN IF NOT EXISTS location_id uuid,
      ADD COLUMN IF NOT EXISTS source_business_id uuid,
      ADD COLUMN IF NOT EXISTS partner_record_id text
  `);
  await database.execute(sql`
    ALTER TABLE care_team_member
      ADD COLUMN IF NOT EXISTS organization_id uuid,
      ADD COLUMN IF NOT EXISTS location_id uuid,
      ADD COLUMN IF NOT EXISTS source_business_id uuid,
      ADD COLUMN IF NOT EXISTS partner_record_id text
  `);
}