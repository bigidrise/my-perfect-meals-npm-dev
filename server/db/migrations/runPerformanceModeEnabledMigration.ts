/**
 * runPerformanceModeEnabledMigration
 *
 * Adds users.performance_mode_enabled — the flag that gates Performance Hub
 * macro targeting.  Extracted from the deferred setTimeout migration block so
 * it can be called synchronously (via withBootRetry) before the startup guard
 * that asserts the column exists.
 *
 * Idempotent: uses ADD COLUMN IF NOT EXISTS.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function runPerformanceModeEnabledMigration(
  db: Pick<NodePgDatabase<any>, "execute">,
): Promise<void> {
  try {
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS performance_mode_enabled boolean NOT NULL DEFAULT false`,
    );
    console.log("✅ [migration] performance_mode_enabled column ensured");
  } catch (err) {
    console.error("❌ [migration] performance_mode_enabled migration failed:", err);
    throw err;
  }
}
