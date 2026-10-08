import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getDatabaseTlsConfig } from "../server/lib/databaseTls";
import { runFounderDemoGrantMigration } from "../server/db/migrations/runFounderDemoGrantMigration";

// An approved schema-only release step, never an account activation command.
if (!process.argv.includes("--approved-schema-only")) {
  throw new Error("Separate release authorization is required: --approved-schema-only");
}
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: getDatabaseTlsConfig(process.env.DATABASE_URL, { requireTls: true }),
});
try {
  await client.connect();
  await runFounderDemoGrantMigration(drizzle(client));
  console.log("Founder demo lifetime schema installed. No accounts, grants, Clinics, billing, or clinical evidence changed.");
} finally {
  await client.end();
}
