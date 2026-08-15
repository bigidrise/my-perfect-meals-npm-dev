import { db } from "../../db";
import { sql } from "drizzle-orm";

/**
 * Idempotent migration — adds url_token to care_invite and studio_invites.
 * The url_token is a 32-char nanoid embedded in email invitation links so
 * clients never have to manually type the short invite code.
 */
export async function runProCareInviteTokenMigration(): Promise<void> {
  await db.execute(sql`ALTER TABLE care_invite ADD COLUMN IF NOT EXISTS url_token TEXT UNIQUE`);
  await db.execute(sql`ALTER TABLE studio_invites ADD COLUMN IF NOT EXISTS url_token TEXT UNIQUE`);
  console.log("✅ ProCare invite token migration complete (url_token on care_invite + studio_invites)");
}
