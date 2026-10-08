import { sql, type SQL } from "drizzle-orm";

type Database = { transaction<T>(work: (tx: { execute(query: SQL): Promise<unknown> }) => Promise<T>): Promise<T> };

/**
 * Run after the Stage 1–3 migrations. No account/backfill DML.
 * An actual users DELETE is the authority: no HTTP redaction endpoint, public
 * history-edit function, or session-setting-only bypass is introduced.
 * schemaName is exclusively for rollback-only PostgreSQL integration fixtures.
 */
export async function runProfessionalErasureMigration(database: Database, schemaName = "public") {
  if (!/^[a-z][a-z0-9_]*$/.test(schemaName)) throw new Error("Invalid migration schema");
  await database.transaction(async tx => {
    await tx.execute(sql.raw("SET LOCAL lock_timeout = '3000ms'"));
    await tx.execute(sql.raw("SET LOCAL statement_timeout = '15000ms'"));
    await tx.execute(sql.raw(`
      SET LOCAL search_path = "${schemaName}", pg_catalog;
      -- Prevent an already-authorized concurrent writer from recreating an
      -- orphan application after account deletion commits.
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint
          WHERE conrelid='professional_identity_requests'::regclass
            AND conname='professional_identity_requests_owner_fk') THEN
          ALTER TABLE professional_identity_requests
            ADD CONSTRAINT professional_identity_requests_owner_fk
            FOREIGN KEY(owner_user_id) REFERENCES users(id);
        END IF;
      END $$;
      ALTER TABLE demo_professional_grants ALTER COLUMN approver_id DROP NOT NULL;
      ALTER TABLE demo_professional_events ALTER COLUMN actor_user_id DROP NOT NULL;

      CREATE TABLE IF NOT EXISTS professional_lifecycle_erasure_audit (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        event_type text NOT NULL CHECK (event_type IN (
          'identity_approved','identity_rejected','identity_correction_requested',
          'demo_prepared','demo_activated','demo_revoked','credentials_verified','credentials_rejected','credentials_pending')),
        outcome text NOT NULL CHECK (outcome IN ('approved','rejected','needs_correction','prepared','active','revoked','verified','pending')),
        occurred_at timestamptz NOT NULL,
        transition_facts jsonb NOT NULL
      );
      ALTER TABLE professional_lifecycle_erasure_audit
        DROP CONSTRAINT IF EXISTS professional_lifecycle_erasure_audit_event_type_check,
        DROP CONSTRAINT IF EXISTS professional_lifecycle_erasure_audit_outcome_check;
      ALTER TABLE professional_lifecycle_erasure_audit
        ADD CONSTRAINT professional_lifecycle_erasure_audit_event_type_check CHECK (event_type IN
          ('identity_approved','identity_rejected','identity_correction_requested','demo_prepared','demo_activated','demo_revoked',
           'credentials_verified','credentials_rejected','credentials_pending')),
        ADD CONSTRAINT professional_lifecycle_erasure_audit_outcome_check CHECK (outcome IN
          ('approved','rejected','needs_correction','prepared','active','revoked','verified','pending'));

      CREATE OR REPLACE FUNCTION professional_erasure_transition_facts(input jsonb)
      RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = "${schemaName}", pg_catalog AS $$
        SELECT jsonb_strip_nulls(jsonb_build_object(
          'previousIdentity', CASE WHEN input->>'previousIdentity' IN
            ('business','medical','physician','trainer','dietitian','nurse_practitioner')
            THEN input->>'previousIdentity' END,
          'requestedIdentity', CASE WHEN input->>'requestedIdentity' IN
            ('physician','trainer','dietitian','nurse_practitioner') THEN input->>'requestedIdentity' END,
          'approvedIdentity', CASE WHEN input->>'approvedIdentity' IN
            ('physician','trainer','dietitian','nurse_practitioner') THEN input->>'approvedIdentity' END
        ));
      $$;

      CREATE OR REPLACE FUNCTION professional_identity_event_append_only()
      RETURNS trigger LANGUAGE plpgsql SET search_path = "${schemaName}", pg_catalog AS $$
      DECLARE subject text := nullif(current_setting('mpm.professional_erasure_subject', true), '');
      BEGIN
        -- Depth 2 means this operation is inside the users BEFORE DELETE trigger.
        -- Setting the GUC directly, TRUNCATE, and ordinary edits never qualify.
        IF pg_trigger_depth() = 2 AND subject IS NOT NULL THEN
          IF TG_OP = 'DELETE' AND EXISTS (
            SELECT 1 FROM professional_identity_requests WHERE id=OLD.request_id AND owner_user_id=subject
          ) THEN RETURN OLD; END IF;
          IF TG_OP = 'UPDATE' AND OLD.actor_user_id=subject
            AND NEW.actor_user_id=current_setting('mpm.professional_erasure_anonymous_actor', true)
            AND NEW.metadata=professional_erasure_transition_facts(OLD.metadata)
            AND (to_jsonb(NEW)-'actor_user_id'-'metadata')=(to_jsonb(OLD)-'actor_user_id'-'metadata')
          THEN RETURN NEW; END IF;
        END IF;
        RAISE EXCEPTION 'professional_identity_events is append-only';
      END $$;
      DROP TRIGGER IF EXISTS professional_identity_events_append_only ON professional_identity_events;
      CREATE TRIGGER professional_identity_events_append_only BEFORE UPDATE OR DELETE ON professional_identity_events
        FOR EACH ROW EXECUTE FUNCTION professional_identity_event_append_only();
      CREATE OR REPLACE FUNCTION professional_erasure_audit_immutable()
      RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Professional erasure audit is immutable'; END $$;
      DROP TRIGGER IF EXISTS professional_identity_events_no_truncate ON professional_identity_events;
      CREATE TRIGGER professional_identity_events_no_truncate BEFORE TRUNCATE ON professional_identity_events
        FOR EACH STATEMENT EXECUTE FUNCTION professional_erasure_audit_immutable();
      DROP TRIGGER IF EXISTS professional_lifecycle_erasure_audit_immutable ON professional_lifecycle_erasure_audit;
      CREATE TRIGGER professional_lifecycle_erasure_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
        ON professional_lifecycle_erasure_audit FOR EACH STATEMENT EXECUTE FUNCTION professional_erasure_audit_immutable();

      CREATE OR REPLACE FUNCTION preserve_demo_professional_history()
      RETURNS trigger LANGUAGE plpgsql SET search_path = "${schemaName}", pg_catalog AS $$
      DECLARE subject text := nullif(current_setting('mpm.professional_erasure_subject', true), '');
      BEGIN
        IF pg_trigger_depth()=2 AND subject IS NOT NULL THEN
          IF TG_TABLE_NAME='demo_professional_grants' THEN
            IF TG_OP='DELETE' AND OLD.user_id=subject THEN RETURN OLD; END IF;
          ELSIF TG_TABLE_NAME='demo_professional_events' THEN
            IF TG_OP='DELETE' AND EXISTS (
              SELECT 1 FROM demo_professional_grants WHERE id=OLD.grant_id AND user_id=subject
            ) THEN RETURN OLD; END IF;
            IF TG_OP='UPDATE' AND OLD.actor_user_id=subject AND NEW.actor_user_id IS NULL
              AND NEW.metadata='{"operatingStatus":"demo_only","persona":"physician"}'::jsonb
              AND (to_jsonb(NEW)-'actor_user_id'-'metadata')=(to_jsonb(OLD)-'actor_user_id'-'metadata')
            THEN RETURN NEW; END IF;
          END IF;
        END IF;
        RAISE EXCEPTION 'Demo professional history/restriction is immutable';
      END $$;

      CREATE OR REPLACE FUNCTION erase_professional_lifecycle_on_account_delete()
      RETURNS trigger LANGUAGE plpgsql SET search_path = "${schemaName}", pg_catalog AS $$
      DECLARE prior_subject text := coalesce(current_setting('mpm.professional_erasure_subject',true),'');
              prior_actor text := coalesce(current_setting('mpm.professional_erasure_anonymous_actor',true),'');
      BEGIN
        IF pg_trigger_depth()<>1 THEN RAISE EXCEPTION 'Nested account erasure is not authorized'; END IF;
        PERFORM set_config('mpm.professional_erasure_subject',OLD.id,true);
        PERFORM set_config('mpm.professional_erasure_anonymous_actor','erased:'||gen_random_uuid()::text,true);

        INSERT INTO professional_lifecycle_erasure_audit(event_type,outcome,occurred_at,transition_facts)
          SELECT e.event_type,
            CASE e.event_type WHEN 'identity_approved' THEN 'approved' WHEN 'identity_rejected' THEN 'rejected'
              WHEN 'credentials_verified' THEN 'verified' WHEN 'credentials_rejected' THEN 'rejected'
              WHEN 'credentials_pending' THEN 'pending' ELSE 'needs_correction' END,
            e.created_at,professional_erasure_transition_facts(e.metadata)
          FROM professional_identity_events e JOIN professional_identity_requests r ON r.id=e.request_id
          WHERE r.owner_user_id=OLD.id AND e.event_type IN
            ('identity_approved','identity_rejected','identity_correction_requested',
             'credentials_verified','credentials_rejected','credentials_pending');
        INSERT INTO professional_lifecycle_erasure_audit(event_type,outcome,occurred_at,transition_facts)
          SELECT e.event_type,CASE e.event_type WHEN 'demo_prepared' THEN 'prepared'
            WHEN 'demo_activated' THEN 'active' ELSE 'revoked' END,
            e.created_at,'{"operatingStatus":"demo_only","persona":"physician"}'::jsonb
          FROM demo_professional_events e JOIN demo_professional_grants g ON g.id=e.grant_id
          WHERE g.user_id=OLD.id AND e.event_type IN ('demo_prepared','demo_activated','demo_revoked');

        -- Erase subject-owned records, but never delete shared synthetic data.
        DELETE FROM demo_professional_events WHERE grant_id IN
          (SELECT id FROM demo_professional_grants WHERE user_id=OLD.id);
        DELETE FROM demo_professional_grants WHERE user_id=OLD.id;
        -- Invitations live in synthetic JSON, but their provider/client IDs
        -- can point at real accounts. Remove only the erased person's link.
        UPDATE demo_professional_patients SET data=data-'connectionInvitation',revision=revision+1
          WHERE data->'connectionInvitation'->>'providerUserId'=OLD.id
             OR data->'connectionInvitation'->>'clientUserId'=OLD.id;
        DELETE FROM professional_identity_events WHERE request_id IN
          (SELECT id FROM professional_identity_requests WHERE owner_user_id=OLD.id);
        DELETE FROM professional_identity_requests WHERE owner_user_id=OLD.id;

        -- Preserve other people's history, removing only this reviewer's identity
        -- and free-text/hash metadata. The new anonymous actor has no lookup map.
        UPDATE professional_identity_requests r SET decision_reason=NULL
          WHERE EXISTS (SELECT 1 FROM professional_identity_events e
            WHERE e.request_id=r.id AND e.actor_user_id=OLD.id AND e.request_revision=r.revision
              AND e.event_type IN ('identity_approved','identity_rejected','identity_correction_requested'));
        UPDATE professional_identity_events SET
          actor_user_id=current_setting('mpm.professional_erasure_anonymous_actor'),
          metadata=professional_erasure_transition_facts(metadata) WHERE actor_user_id=OLD.id;
        UPDATE demo_professional_events SET actor_user_id=NULL,
          metadata='{"operatingStatus":"demo_only","persona":"physician"}'::jsonb WHERE actor_user_id=OLD.id;
        UPDATE demo_professional_grants SET approver_id=NULL,reason='[erased]',
          training_waiver_reason=CASE WHEN training_basis='demo_only_waiver' THEN '[erased]' ELSE NULL END
          WHERE approver_id=OLD.id;

        PERFORM set_config('mpm.professional_erasure_subject',prior_subject,true);
        PERFORM set_config('mpm.professional_erasure_anonymous_actor',prior_actor,true);
        RETURN OLD;
      END $$;
      DROP TRIGGER IF EXISTS users_professional_lifecycle_erasure ON users;
      CREATE TRIGGER users_professional_lifecycle_erasure BEFORE DELETE ON users
        FOR EACH ROW EXECUTE FUNCTION erase_professional_lifecycle_on_account_delete();
    `));
  });
}
