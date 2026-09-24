/**
 * DEV shadow backfill: exact known legacy names only, all pending_review.
 * Run --dry-run first; --apply inserts in bounded, idempotent batches.
 * No food-generation path reads these rows.
 */
import { Pool } from "pg";
import { getDatabaseTlsConfig } from "../server/lib/databaseTls";

const candidates = `
  SELECT DISTINCT u.id AS subject_user_id, a.protocol_key,
    'legacy:' || x.origin AS evidence_ref
  FROM users u
  CROSS JOIN LATERAL (
    SELECT value, 'medical_conditions' AS origin FROM unnest(coalesce(u.medical_conditions, ARRAY[]::text[])) value
    UNION ALL
    SELECT value, 'specialty_conditions' FROM unnest(coalesce(u.specialty_conditions, ARRAY[]::text[])) value
    UNION ALL
    SELECT u.specialty_condition, 'specialty_conditions' WHERE u.specialty_condition IS NOT NULL
    UNION ALL
    SELECT value, 'health_conditions' FROM unnest(coalesce(u.health_conditions, ARRAY[]::text[])) value
  ) x
  JOIN (VALUES
    ('glp1','glp1'),('glp-1','glp1'),('glp 1','glp1'),
    ('semaglutide','glp1'),('tirzepatide','glp1'),
    ('diabetes','diabetes'),('diabetic','diabetes'),
    ('diabetes-type1','diabetes'),('diabetes-type2','diabetes'),
    ('renal','renal'),('kidney-disease','renal'),
    ('cardiac','cardiac'),('heart-failure','cardiac'),
    ('anti-inflammatory','anti_inflammatory'),('anti_inflammatory','anti_inflammatory'),
    ('inflammation-support','anti_inflammatory'),
    ('thyroid-support','thyroid'),('oncology-support','oncology'),
    ('hormone-optimization','hormone_optimization'),
    ('performance-nutrition','performance'),
    ('liver-disease','liver_disease'),('liver-support','liver_support'),
    ('hashimotos','hashimotos'),('hypothyroid','hypothyroid'),('hyperthyroid','hyperthyroid'),
    ('menopause','menopause'),('perimenopause','perimenopause'),
    ('metabolic-recovery','metabolic_recovery'),('pregnancy-support','pregnancy_support')
  ) a(alias, protocol_key) ON lower(btrim(x.value)) = a.alias
`;

async function main() {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Shadow backfill is DEV-only.");
  }
  const apply = process.argv.includes("--apply");
  if (apply && process.argv.includes("--dry-run")) throw new Error("Choose apply or dry-run.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Development database is unavailable.");
  const pool = new Pool({
    connectionString: url, ssl: getDatabaseTlsConfig(url), max: 1,
    connectionTimeoutMillis: 5000,
  });
  try {
    const estimated = await pool.query(`
      WITH candidates AS (${candidates})
      SELECT protocol_key, count(*)::int AS review_pending_candidates,
             count(DISTINCT subject_user_id)::int AS subjects
      FROM candidates GROUP BY protocol_key ORDER BY protocol_key
    `);
    console.log("Legacy candidates (aggregate; no person-level output):", estimated.rows);
    if (apply) {
      let total = 0;
      while (true) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("SET LOCAL lock_timeout = '3s'");
          await client.query("SET LOCAL statement_timeout = '30s'");
          const inserted = await client.query(`
            WITH candidates AS (${candidates}),
            pending AS (
              SELECT c.* FROM candidates c
              WHERE NOT EXISTS (
                SELECT 1 FROM health_protocol_sources s
                WHERE s.subject_user_id=c.subject_user_id
                  AND s.protocol_key=c.protocol_key
                  AND s.source_kind='legacy_migrated'
                  AND s.evidence_ref=c.evidence_ref
              )
              ORDER BY c.subject_user_id, c.protocol_key, c.evidence_ref LIMIT 300
            ),
            inserted AS (
              INSERT INTO health_protocol_sources
                (subject_user_id, protocol_key, source_kind, evidence_ref, status)
              SELECT subject_user_id, protocol_key, 'legacy_migrated',
                     evidence_ref, 'pending_review' FROM pending
              ON CONFLICT DO NOTHING RETURNING id
            )
            INSERT INTO health_protocol_events
              (source_id, old_status, new_status, reason_code)
            SELECT id, NULL, 'pending_review', 'legacy_unverified_backfill' FROM inserted
            RETURNING source_id
          `);
          await client.query("COMMIT");
          total += inserted.rowCount ?? 0;
          if (!inserted.rowCount) break;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }
      console.log("New review-pending shadow claims inserted:", total);
    }
    const { rows } = await pool.query(`
      SELECT protocol_key, status, count(*)::int AS count
      FROM health_protocol_sources WHERE source_kind='legacy_migrated'
      GROUP BY protocol_key, status ORDER BY protocol_key, status
    `);
    console.log("Stored legacy shadow status counts:", rows);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("DEV backfill failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});