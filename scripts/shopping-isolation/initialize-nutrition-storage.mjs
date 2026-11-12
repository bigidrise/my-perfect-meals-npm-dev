// node --import tsx scripts/shopping-isolation/initialize-nutrition-storage.mjs
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { verifyIsolatedDatabase } from "./target.mjs";
import { runPhase3BMigration } from "../../server/db/migrations/runPhase3BMigration.ts";

const source = await readFile("server/index.ts", "utf8");
const additions = [...source.matchAll(
  /await db\.execute\(sql`(ALTER TABLE daily_nutrition_prescriptions ADD COLUMN IF NOT EXISTS [^`]+)`\);/g,
)].map(match => match[1]);
if (additions.length !== 3 || additions.some(sql => sql.includes("${"))) {
  throw new Error("Existing prescription snapshot additions changed; inspect before proceeding.");
}
const client = await verifyIsolatedDatabase();
try {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    // Reviewed pure DDL: activity-event table/indexes and daily prescriptions.
    await runPhase3BMigration(drizzle(client));
    for (const sql of additions) await client.query(sql);
    await client.query("COMMIT");
    console.log("Applied existing prescription base migration and all three existing snapshot additions locally.");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
} finally { await client.end(); }
