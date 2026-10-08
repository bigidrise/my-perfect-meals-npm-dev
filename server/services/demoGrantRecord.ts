import type { DemoGrant } from "@shared/demoProfessional";
import { isFounderPhysicianDemoScope } from "../config/developmentFounderPhysicianDemo";

/** Permanent authority is reconstructed from the immutable MFA-admin preparation event. */
export function normalizeDemoGrantRecord(row: (DemoGrant & { authorization?: Record<string, unknown> | null }) | undefined): DemoGrant | null {
  if (!row) return null;
  const { authorization, authority: _authority, lifetime: _lifetime, clinicId: _clinicId, ...record } = row;
  const grant: DemoGrant = {
    ...record,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    acknowledgedAt: row.acknowledgedAt ? new Date(row.acknowledgedAt).toISOString() : null,
  };
  if (authorization?.authority === "founder_admin" && authorization.lifetime === "permanent_founder"
    && authorization.founderAuthorizationAcknowledged === true
    && authorization.reviewerAuthority === "authenticated_admin_with_current_mfa"
    && Number.isInteger(authorization.reviewerSecurityVersion) && Number(authorization.reviewerSecurityVersion) >= 0
    && authorization.grantRevision === 1
    && typeof authorization.clinicId === "string"
    && isFounderPhysicianDemoScope(grant.userId, authorization.clinicId)
    && grant.expiresAt === null && !!grant.approverId
    && grant.trainingBasis === "demo_only_waiver" && !!grant.trainingWaiverReason) {
    return { ...grant, authority: "founder_admin", lifetime: "permanent_founder", clinicId: authorization.clinicId };
  }
  return grant;
}
