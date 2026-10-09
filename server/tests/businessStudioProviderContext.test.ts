import { mockInvitationDb, records, resetInvitationRecords } from "./helpers/careInvitationMemoryDb";
jest.mock("../db", () => ({ db: mockInvitationDb }));
let mockAccess = true;
let mockPhase1 = true;
let mockLegal = true;
jest.mock("../services/procareProviderAccess", () => ({
  providerHasProCareStudioAccess: jest.fn(async () => mockAccess),
}));
jest.mock("../services/academyProgression", () => ({
  getAcademyProgression: jest.fn(async () => ({ phase1: { complete: mockPhase1 }, proCare: { complete: true } })),
}));
jest.mock("../services/legalCheck", () => ({
  checkLegalAcceptance: jest.fn(async () => ({ allAccepted: mockLegal, missing: mockLegal ? [] : ["attestation"] })),
}));
jest.mock("../services/professionalIdentityCredentialBoundary", () => ({
  identityRequiresIndependentCredentialReview: jest.fn(async () => false),
}));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn() }));
jest.mock("../services/studioBridge", () => ({ ensureStudioForTrainer: jest.fn() }));
import { resolveInvitationProviderContext } from "../services/invitationProviderContext";
import { resolveCareInvitationParties } from "../services/careInvitationPolicy";
import { ensureProviderStudioReady } from "../services/procareStudioReadiness";
import { evaluateConsumerProCareAccess } from "../../shared/procareConsumerAccess";
import { isCanonicalPractitionerRole, isClinicalPractitionerRole } from "../../shared/professionalRoles";

const owner = { id: "operator-fixture", professionalRole: "business", isProCare: true, role: "coach" };
const client = { id: "client-fixture", professionalRole: "business" };
beforeEach(() => {
  mockAccess = mockPhase1 = mockLegal = true;
  resetInvitationRecords({ users: [{ ...owner }, { ...client }],
    studios: [{ id: "studio-fixture", name: "Fixture Studio", ownerUserId: owner.id, type: "studio", status: "active" }] });
});

test("authorized existing Studio yields nonclinical operating authority without changing identity", async () => {
  const before = JSON.stringify(records);
  const context = await resolveInvitationProviderContext(owner);
  expect(context).toEqual({ userId: owner.id, studioId: "studio-fixture", relationshipRole: "studio_operator" });
  expect((await ensureProviderStudioReady(owner.id)).studio).toMatchObject({ studioId: "studio-fixture", created: false });
  expect(JSON.stringify(records)).toBe(before);
  const parties = resolveCareInvitationParties(owner, client,
    { providerUserId: owner.id, clientUserId: client.id }, new Map([[owner.id, context!]]));
  expect(parties.provider.id).toBe(owner.id);
  expect(parties.client.id).toBe(client.id);
});

test("a Business account without a Studio has no provider authority", async () => {
  records.studios = [];
  expect(await resolveInvitationProviderContext(owner)).toBeNull();
  expect(() => resolveCareInvitationParties(owner, client, { providerUserId: owner.id }))
    .toThrow("UNSUPPORTED_PROVIDER_ROLE");
});

test("authorized independent Business Studio access does not require or change the legacy managed-account flag", async () => {
  records.users[0].isProCare = false;
  const before = JSON.stringify(records);
  expect(await resolveInvitationProviderContext(owner)).toMatchObject({
    userId: owner.id, studioId: "studio-fixture", relationshipRole: "studio_operator",
  });
  expect((await ensureProviderStudioReady(owner.id)).ok).toBe(true);
  expect(JSON.stringify(records)).toBe(before);
});

test("an unset managed-account flag does not bypass actual provider access", async () => {
  records.users[0].isProCare = false;
  mockAccess = false;
  await expect(resolveInvitationProviderContext(owner)).rejects.toMatchObject({ code: "PROCARE_ACCESS_REQUIRED" });
  expect(records.users[0].isProCare).toBe(false);
});

test.each(["paused", "inactive"])("a %s Studio cannot authorize its owner", async status => {
  records.studios[0].status = status;
  await expect(resolveInvitationProviderContext(owner)).rejects.toMatchObject({ code: "PROVIDER_ROLE_REQUIRED" });
});

test("Clinic ownership never creates a clinical practitioner", async () => {
  records.studios[0].type = "clinic";
  await expect(resolveInvitationProviderContext(owner)).rejects.toMatchObject({ code: "UNSUPPORTED_PROVIDER_ROLE" });
});

test.each(["access", "training", "legal"])("current %s requirements cannot be bypassed by ownership", async gate => {
  if (gate === "access") mockAccess = false;
  if (gate === "training") mockPhase1 = false;
  if (gate === "legal") mockLegal = false;
  await expect(resolveInvitationProviderContext(owner)).rejects.toMatchObject({
    code: gate === "access" ? "PROCARE_ACCESS_REQUIRED" : gate === "training" ? "PHASE1_CERT_REQUIRED" : "LEGAL_REACCEPT_REQUIRED",
  });
});

test("legacy backwards and unbound business invitations require explicit reissue", async () => {
  const context = await resolveInvitationProviderContext(owner);
  const evidence = new Map([[owner.id, context!]]);
  expect(() => resolveCareInvitationParties(owner, client, { clientUserId: owner.id }, evidence))
    .toThrow("This invitation was created in the wrong direction");
  expect(() => resolveCareInvitationParties(client, owner, {}, evidence)).toThrow("new, explicitly bound");
});

test("bindings identify provider and client in either direction, including two professional identities", () => {
  const trainer = { id: "trainer-fixture", professionalRole: "trainer" };
  const physician = { id: "physician-fixture", professionalRole: "physician" };
  const bound = { providerUserId: trainer.id, clientUserId: physician.id };
  expect(resolveCareInvitationParties(trainer, physician, bound).provider.id).toBe(trainer.id);
  expect(resolveCareInvitationParties(physician, trainer, bound).provider.id).toBe(trainer.id);
});

test("foreign and contradictory bindings fail closed", () => {
  const provider = { id: "provider-fixture", professionalRole: "trainer" };
  expect(() => resolveCareInvitationParties(provider, client, { providerUserId: "foreign" })).toThrow("INVITATION_PARTIES_CHANGED");
  expect(() => resolveCareInvitationParties(provider, client,
    { providerUserId: provider.id, clientUserId: provider.id })).toThrow("INVITATION_PARTIES_CHANGED");
});

test("an operator context is coaching-only and never a canonical or clinical credential", () => {
  expect(isCanonicalPractitionerRole("studio_operator")).toBe(false);
  expect(isClinicalPractitionerRole("studio_operator")).toBe(false);
  expect(isClinicalPractitionerRole("business")).toBe(false);
  expect(evaluateConsumerProCareAccess({
    accessTier: "PAID_FULL", planLookupKey: "mpm_premium_monthly", providerRole: "studio_operator",
  })).toMatchObject({ allowed: true, relationshipType: "coaching", requiredTier: "pro" });
  expect(evaluateConsumerProCareAccess({
    accessTier: "PAID_FULL", planLookupKey: "mpm_ultimate_monthly", providerRole: "business",
  })).toMatchObject({ allowed: false, code: "UNSUPPORTED_PROVIDER_ROLE" });
});
