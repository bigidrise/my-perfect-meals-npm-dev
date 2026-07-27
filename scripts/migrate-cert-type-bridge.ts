/**
 * Migration: cert-type bridge — platform → platform_mastery
 *
 * Background:
 *   The Academy renamed its certification type from "platform" to "platform_mastery".
 *   This migration creates equivalent "platform_mastery" records for users who
 *   completed the Academy under the old "platform" cert type, so that downstream
 *   eligibility checks (affiliate gating, ProCare gating) continue to work for
 *   existing users regardless of which cert type they hold.
 *
 * Scope guard (prevents ProCare false-positives):
 *   Only migrates records where:
 *     - is_certification_track = true  (actual Academy cert completions, not ProCare platform)
 *     - completed_at < '2026-07-15'    (before the rename was introduced)
 *     - status = 'completed'           (only fully completed records)
 *
 * Idempotency:
 *   Skips users who already have a "platform_mastery" record (NOT EXISTS guard).
 *
 * Rollback (down):
 *   DELETE FROM user_certifications WHERE certification_type = 'platform_mastery'
 *   AND created_by_migration = 'cert-type-bridge-v1'
 *
 *   Note: down() only removes records created BY this migration, identified by
 *   the migration marker in the certificate_number column prefix. Records created
 *   by a user completing the Academy after the rename are NOT touched.
 *
 * Preflight:
 *   Run preflight() before up() to see how many records will be affected.
 *
 * Usage:
 *   npx tsx scripts/migrate-cert-type-bridge.ts [up|down|preflight]
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

const MIGRATION_MARKER = "cert-type-bridge-v1";
const CUTOFF_DATE = "2026-07-15T00:00:00Z";

async function preflight() {
  const result = await db.execute(sql`
    SELECT COUNT(*) AS affected_count
    FROM user_certifications uc
    WHERE uc.certification_type = 'platform'
      AND uc.status = 'completed'
      AND uc.is_certification_track = true
      AND uc.completed_at < ${CUTOFF_DATE}
      AND NOT EXISTS (
        SELECT 1 FROM user_certifications pm
        WHERE pm.user_id = uc.user_id
          AND pm.certification_type = 'platform_mastery'
      )
  `);
  const count = (result.rows[0] as any)?.affected_count ?? 0;
  console.log(`[Preflight] Records that would be migrated: ${count}`);
  return Number(count);
}

async function up() {
  const preCount = await preflight();
  if (preCount === 0) {
    console.log("[Up] No records to migrate — already up to date.");
    return;
  }

  const result = await db.execute(sql`
    INSERT INTO user_certifications (
      user_id, certification_type, status, completed_at,
      certificate_number, certificate_name, is_certification_track,
      created_at, updated_at
    )
    SELECT
      uc.user_id,
      'platform_mastery',
      uc.status,
      uc.completed_at,
      CONCAT(${MIGRATION_MARKER}, ':', COALESCE(uc.certificate_number, '')),
      uc.certificate_name,
      uc.is_certification_track,
      NOW(),
      NOW()
    FROM user_certifications uc
    WHERE uc.certification_type = 'platform'
      AND uc.status = 'completed'
      AND uc.is_certification_track = true
      AND uc.completed_at < ${CUTOFF_DATE}
      AND NOT EXISTS (
        SELECT 1 FROM user_certifications pm
        WHERE pm.user_id = uc.user_id
          AND pm.certification_type = 'platform_mastery'
      )
  `);

  const migrated = (result as any).rowCount ?? (result as any).count ?? "?";
  console.log(`[Up] Migrated ${migrated} record(s): platform → platform_mastery`);
}

async function down() {
  const result = await db.execute(sql`
    DELETE FROM user_certifications
    WHERE certification_type = 'platform_mastery'
      AND certificate_number LIKE ${MIGRATION_MARKER + ":%"}
  `);
  const deleted = (result as any).rowCount ?? (result as any).count ?? "?";
  console.log(`[Down] Removed ${deleted} bridged record(s) created by this migration`);
  console.log("[Down] Original 'platform' records are untouched");
}

const cmd = process.argv[2] ?? "preflight";
const runners: Record<string, () => Promise<void>> = { up, down, preflight };

if (!runners[cmd]) {
  console.error(`Unknown command: ${cmd}. Use: up | down | preflight`);
  process.exit(1);
}

runners[cmd]()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
