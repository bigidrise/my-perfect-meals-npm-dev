/**
 * assertCorrelationIdColumn
 *
 * Post-migration guard: verifies that safety_override_audit_logs.correlation_id
 * is present in information_schema.columns.  Throws a descriptive error that
 * contains "STARTUP GUARD" and "correlation_id" so the server refuses to start
 * instead of letting logSafetyOverride silently 500 at runtime.
 *
 * Extracted into its own file so it can be unit-tested without booting the full
 * server or touching a real database.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function assertCorrelationIdColumn(
  db: Pick<NodePgDatabase<any>, "execute">,
): Promise<void> {
  const guardResult = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'safety_override_audit_logs'
      AND column_name = 'correlation_id'
  `);

  const rows = (guardResult as any).rows ?? guardResult;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      "🚨 STARTUP GUARD: safety_override_audit_logs.correlation_id column is missing. " +
        "The boot migration (runSafetyOverrideCorrelationMigration) did not apply successfully. " +
        "Safety PIN overrides will fail at runtime until this column exists.",
    );
  }

  console.log(
    "✅ [guard] safety_override_audit_logs.correlation_id column confirmed present",
  );
}
