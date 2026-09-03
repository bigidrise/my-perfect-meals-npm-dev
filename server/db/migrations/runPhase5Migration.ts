/**
 * Coaching Engine Phase 5 — Boot Migration
 *
 * Targeted ALTERs to existing Phase 1 tables.
 * Does NOT replace any Phase 1 tables — only extends them.
 *
 * Safe to run on every boot (IF NOT EXISTS / IF EXISTS guards throughout).
 * Must be registered in BOTH server/index.ts (dev) and server/prod.ts (prod).
 */

import { sql } from "drizzle-orm";

type DbExecutor = {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

export async function runPhase5Migration(db: DbExecutor): Promise<void> {
  try {
    // ── coach_action_items: add completion provenance ──────────────────────
    // completion_source: 'objective' | 'subjective' | null (null = unknown)
    // completion_confidence: 'high' | 'medium' | 'low' | null
    await db.execute(sql`
      ALTER TABLE coach_action_items
        ADD COLUMN IF NOT EXISTS completion_source TEXT,
        ADD COLUMN IF NOT EXISTS completion_confidence TEXT
    `);

    // ── coach_followups: add observer tracking + investigation link ────────
    // observer_selection: which observer IDs were run at plan creation time
    // investigation_id: link back to the original investigation evidence
    await db.execute(sql`
      ALTER TABLE coach_followups
        ADD COLUMN IF NOT EXISTS observer_selection JSONB,
        ADD COLUMN IF NOT EXISTS investigation_id UUID
    `);

    // ── coach_followups: idempotency unique index ──────────────────────────
    // Prevents duplicate pending followups for the same plan.
    // One plan can have at most one pending followup at a time.
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS coach_followups_plan_pending_uniq
        ON coach_followups (plan_id)
        WHERE status = 'pending'
    `);

    // ── coach_followups: add delivered status path ─────────────────────────
    // 'ready' → worker has processed it and persisted the message
    // Already supports: pending | sent | dismissed | snoozed | completed
    // We add 'delivered' and 'ready' to the status vocabulary via app-layer,
    // no constraint change needed (status is TEXT NOT NULL with no CHECK).

    console.log("✅ Phase 5 boot migration complete");
  } catch (err: any) {
    console.error("❌ Phase 5 boot migration failed:", err.message);
    // Non-fatal — log and continue.
  }
}
