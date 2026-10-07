import { db, pool } from "../server/db";
import { runProfessionalOnboardingMigration } from "../server/db/migrations/runProfessionalOnboardingMigration";

if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("This Stage 1 migration command is Development-only.");
}
try {
  await runProfessionalOnboardingMigration(db);
  console.log("Professional onboarding request/event storage is ready. No existing tables or account records were changed.");
} catch (error) {
  console.error("Professional request migration failed.", (error as { code?: string }).code ?? "MIGRATION_ERROR");
  process.exitCode = 1;
} finally {
  await pool.end();
  // server/db's existing keepalive timer must not hold an explicit CLI open.
  process.exit(process.exitCode ?? 0);
}
