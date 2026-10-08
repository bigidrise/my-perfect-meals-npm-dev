/** Fictional evidence only. No shared account approvals or billing writes. */
import { credentialSubjectHash, credentialReviewStatus, createCredentialReviewService, type CredentialContext } from "../services/professionalCredentialReviewService";
import { professionalCredentialDecision } from "@shared/professionalCredentialReview";

const now = new Date("2026-10-08T12:00:00Z");
const approvalId = "bff13b2d-7f33-4ff4-8be3-44a5c67c0d22";
function fixture() {
  let context: CredentialContext = {
    request: {
      id: "bff13b2d-7f33-4ff4-8be3-44a5c67c0d21", ownerUserId: "fictional-clinician",
      requestedRole: "physician", professionalCategory: "certified", credentialBody: "Fictional issuing authority",
      credentialNumber: "SYNTHETIC-NOT-A-LICENSE", credentialType: "fictional", credentialYear: "2020",
      state: "approved", revision: 3, createdAt: now.toISOString(), updatedAt: now.toISOString(), submittedAt: now.toISOString(),
    },
    account: {
      id: "fictional-clinician", professionalRole: "physician", authSecurityVersion: 7,
      professionalCategory: null, credentialBody: null, credentialNumber: null, credentialType: null,
      credentialYear: null, isProCare: false, organizationId: "fictional-org", isAdmin: false, mfaEnabled: true,
    },
    approval: { id: approvalId, actorUserId: "fictional-identity-reviewer", eventType: "identity_approved", createdAt: now.toISOString(), metadata: { roleChanged: true } },
    latest: null, required: true, demo: false,
  };
  const reviewer = { ...context.account, id: "fictional-credential-reviewer", isAdmin: true, authSecurityVersion: 4 };
  const proof = { id: reviewer.id, securityVersion: 4, mfaVerified: true as const };
  let failure = false, reviewerDemo = false, tail = Promise.resolve();
  const writes: string[] = [];
  const service = createCredentialReviewService({
    transaction: async work => {
      const previous = tail; let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; }); await previous;
      const snapshot = JSON.parse(JSON.stringify(context));
      try {
        return await work({
          context: async () => context, lockOwner: async () => {},
          accounts: async () => [context.account, reviewer], isDemo: async () => reviewerDemo,
          append: async (_context, actor, input) => {
            context.request.revision++;
            if (failure) throw new Error("audit write unavailable");
            context.latest = {
              id: "fictional-audit", actorUserId: actor.id, eventType: "credentials_" + input.decision,
              createdAt: now.toISOString(),
              metadata: { ...input, reviewerAuthority: "authenticated_admin_with_current_mfa", reviewerSecurityVersion: actor.securityVersion },
            };
            writes.push(context.latest.eventType);
          },
        });
      } catch (error) { context = snapshot; throw error; } finally { release(); }
    },
  }, () => now);
  const input = () => ({
    revision: context.request.revision, reviewedCredentialHash: credentialSubjectHash(context),
    approvalEventId: context.approval!.id, decision: "verified" as const,
    verificationBasis: "FICTIONAL FIXTURE: issuing authority registry reference SYNTHETIC-1 reports an active matching license.",
    checkedAt: "2026-10-01T12:00:00Z", validUntil: "2027-10-01T12:00:00Z",
    independentVerificationAcknowledged: true as const,
  });
  return { service, proof, reviewer, input, context: () => context, writes,
    fail: () => { failure = true; }, reviewerDemo: () => { reviewerDemo = true; } };
}
test("explicit evidence-bound verification records the authenticated reviewer and server time without activating or changing the subject", async () => {
  const f = fixture(); const before = { ...f.context().account };
  await expect(f.service.decide(f.context().request.id, f.proof, f.input())).resolves.toEqual({ decisionSaved: true });
  expect(f.context().account).toEqual(before);
  expect(f.context().request.state).toBe("approved");
  expect(credentialReviewStatus(f.context(), now)).toMatchObject({
    status: "verified", latestDecision: { reviewerId: f.proof.id, decidedAt: now.toISOString(), verificationBasis: f.input().verificationBasis },
  });
});
test.each(["pending", "rejected"] as const)("%s does not clear the gate, and a later genuine review can supersede it", async decision => {
  const f = fixture();
  await f.service.decide(f.context().request.id, f.proof, { ...f.input(), decision });
  expect(credentialReviewStatus(f.context(), now).status).toBe(decision);
  await f.service.decide(f.context().request.id, f.proof, f.input());
  expect(credentialReviewStatus(f.context(), now).status).toBe("verified");
  await f.service.decide(f.context().request.id, f.proof, { ...f.input(), decision });
  expect(credentialReviewStatus(f.context(), now).status).toBe(decision);
});
test("self-approval is forbidden", async () => {
  const f = fixture();
  await expect(f.service.decide(f.context().request.id, { ...f.proof, id: f.context().account.id }, f.input())).rejects.toMatchObject({ code: "SELF_REVIEW_FORBIDDEN" });
  expect(f.writes).toEqual([]);
});
test.each(["admin", "mfa", "security", "proof"] as const)("current reviewer %s protection is rechecked inside the transaction", async field => {
  const f = fixture(); const proof = { ...f.proof };
  if (field === "admin") f.reviewer.isAdmin = false;
  if (field === "mfa") f.reviewer.mfaEnabled = false;
  if (field === "security") f.reviewer.authSecurityVersion++;
  if (field === "proof") (proof as any).mfaVerified = false;
  await expect(f.service.decide(f.context().request.id, proof, f.input())).rejects.toMatchObject({ status: 403 });
  expect(f.writes).toEqual([]);
});
test.each(["subject", "reviewer"] as const)("a %s demo exemption cannot issue or receive real clearance", async whom => {
  const f = fixture(); if (whom === "subject") f.context().demo = true; else f.reviewerDemo();
  await expect(f.service.decide(f.context().request.id, f.proof, f.input())).rejects.toMatchObject({ code: "DEMO_CREDENTIAL_REVIEW_FORBIDDEN" });
  expect(f.writes).toEqual([]);
});
test("duplicate and concurrent decisions append exactly once, with a reload-required conflict for the loser", async () => {
  const f = fixture(); const input = f.input();
  const results = await Promise.allSettled([f.service.decide(f.context().request.id, f.proof, input), f.service.decide(f.context().request.id, f.proof, input)]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(f.writes).toEqual(["credentials_verified"]);
  await expect(f.service.decide(f.context().request.id, f.proof, input)).rejects.toMatchObject({ code: "CREDENTIAL_REVIEW_STATE_CHANGED" });
});
test.each(["security", "claims", "approval", "role", "revision"] as const)("changed %s before saving cannot reuse a reviewed form", async field => {
  const f = fixture(); const input = f.input();
  if (field === "security") f.context().account.authSecurityVersion++;
  if (field === "claims") f.context().request.credentialNumber = "DIFFERENT-SYNTHETIC";
  if (field === "approval") f.context().approval!.id = "bff13b2d-7f33-4ff4-8be3-44a5c67c0d23";
  if (field === "role") f.context().account.professionalRole = "dietitian";
  if (field === "revision") f.context().request.revision++;
  await expect(f.service.decide(f.context().request.id, f.proof, input)).rejects.toMatchObject({ status: 409 });
  expect(f.writes).toEqual([]);
});
test.each(["security", "claims", "accountCredentials", "approval", "erasure", "expiry"] as const)("clearance fails closed after %s changes", async field => {
  const f = fixture(); await f.service.decide(f.context().request.id, f.proof, f.input());
  if (field === "security") f.context().account.authSecurityVersion++;
  if (field === "claims") f.context().request.credentialNumber = "DIFFERENT-SYNTHETIC";
  if (field === "accountCredentials") f.context().account.credentialBody = "OTHER-AUTHORITY";
  if (field === "approval") f.context().approval!.id = "bff13b2d-7f33-4ff4-8be3-44a5c67c0d23";
  if (field === "erasure") f.context().latest!.metadata = {};
  const date = field === "expiry" ? new Date("2028-01-01") : now;
  expect(credentialReviewStatus(f.context(), date)).toMatchObject({ required: true, status: "stale" });
});
test("provider activation and Organization selection remain separate and do not manufacture or invalidate credential evidence", async () => {
  const f = fixture(); f.context().account.isProCare = true;
  expect(credentialReviewStatus(f.context(), now).status).toBe("pending");
  await f.service.decide(f.context().request.id, f.proof, f.input());
  f.context().account.isProCare = false; f.context().account.organizationId = "other-fictional-org";
  expect(credentialReviewStatus(f.context(), now).status).toBe("verified");
});
test("failed audit append rolls back revision and cannot leave a partial successful verification", async () => {
  const f = fixture(); f.fail(); const before = JSON.stringify(f.context());
  await expect(f.service.decide(f.context().request.id, f.proof, f.input())).rejects.toThrow("audit write unavailable");
  expect(JSON.stringify(f.context())).toBe(before);
});
test.each(["reviewerId", "ownerUserId", "isProCare", "verified", "pilotGrant"] as const)("client-forged %s is rejected by the strict schema", field => {
  const f = fixture(); expect(professionalCredentialDecision.safeParse({ ...f.input(), [field]: true }).success).toBe(false);
});
test.each([
  { verificationBasis: "" }, { checkedAt: undefined }, { validUntil: undefined },
  { independentVerificationAcknowledged: false }, { checkedAt: "2027-01-01T00:00:00Z" }, { validUntil: "2025-01-01T00:00:00Z" },
])("missing/invalid evidence never approves: %p", async change => {
  const f = fixture();
  await expect(f.service.decide(f.context().request.id, f.proof, { ...f.input(), ...change } as any)).rejects.toMatchObject({ status: 400 });
  expect(f.writes).toEqual([]);
});
