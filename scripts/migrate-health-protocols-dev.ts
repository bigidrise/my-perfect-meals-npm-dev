/**
 * Additive DEV-only migration. Do not mount in either application boot path.
 * The application continues to read legacy fields until a later cutover.
 */
import { Pool } from "pg";
import { getDatabaseTlsConfig } from "../server/lib/databaseTls";

async function main() {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Health-protocol migration is DEV-only; refusing non-development environment.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Development database is unavailable.");
  const pool = new Pool({
    connectionString: url, ssl: getDatabaseTlsConfig(url), max: 1,
    connectionTimeoutMillis: 5000,
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query(`
      CREATE TABLE IF NOT EXISTS health_protocol_sources (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        subject_user_id varchar NOT NULL REFERENCES users(id),
        protocol_key text NOT NULL CHECK (protocol_key IN (
          'glp1','diabetes','renal','cardiac','anti_inflammatory','thyroid',
          'oncology','hormone_optimization','performance','liver_disease',
          'liver_support','hashimotos','hypothyroid','hyperthyroid','menopause',
          'perimenopause','metabolic_recovery','pregnancy_support'
        )),
        source_kind text NOT NULL CHECK (source_kind IN (
          'user','provider','lab','medication','system_recommendation','legacy_migrated'
        )),
        status text NOT NULL CHECK (status IN (
          'active','inactive','historical','pending_review'
        )),
        owner_user_id varchar REFERENCES users(id),
        care_relationship_id uuid,
        evidence_ref text,
        accepted_recommendation boolean,
        current_medication_use boolean,
        activated_at timestamptz,
        ended_at timestamptz,
        reviewed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS health_protocol_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id uuid NOT NULL REFERENCES health_protocol_sources(id),
        actor_user_id varchar REFERENCES users(id),
        old_status text CHECK (old_status IS NULL OR old_status IN (
          'active','inactive','historical','pending_review'
        )),
        new_status text NOT NULL CHECK (new_status IN (
          'active','inactive','historical','pending_review'
        )),
        reason_code text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS health_protocol_sources_subject_protocol_idx
      ON health_protocol_sources(subject_user_id, protocol_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS health_protocol_sources_relationship_idx
      ON health_protocol_sources(care_relationship_id)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS health_protocol_sources_origin_idx
      ON health_protocol_sources(subject_user_id, protocol_key, source_kind, evidence_ref)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS health_protocol_sources_user_idx
      ON health_protocol_sources(subject_user_id, protocol_key) WHERE source_kind = 'user'`);
    await client.query(`CREATE INDEX IF NOT EXISTS health_protocol_events_source_time_idx
      ON health_protocol_events(source_id, created_at)`);
    await client.query(`
      CREATE OR REPLACE FUNCTION reject_health_protocol_event_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Health protocol history is append-only';
      END;
      $$
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'health_protocol_events_append_only') THEN
          CREATE TRIGGER health_protocol_events_append_only
          BEFORE UPDATE OR DELETE ON health_protocol_events
          FOR EACH ROW EXECUTE FUNCTION reject_health_protocol_event_mutation();
        END IF;
      END $$
    `);
    await client.query("COMMIT");
    console.log("DEV health-protocol additive schema ensured; legacy data and food reads unchanged.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("DEV migration failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});