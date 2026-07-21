/**
 * Idempotent migration: creates partner_activity_log table.
 * Safe to re-run at any time.
 */
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function run() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS partner_activity_log (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL,
      actor_id    TEXT NOT NULL,
      action      TEXT NOT NULL,
      details     JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_partner_activity_log_user_id
    ON partner_activity_log (user_id)
  `);

  console.log("[migrate-partner-activity-log] partner_activity_log table ready");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
