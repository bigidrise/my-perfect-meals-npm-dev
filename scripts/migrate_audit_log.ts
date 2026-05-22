/**
 * Migration: Create audit_log table
 * Run: tsx scripts/migrate_audit_log.ts
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("Creating audit_log table...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id          UUID,
      actor_user_id   VARCHAR(64),
      target_user_id  VARCHAR(64),
      action          VARCHAR(64) NOT NULL,
      resource_type   VARCHAR(64),
      resource_id     TEXT,
      table_name      VARCHAR(64),
      field_name      VARCHAR(256),
      route           TEXT,
      ip_address      VARCHAR(64),
      metadata        JSONB,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✅ audit_log table created (or already exists)");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS audit_log_actor_idx
      ON audit_log (actor_user_id, created_at DESC)
  `);
  console.log("✅ index: actor_user_id + created_at");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS audit_log_target_idx
      ON audit_log (target_user_id, created_at DESC)
  `);
  console.log("✅ index: target_user_id + created_at");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS audit_log_org_idx
      ON audit_log (org_id, created_at DESC)
  `);
  console.log("✅ index: org_id + created_at");

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS audit_log_action_idx
      ON audit_log (action, created_at DESC)
  `);
  console.log("✅ index: action + created_at");

  console.log("\n✅ Migration complete.");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
