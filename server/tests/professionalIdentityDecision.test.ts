import { createIdentityDecisionService, identitySnapshotHash, type IdentityAccountSnapshot, type IdentityDecisionRepository, type IdentityDecisionTransaction } from "../services/professionalIdentityDecisionService";
import { professionalIdentityDecision, type ProfessionalIdentityDecision, type ProfessionalIdentityRequest } from "@shared/professionalOnboarding";
import { createProfessionalReadinessService, type ReadinessDependencies } from "../services/professionalIdentityReadiness";
import { createProfessionalOnboardingService } from "../services/professionalOnboardingService";

const account = (id: string, overrides: Partial<IdentityAccountSnapshot> = {}): IdentityAccountSnapshot => ({
  id, professionalRole: null, authSecurityVersion: 7, professionalCategory: null,
  credentialBody: null, credentialNumber: null, credentialType: null, credentialYear: null,
  isProCare: false, organizationId: "organization-preserved", isAdmin: false, mfaEnabled: true, ...overrides,
});
function fixture(previous: string | null = null) {
  let state = {
    accounts: [account("reviewer", { isAdmin: true }), account("subject", { professionalRole: previous })],
    request: { id: "d7c26d89-b756-49b6-8ceb-a34c435d6871", ownerUserId: "subject", requestedRole: "physician", professionalCategory: "certified",
      credentialBody: "TX", credentialNumber: "synthetic-claim", credentialType: "MD", credentialYear: null,
      state: "submitted", revision: 2, createdAt: "2026-10-07", updatedAt: "2026-10-07", submittedAt: "2026-10-07" } as ProfessionalIdentityRequest,
    events: [] as Record<string, unknown>[],
    unrelated: { ownership: ["existing-owner"], memberships: ["existing-member"], billing: "unchanged", verification: "pending", academy: [], legal: [], relationships: [], history: ["historical"] },
  };
  let failEvent = false;
  let tail = Promise.resolve();
  const repo: IdentityDecisionRepository = {
    async transaction(work) {
      let unlock!: () => void;
      const pending = tail; tail = new Promise<void>(resolve => { unlock = resolve; });
      await pending;
      const before = JSON.parse(JSON.stringify(state));
      const tx: IdentityDecisionTransaction = {
        request: async () => ({ ...state.request }), lockOwner: async () => {},
        accounts: async () => state.accounts,
        transition: async (old, role) => {
          const target = state.accounts.find(value => value.id === old.id)!;
          target.professionalRole = role; return ++target.authSecurityVersion;
        },
        decide: async (row, next, reason) => (state.request = { ...row, state: next, revision: row.revision + 1, decisionReason: reason, decidedAt: "durable-time" }),
        event: async (row, actor, type, metadata) => {
          if (failEvent) throw new Error("event write failed");
          state.events.push({ actor, type, requestId: row.id, revision: row.revision, ...metadata });
        },
      };
      try { return await work(tx); } catch (error) { state = before; throw error; } finally { unlock(); }
    },
  };
  const proof = { id: "reviewer", securityVersion: 7, mfaVerified: true as const };
  const input = (): ProfessionalIdentityDecision => ({
    revision: 2, reviewedStateHash: identitySnapshotHash(state.accounts[1]), decision: "approve",
    approvedRole: "physician", reason: "Explicit synthetic identity review.", recovery: !!previous,
    identityOnlyAcknowledged: true, sharedDataAcknowledged: true,
  });
  return { service: createIdentityDecisionService(repo), state: () => state, proof, input, failEvent: () => { failEvent = true; } };
}

describe("Stage 2 controlled identity decisions — isolated accounts only", () => {
  test("authorized approval writes only canonical identity and revocation version; independent systems stay unchanged", async () => {
    const f = fixture(); const before = JSON.stringify(f.state().unrelated);
    const result = await f.service.decide(f.state().request.id, f.proof, f.input());
    expect(result).toMatchObject({ request: { state: "approved", revision: 3 }, currentAuthorizedRole: "physician", reauthenticationRequired: true });
    expect(f.state().accounts[1]).toMatchObject({ professionalRole: "physician", authSecurityVersion: 8, organizationId: "organization-preserved", credentialNumber: null, isProCare: false, professionalCategory: null });
    expect(JSON.stringify(f.state().unrelated)).toBe(before);
    expect(f.state().events[0]).toMatchObject({ previousIdentity: null, requestedIdentity: "physician", approvedIdentity: "physician", actor: "reviewer", reviewerAuthority: "authenticated_admin_with_current_mfa", reviewedRevision: 2, decisionRevision: 3, nextSecurityVersion: 8 });
  });
  test("unauthorized reviewer cannot decide despite submitted request", async () => {
    const f = fixture(); f.state().accounts[0].isAdmin = false;
    await expect(f.service.decide(f.state().request.id, f.proof, f.input())).rejects.toMatchObject({ status: 403, code: "REVIEWER_REQUIRED" });
    expect(f.state().accounts[1].professionalRole).toBeNull();
  });
  test("self-approval is forbidden even for an administrator", async () => {
    const f = fixture(); f.state().request.ownerUserId = "reviewer";
    await expect(f.service.decide(f.state().request.id, f.proof, f.input())).rejects.toMatchObject({ code: "SELF_REVIEW_FORBIDDEN" });
  });
  test.each(["enrollment", "session", "version"])("reviewer %s security must still hold in transaction", async value => {
    const f = fixture();
    if (value === "enrollment") f.state().accounts[0].mfaEnabled = false;
    if (value === "session") (f.proof as any).mfaVerified = false;
    if (value === "version") f.proof.securityVersion--;
    await expect(f.service.decide(f.state().request.id, f.proof, f.input())).rejects.toMatchObject({ code: "REVIEWER_MFA_REQUIRED" });
    expect(f.state().events).toHaveLength(0);
  });
  test.each(["business", "coach", "nutritionist", "rn", "pa", "medical", "unknown"])("legacy %s requires explicit recovery and keeps its history", async previous => {
    const f = fixture(previous); const input = f.input(); input.recovery = false;
    await expect(f.service.decide(f.state().request.id, f.proof, input)).rejects.toMatchObject({ code: "EXPLICIT_RECOVERY_REQUIRED" });
    expect(f.state().accounts[1].professionalRole).toBe(previous);
    input.recovery = true;
    await f.service.decide(f.state().request.id, f.proof, input);
    expect(f.state().events[0]).toMatchObject({ previousIdentity: previous, approvedIdentity: "physician", recovery: true });
    expect(f.state().unrelated.history).toEqual(["historical"]);
  });
  test.each(["coach", "medical", "business", "rn", "pa", "nutritionist", "doctor", "np"])("unsupported requested %s never becomes identity", async role => {
    const f = fixture(); f.state().request.requestedRole = role as any;
    await expect(f.service.decide(f.state().request.id, f.proof, f.input())).rejects.toMatchObject({ code: "APPROVED_ROLE_MISMATCH" });
    expect(f.state().accounts[1].professionalRole).toBeNull();
  });
  test("reviewer cannot approve a different canonical role than requested", async () => {
    const f = fixture();
    await expect(f.service.decide(f.state().request.id, f.proof, { ...f.input(), approvedRole: "trainer" })).rejects.toMatchObject({ code: "APPROVED_ROLE_MISMATCH" });
  });
  test.each(["revision", "identity", "security", "credentials", "category", "organization"])("concurrent %s change requires re-review", async value => {
    const f = fixture(); const input = f.input();
    if (value === "revision") input.revision--;
    if (value === "identity") f.state().accounts[1].professionalRole = "trainer";
    if (value === "security") f.state().accounts[1].authSecurityVersion++;
    if (value === "credentials") f.state().accounts[1].credentialNumber = "changed-claim";
    if (value === "category") f.state().accounts[1].professionalCategory = "experienced";
    if (value === "organization") f.state().accounts[1].organizationId = "different";
    await expect(f.service.decide(f.state().request.id, f.proof, input)).rejects.toMatchObject({ status: 409 });
    expect(f.state().events).toHaveLength(0);
  });
  test("event failure rolls back identity, security version and request decision", async () => {
    const f = fixture(); const before = JSON.stringify(f.state()); f.failEvent();
    await expect(f.service.decide(f.state().request.id, f.proof, f.input())).rejects.toThrow("event write failed");
    expect(JSON.stringify(f.state())).toBe(before);
  });
  test("two concurrent decisions commit one transition/event; replay cannot overwrite", async () => {
    const f = fixture(); const input = f.input();
    const results = await Promise.allSettled([f.service.decide(f.state().request.id, f.proof, input), f.service.decide(f.state().request.id, f.proof, input)]);
    expect(results.filter(value => value.status === "fulfilled")).toHaveLength(1);
    expect(f.state().events).toHaveLength(1); expect(f.state().accounts[1].authSecurityVersion).toBe(8);
  });
  test.each(["reject", "needs_correction"] as const)("%s records a decision without any account transition", async decision => {
    const f = fixture("trainer"); const before = JSON.stringify(f.state().accounts);
    await f.service.decide(f.state().request.id, f.proof, { ...f.input(), decision });
    expect(JSON.stringify(f.state().accounts)).toBe(before);
    expect(f.state().events[0].approvedIdentity).toBeNull();
  });
  test("approval of an already identical role never revokes existing sessions", async () => {
    const f = fixture("physician");
    expect((await f.service.decide(f.state().request.id, f.proof, f.input())).reauthenticationRequired).toBe(false);
    expect(f.state().accounts[1].authSecurityVersion).toBe(7);
  });
  test.each(["reason", "identityOnlyAcknowledged", "sharedDataAcknowledged", "ownerUserId", "reviewerId"])("unacknowledged/forged %s input fails validation", field => {
    const f = fixture(); const input: any = f.input();
    if (field === "reason") input.reason = "";
    else if (field.endsWith("Acknowledged")) input[field] = false;
    else input[field] = "another-account";
    expect(professionalIdentityDecision.safeParse(input).success).toBe(false);
  });
  test("correction resumes explicitly with new revision/event and preserves previous reason", async () => {
    const f = fixture(); await f.service.decide(f.state().request.id, f.proof, { ...f.input(), decision: "needs_correction" });
    const ownerService = createProfessionalOnboardingService({
      transaction: async work => work({
        lockAccount: async () => {}, accountRole: async () => ({ professionalRole: null }), request: async () => f.state().request,
        create: async () => { throw new Error("must not create"); },
        save: async row => (f.state().request = row),
        event: async (_row, kind) => { f.state().events.push({ type: kind }); },
      }),
    });
    expect((await ownerService.status("subject")).request?.state).toBe("needs_correction");
    const resumed = await ownerService.resume("subject");
    expect(resumed.request).toMatchObject({ state: "draft", revision: 4, submittedAt: null, decisionReason: "Explicit synthetic identity review." });
    expect(f.state().events).toHaveLength(2);
  });
});

describe("Stage 2 independent reason-coded account readiness", () => {
  function deps(overrides: Partial<ReadinessDependencies> = {}): ReadinessDependencies {
    return {
      account: async () => ({ ...account("subject", { professionalRole: "physician" }), email: "synthetic.invalid" }),
      credentials: async () => false, training: async () => ({ phase1: { complete: false }, proCare: { complete: false } }),
      agreements: async () => false, entitlement: async () => false, mfaRequired: () => true, ...overrides,
    };
  }
  test("approved identity does not imply credentials, Academy, current legal, entitlement or client scope", async () => {
    const result = await createProfessionalReadinessService(deps())("subject", false);
    expect(result.accountPrerequisitesReady).toBe(false);
    expect(result.checks.identity.status).toBe("ready");
    for (const key of ["credentials", "training", "agreements", "entitlement", "mfa"] as const) expect(result.checks[key].status).toBe("blocked");
    expect(result.checks.organizationLocation.status).toBe("not_evaluated");
    expect(result.checks.relationshipConsent.status).toBe("not_evaluated");
    expect(result.clientAccessEvaluated).toBe(false);
  });
  test.each(["credentials", "training", "agreements", "entitlement"] as const)("%s errors fail closed without hiding other checks", async key => {
    const d = deps(); (d as any)[key] = async () => { throw new Error("database unavailable"); };
    const result = await createProfessionalReadinessService(d)("subject");
    expect(result.checks[key].status).toBe("unavailable");
    expect(result.accountPrerequisitesReady).toBe(false);
    expect(result.checks.identity.status).toBe("ready");
  });
  test("all account prerequisites can be ready, but no organization/relationship/consent is inferred", async () => {
    const result = await createProfessionalReadinessService(deps({
      credentials: async () => true, training: async () => ({ phase1: { complete: true }, proCare: { complete: true } }),
      agreements: async () => true, entitlement: async () => true,
    }))("subject", true);
    expect(result.accountPrerequisitesReady).toBe(true);
    expect(result.clientAccessEvaluated).toBe(false);
  });
  test("Academy ProCare evidence is independently required even after Phase 1", async () => {
    const result = await createProfessionalReadinessService(deps({ training: async () => ({ phase1: { complete: true }, proCare: { complete: false } }) }))("subject");
    expect(result.checks.training.code).toBe("ACADEMY_PROCARE_TRAINING_REQUIRED");
  });
});
