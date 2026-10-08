import { sql, type SQL } from "drizzle-orm";
type MigrationTransaction = { execute(query: SQL): Promise<unknown> };
type MigrationDatabase = { transaction<T>(work: (tx: MigrationTransaction) => Promise<T>): Promise<T> };

// Explicit opt-in only. No startup backfill and no ALTER/UPDATE on users.
export async function runProfessionalOnboardingMigration(database: MigrationDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql.raw("SET LOCAL lock_timeout = '3000ms'"));
    await tx.execute(sql.raw("SET LOCAL statement_timeout = '15000ms'"));
    await tx.execute(sql.raw(`CREATE TABLE IF NOT EXISTS professional_identity_requests (
      id uuid PRIMARY KEY, owner_user_id text NOT NULL UNIQUE,
      requested_role text CHECK (requested_role IN ('trainer','physician','dietitian','nurse_practitioner')),
      professional_category text CHECK (professional_category IN ('certified','experienced','non_certified')),
      credential_type text CHECK (length(credential_type) <= 120),
      credential_body text CHECK (length(credential_body) <= 120),
      credential_number text CHECK (length(credential_number) <= 120),
      credential_year text CHECK (credential_year IS NULL OR credential_year ~ '^[0-9]{4}$'),
      state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','submitted')),
      revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      submitted_at timestamptz,
      CHECK ((state = 'draft' AND submitted_at IS NULL) OR (state = 'submitted' AND submitted_at IS NOT NULL))
    )`));
    await tx.execute(sql.raw(`CREATE TABLE IF NOT EXISTS professional_identity_events (
      id uuid PRIMARY KEY,
      request_id uuid NOT NULL REFERENCES professional_identity_requests(id),
      actor_user_id text NOT NULL,
      event_type text NOT NULL CHECK (event_type IN ('draft_created','draft_updated','request_submitted')),
      request_revision integer NOT NULL CHECK (request_revision >= 0),
      metadata jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (request_id, request_revision)
    )`));
    await tx.execute(sql.raw(`CREATE OR REPLACE FUNCTION professional_identity_event_append_only()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'professional_identity_events is append-only'; END; $$`));
    await tx.execute(sql.raw(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'professional_identity_events_append_only'
        AND tgrelid = 'professional_identity_events'::regclass) THEN
        CREATE TRIGGER professional_identity_events_append_only
        BEFORE UPDATE OR DELETE OR TRUNCATE ON professional_identity_events
        FOR EACH STATEMENT EXECUTE FUNCTION professional_identity_event_append_only();
      END IF;
    END $$`));
  });
}
