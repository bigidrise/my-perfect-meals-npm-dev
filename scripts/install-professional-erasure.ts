import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getDatabaseTlsConfig } from "../server/lib/databaseTls";
import { runProfessionalErasureMigration } from "../server/db/migrations/runProfessionalErasureMigration";

// Explicit Development schema installation only. Never run from ordinary boot.
async function main() {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Professional erasure installation is Development-only");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  // Do not import the application db module: its keepalive interval keeps
  // one-off scripts alive after their transaction and pool have finished.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: getDatabaseTlsConfig(process.env.DATABASE_URL),
    max: 1, connectionTimeoutMillis: 5000,
  });
  const db = drizzle(pool);
  try {
    await runProfessionalErasureMigration(db);
    console.log("Professional erasure schema installed; no existing account or billing records modified.");
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
