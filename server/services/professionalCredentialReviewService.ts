import { createHash } from "node:crypto";
import { isClinicalPractitionerRole } from "@shared/professionalRoles";
import { professionalCredentialDecision, type ProfessionalCredentialDecision, type CredentialReviewStatus } from "@shared/professionalCredentialReview";
import type { ProfessionalIdentityRequest } from "@shared/professionalOnboarding";
import type { IdentityAccountSnapshot, IdentityReviewerProof } from "./professionalIdentityDecisionService";
import { ProfessionalRequestError } from "./professionalOnboardingService";

export interface CredentialEvent {
  id: string; actorUserId: string; eventType: string; createdAt: string;
  metadata: Record<string, unknown>;
}
export interface CredentialContext {
  request: ProfessionalIdentityRequest;
  account: IdentityAccountSnapshot;
  approval: CredentialEvent | null;
  latest: CredentialEvent | null;
  required: boolean;
  demo: boolean;
}
export interface CredentialReviewTransaction {
  context(requestId: string): Promise<CredentialContext | null>;
  lockOwner(id: string): Promise<void>;
  accounts(ids: string[]): Promise<IdentityAccountSnapshot[]>;
  isDemo(id: string): Promise<boolean>;
  append(context: CredentialContext, reviewer: IdentityReviewerProof, input: ProfessionalCredentialDecision): Promise<void>;
}
export interface CredentialReviewRepository {
  transaction<T>(work: (tx: CredentialReviewTransaction) => Promise<T>): Promise<T>;
}

// Bind evidence to identity, security epoch and BOTH persisted account evidence
// and the approved application's claims. Activation/Organization membership
// are separate gates and do not invalidate a credential by themselves.
export function credentialSubjectHash(context: CredentialContext) {
  const { account: a, request: r, approval } = context;
  return createHash("sha256").update(JSON.stringify([
    a.id, a.professionalRole, a.authSecurityVersion, a.professionalCategory,
    a.credentialBody, a.credentialNumber, a.credentialType, a.credentialYear,
    r.id, r.requestedRole, r.professionalCategory, r.credentialBody,
    r.credentialNumber, r.credentialType, r.credentialYear, approval?.id,
  ])).digest("hex");
}
function eligible(context: CredentialContext) {
  return context.request.state === "approved" && !!context.approval &&
    isClinicalPractitionerRole(context.account.professionalRole) &&
    context.request.requestedRole === context.account.professionalRole &&
    context.request.professionalCategory === "certified" &&
    !!context.request.credentialBody?.trim() && !!context.request.credentialNumber?.trim();
}
export function credentialReviewStatus(context: CredentialContext, now = new Date()): CredentialReviewStatus {
  const credentialFields = ["professionalCategory", "credentialBody", "credentialNumber", "credentialType", "credentialYear"] as const;
  const { latest, approval } = context;
  const required = context.required || !!latest;
  const hash = credentialSubjectHash(context);
  const metadata = latest?.metadata;
  let status: CredentialReviewStatus["status"];
  if (context.demo) status = "demo_only";
  else if (!eligible(context)) status = "not_eligible";
  else if (!latest) status = required ? "pending" : "legacy";
  else if (metadata?.approvalEventId !== approval?.id || metadata?.reviewedCredentialHash !== hash ||
    metadata?.reviewerAuthority !== "authenticated_admin_with_current_mfa" ||
    metadata?.independentVerificationAcknowledged !== true || latest.actorUserId === context.account.id ||
    typeof metadata?.verificationBasis !== "string" || metadata.verificationBasis.trim().length < 10) status = "stale";
  else if (latest.eventType === "credentials_verified") {
    const checked = Date.parse(String(metadata.checkedAt));
    const until = Date.parse(String(metadata.validUntil));
    const decided = Date.parse(String(latest.createdAt));
    status = Number.isFinite(checked) && Number.isFinite(until) && Number.isFinite(decided) &&
      checked <= decided && checked <= now.getTime() && until > now.getTime() && until > checked ? "verified" : "stale";
  } else status = latest.eventType === "credentials_rejected" ? "rejected" : "pending";
  return {
    status, required, reviewedCredentialHash: hash, approvalEventId: approval?.id ?? null,
    revision: context.request.revision,
    evidence: {
      accountRole: context.account.professionalRole,
      accountCredentials: Object.fromEntries(credentialFields.map(key => [key, context.account[key] ?? null])),
      approvedClaims: Object.fromEntries(credentialFields.map(key => [key, context.request[key] ?? null])),
    },
    latestDecision: latest ? {
      decision: latest.eventType.replace("credentials_", ""), reviewerId: latest.actorUserId,
      decidedAt: latest.createdAt, verificationBasis: typeof metadata?.verificationBasis === "string" ? metadata.verificationBasis : null,
      checkedAt: typeof metadata?.checkedAt === "string" ? metadata.checkedAt : null,
      validUntil: typeof metadata?.validUntil === "string" ? metadata.validUntil : null,
    } : null,
  };
}
export function createCredentialReviewService(repository: CredentialReviewRepository, clock = () => new Date()) {
  return {
    async decide(requestId: string, proof: IdentityReviewerProof, raw: ProfessionalCredentialDecision) {
      const parsed = professionalCredentialDecision.safeParse(raw);
      if (!parsed.success) throw new ProfessionalRequestError(400, "INVALID_CREDENTIAL_DECISION", "An explicit credential decision and verification basis are required.");
      const input = parsed.data;
      return repository.transaction(async tx => {
        let context = await tx.context(requestId);
        if (!context) throw new ProfessionalRequestError(404, "REQUEST_NOT_FOUND", "Request or account not found.");
        if (context.account.id === proof.id) throw new ProfessionalRequestError(403, "SELF_REVIEW_FORBIDDEN", "You cannot verify your own credentials.");
        await tx.lockOwner(context.account.id);
        const accounts = await tx.accounts([context.account.id, proof.id].sort());
        const reviewer = accounts.find(a => a.id === proof.id);
        if (!reviewer?.isAdmin) throw new ProfessionalRequestError(403, "REVIEWER_REQUIRED", "Administrative reviewer authority is required.");
        if (!reviewer.mfaEnabled || proof.mfaVerified !== true || reviewer.authSecurityVersion !== proof.securityVersion) {
          throw new ProfessionalRequestError(403, "REVIEWER_MFA_REQUIRED", "A current MFA-verified reviewer session is required.");
        }
        context = await tx.context(requestId);
        if (!context) throw new ProfessionalRequestError(404, "TARGET_ACCOUNT_NOT_FOUND", "Target account not found.");
        if (context.demo || await tx.isDemo(proof.id)) throw new ProfessionalRequestError(403, "DEMO_CREDENTIAL_REVIEW_FORBIDDEN", "Demo-only identities cannot issue or receive real credential clearance.");
        if (!eligible(context)) throw new ProfessionalRequestError(409, "APPROVED_LICENSED_IDENTITY_REQUIRED", "A current approved licensed identity with credential claims is required.");
        if (context.request.revision !== input.revision || context.approval?.id !== input.approvalEventId ||
          credentialSubjectHash(context) !== input.reviewedCredentialHash) {
          throw new ProfessionalRequestError(409, "CREDENTIAL_REVIEW_STATE_CHANGED", "Account, identity or review changed. Reload before deciding; a duplicate decision is not applied.");
        }
        const now = clock().getTime();
        if ((input.checkedAt && Date.parse(input.checkedAt) > now) ||
          (input.validUntil && (Date.parse(input.validUntil) <= now || (input.checkedAt && Date.parse(input.validUntil) <= Date.parse(input.checkedAt))))) {
          throw new ProfessionalRequestError(400, "INVALID_VERIFICATION_TIME", "Use the actual past check time and a future evidence validity end.");
        }
        await tx.append(context, proof, input);
        return { decisionSaved: true as const };
      });
    },
  };
}
