// Run with: node --import tsx scripts/shopping-isolation/initialize-billing.mjs
// Imports only pure migrations, never the application's shared DB module.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { verifyIsolatedDatabase } from "./target.mjs";
import { runStripeBillingMigration } from "../../server/db/migrations/runStripeBillingMigration.ts";
import { assertStripeBillingSchema } from "../../server/db/migrations/assertStripeBillingSchema.ts";

// The original businesses base migration is embedded in prod.ts. Extract that
// exact existing statement without importing/running the production application.
const productionSource = await readFile("server/prod.ts", "utf8");
const baseStatements = [...productionSource.matchAll(
  /await db\.execute\(sql`(\s*CREATE TABLE IF NOT EXISTS businesses \([\s\S]*?)`\);/g,
)];
if (baseStatements.length !== 1 || baseStatements[0][1].includes("${")) {
  throw new Error("Cannot unambiguously identify the existing businesses base migration; stopped.");
}
const baseSql = baseStatements[0][1];
const client = await verifyIsolatedDatabase();
try {
  const prerequisites = {
    users: ["id", "stripe_customer_id", "stripe_subscription_id"],
    client_links: ["id"],
  };
  const { rows } = await client.query(`SELECT table_name,column_name
    FROM information_schema.columns WHERE table_schema='public'
    AND table_name=ANY($1::text[])`, [Object.keys(prerequisites)]);
  const missing = Object.entries(prerequisites).flatMap(([table, columns]) =>
    columns.filter(column => !rows.some(row => row.table_name === table && row.column_name === column))
      .map(column => `${table}.${column}`));
  if (missing.length) throw new Error(`Missing migration prerequisites: ${missing.join(", ")}`);

  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    await client.query(baseSql);
    console.log("Applied exact businesses base statement from server/prod.ts; SHA256:",
      createHash("sha256").update(baseSql).digest("hex"));
    const db = drizzle(client);
    // Existing entry point preserves schema-before-ownership reconciliation order.
    await runStripeBillingMigration(db);
    await assertStripeBillingSchema(db);
    await client.query("COMMIT");
    console.log("Committed existing base → billing schema → ownership reconciliation migrations in isolated DB.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  await assertStripeBillingSchema(drizzle(client));
  const { rows: counts } = await client.query(`SELECT count(*)::int AS tables
    FROM information_schema.tables WHERE table_schema='public'`);
  console.log("Isolated public table count:", counts[0].tables);
} finally { await client.end(); }
