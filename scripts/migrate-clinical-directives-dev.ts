/**
 * Explicit, additive DEV-only shadow schema. Never import from application
 * startup or drizzle.config.ts. The external Neon database is deliberately
 * shared with Production: this adds tables there, but all application access
 * to this layer remains Development-gated until a later explicit cutover.
 */
import { Pool } from "pg";
import { getDatabaseTlsConfig } from "../server/lib/databaseTls";

async function main() {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT ||
      process.env.CLINICAL_DIRECTIVES_DEV_SCHEMA_APPLY !== "1" ||
      process.env.CLINICAL_DIRECTIVES_SHARED_SCHEMA_ACK !== "1") {
    throw new Error("Explicit Development-only migration and shared-schema acknowledgement required.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("The configured external database is unavailable.");
  const pool = new Pool({
    connectionString: url, ssl: getDatabaseTlsConfig(url), max: 1,
    connectionTimeoutMillis: 5000,
  });
  const client = await pool.connect();
  try {
    const preflight = await client.query<{ sources: string | null; users: string | null }>(
      "SELECT to_regclass('public.health_protocol_sources')::text AS sources, " +
        "to_regclass('public.users')::text AS users",
    );
    if (!preflight.rows[0]?.sources || !preflight.rows[0]?.users) {
      throw new Error("Expected existing project clinical source/user tables are missing.");
    }
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('clinical-directives-dev-schema'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS health_protocol_food_directives (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        subject_user_id varchar NOT NULL REFERENCES users(id),
        source_id uuid NOT NULL REFERENCES health_protocol_sources(id),
        protocol_key text NOT NULL CHECK (protocol_key IN (
          'glp1','diabetes','renal','cardiac','anti_inflammatory','thyroid',
          'oncology','hormone_optimization','performance','liver_disease',
          'liver_support','hashimotos','hypothyroid','hyperthyroid','menopause',
          'perimenopause','metabolic_recovery','pregnancy_support'
        )),
        rule jsonb NOT NULL CHECK (
          jsonb_typeof(rule)='object' AND
          rule->>'kind' IN ('avoid_ingredient','nutrient_bound')
        ),
        effective_at timestamptz NOT NULL,
        expires_at timestamptz,
        supersedes_id uuid REFERENCES health_protocol_food_directives(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (expires_at IS NULL OR expires_at > effective_at)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS health_protocol_review_decisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        subject_user_id varchar NOT NULL REFERENCES users(id),
        source_id uuid NOT NULL REFERENCES health_protocol_sources(id),
        directive_id uuid REFERENCES health_protocol_food_directives(id),
        disposition text NOT NULL CHECK (disposition IN (
          'history_only','current_guidance','current_hard_restriction',
          'verified_provider_directive','historical','unresolved'
        )),
        actor_user_id varchar NOT NULL REFERENCES users(id),
        reason_code text NOT NULL,
        decided_at timestamptz NOT NULL DEFAULT now(),
        CHECK (
          (disposition NOT IN ('current_hard_restriction','verified_provider_directive')
            OR directive_id IS NOT NULL)
          AND (disposition NOT IN ('history_only','current_guidance','unresolved')
            OR directive_id IS NULL)
        )
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS health_protocol_food_directives_source_time_idx
      ON health_protocol_food_directives(source_id, created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS health_protocol_food_directives_subject_idx
      ON health_protocol_food_directives(subject_user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS health_protocol_review_decisions_subject_time_idx
      ON health_protocol_review_decisions(subject_user_id, decided_at DESC, id DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS health_protocol_review_decisions_source_time_idx
      ON health_protocol_review_decisions(source_id, decided_at DESC, id DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS health_protocol_review_decisions_directive_time_idx
      ON health_protocol_review_decisions(directive_id, decided_at DESC, id DESC)`);
    await client.query(`
      CREATE OR REPLACE FUNCTION validate_clinical_directive_identity()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_TABLE_NAME='health_protocol_food_directives' THEN
          IF NOT EXISTS (
            SELECT 1 FROM health_protocol_sources s
            WHERE s.id=NEW.source_id AND s.subject_user_id=NEW.subject_user_id
              AND s.protocol_key=NEW.protocol_key
          ) THEN
            RAISE EXCEPTION 'Clinical source identity mismatch';
          END IF;
          IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM health_protocol_food_directives d
            WHERE d.id=NEW.supersedes_id AND d.source_id=NEW.source_id
              AND d.subject_user_id=NEW.subject_user_id
          ) THEN
            RAISE EXCEPTION 'Superseded clinical directive identity mismatch';
          END IF;
        ELSE
          IF NOT EXISTS (
            SELECT 1 FROM health_protocol_sources s
            WHERE s.id=NEW.source_id AND s.subject_user_id=NEW.subject_user_id
          ) THEN
            RAISE EXCEPTION 'Clinical source identity mismatch';
          END IF;
          IF NEW.directive_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM health_protocol_food_directives d
            WHERE d.id=NEW.directive_id AND d.source_id=NEW.source_id
              AND d.subject_user_id=NEW.subject_user_id
          ) THEN
            RAISE EXCEPTION 'Clinical directive identity mismatch';
          END IF;
        END IF;
        RETURN NEW;
      END $$
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION reject_clinical_authority_history_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Clinical authority history is append-only';
      END $$
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='health_protocol_directives_identity') THEN
          CREATE TRIGGER health_protocol_directives_identity
          BEFORE INSERT ON health_protocol_food_directives
          FOR EACH ROW EXECUTE FUNCTION validate_clinical_directive_identity();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='health_protocol_decisions_identity') THEN
          CREATE TRIGGER health_protocol_decisions_identity
          BEFORE INSERT ON health_protocol_review_decisions
          FOR EACH ROW EXECUTE FUNCTION validate_clinical_directive_identity();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='health_protocol_directives_append_only') THEN
          CREATE TRIGGER health_protocol_directives_append_only
          BEFORE UPDATE OR DELETE ON health_protocol_food_directives
          FOR EACH ROW EXECUTE FUNCTION reject_clinical_authority_history_mutation();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='health_protocol_decisions_append_only') THEN
          CREATE TRIGGER health_protocol_decisions_append_only
          BEFORE UPDATE OR DELETE ON health_protocol_review_decisions
          FOR EACH ROW EXECUTE FUNCTION reject_clinical_authority_history_mutation();
        END IF;
      END $$
    `);
    await client.query("COMMIT");
    console.log("Development clinical directive shadow schema ensured; no food reads changed.");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* no transaction began */ }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Clinical directive migration refused or failed:",
    error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});