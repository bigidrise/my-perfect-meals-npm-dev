import type { SQL } from "drizzle-orm";
import { runProfessionalDecisionMigration } from "./runProfessionalDecisionMigration";
import { runProfessionalErasureMigration } from "./runProfessionalErasureMigration";

type Database = { transaction<T>(work: (tx: { execute(query: SQL): Promise<unknown> }) => Promise<T>): Promise<T> };
// Explicit release DDL only: update the existing append-only event allowlist and
// de-identified erasure audit together. No existing account/evidence/billing DML.
export async function runProfessionalCredentialMigration(database: Database, schemaName = "public") {
  await database.transaction(async tx => {
    const sameTransaction: Database = { transaction: work => work(tx) };
    await runProfessionalDecisionMigration(sameTransaction);
    await runProfessionalErasureMigration(sameTransaction, schemaName);
  });
}
