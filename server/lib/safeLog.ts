/**
 * safeLog — No PHI in Logs Standard
 *
 * HIPAA Phase 1 compliance: all server logging in clinical, auth,
 * and PHI-adjacent routes must go through these helpers.
 *
 * ─── RULE ─────────────────────────────────────────────────────────────────────
 * Logs MAY contain:     userId, orgId, studioId, routePath, HTTP status,
 *                       success/failure boolean, record ID, count, auditId,
 *                       action/event name, timestamp.
 *
 * Logs MUST NOT contain: lab values (A1C, TSH, glucose, testosterone …),
 *                         diagnoses, medications, treatment protocols,
 *                         symptom lists, free-text clinical notes,
 *                         user names, email addresses, phone numbers,
 *                         any field from medical_conditions, health_conditions,
 *                         oncology_support_context, performanceContext,
 *                         or any other T1/T2 PHI column.
 *
 * When you want to record that a PHI field changed, use logAudit() in
 * server/lib/auditLog.ts — that writes to the DB with a safe metadata contract.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────────
 *   import { safeInfo, safeWarn, safeError } from "../lib/safeLog";
 *
 *   safeInfo("[biometrics]", "Weight ingested", { userId, count: rows.length });
 *   safeWarn("[clinicalLabs]", "Unauthorized attempt", { requesterId, targetUserId });
 *   safeError("[performanceNutrition]", "Setup error", err);
 */

type SafeMeta = Record<string, string | number | boolean | null | undefined>;

function format(tag: string, msg: string, meta?: SafeMeta): string {
  const base = `${tag} ${msg}`;
  if (!meta || Object.keys(meta).length === 0) return base;
  const parts = Object.entries(meta)
    .map(([k, v]) => `${k}=${v ?? "null"}`)
    .join(" ");
  return `${base} | ${parts}`;
}

export function safeInfo(tag: string, msg: string, meta?: SafeMeta): void {
  console.log(format(tag, msg, meta));
}

export function safeWarn(tag: string, msg: string, meta?: SafeMeta): void {
  console.warn(format(tag, msg, meta));
}

export function safeError(tag: string, msg: string, err?: unknown, meta?: SafeMeta): void {
  const errMsg = err instanceof Error ? err.message : String(err ?? "");
  console.error(format(tag, msg, meta), errMsg ? `| error=${errMsg}` : "");
}
