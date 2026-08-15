/**
 * assertColumnsExist — boot-time column existence guard
 *
 * Accepts a list of { table, column, hint? } descriptors and throws a
 * descriptive error for every column that is absent from the database.
 * Call this once during boot (index.ts + prod.ts) after critical migrations
 * have run so that missing columns surface as a clear startup failure instead
 * of a cryptic 500 or silent data loss at runtime.
 *
 * The check is a single query against information_schema.columns — one round
 * trip regardless of how many columns are being validated.
 */
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

export interface ColumnDescriptor {
  /** Unqualified table name (e.g. "users") */
  table: string;
  /** Column name (e.g. "procare_training_completed") */
  column: string;
  /**
   * Optional human-readable note explaining what breaks when the column is
   * absent. Included in the thrown error message.
   */
  hint?: string;
}

/**
 * Query information_schema.columns for all requested (table, column) pairs.
 * Throws an Error listing every missing column if any are absent.
 *
 * @param db  - Any drizzle NodePgDatabase instance
 * @param columns - Descriptors for the columns that must exist
 */
export async function assertColumnsExist(
  db: NodePgDatabase<any>,
  columns: ColumnDescriptor[],
): Promise<void> {
  if (columns.length === 0) return;

  // Build arrays for the parameterised IN clauses.
  // We need to use sql.raw with literal strings here because drizzle's sql
  // template tag doesn't support array-expansion for WHERE IN.  The values
  // are internal constants (not user input) so this is safe.
  const tableList = Array.from(new Set(columns.map((c) => c.table)));
  const columnList = Array.from(new Set(columns.map((c) => c.column)));

  const tableIn = tableList.map((t) => `'${t}'`).join(", ");
  const columnIn = columnList.map((c) => `'${c}'`).join(", ");

  const result = await db.execute(sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name  IN (${sql.raw(tableIn)})
      AND column_name IN (${sql.raw(columnIn)})
  `);

  const rows: Array<{ table_name: string; column_name: string }> =
    ((result as any).rows ?? result) as any;

  const present = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));

  const missing = columns.filter(
    (c) => !present.has(`${c.table}.${c.column}`),
  );

  if (missing.length === 0) {
    console.log(
      `✅ [guard] ${columns.length} critical column(s) confirmed present`,
    );
    return;
  }

  const lines = missing.map((c) => {
    const base = `  • ${c.table}.${c.column}`;
    return c.hint ? `${base} — ${c.hint}` : base;
  });

  throw new Error(
    `🚨 STARTUP GUARD: ${missing.length} critical column(s) are missing from the database.\n` +
      `These columns gate important runtime flows and their absence will cause 500 errors\n` +
      `or silent data loss. Ensure the boot migration ran successfully before starting:\n` +
      lines.join("\n"),
  );
}
