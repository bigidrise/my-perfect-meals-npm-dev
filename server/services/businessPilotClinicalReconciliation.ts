import { sql } from "drizzle-orm";
import { BusinessPilotActivationError, finitePilotTimestamp } from "./businessPilotActivationPolicy";

export const BUSINESS_PILOT_RECONCILIATION_SOURCE = "explicit_business_pilot_reconciliation_v1";
const rows = (result: any): any[] => result.rows ?? result;

/** Independent release switch. Never set by startup, migration, or a grant. */
export function businessPilotClinicalReconciliationEnabled(): boolean {
  return process.env.BUSINESS_PILOT_RECONCILIATION_ENABLED === "true";
}

interface ReconciliationRow {
  id: string; user_id: string; organization_id: string; source_business_id: string;
  authorization_source: string; approval_reference: string; correction_reason: string;
  original_pilot_started_at: Date | string; original_pilot_ends_at: Date | string;
  expires_at: Date | string; granted_at: Date | string; revoked_at: Date | string | null;
}

interface ReconciliationSourceRow extends ReconciliationRow {
  matched_user_id: string; matched_business_id: string; matched_organization_id: string;
  matched_start: Date | string; matched_end: Date | string;
  matched_status: string; matched_mode: string; matched_org_status: string;
  matched_member_role: string; matched_member_status: string;
}

export function reconciliationSourceMatches(row: ReconciliationSourceRow, userId: string): boolean {
  try {
    return row.user_id === userId && row.matched_user_id === userId
      && row.source_business_id === row.matched_business_id
      && row.organization_id === row.matched_organization_id
      && row.matched_status === "active" && row.matched_mode === "onboarding_pilot"
      && row.matched_org_status === "active"
      && row.matched_member_role === "owner" && row.matched_member_status === "active"
      && finitePilotTimestamp(row.original_pilot_started_at).getTime() === finitePilotTimestamp(row.matched_start).getTime()
      && finitePilotTimestamp(row.original_pilot_ends_at).getTime() === finitePilotTimestamp(row.matched_end).getTime();
  } catch { return false; }
}

/** Defense in depth: a record alone cannot invent a new period or past approval. */
export function reconciliationWindowIsActive(row: ReconciliationRow, userId: string, now = new Date()): boolean {
  try {
    const start = finitePilotTimestamp(row.original_pilot_started_at).getTime();
    const end = finitePilotTimestamp(row.original_pilot_ends_at).getTime();
    const expires = finitePilotTimestamp(row.expires_at).getTime();
    const granted = finitePilotTimestamp(row.granted_at).getTime();
    const at = finitePilotTimestamp(now).getTime();
    return row.user_id === userId && row.authorization_source === BUSINESS_PILOT_RECONCILIATION_SOURCE
      && /^[a-f0-9]{64}$/.test(row.approval_reference)
      && typeof row.correction_reason === "string" && row.correction_reason.trim().length >= 10
      && Boolean(row.organization_id && row.source_business_id) && row.revoked_at == null
      && start < end && expires === end && start <= granted && granted <= at && at < end;
  } catch { return false; }
}

/**
 * Executor injection is mandatory: offline checks never import application DB
 * initialization. Production callers supply their existing authoritative DB.
 * Storage absence while enabled is an explicit failure, never synthetic access.
 */
export async function getActiveBusinessPilotClinicalReconciliation(userId: string, executor: any, now = new Date()) {
  if (!businessPilotClinicalReconciliationEnabled()) return null;
  const result = await executor.execute(sql`SELECT r.*, b.owner_user_id AS matched_user_id,
      b.id AS matched_business_id, b.organization_id AS matched_organization_id,
      b.commercial_access_started_at AS matched_start, b.commercial_access_ends_at AS matched_end,
      b.status AS matched_status, b.commercial_access_mode AS matched_mode,
      o.active_status AS matched_org_status, m.role AS matched_member_role, m.status AS matched_member_status
    FROM business_pilot_clinical_reconciliations r
    JOIN businesses b ON b.id = r.source_business_id AND b.owner_user_id = r.user_id
      AND b.organization_id = r.organization_id
    JOIN organizations o ON o.id = r.organization_id AND o.active_status = 'active'
    JOIN business_members m ON m.business_id = b.id AND m.user_id = r.user_id
      AND m.role = 'owner' AND m.status = 'active'
    WHERE r.user_id = ${userId} AND r.authorization_source = ${BUSINESS_PILOT_RECONCILIATION_SOURCE}
      AND r.revoked_at IS NULL AND r.expires_at > ${now} AND r.granted_at <= ${now}
      AND r.original_pilot_started_at <= ${now}
      AND r.expires_at = r.original_pilot_ends_at
      AND b.status = 'active' AND b.commercial_access_mode = 'onboarding_pilot'
      AND b.commercial_access_started_at = r.original_pilot_started_at
      AND b.commercial_access_ends_at = r.original_pilot_ends_at
    ORDER BY r.granted_at DESC LIMIT 1`);
  const [row] = rows(result) as ReconciliationSourceRow[];
  if (!row || !reconciliationSourceMatches(row, userId) || !reconciliationWindowIsActive(row, userId, now)) return null;
  return { reconciliationId: row.id, endsAt: finitePilotTimestamp(row.expires_at) };
}

interface ReconciliationApproval {
  userId: string; expectedEmail: string; businessId: string; organizationId: string;
  originalStartedAt: Date | string; expectedExpiresAt: Date | string;
  approvedByUserId: string; approvalReference: string; reason: string;
}

function requireApprovalReference(reference: string) {
  if (!/^[a-f0-9]{64}$/.test(reference)) throw new BusinessPilotActivationError(
    "A SHA-256 approval reference is required.", "RECONCILIATION_APPROVAL_REQUIRED", 400,
  );
}
function requireOperational() {
  if (!businessPilotClinicalReconciliationEnabled()) throw new BusinessPilotActivationError(
    "Reconciliation requires separately approved storage, runtime release and enablement.",
    "RECONCILIATION_NOT_OPERATIONAL", 503,
  );
}
async function verifyOperator(tx: any, userId: string) {
  const [operator] = rows(await tx.execute(sql`SELECT id FROM users
    WHERE id = ${userId} AND (is_founder = true OR is_admin = true) FOR SHARE`));
  if (!operator) throw new BusinessPilotActivationError("Verified operator approval is required.", "RECONCILIATION_OPERATOR_REQUIRED", 403);
}
function receipt(row: ReconciliationRow, alreadyExisted: boolean, now: Date) {
  return {
    reconciliationId: row.id, authorizationSource: row.authorization_source,
    approvalReference: row.approval_reference, alreadyExisted,
    originalStartedAt: finitePilotTimestamp(row.original_pilot_started_at),
    expiresAt: finitePilotTimestamp(row.expires_at), correctedAt: finitePilotTimestamp(row.granted_at),
    active: reconciliationWindowIsActive(row, row.user_id, now), revoked: row.revoked_at != null,
  };
}

/** Internal controlled operation, not an HTTP endpoint or automatic repair. */
export async function createBusinessPilotClinicalReconciliation(input: ReconciliationApproval, executor: any) {
  requireOperational();
  requireApprovalReference(input.approvalReference);
  const start = finitePilotTimestamp(input.originalStartedAt);
  const end = finitePilotTimestamp(input.expectedExpiresAt);
  const now = new Date();
  if (start > now || end <= now || start >= end || input.reason.trim().length < 10 || input.reason.trim().length > 2000) {
    throw new BusinessPilotActivationError("The approved original period or correction reason is invalid.", "RECONCILIATION_INVALID", 400);
  }
  return executor.transaction(async (tx: any) => {
    await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
    await tx.execute(sql`SET LOCAL statement_timeout = '10s'`);
    await verifyOperator(tx, input.approvedByUserId);
    // Lock authoritative source rows before validating; neither is updated.
    const [source] = rows(await tx.execute(sql`SELECT b.id FROM businesses b
      JOIN users u ON u.id = b.owner_user_id
      JOIN organizations o ON o.id = b.organization_id AND o.active_status = 'active'
      JOIN business_members m ON m.business_id = b.id AND m.user_id = u.id
      WHERE u.id = ${input.userId} AND lower(u.email) = ${input.expectedEmail.trim().toLowerCase()}
        AND b.id = ${input.businessId} AND b.organization_id = ${input.organizationId}
        AND m.role = 'owner' AND m.status = 'active' AND b.status = 'active'
        AND b.commercial_access_mode = 'onboarding_pilot'
        AND b.commercial_access_started_at = ${start} AND b.commercial_access_ends_at = ${end}
      FOR UPDATE OF b, u, m, o`));
    if (!source) throw new BusinessPilotActivationError("Account, organization or original dates no longer match approval.", "RECONCILIATION_SOURCE_MISMATCH", 409);
    const correctedAt = new Date();
    if (end <= correctedAt) throw new BusinessPilotActivationError(
      "The original pilot expired while approval was being verified.", "RECONCILIATION_EXPIRED", 410,
    );
    const inserted = rows(await tx.execute(sql`INSERT INTO business_pilot_clinical_reconciliations
      (user_id, organization_id, source_business_id, authorization_source, approval_reference,
        approved_by_user_id, correction_reason, original_pilot_started_at, original_pilot_ends_at, expires_at, granted_at)
      VALUES (${input.userId}, ${input.organizationId}, ${input.businessId}, ${BUSINESS_PILOT_RECONCILIATION_SOURCE},
        ${input.approvalReference}, ${input.approvedByUserId}, ${input.reason.trim()}, ${start}, ${end}, ${end}, ${correctedAt})
      ON CONFLICT (user_id, organization_id, source_business_id, original_pilot_started_at, original_pilot_ends_at)
      DO NOTHING RETURNING *`));
    const [row] = inserted.length ? inserted : rows(await tx.execute(sql`SELECT * FROM business_pilot_clinical_reconciliations
      WHERE user_id = ${input.userId} AND organization_id = ${input.organizationId}
        AND source_business_id = ${input.businessId} AND original_pilot_started_at = ${start}
        AND original_pilot_ends_at = ${end} FOR UPDATE`));
    if (!row || row.user_id !== input.userId || row.organization_id !== input.organizationId
      || row.source_business_id !== input.businessId
      || row.authorization_source !== BUSINESS_PILOT_RECONCILIATION_SOURCE
      || finitePilotTimestamp(row.original_pilot_started_at).getTime() !== start.getTime()
      || finitePilotTimestamp(row.original_pilot_ends_at).getTime() !== end.getTime()
      || finitePilotTimestamp(row.expires_at).getTime() !== end.getTime()) {
      throw new BusinessPilotActivationError("The persisted reconciliation could not be verified.", "RECONCILIATION_STATE_INVALID", 503);
    }
    // A repeated approval never revives a revoked grant or changes its clock.
    return receipt(row, inserted.length === 0, new Date());
  });
}

export async function revokeBusinessPilotClinicalReconciliation(
  input: { reconciliationId: string; approvedByUserId: string; approvalReference: string }, executor: any,
) {
  requireOperational(); requireApprovalReference(input.approvalReference);
  return executor.transaction(async (tx: any) => {
    await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
    await tx.execute(sql`SET LOCAL statement_timeout = '10s'`);
    await verifyOperator(tx, input.approvedByUserId);
    const now = new Date();
    const updated = rows(await tx.execute(sql`UPDATE business_pilot_clinical_reconciliations SET revoked_at = ${now},
      revoked_by_user_id = ${input.approvedByUserId}, revocation_reference = ${input.approvalReference}
      WHERE id = ${input.reconciliationId} AND revoked_at IS NULL RETURNING *`));
    const [row] = updated.length ? updated : rows(await tx.execute(sql`SELECT * FROM business_pilot_clinical_reconciliations
      WHERE id = ${input.reconciliationId} FOR UPDATE`));
    if (!row) throw new BusinessPilotActivationError("Reconciliation not found.", "RECONCILIATION_NOT_FOUND", 404);
    return receipt(row, updated.length === 0, now);
  });
}
