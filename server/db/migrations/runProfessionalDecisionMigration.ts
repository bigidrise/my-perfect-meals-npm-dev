import { sql, type SQL } from "drizzle-orm";
type Transaction = { execute(query: SQL): Promise<unknown> };
type Database = { transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> };

// Stage 2 evolves ONLY Stage 1's new tables. No user/backfill DML.
export async function runProfessionalDecisionMigration(database: Database) {
  await database.transaction(async tx => {
    await tx.execute(sql.raw("SET LOCAL lock_timeout = '3000ms'"));
    await tx.execute(sql.raw("SET LOCAL statement_timeout = '15000ms'"));
    await tx.execute(sql.raw(`ALTER TABLE professional_identity_requests
      ADD COLUMN IF NOT EXISTS decision_reason text,
      ADD COLUMN IF NOT EXISTS decided_at timestamptz`));
    await tx.execute(sql.raw(`ALTER TABLE professional_identity_requests
      DROP CONSTRAINT IF EXISTS professional_identity_requests_state_check,
      DROP CONSTRAINT IF EXISTS professional_identity_requests_check`));
    await tx.execute(sql.raw(`ALTER TABLE professional_identity_requests
      ADD CONSTRAINT professional_identity_requests_state_check CHECK (state IN ('draft','submitted','approved','rejected','needs_correction')),
      ADD CONSTRAINT professional_identity_requests_check CHECK (
        (state = 'draft' AND submitted_at IS NULL) OR (state <> 'draft' AND submitted_at IS NOT NULL))`));
    await tx.execute(sql.raw(`ALTER TABLE professional_identity_events
      DROP CONSTRAINT IF EXISTS professional_identity_events_event_type_check`));
    await tx.execute(sql.raw(`ALTER TABLE professional_identity_events
      ADD CONSTRAINT professional_identity_events_event_type_check CHECK (event_type IN
        ('draft_created','draft_updated','request_submitted','correction_resumed',
         'identity_approved','identity_rejected','identity_correction_requested'))`));
  });
}
