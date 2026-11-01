import { sql } from "drizzle-orm";
import { db } from "../db";

/** Independent from invitation activation; disabled readers perform no SQL. */
export function personalClinicalReconciliationEnabled(): boolean {
  return process.env.BUSINESS_PILOT_RECONCILIATION_ENABLED === "true"
    && process.env.BUSINESS_PILOT_RECONCILIATION_SCHEMA_APPROVED === "true";
}

export async function getActivePersonalClinicalReconciliation(
  userId: string,
  now = new Date(),
): Promise<{ id: string; endsAt: Date } | null> {
  if (!personalClinicalReconciliationEnabled()) return null;
  const result = await db.execute(sql`
    SELECT g.id, g.starts_at, g.ends_at
    FROM personal_clinical_reconciliation_grants g
    JOIN businesses b ON b.id = g.business_id
    WHERE g.user_id = ${userId} AND g.status = 'active'
      AND g.revoked_at IS NULL
      AND g.starts_at <= ${now} AND g.ends_at > ${now}
      AND b.owner_user_id = g.user_id AND b.status = 'active'
      AND b.commercial_access_mode = 'onboarding_pilot'
      AND b.commercial_access_started_at = g.starts_at
      AND b.commercial_access_ends_at = g.ends_at
    ORDER BY g.ends_at DESC LIMIT 1
  `);
  const rows = (result as any).rows ?? result;
  const row = rows[0];
  if (!row) return null;
  const start = new Date(row.starts_at).getTime();
  const end = new Date(row.ends_at).getTime();
  if (row.starts_at == null || row.ends_at == null
    || !Number.isFinite(start) || !Number.isFinite(end)
    || end - start !== 720 * 60 * 60 * 1000
    || start > now.getTime() || end <= now.getTime()) return null;
  return { id: row.id, endsAt: new Date(end) };
}
