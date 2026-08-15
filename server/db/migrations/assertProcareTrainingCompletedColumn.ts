/**
 * assertProcareTrainingCompletedColumn
 *
 * Post-migration guard: verifies that users.procare_training_completed is
 * present in information_schema.columns.  Throws a descriptive error
 * containing "STARTUP GUARD" and "procare_training_completed" so the server
 * refuses to start instead of letting the Phase 2 Studio gate silently allow
 * untrained professionals through at runtime.
 *
 * Extracted into its own file so it can be unit-tested without booting the
 * full server or touching a real database.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function assertProcareTrainingCompletedColumn(
  db: Pick<NodePgDatabase<any>, "execute">,
): Promise<void> {
  const guardResult = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'procare_training_completed'
  `);

  const rows = (guardResult as any).rows ?? guardResult;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(
      "🚨 STARTUP GUARD: users.procare_training_completed column is missing. " +
        "The boot migration did not apply successfully. " +
        "The Phase 2 ProCare Studio gate will malfunction at runtime until this column exists.",
    );
  }

  console.log(
    "✅ [guard] users.procare_training_completed column confirmed present",
  );
}
