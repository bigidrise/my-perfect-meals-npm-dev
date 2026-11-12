// Run with: node --import tsx scripts/shopping-isolation/initialize-prerequisites.mjs
import { drizzle } from "drizzle-orm/node-postgres";
import { readFile } from "node:fs/promises";
import { verifyIsolatedDatabase } from "./target.mjs";
import { runNutritionPrioritiesMigration } from "../../server/db/migrations/runNutritionPrioritiesMigration.ts";
import { assertStripeBillingSchema } from "../../server/db/migrations/assertStripeBillingSchema.ts";
import { assertCorrelationIdColumn } from "../../server/db/migrations/assertCorrelationIdColumn.ts";
import { assertColumnsExist, CRITICAL_COLUMNS } from "../../server/bootstrap/assertColumnsExist.ts";

const client = await verifyIsolatedDatabase();
try {
  const db = drizzle(client);
  const { rows } = await client.query(`SELECT table_name,column_name
    FROM information_schema.columns WHERE table_schema='public'`);
  const present = new Set(rows.map(row => `${row.table_name}.${row.column_name}`));
  const missing = CRITICAL_COLUMNS.filter(column => !present.has(`${column.table}.${column.column}`));
  console.log("Complete critical-column inventory:", JSON.stringify({
    checked: CRITICAL_COLUMNS.length, missing: missing.map(column => `${column.table}.${column.column}`),
  }));
  // These are the other two unconditional DB startup guards in safe mode.
  await assertStripeBillingSchema(db);
  await assertCorrelationIdColumn(db);
  if (!present.has("child_profiles.id")) {
    const source = await readFile("server/index.ts", "utf8");
    const matches = [...source.matchAll(
      /await db\.execute\(sql`(\s*CREATE TABLE IF NOT EXISTS child_profiles \([\s\S]*?)`\);/g,
    )];
    if (matches.length !== 1 || matches[0][1].includes("${")) {
      throw new Error("Existing child_profiles base migration is ambiguous; refusing replacement schema.");
    }
    // Exact, additive boot migration; no application import or scheduled work.
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SET LOCAL statement_timeout='30s'");
      await client.query(matches[0][1]);
      await client.query("COMMIT");
      present.add("child_profiles.id");
      console.log("Applied exact existing child_profiles base CREATE from server/index.ts.");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  }
  for (const table of ["users", "household_profiles", "child_profiles"]) {
    if (!present.has(`${table}.id`)) throw new Error(`Missing Nutrition Priorities prerequisite: ${table}`);
  }
  const unexpected = missing.filter(column => column.column !== "food_inclusion_priorities" ||
    !["users", "household_profiles", "child_profiles"].includes(column.table));
  if (unexpected.length) throw new Error("Unaudited missing prerequisites require source/dependency inspection before execution.");

  // Audited existing migration: transaction-scoped timeouts and three additive
  // nullable JSONB columns only. No DML, external services or application DB import.
  await runNutritionPrioritiesMigration(db);
  await assertStripeBillingSchema(db);
  await assertCorrelationIdColumn(db);
  await assertColumnsExist(db, CRITICAL_COLUMNS);
  console.log("PASS: all unconditional safe-Development database startup guards passed together.");
} finally { await client.end(); }
