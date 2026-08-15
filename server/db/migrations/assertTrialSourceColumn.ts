/**
 * assertTrialSourceColumn
 *
 * Post-migration guard: verifies that users.trial_source is present in
 * information_schema.columns.  Throws a descriptive error containing
 * "STARTUP GUARD" and "trial_source" so the server refuses to start instead
 * of letting signup flows silently fail to record trial attribution at runtime.
 *
 * Extracted into its own file so it can be unit-tested without booting the
 * full server or touching a real database.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function assertTrialSourceColumn(
  db: Pick<NodePgDatabase<any>, "execute">,
): Promise<void> {
  const guardResult = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'trial_source'
  `);

  const rows = (guardResult as any).rows ?? guardResult;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      "🚨 STARTUP GUARD: users.trial_source column is missing. " +
        "The boot migration (runTrialGrantsMigration) did not apply successfully. " +
        "Trial attribution will fail at runtime until this column exists.",
    );
  }

  console.log("✅ [guard] users.trial_source column confirmed present");
}
