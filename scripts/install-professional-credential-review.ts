import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getDatabaseTlsConfig } from "../server/lib/databaseTls";
import { runProfessionalCredentialMigration } from "../server/db/migrations/runProfessionalCredentialMigration";

async function main() {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Credential-review installation is Development-only; Production requires a separately approved release migration.");
  }
  if (!process.env.DATABASE_URL) throw new Error("Database configuration is required");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: getDatabaseTlsConfig(process.env.DATABASE_URL), max: 1, connectionTimeoutMillis: 5000,
  });
  try {
    await runProfessionalCredentialMigration(drizzle(pool));
    console.log("Credential-review DDL installed. No account approvals, grants or billing records changed.");
  } finally { await pool.end(); }
}
main().catch(() => { console.error("Credential-review DDL failed; no installation success confirmed."); process.exitCode = 1; });
