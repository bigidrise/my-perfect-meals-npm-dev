import { createHash } from "node:crypto";
import type { ProfessionalIdentityDecision, ProfessionalIdentityRequest } from "@shared/professionalOnboarding";
import { isCanonicalPractitionerRole } from "@shared/professionalRoles";
import { ProfessionalRequestError } from "./professionalOnboardingService";

export interface IdentityAccountSnapshot {
  id: string;
  professionalRole: string | null;
  authSecurityVersion: number;
  professionalCategory: string | null;
  credentialBody: string | null;
  credentialNumber: string | null;
  credentialType: string | null;
  credentialYear: string | null;
  isProCare: boolean;
  organizationId: string | null;
  isAdmin: boolean;
  mfaEnabled: boolean;
}
export interface IdentityReviewerProof { id: string; securityVersion: number; mfaVerified: true }
export function identitySnapshotHash(account: IdentityAccountSnapshot) {
  return createHash("sha256").update(JSON.stringify([
    account.id, account.professionalRole, account.authSecurityVersion, account.professionalCategory,
    account.credentialBody, account.credentialNumber, account.credentialType, account.credentialYear,
    account.isProCare, account.organizationId, account.isAdmin, account.mfaEnabled,
  ])).digest("hex");
}
export interface IdentityDecisionTransaction {
  request(id: string): Promise<ProfessionalIdentityRequest | null>;
  lockOwner(owner: string): Promise<void>;
  accounts(ids: string[]): Promise<IdentityAccountSnapshot[]>;
  transition(account: IdentityAccountSnapshot, role: string): Promise<number>;
  decide(row: ProfessionalIdentityRequest, state: "approved" | "rejected" | "needs_correction", reason: string): Promise<ProfessionalIdentityRequest>;
  event(row: ProfessionalIdentityRequest, reviewer: string, type: string, metadata: Record<string, unknown>): Promise<void>;
}
export interface IdentityDecisionRepository {
  transaction<T>(work: (tx: IdentityDecisionTransaction) => Promise<T>): Promise<T>;
}

export function createIdentityDecisionService(repository: IdentityDecisionRepository) {
  return {
    async decide(requestId: string, proof: IdentityReviewerProof, input: ProfessionalIdentityDecision) {
      return repository.transaction(async tx => {
        let request = await tx.request(requestId);
        if (!request) throw new ProfessionalRequestError(404, "REQUEST_NOT_FOUND", "Request not found.");
        if (request.ownerUserId === proof.id) throw new ProfessionalRequestError(403, "SELF_REVIEW_FORBIDDEN", "You cannot decide your own professional identity request.");
        await tx.lockOwner(request.ownerUserId);
        // Re-read after obtaining the same owner lock used by Stage 1.
        request = await tx.request(requestId);
        if (!request || request.state !== "submitted" || request.revision !== input.revision) {
          throw new ProfessionalRequestError(409, "REQUEST_STATE_CHANGED", "Reload the request before deciding.");
        }
        const accounts = await tx.accounts([proof.id, request.ownerUserId].sort());
        const reviewer = accounts.find(account => account.id === proof.id);
        const targetSource = accounts.find(account => account.id === request!.ownerUserId);
        if (!reviewer?.isAdmin) throw new ProfessionalRequestError(403, "REVIEWER_REQUIRED", "Administrative reviewer authority is required.");
        if (!reviewer.mfaEnabled || proof.mfaVerified !== true || reviewer.authSecurityVersion !== proof.securityVersion) {
          throw new ProfessionalRequestError(403, "REVIEWER_MFA_REQUIRED", "A current MFA-verified reviewer session is required.");
        }
        if (!targetSource) throw new ProfessionalRequestError(404, "TARGET_ACCOUNT_NOT_FOUND", "Target account not found.");
        // Freeze the reviewed pre-write evidence even for adapters returning
        // mutable records. The audit must never accidentally record new state
        // as the previous identity/security version.
        const target = { ...targetSource };
        if (identitySnapshotHash(target) !== input.reviewedStateHash) {
          throw new ProfessionalRequestError(409, "TARGET_IDENTITY_CHANGED", "The reviewed account identity/security state changed. Reload and review again.");
        }
        if (!input.reason?.trim() || input.identityOnlyAcknowledged !== true || input.sharedDataAcknowledged !== true) {
          throw new ProfessionalRequestError(400, "EXPLICIT_DECISION_REQUIRED", "Reason and explicit identity/shared-data acknowledgments are required.");
        }
        const approval = input.decision === "approve";
        if (approval && (!isCanonicalPractitionerRole(request.requestedRole) || input.approvedRole !== request.requestedRole)) {
          throw new ProfessionalRequestError(400, "APPROVED_ROLE_MISMATCH", "Only the canonical role actually requested may be approved.");
        }
        const roleChanged = approval && target.professionalRole !== input.approvedRole;
        const recovery = !!target.professionalRole && roleChanged;
        if (recovery && !input.recovery) throw new ProfessionalRequestError(400, "EXPLICIT_RECOVERY_REQUIRED", "Changing an existing identity requires an explicit recovery decision.");
        const nextVersion = roleChanged ? await tx.transition(target, input.approvedRole!) : target.authSecurityVersion;
        const state = approval ? "approved" : input.decision === "reject" ? "rejected" : "needs_correction";
        const decided = await tx.decide(request, state, input.reason.trim());
        await tx.event(decided, proof.id, approval ? "identity_approved" : input.decision === "reject" ? "identity_rejected" : "identity_correction_requested", {
          previousIdentity: target.professionalRole, requestedIdentity: request.requestedRole,
          approvedIdentity: approval ? input.approvedRole : null,
          reviewerAuthority: "authenticated_admin_with_current_mfa",
          reviewerSecurityVersion: reviewer.authSecurityVersion,
          reason: input.reason.trim(), reviewedStateHash: input.reviewedStateHash,
          reviewedRevision: request.revision, decisionRevision: decided.revision,
          recovery: approval && recovery, roleChanged,
          previousSecurityVersion: target.authSecurityVersion, nextSecurityVersion: nextVersion,
        });
        return { request: decided, currentAuthorizedRole: approval ? input.approvedRole : target.professionalRole, reauthenticationRequired: roleChanged };
      });
    },
  };
}
