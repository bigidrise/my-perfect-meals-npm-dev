import { db, pool } from "../server/db";
import { runProfessionalDecisionMigration } from "../server/db/migrations/runProfessionalDecisionMigration";
if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) throw new Error("Development-only migration.");
try {
  await runProfessionalDecisionMigration(db);
  console.log("Stage 2 request decision schema ready. No account records changed.");
} catch (error) {
  console.error("Stage 2 schema migration failed.", (error as { code?: string }).code ?? "MIGRATION_ERROR");
  process.exitCode = 1;
} finally { await pool.end(); process.exit(process.exitCode ?? 0); }
