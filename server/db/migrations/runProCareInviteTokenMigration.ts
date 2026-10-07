import { db } from "../../db";
import { sql } from "drizzle-orm";

/**
 * Idempotent migration — adds url_token to care_invite and studio_invites.
 * The url_token is a 32-char nanoid embedded in email invitation links so
 * clients never have to manually type the short invite code.
 */
export async function runProCareInviteTokenMigration(): Promise<void> {
  await db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL lock_timeout = '3s'`);
    await tx.execute(sql`SET LOCAL statement_timeout = '15s'`);
    await tx.execute(sql`ALTER TABLE care_invite
      ADD COLUMN IF NOT EXISTS url_token TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS provider_user_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS client_user_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS accepted_by_user_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ`);
    await tx.execute(sql`ALTER TABLE studio_invites
      ADD COLUMN IF NOT EXISTS url_token TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS provider_user_id TEXT,
      ADD COLUMN IF NOT EXISTS client_user_id TEXT,
      ADD COLUMN IF NOT EXISTS accepted_by_user_id TEXT,
      ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ`);
    await tx.execute(sql`ALTER TABLE care_team_member
      ADD COLUMN IF NOT EXISTS organization_id UUID,
      ADD COLUMN IF NOT EXISTS location_id UUID,
      ADD COLUMN IF NOT EXISTS source_business_id UUID,
      ADD COLUMN IF NOT EXISTS partner_record_id TEXT`);
  });
  console.log("✅ ProCare invite token migration complete (url_token on care_invite + studio_invites)");
}
