import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/**
 * Keeps an administrator's explicit, non-destructive disposition of legacy
 * case-variant account records. This migration intentionally does not add a
 * case-insensitive unique index: existing independent accounts must never be
 * merged, deleted, or made inaccessible during remediation.
 */
export async function runEmailIdentityReviewMigration(
  db: Pick<NodePgDatabase<any>, "execute">,
): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_identity_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      normalized_email text NOT NULL,
      subject_user_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      reviewed_by_user_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      resolution text NOT NULL,
      note text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS email_identity_reviews_normalized_email_idx
      ON email_identity_reviews (normalized_email, created_at DESC)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS email_identity_reviews_subject_user_idx
      ON email_identity_reviews (subject_user_id, created_at DESC)
  `);
  console.log("✅ [migration] email identity review table ensured");
}