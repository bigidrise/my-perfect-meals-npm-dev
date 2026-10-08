import { sql, type SQL } from "drizzle-orm";
import { DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO as scope } from "../../config/developmentFounderPhysicianDemo";

type Database = { transaction<T>(work: (tx: { execute(query: SQL): Promise<unknown> }) => Promise<T>): Promise<T> };

/** Explicit release step only. Never called by ordinary application startup. */
export async function runFounderDemoGrantMigration(database: Database) {
  await database.transaction(async tx => {
    await tx.execute(sql.raw("SET LOCAL lock_timeout = '3000ms'"));
    await tx.execute(sql.raw("SET LOCAL statement_timeout = '15000ms'"));
    // The original 30-day CHECK remains unchanged for every dated grant.
    // NULL is possible only for the one founder-controlled identity, and runtime
    // authority additionally requires its immutable, current-MFA approval event.
    await tx.execute(sql.raw(`
      ALTER TABLE demo_professional_grants ALTER COLUMN expires_at DROP NOT NULL;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint
          WHERE conrelid='demo_professional_grants'::regclass
            AND conname='demo_professional_founder_lifetime') THEN
          ALTER TABLE demo_professional_grants ADD CONSTRAINT demo_professional_founder_lifetime
          CHECK (expires_at IS NOT NULL OR (
            user_id='${scope.userId}' AND approver_id IS NOT NULL
            AND approver_id<>user_id AND training_basis='demo_only_waiver'
            AND training_waiver_reason IS NOT NULL AND length(trim(training_waiver_reason))>=5
          ));
        END IF;
      END $$;
      CREATE OR REPLACE FUNCTION preserve_demo_grant_scope() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF OLD.user_id <> NEW.user_id OR OLD.workspace_id <> NEW.workspace_id OR
             OLD.persona <> NEW.persona OR OLD.operating_status <> NEW.operating_status OR
             OLD.expires_at IS DISTINCT FROM NEW.expires_at OR
             OLD.approver_id IS DISTINCT FROM NEW.approver_id OR
             OLD.training_basis IS DISTINCT FROM NEW.training_basis OR
             OLD.training_waiver_reason IS DISTINCT FROM NEW.training_waiver_reason THEN
            RAISE EXCEPTION 'Demo grant authority scope cannot change';
          END IF;
          RETURN NEW;
        END $$;
    `));
  });
}
