import { sql, type SQL } from "drizzle-orm";
type Database = { transaction<T>(work: (tx: { execute(query: SQL): Promise<unknown> }) => Promise<T>): Promise<T> };
export async function runDemoProfessionalMigration(database: Database) {
  await database.transaction(async tx => {
    await tx.execute(sql.raw("SET LOCAL lock_timeout = '3000ms'"));
    await tx.execute(sql.raw("SET LOCAL statement_timeout = '15000ms'"));
    await tx.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS demo_professional_workspaces (
        id uuid PRIMARY KEY, label text NOT NULL,
        classification text CHECK (classification IN ('synthetic','live')),
        created_at timestamptz NOT NULL DEFAULT clock_timestamp()
      );
      CREATE TABLE IF NOT EXISTS demo_professional_patients (
        id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES demo_professional_workspaces(id),
        classification text CHECK (classification IN ('synthetic','live')),
        label text NOT NULL, data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
        created_at timestamptz NOT NULL DEFAULT clock_timestamp()
      );
      CREATE INDEX IF NOT EXISTS demo_professional_patients_workspace_idx ON demo_professional_patients(workspace_id);
      CREATE TABLE IF NOT EXISTS demo_professional_grants (
        id uuid PRIMARY KEY, user_id text NOT NULL UNIQUE REFERENCES users(id),
        workspace_id uuid NOT NULL REFERENCES demo_professional_workspaces(id),
        persona text NOT NULL CHECK(persona = 'physician'),
        operating_status text NOT NULL CHECK(operating_status = 'demo_only'),
        state text NOT NULL CHECK(state IN ('prepared','active','revoked')),
        revision integer NOT NULL CHECK(revision > 0),
        capabilities jsonb NOT NULL CHECK(jsonb_typeof(capabilities) = 'array' AND jsonb_array_length(capabilities) > 0
          AND capabilities <@ '["patient.read","clinical.read","clinical.write","messages.read","media.read","export"]'::jsonb),
        expires_at timestamptz NOT NULL,
        approver_id text NOT NULL REFERENCES users(id), reason text NOT NULL,
        training_basis text NOT NULL CHECK(training_basis IN ('academy_evidence','demo_only_waiver')),
        training_waiver_reason text,
        acknowledged_at timestamptz, acknowledgment_version text,
        identity_request_id uuid REFERENCES professional_identity_requests(id),
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        CHECK(expires_at > created_at AND expires_at <= created_at + interval '30 days'),
        CHECK(training_basis <> 'demo_only_waiver' OR length(trim(training_waiver_reason)) >= 5),
        CHECK((acknowledged_at IS NULL) = (acknowledgment_version IS NULL)),
        CHECK(state <> 'active' OR identity_request_id IS NOT NULL)
      );
      CREATE TABLE IF NOT EXISTS demo_professional_events (
        id uuid PRIMARY KEY, grant_id uuid NOT NULL REFERENCES demo_professional_grants(id),
        actor_user_id text NOT NULL REFERENCES users(id), event_type text NOT NULL CHECK(event_type IN
          ('demo_prepared','demo_activated','demo_revoked','demo_acknowledged','demo_plan_saved','demo_exported')),
        metadata jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
      );
      CREATE INDEX IF NOT EXISTS demo_professional_events_grant_idx ON demo_professional_events(grant_id,created_at);
      CREATE OR REPLACE FUNCTION preserve_demo_professional_history() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Demo professional history/restriction is immutable'; END $$;
      DROP TRIGGER IF EXISTS demo_professional_events_immutable ON demo_professional_events;
      CREATE TRIGGER demo_professional_events_immutable BEFORE UPDATE OR DELETE ON demo_professional_events
        FOR EACH ROW EXECUTE FUNCTION preserve_demo_professional_history();
      DROP TRIGGER IF EXISTS demo_professional_grants_no_delete ON demo_professional_grants;
      CREATE TRIGGER demo_professional_grants_no_delete BEFORE DELETE ON demo_professional_grants
        FOR EACH ROW EXECUTE FUNCTION preserve_demo_professional_history();
      CREATE OR REPLACE FUNCTION preserve_demo_data_scope() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF OLD.classification IS DISTINCT FROM NEW.classification THEN
            RAISE EXCEPTION 'Demo classification cannot be promoted or changed';
          END IF;
          IF TG_TABLE_NAME = 'demo_professional_patients' AND to_jsonb(OLD)->>'workspace_id' IS DISTINCT FROM to_jsonb(NEW)->>'workspace_id' THEN
            RAISE EXCEPTION 'Demo patient workspace cannot change';
          END IF;
          RETURN NEW;
        END $$;
      DROP TRIGGER IF EXISTS demo_professional_workspaces_scope ON demo_professional_workspaces;
      CREATE TRIGGER demo_professional_workspaces_scope BEFORE UPDATE ON demo_professional_workspaces
        FOR EACH ROW EXECUTE FUNCTION preserve_demo_data_scope();
      DROP TRIGGER IF EXISTS demo_professional_patients_scope ON demo_professional_patients;
      CREATE TRIGGER demo_professional_patients_scope BEFORE UPDATE ON demo_professional_patients
        FOR EACH ROW EXECUTE FUNCTION preserve_demo_data_scope();
      CREATE OR REPLACE FUNCTION preserve_demo_grant_scope() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF OLD.user_id <> NEW.user_id OR OLD.workspace_id <> NEW.workspace_id OR
             OLD.persona <> NEW.persona OR OLD.operating_status <> NEW.operating_status THEN
            RAISE EXCEPTION 'Demo grant authority scope cannot change';
          END IF;
          IF OLD.state = 'revoked' AND NEW.state <> 'revoked' THEN
            RAISE EXCEPTION 'Revoked demo authority cannot be reactivated';
          END IF;
          RETURN NEW;
        END $$;
      DROP TRIGGER IF EXISTS demo_professional_grants_scope ON demo_professional_grants;
      CREATE TRIGGER demo_professional_grants_scope BEFORE UPDATE ON demo_professional_grants
        FOR EACH ROW EXECUTE FUNCTION preserve_demo_grant_scope();
    `));
    // Seed only new, explicitly synthetic tables. No users, Clinics or care links.
    const workspaceId = "37e010aa-c441-4881-bf2a-3f402654cd10";
    const patientId = "37e010aa-c441-4881-bf2a-3f402654cd11";
    await tx.execute(sql`INSERT INTO demo_professional_workspaces(id,label,classification)
      VALUES (${workspaceId},'Isolated physician demonstration seed','synthetic') ON CONFLICT DO NOTHING`);
    await tx.execute(sql`INSERT INTO demo_professional_patients(id,workspace_id,classification,label,data)
      VALUES (${patientId},${workspaceId},'synthetic','Synthetic Patient 001',${JSON.stringify({
        scenario: "Fictional adult with type 2 diabetes; no real person or clinical record.",
        glucose: [{ id: "synthetic-reading-1", value: 118, unit: "mg/dL", context: "FASTED", recordedAt: "2026-10-01T08:00:00.000Z" }],
        messages: [{ id: "synthetic-message-1", author: "Synthetic patient", text: "Demo message: help planning regular balanced meals." }],
        media: [{ id: "37e010aa-c441-4881-bf2a-3f402654cd15", name: "synthetic-nutrition-diary.txt", contentType: "text/plain", content: "SYNTHETIC DEMONSTRATION ONLY — fictional nutrition diary." }], plan: null,
       })}::jsonb) ON CONFLICT DO NOTHING`);
    // Repair only this new synthetic seed's pre-UUID media identifier; preserve
    // any plan and every other dataset. The route deliberately requires UUIDs.
    await tx.execute(sql`UPDATE demo_professional_patients
      SET data=jsonb_set(data,'{media,0,id}',to_jsonb(${"37e010aa-c441-4881-bf2a-3f402654cd15"}::text))
      WHERE id=${patientId} AND classification='synthetic' AND data #>> '{media,0,id}'='synthetic-media-1'`);
  });
}
