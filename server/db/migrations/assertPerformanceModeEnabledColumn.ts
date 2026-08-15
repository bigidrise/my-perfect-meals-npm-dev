/**
 * assertPerformanceModeEnabledColumn
 *
 * Post-migration guard: verifies that users.performance_mode_enabled is
 * present in information_schema.columns.  Throws a descriptive error
 * containing "STARTUP GUARD" and "performance_mode_enabled" so the server
 * refuses to start instead of letting the Performance Hub macro resolver
 * silently use wrong targets at runtime.
 *
 * Extracted into its own file so it can be unit-tested without booting the
 * full server or touching a real database.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function assertPerformanceModeEnabledColumn(
  db: Pick<NodePgDatabase<any>, "execute">,
): Promise<void> {
  const guardResult = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'performance_mode_enabled'
  `);

  const rows = (guardResult as any).rows ?? guardResult;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      "🚨 STARTUP GUARD: users.performance_mode_enabled column is missing. " +
        "The boot migration did not apply successfully. " +
        "Performance Hub macro targets will be incorrect at runtime until this column exists.",
    );
  }

  console.log(
    "✅ [guard] users.performance_mode_enabled column confirmed present",
  );
}
