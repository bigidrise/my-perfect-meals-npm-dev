/**
 * runProcareTrainingMigration
 *
 * Adds users.procare_training_completed — the Phase 2 ProCare Studio gate
 * column.  Extracted from the deferred setTimeout migration block so it can
 * be called synchronously (via withBootRetry) before the startup guard that
 * asserts the column exists.
 *
 * Idempotent: uses ADD COLUMN IF NOT EXISTS.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function runProcareTrainingMigration(
  db: Pick<NodePgDatabase<any>, "execute">,
): Promise<void> {
  try {
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS procare_training_completed boolean NOT NULL DEFAULT false`,
    );
    console.log("✅ [migration] procare_training_completed column ensured");
  } catch (err) {
    console.error("❌ [migration] procare_training_completed migration failed:", err);
    throw err;
  }
}
