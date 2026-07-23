/**
 * Phase 1 — Clinical Studio Foundation Migration
 *
 * Creates the provider_clinical_interventions table and adds
 * specialty + clinical_config columns to organizations.
 *
 * Run with: npx tsx scripts/migrate-phase1-clinical-studio.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

const migrations = [
  // ── Organizations: specialty + clinical config ──────────────────────────────
  `ALTER TABLE organizations
     ADD COLUMN IF NOT EXISTS specialty TEXT NOT NULL DEFAULT 'general'`,

  `ALTER TABLE organizations
     ADD COLUMN IF NOT EXISTS clinical_config JSONB NOT NULL DEFAULT '{}'::jsonb`,

  // ── Provider Clinical Interventions ─────────────────────────────────────────
  // One row per active provider selection for a given patient.
  // A "none" severity or resolved_at set = deactivated.
  // Multiple conditions can be active simultaneously for one patient.
  `CREATE TABLE IF NOT EXISTS provider_clinical_interventions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id        UUID        REFERENCES studios(id) ON DELETE CASCADE,
    client_user_id   TEXT        NOT NULL,
    provider_user_id TEXT        NOT NULL,
    condition_key    TEXT        NOT NULL,
    severity         TEXT        NOT NULL DEFAULT 'none',
    notes            TEXT,
    metadata         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    is_active        BOOLEAN     NOT NULL DEFAULT true,
    escalation_flag  BOOLEAN     NOT NULL DEFAULT false,
    activated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_pci_client_active
     ON provider_clinical_interventions (client_user_id, is_active)`,

  `CREATE INDEX IF NOT EXISTS idx_pci_studio_client
     ON provider_clinical_interventions (studio_id, client_user_id)`,

  // Unique active intervention per patient + condition (only one severity per condition active at once)
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_pci_unique_active_condition
     ON provider_clinical_interventions (client_user_id, condition_key)
     WHERE is_active = true`,
];

(async () => {
  console.log("[Phase 1 Migration] Applying Clinical Studio schema…\n");
  let ok = 0;
  let failed = 0;

  for (const stmt of migrations) {
    try {
      await db.execute(sql.raw(stmt));
      const label =
        stmt.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\S+)/)?.[1] ??
        stmt.match(/ADD COLUMN IF NOT EXISTS (\S+)/)?.[1] ??
        stmt.match(/CREATE TABLE IF NOT EXISTS (\S+)/)?.[1] ??
        stmt.slice(0, 60).replace(/\s+/g, " ");
      console.log(`  ✓ ${label}`);
      ok++;
    } catch (e: any) {
      console.error(`  ✗ ${stmt.slice(0, 80).replace(/\s+/g, " ")}`);
      console.error(`    ${e.message}`);
      failed++;
    }
  }

  console.log(`\n[Phase 1 Migration] Done — ${ok} applied, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
})();
