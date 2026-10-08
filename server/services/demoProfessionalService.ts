import { randomUUID } from "node:crypto";
import { DEMO_ACKNOWLEDGMENT_VERSION, isDemoGrantCurrent, isPermanentFounderDemoGrant, type DemoCapability, type DemoContext, type DemoGrant, type DemoGrantActivation, type DemoGrantPreparation, type DemoPatient, type DemoPlan, type DemoWorkspace } from "@shared/demoProfessional";
import { identitySnapshotHash, type IdentityAccountSnapshot, type IdentityReviewerProof } from "./professionalIdentityDecisionService";
import { ProfessionalRequestError } from "./professionalOnboardingService";
import { assertInvitationDataset, assertInvitationWindow, resolveCareInvitationParties, CareInvitationError } from "./careInvitationPolicy";
import type { DemoCareInvitation } from "@shared/demoProfessional";
import { DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO, isDevelopmentFounderDemoAccount, isFounderPhysicianDemoScope } from "../config/developmentFounderPhysicianDemo";

export interface DemoTransaction {
  accounts(ids: string[]): Promise<IdentityAccountSnapshot[]>;
  grant(userId: string): Promise<DemoGrant | null>;
  workspace(id: string): Promise<DemoWorkspace | null>;
  patients(workspaceId: string): Promise<DemoPatient[]>;
  patient(workspaceId: string, id: string): Promise<DemoPatient | null>;
  academyComplete(userId: string): Promise<boolean>;
  approvedIdentityRequest(userId: string, requestId: string): Promise<boolean>;
  createDataset(workspace: DemoWorkspace, patient: DemoPatient): Promise<void>;
  saveGrant(grant: DemoGrant): Promise<void>;
  savePlan(patient: DemoPatient, plan: DemoPlan): Promise<DemoPatient>;
  saveInvitation(patient: DemoPatient, invitation: DemoCareInvitation): Promise<DemoPatient>;
  invalidateSessions(account: IdentityAccountSnapshot): Promise<void>;
  event(grant: DemoGrant, actorId: string, kind: string, metadata: Record<string, unknown>): Promise<void>;
  clinic?(): Promise<NonNullable<DemoContext["clinic"]>>;
  ownedClinic?(userId: string, clinicId: string): Promise<NonNullable<DemoContext["clinic"]> | null>;
}
export interface DemoRepository { transaction<T>(work: (tx: DemoTransaction) => Promise<T>): Promise<T> }
function deny(code: string, message = "Demo-only access is limited to the explicitly authorized synthetic dataset."): never {
  throw new ProfessionalRequestError(403, code, message);
}
function live(grant: DemoGrant, now: Date) {
  if (grant.operatingStatus !== "demo_only" || grant.persona !== "physician" || grant.state !== "active") deny("DEMO_GRANT_INACTIVE");
  if (!isDemoGrantCurrent(grant, now.getTime())) deny("DEMO_GRANT_EXPIRED");
}
function synthetic(record: DemoWorkspace | DemoPatient | null, workspaceId: string) {
  if (!record || record.classification !== "synthetic" ||
    ("workspaceId" in record ? record.workspaceId !== workspaceId : record.id !== workspaceId)) deny("DEMO_DATA_SCOPE_DENIED");
}
function reviewer(accounts: IdentityAccountSnapshot[], proof: IdentityReviewerProof) {
  const actor = accounts.find(row => row.id === proof.id);
  if (!actor?.isAdmin || !actor.mfaEnabled || proof.mfaVerified !== true || actor.authSecurityVersion !== proof.securityVersion) deny("DEMO_REVIEWER_REQUIRED", "A current MFA-verified administrative reviewer is required.");
}
export function syntheticPatient(workspaceId: string): DemoPatient {
  return {
    id: randomUUID(), workspaceId, classification: "synthetic", label: "Synthetic Patient 001",
    scenario: "Fictional adult with type 2 diabetes; simulated meal-planning follow-up. Not a real person.",
    glucose: [
      { id: randomUUID(), value: 118, unit: "mg/dL", context: "FASTED", recordedAt: "2026-10-01T08:00:00.000Z" },
      { id: randomUUID(), value: 163, unit: "mg/dL", context: "POST_MEAL_2H", recordedAt: "2026-10-01T14:00:00.000Z" },
    ],
    messages: [{ id: randomUUID(), author: "Synthetic patient", text: "Demo message: I would like help planning regular balanced meals." }],
    media: [{ id: randomUUID(), name: "synthetic-nutrition-diary.txt", contentType: "text/plain", content: "SYNTHETIC DEMONSTRATION ONLY\nFictional diary: breakfast, lunch, dinner and water. No real patient content." }],
    plan: null, revision: 1,
  };
}
export function createDemoProfessionalService(repository: DemoRepository, clock = () => new Date()) {
  async function authorized(tx: DemoTransaction, userId: string, capability?: DemoCapability, workspaceId?: string, acknowledgment = true) {
    // Account then grant lock order matches administration. No cached entitlement.
    const [account] = await tx.accounts([userId]);
    const grant = await tx.grant(userId);
    // The Development repository validates exact Clinic ownership and issues
    // explicit founder authority independently of the stored Business identity.
    if (!account || !grant || account.id !== userId || grant.userId !== userId
      || (grant.authority === "development_founder" && !isDevelopmentFounderDemoAccount(userId))
      || (grant.authority === "founder_admin" && (!isPermanentFounderDemoGrant(grant) || !isFounderPhysicianDemoScope(userId, grant.clinicId)))
      || (account.professionalRole !== "physician" && !isPermanentFounderDemoGrant(grant))) deny("DEMO_AUTHORITY_REQUIRED");
    // A persisted founder grant does not override canonical identity or Clinic ownership.
    let clinic: NonNullable<DemoContext["clinic"]> | null = null;
    if (grant.authority === "founder_admin") {
      if (account.professionalRole !== "physician") deny("DEMO_CONTROLLED_IDENTITY_REQUIRED");
      clinic = await tx.ownedClinic?.(userId, grant.clinicId!) ?? null;
      if (!clinic || clinic.id !== grant.clinicId) deny("DEMO_CLINIC_OWNERSHIP_REQUIRED");
    }
    live(grant!, clock());
    if (workspaceId && workspaceId !== grant!.workspaceId) deny("DEMO_DATA_SCOPE_DENIED");
    if (capability && !grant!.capabilities.includes(capability)) deny("DEMO_CAPABILITY_DENIED");
    if (acknowledgment && (!grant!.acknowledgedAt || grant!.acknowledgmentVersion !== DEMO_ACKNOWLEDGMENT_VERSION)) deny("DEMO_ACKNOWLEDGMENT_REQUIRED");
    const workspace = await tx.workspace(grant!.workspaceId);
    synthetic(workspace, grant!.workspaceId);
    return { account: account!, grant: grant!, workspace: workspace!, clinic };
  }
  async function patient(tx: DemoTransaction, userId: string, workspaceId: string, patientId: string, capability: DemoCapability) {
    const authority = await authorized(tx, userId, capability, workspaceId);
    const record = await tx.patient(workspaceId, patientId);
    synthetic(record, authority.grant.workspaceId);
    return { ...authority, patient: record! };
  }
  return {
    async invitation(userId: string, workspaceId: string, patientId: string) {
      return repository.transaction(async tx => {
        const { patient: record } = await patient(tx, userId, workspaceId, patientId, "patient.read");
        return record.connectionInvitation ?? null;
      });
    },
    async invite(userId: string, workspaceId: string, patientId: string) {
      return repository.transaction(async tx => {
        const { account, grant, patient: record } = await patient(tx, userId, workspaceId, patientId, "clinical.write");
        const parties = resolveCareInvitationParties({ ...account, professionalRole: grant.persona }, { id: record.id, professionalRole: null });
        assertInvitationDataset({ domain: "synthetic", workspaceId: grant.workspaceId },
          { domain: record.classification === "synthetic" ? "synthetic" : "live", workspaceId: record.workspaceId });
        if (record.connectionInvitation?.state === "accepted") return record.connectionInvitation;
        const invitation: DemoCareInvitation = {
          id: randomUUID(), providerUserId: parties.provider.id, clientUserId: parties.client.id, workspaceId,
          code: `DM-${randomUUID().slice(0, 8).toUpperCase()}`, token: `demo_${randomUUID()}`,
          expiresAt: new Date(Math.min(clock().getTime() + 14 * 86400000,
            grant.expiresAt === null ? Infinity : Date.parse(grant.expiresAt))).toISOString(),
          revokedAt: null, state: "pending", acceptedAt: null, classification: "synthetic",
        };
        await tx.saveInvitation(record, invitation);
        return invitation;
      });
    },
    async acceptInvitation(userId: string, workspaceId: string, patientId: string, key: string) {
      return repository.transaction(async tx => {
        const { account, grant, patient: record } = await patient(tx, userId, workspaceId, patientId, "clinical.write");
        assertInvitationDataset({ domain: "synthetic", workspaceId: grant.workspaceId },
          { domain: record.classification === "synthetic" ? "synthetic" : "live", workspaceId: record.workspaceId });
        const invitation = record.connectionInvitation;
        if (!invitation || (key !== invitation.code && key !== invitation.token)) deny("DEMO_INVITATION_NOT_FOUND");
        resolveCareInvitationParties({ ...account, professionalRole: grant.persona }, { id: record.id, professionalRole: null }, invitation!);
        if (invitation!.workspaceId !== workspaceId || invitation!.classification !== "synthetic") deny("DEMO_DATA_SCOPE_DENIED");
        try { assertInvitationWindow(invitation!, clock()); }
        catch (error) {
          if (error instanceof CareInvitationError) throw new ProfessionalRequestError(error.status, error.code, error.message);
          throw error;
        }
        if (invitation!.state === "revoked") deny("DEMO_INVITATION_REVOKED");
        if (invitation!.state === "accepted") return invitation!;
        const next: DemoCareInvitation = { ...invitation!, state: "accepted", acceptedAt: clock().toISOString() };
        await tx.saveInvitation(record, next);
        return next;
      });
    },
    async prepare(proof: IdentityReviewerProof, input: DemoGrantPreparation) {
      return repository.transaction(async tx => {
        if (proof.id === input.targetUserId) deny("DEMO_SELF_GRANT_FORBIDDEN");
        const accounts = await tx.accounts([proof.id, input.targetUserId].sort());
        reviewer(accounts, proof);
        const target = accounts.find(row => row.id === input.targetUserId);
        if (!target || identitySnapshotHash(target) !== input.reviewedStateHash) throw new ProfessionalRequestError(409, "DEMO_TARGET_CHANGED", "Reload the target identity before preparing a grant.");
        if (await tx.grant(target.id)) throw new ProfessionalRequestError(409, "DEMO_GRANT_ALREADY_EXISTS", "Existing demo restriction/grant must not be overwritten.");
        const permanent = input.lifetime === "permanent_founder";
        let clinic: NonNullable<DemoContext["clinic"]> | null = null;
        if (permanent) {
          if (!isFounderPhysicianDemoScope(target.id, DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO.clinicId)
            || input.founderAuthorizationAcknowledged !== true || input.expiresAt !== null
            || !input.demoTrainingWaiverReason || !input.identityOnlyAcknowledged || !input.sharedDataAcknowledged) deny("DEMO_FOUNDER_AUTHORIZATION_REQUIRED");
          clinic = await tx.ownedClinic?.(target.id, DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO.clinicId) ?? null;
          if (!clinic || clinic.id !== DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO.clinicId) deny("DEMO_CLINIC_OWNERSHIP_REQUIRED");
        } else {
          const now = clock().getTime(), expires = input.expiresAt === null ? NaN : Date.parse(input.expiresAt);
          if (!Number.isFinite(expires) || expires <= now || expires > now + 30 * 86400000 || input.founderAuthorizationAcknowledged !== undefined) throw new ProfessionalRequestError(400, "DEMO_EXPIRY_INVALID", "Explicit expiry must be within the next 30 days.");
        }
        const academy = permanent ? false : await tx.academyComplete(target.id);
        if (!academy && !input.demoTrainingWaiverReason) deny("DEMO_TRAINING_BASIS_REQUIRED", "Genuine Academy evidence or an explicit demo-only waiver is required.");
        const workspace: DemoWorkspace = { id: randomUUID(), label: "Isolated physician demonstration", classification: "synthetic" };
        const grant: DemoGrant = {
          id: randomUUID(), userId: target.id, workspaceId: workspace.id, persona: "physician", operatingStatus: "demo_only",
          state: "prepared", revision: 1, capabilities: [...new Set(input.capabilities)], expiresAt: permanent ? null : new Date(input.expiresAt!).toISOString(),
          ...(permanent ? { authority: "founder_admin" as const, lifetime: "permanent_founder" as const, clinicId: clinic!.id } : {}),
          approverId: proof.id, reason: input.reason, trainingBasis: academy ? "academy_evidence" : "demo_only_waiver",
          trainingWaiverReason: academy ? null : input.demoTrainingWaiverReason!,
          acknowledgedAt: null, acknowledgmentVersion: null, identityRequestId: null,
        };
        await tx.createDataset(workspace, syntheticPatient(workspace.id));
        await tx.saveGrant(grant);
        await tx.invalidateSessions(target);
        await tx.event(grant, proof.id, "demo_prepared", { reason: input.reason, previousIdentity: target.professionalRole, reviewedStateHash: input.reviewedStateHash, trainingBasis: grant.trainingBasis, trainingWaiverReason: grant.trainingWaiverReason, authority: grant.authority ?? "temporary_admin", lifetime: grant.lifetime ?? "temporary", clinicId: grant.clinicId ?? null, founderAuthorizationAcknowledged: permanent, reviewerAuthority: "authenticated_admin_with_current_mfa", reviewerSecurityVersion: proof.securityVersion });
        return grant;
      });
    },
    async activate(proof: IdentityReviewerProof, targetUserId: string, input: DemoGrantActivation) {
      return repository.transaction(async tx => {
        if (proof.id === targetUserId) deny("DEMO_SELF_GRANT_FORBIDDEN");
        const accounts = await tx.accounts([proof.id, targetUserId].sort());
        reviewer(accounts, proof);
        const target = accounts.find(row => row.id === targetUserId);
        const grant = await tx.grant(targetUserId);
        if (!target || !grant || grant.state !== "prepared" || grant.revision !== input.revision || identitySnapshotHash(target) !== input.reviewedStateHash) throw new ProfessionalRequestError(409, "DEMO_TARGET_CHANGED", "Grant or reviewed identity changed.");
        if (target.professionalRole !== "physician" || !await tx.approvedIdentityRequest(targetUserId, input.identityRequestId)) deny("DEMO_CONTROLLED_IDENTITY_REQUIRED");
        if (grant.authority === "founder_admin") {
          if (!isPermanentFounderDemoGrant(grant) || !isFounderPhysicianDemoScope(targetUserId, grant.clinicId)
            || !(await tx.ownedClinic?.(targetUserId, grant.clinicId!))) deny("DEMO_CLINIC_OWNERSHIP_REQUIRED");
        }
        const workspace = await tx.workspace(grant.workspaceId); synthetic(workspace, grant.workspaceId);
        live({ ...grant, state: "active" }, clock());
        const next: DemoGrant = { ...grant, state: "active", revision: grant.revision + 1, identityRequestId: input.identityRequestId };
        await tx.saveGrant(next); await tx.invalidateSessions(target);
        await tx.event(next, proof.id, "demo_activated", { reason: input.reason, identityRequestId: input.identityRequestId, reviewedStateHash: input.reviewedStateHash, authority: grant.authority ?? "temporary_admin", lifetime: grant.lifetime ?? "temporary", clinicId: grant.clinicId ?? null, reviewerAuthority: "authenticated_admin_with_current_mfa", reviewerSecurityVersion: proof.securityVersion });
        return next;
      });
    },
    async revoke(proof: IdentityReviewerProof, targetUserId: string, revision: number, reason: string) {
      return repository.transaction(async tx => {
        const accounts = await tx.accounts([proof.id, targetUserId].sort()); reviewer(accounts, proof);
        const target = accounts.find(row => row.id === targetUserId), grant = await tx.grant(targetUserId);
        if (!target || !grant || grant.revision !== revision) throw new ProfessionalRequestError(409, "DEMO_GRANT_CHANGED", "Reload the grant.");
        const next: DemoGrant = { ...grant, state: "revoked", revision: grant.revision + 1 };
        await tx.saveGrant(next); await tx.invalidateSessions(target);
        await tx.event(next, proof.id, "demo_revoked", { reason, reviewerAuthority: "authenticated_admin_with_current_mfa", reviewerSecurityVersion: proof.securityVersion });
        return next; // operatingStatus remains restrictive even when revoked.
      });
    },
    async context(userId: string): Promise<DemoContext> {
      return repository.transaction(async tx => {
        const { grant, workspace, clinic } = await authorized(tx, userId, undefined, undefined, false);
        return { operatingStatus: "demo_only", persona: "physician", grant, workspace,
          ...(clinic ? { clinic } : tx.clinic ? { clinic: await tx.clinic() } : {}),
          acknowledgmentRequired: !grant.acknowledgedAt || grant.acknowledgmentVersion !== DEMO_ACKNOWLEDGMENT_VERSION,
          realClinicalReadiness: false, credentialVerificationGranted: false, academyCompletionGranted: false,
          realAgreementsGranted: false, paidSubscriptionGranted: false };
      });
    },
    async acknowledge(userId: string) {
      return repository.transaction(async tx => {
        const { grant } = await authorized(tx, userId, undefined, undefined, false);
        const next = { ...grant, acknowledgedAt: clock().toISOString(), acknowledgmentVersion: DEMO_ACKNOWLEDGMENT_VERSION, revision: grant.revision + 1 };
        await tx.saveGrant(next); await tx.event(next, userId, "demo_acknowledged", { version: DEMO_ACKNOWLEDGMENT_VERSION });
        return { acknowledged: true as const };
      });
    },
    async list(userId: string, workspaceId: string) {
      return repository.transaction(async tx => {
        await authorized(tx, userId, "patient.read", workspaceId);
        // Unknown/live rows never surface even when placed into a demo workspace.
        return (await tx.patients(workspaceId)).filter(row => row.classification === "synthetic" && row.workspaceId === workspaceId).map(({ id, label, scenario }) => ({ id, label, scenario }));
      });
    },
    async read(userId: string, workspaceId: string, id: string) {
      return repository.transaction(async tx => {
        const { patient: record } = await patient(tx, userId, workspaceId, id, "clinical.read");
        return { id: record.id, label: record.label, scenario: record.scenario, classification: "synthetic" as const, glucose: record.glucose, plan: record.plan, revision: record.revision };
      });
    },
    async savePlan(userId: string, workspaceId: string, id: string, plan: DemoPlan) {
      return repository.transaction(async tx => {
        const { patient: record, grant } = await patient(tx, userId, workspaceId, id, "clinical.write");
        const saved = await tx.savePlan(record, plan);
        await tx.event(grant, userId, "demo_plan_saved", { patientId: record.id, plan, patientRevision: saved.revision });
        return { plan: saved.plan, revision: saved.revision, classification: "synthetic" as const };
      });
    },
    async messages(userId: string, workspaceId: string, id: string) {
      return repository.transaction(async tx => (await patient(tx, userId, workspaceId, id, "messages.read")).patient.messages);
    },
    async media(userId: string, workspaceId: string, id: string, mediaId: string) {
      return repository.transaction(async tx => {
        const record = (await patient(tx, userId, workspaceId, id, "media.read")).patient.media.find(row => row.id === mediaId);
        if (!record) deny("DEMO_DATA_SCOPE_DENIED");
        return record!;
      });
    },
    async mediaList(userId: string, workspaceId: string, id: string) {
      return repository.transaction(async tx => (await patient(tx, userId, workspaceId, id, "media.read")).patient.media.map(({ id, name, contentType }) => ({ id, name, contentType })));
    },
    async export(userId: string, workspaceId: string, id: string) {
      return repository.transaction(async tx => {
        const { patient: record, grant } = await patient(tx, userId, workspaceId, id, "export");
        await tx.event(grant, userId, "demo_exported", { patientId: record.id });
        return { classification: "synthetic" as const, notice: "SYNTHETIC DEMONSTRATION ONLY — not a real patient record", patient: { id: record.id, label: record.label, scenario: record.scenario, glucose: record.glucose, plan: record.plan } };
      });
    },
  };
}
