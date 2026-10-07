import { db, pool } from "../server/db";
import { runDemoProfessionalMigration } from "../server/db/migrations/runDemoProfessionalMigration";
await runDemoProfessionalMigration(db);
console.log("Stage 3 isolated demo schema and synthetic seed ready. No users, grants, Clinics, care links or existing accounts changed.");
// The shared DB module can retain health-check timers after a CLI transaction.
// Commit has already completed; close sockets and finish this one-shot runner.
void pool.end();
process.exit(0);
