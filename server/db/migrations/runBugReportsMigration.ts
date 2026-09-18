/**
 * runBugReportsMigration.ts — idempotent boot migration
 *
 * Creates the bug_reports table and supporting enum.
 * Safe to run multiple times; uses IF NOT EXISTS / DO NOTHING guards.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";

export async function runBugReportsMigration(): Promise<void> {
  try {
    // Create the enum first (idempotent via DO $$)
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE bug_report_status AS ENUM ('new', 'reviewing', 'resolved');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bug_reports (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id             TEXT,
        user_email          TEXT,
        user_name           TEXT,
        description         TEXT NOT NULL,
        intent              TEXT,
        route               TEXT,
        build_version       TEXT,
        environment         TEXT,
        user_agent          TEXT,
        include_diagnostics BOOLEAN NOT NULL DEFAULT TRUE,
        diagnostics         JSONB,
        status              bug_report_status NOT NULL DEFAULT 'new',
        created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);

    // Index for support dashboard queries by status + date
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bug_reports_status_created_idx
        ON bug_reports (status, created_at DESC)
    `);

    // Index for looking up by user
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bug_reports_user_id_idx
        ON bug_reports (user_id)
      WHERE user_id IS NOT NULL
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bug_report_acknowledgements (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bug_report_id    UUID NOT NULL,
        recipient_email  TEXT NOT NULL,
        first_name       TEXT,
        short_report_id  TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
        attempts         INTEGER NOT NULL DEFAULT 0,
        available_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        lease_expires_at TIMESTAMPTZ,
        claim_token      UUID,
        last_error       TEXT,
        sent_at          TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      ALTER TABLE bug_report_acknowledgements
        ADD COLUMN IF NOT EXISTS claim_token UUID
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS bug_report_acknowledgements_report_uniq
        ON bug_report_acknowledgements (bug_report_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bug_report_acknowledgements_due_idx
        ON bug_report_acknowledgements (status, available_at)
        WHERE status IN ('pending', 'processing', 'failed')
    `);

    console.log("✅ Bug Reports boot migration complete (reports + acknowledgement outbox)");
  } catch (err: any) {
    console.error("❌ Bug Reports migration error:", err.message);
    throw err;
  }
}
