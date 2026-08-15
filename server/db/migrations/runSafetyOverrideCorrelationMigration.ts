/**
 * Safety Override Correlation ID Migration
 *
 * Adds correlation_id column to safety_override_audit_logs so every override
 * audit row can be traced back to the specific generation request that consumed it.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function runSafetyOverrideCorrelationMigration(db: NodePgDatabase<any>) {
  try {
    await db.execute(sql`
      ALTER TABLE safety_override_audit_logs
        ADD COLUMN IF NOT EXISTS correlation_id TEXT
    `);
    console.log("✅ [migration] safety_override_audit_logs.correlation_id migration complete");
  } catch (err) {
    console.error("❌ [migration] safety_override_audit_logs.correlation_id migration failed:", err);
    throw err;
  }
}
