import { mockInvitationDb, records, resetInvitationRecords } from "./helpers/careInvitationMemoryDb";
jest.mock("../db", () => ({ db: mockInvitationDb }));
jest.mock("../services/activityLog", () => ({ logClientActivity: jest.fn(async () => {}) }));
let mockClientAccess = { accessTier: "PAID_FULL", planLookupKey: "mpm_ultimate_monthly" };
let mockLegal = true;
let mockReady = true;
let mockScope: any = null;
jest.mock("../middleware/requireAuth", () => ({
  buildAuthUserWithEffectiveAccess: jest.fn(async (user: any) => ({ ...user, ...mockClientAccess })),
}));
jest.mock("../services/legalCheck", () => ({
  checkLegalAcceptance: jest.fn(async () => ({ allAccepted: mockLegal, missing: mockLegal ? [] : ["patient_clinical_data_consent"] })),
}));
jest.mock("../services/procareStudioReadiness", () => ({
  readOwnedBusinessStudio: async (id: string) => records.studios.find(row => row.ownerUserId === id) ?? null,
  getProviderStudioReadiness: jest.fn(async () => ({ ok: mockReady, code: "LEGAL_REACCEPT_REQUIRED" })),
  ensureProviderStudioReady: jest.fn(async () => ({ ok: mockReady, code: "LEGAL_REACCEPT_REQUIRED" })),
}));
jest.mock("../services/procareProviderAccess", () => ({ providerHasProCareStudioAccess: jest.fn(async () => mockReady) }));
jest.mock("../services/studioBridge", () => ({
  ensureStudioForTrainer: jest.fn(async (id: string) => {
    const studio = records.studios.find(row => row.ownerUserId === id);
    return studio ? { studioId: studio.id, studioName: studio.name, studioType: studio.type } : null;
  }),
}));
jest.mock("../services/organizationWorkspaceService", () => ({ discoverAuthorizedWorkspaces: jest.fn(async () => []) }));
jest.mock("../services/bp1OrganizationAttributionService", () => ({
  resolveProviderStudioAttribution: jest.fn(async () => mockScope),
  validateBp1Attribution: jest.fn(async (scope: any) => {
    if (!mockScope || scope.organizationId !== mockScope.organizationId || scope.locationId !== mockScope.locationId) {
      throw Object.assign(new Error("Invalid workspace"), { status: 403, code: "INVALID_WORKSPACE_SELECTION" });
    }
  }),
}));
jest.mock("../services/emailIdentityService", () => ({
  normalizeEmailIdentity: (value: string) => value.trim().toLowerCase(),
  resolveEmailIdentityForUser: jest.fn(async (id: string) => {
    const user = records.users.find(row => row.id === id);
    const candidates = user ? records.users.filter(row => row.email.toLowerCase() === user.email.toLowerCase()) : [];
    return candidates.length === 1 ? { status: "unique", user, candidates }
      : candidates.length ? { status: "ambiguous", candidates } : { status: "not_found", candidates: [] };
  }),
  findEmailIdentityCandidates: jest.fn(async (email: string) => records.users.filter(row => row.email.toLowerCase() === email.toLowerCase())),
}));
import { acceptStoredCareInvitation, findCareInvitation, resolveInvitationAttribution } from "../services/careInvitationAcceptance";
import { acceptInviteByToken, getInviteMetadata } from "../services/procareInviteService";
import { autoAcceptPendingInvites } from "../services/inviteAutoAccept";

const scopeNull = { organizationId: null, locationId: null, sourceBusinessId: null, partnerRecordId: null };
function fixture(direction: "provider" | "client" | "studio" = "provider") {
  const invite = { id: "invite", userId: direction === "client" ? "client" : "provider",
    studioId: "clinic", email: direction === "client" ? "provider@example.invalid" : "client@example.invalid",
    role: "trainer", inviteCode: "MP-CODE", urlToken: "link-token", accepted: false, acceptedAt: null,
    acceptedByUserId: null, revokedAt: null, providerUserId: null, clientUserId: null,
    expiresAt: new Date(Date.now() + 86400000), ...scopeNull,
    permissions: { canViewMacros: true, canAddMeals: false, canEditPlan: false } };
  resetInvitationRecords({
    users: [{ id: "provider", email: "provider@example.invalid", professionalRole: "physician", authSecurityVersion: 2, firstName: "Canonical", lastName: "Physician" },
      { id: "client", email: "client@example.invalid", professionalRole: null, authSecurityVersion: 1, activeBoard: "weekly" },
      { id: "wrong", email: "wrong@example.invalid", professionalRole: null, authSecurityVersion: 1 }],
    studios: [{ id: "clinic", ownerUserId: "provider", type: "clinic", name: "Correct Clinic", orgId: null, status: "active" }],
    care_invite: direction === "studio" ? [] : [invite], studio_invites: direction === "studio" ? [invite] : [],
    care_team_member: [], studio_memberships: [], client_links: [],
    demo_professional_grants: [], demo_professional_patients: [],
  });
  return direction === "client" ? "provider" : "client";
}
beforeEach(() => {
  mockClientAccess = { accessTier: "PAID_FULL", planLookupKey: "mpm_ultimate_monthly" };
  mockLegal = true; mockReady = true; mockScope = null; fixture();
});
async function byCode(actor = "client") {
  const invite = await findCareInvitation("code", "MP-CODE");
  return acceptStoredCareInvitation(invite!, actor);
}
function expectCorrectRelationship() {
  expect(records.studio_memberships).toHaveLength(1);
  expect(records.studio_memberships[0]).toMatchObject({ studioId: "clinic", clientUserId: "client", status: "active" });
  expect(records.client_links).toHaveLength(1);
  expect(records.client_links[0]).toMatchObject({ proUserId: "provider", clientUserId: "client", active: true });
  expect(records.care_team_member).toHaveLength(1);
  expect(records.care_team_member[0]).toMatchObject({ userId: "client", proUserId: "provider", role: "physician", email: "provider@example.invalid", status: "active" });
}
test("professional → client by code uses actual provider identity, not the requested trainer label", async () => {
  await byCode(); expectCorrectRelationship();
});

test.each(["bound", "explicit"] as const)("%s Organization scope still requires validated Organization and Location selection", async kind => {
  const resolver = jest.requireMock("../services/bp1OrganizationAttributionService").resolveProviderStudioAttribution;
  const selected = kind === "explicit" ? { organizationId: "selected-org", locationId: "selected-location" } : null;
  const studio = { ...records.studios[0], orgId: kind === "bound" ? "bound-org" : null };
  resolver.mockRejectedValueOnce(Object.assign(new Error("Select an Organization and Location before continuing."), {
    code: "WORKSPACE_SELECTION_REQUIRED", status: 409,
  }));
  await expect(resolveInvitationAttribution("provider", studio, selected))
    .rejects.toMatchObject({ code: "WORKSPACE_SELECTION_REQUIRED", status: 409 });
  expect(resolver).toHaveBeenLastCalledWith("provider", studio, selected);
});

test.each(["code", "token", "studio"] as const)("authorized Business Studio acceptance by %s retains both account identities", async path => {
  if (path === "studio") fixture("studio");
  records.users[0].professionalRole = "business";
  records.studios[0].type = "studio";
  const table = path === "studio" ? records.studio_invites : records.care_invite;
  table[0].providerUserId = "provider";
  table[0].clientUserId = "client";
  const identities = JSON.stringify(records.users);
  if (path === "token") {
    expect((await acceptInviteByToken("link-token", "client")).ok).toBe(true);
  } else await byCode();
  expect(records.care_team_member[0]).toMatchObject({ proUserId: "provider", userId: "client", role: "studio_operator" });
  expect(records.studio_memberships[0]).toMatchObject({ studioId: "clinic", clientUserId: "client", status: "active" });
  // Activation can maintain the client's ordinary relationship state, never occupations.
  expect(records.users.map(row => row.professionalRole)).toEqual(JSON.parse(identities).map((row: any) => row.professionalRole));
  expect(records.users[0].professionalRole).toBe(JSON.parse(identities)[0].professionalRole);
});
test("a trainer's canonical coaching relationship accepts Pro without requiring physician agreements", async () => {
  records.users[0].professionalRole = "trainer"; records.studios[0].type = "studio";
  mockClientAccess = { accessTier: "PAID_FULL", planLookupKey: "mpm_premium_monthly" };
  await byCode();
  expect(records.care_team_member[0]).toMatchObject({ userId: "client", proUserId: "provider", role: "trainer", status: "active" });
  expect(jest.requireMock("../services/legalCheck").checkLegalAcceptance).toHaveBeenCalledWith("client", "client");
});
test("professional → client email link ignores caller-supplied tier/internal flags and writes every relationship record", async () => {
  const result = await acceptInviteByToken("link-token", "client", "essential", "essential", true);
  expect(result.ok).toBe(true); expectCorrectRelationship();
});
test.each(["provider", "client", "studio"] as const)("%s legacy login acceptance has the same party orientation and does not attach a patient membership to a provider login", async direction => {
  const actor = fixture(direction);
  (records.care_invite[0] ?? records.studio_invites[0]).urlToken = null;
  const result = await autoAcceptPendingInvites(actor, "caller-spoofed@example.invalid");
  expect(result.accepted).toBe(true);
  expect(!!result.membership).toBe(direction !== "client");
  expectCorrectRelationship();
});
test.each(["code", "token"] as const)("client → professional by %s checks and stores the real client, not the accepting provider", async path => {
  fixture("client");
  if (path === "code") await byCode("provider");
  else expect((await acceptInviteByToken("link-token", "provider", null, "essential")).ok).toBe(true);
  expectCorrectRelationship();
  expect((await getInviteMetadata("link-token"))?.studioType).toBe("clinic");
});
test.each(["code", "token"] as const)("Studio/Clinic %s creates the canonical Care Team row too", async path => {
  fixture("studio");
  if (path === "code") await byCode();
  else expect((await acceptInviteByToken("link-token", "client", null, "essential")).ok).toBe(true);
  expectCorrectRelationship();
});
test("wrong recipient cannot provision or mutate a relationship", async () => {
  await expect(byCode("wrong")).rejects.toMatchObject({ code: "EMAIL_MISMATCH" });
  expect(records.studio_memberships).toHaveLength(0); expect(records.care_team_member).toHaveLength(0);
});
test.each(["expired", "revoked"] as const)("%s invitation fails before activation", async state => {
  if (state === "expired") records.care_invite[0].expiresAt = new Date(0);
  else records.care_invite[0].revokedAt = new Date();
  await expect(byCode()).rejects.toMatchObject({ code: state === "expired" ? "EXPIRED" : "REVOKED" });
  expect(records.client_links).toHaveLength(0);
});
test("same recipient retry is idempotent, and an accepted invitation cannot restore a revoked connection", async () => {
  await byCode(); await byCode(); expectCorrectRelationship();
  records.studio_memberships[0].status = "revoked";
  await expect(byCode()).rejects.toMatchObject({ code: "ALREADY_ACCEPTED" });
  expect(records.studio_memberships[0].status).toBe("revoked");
});
test("concurrent code/link acceptance creates exactly one connection", async () => {
  const result = await Promise.all([byCode(), acceptInviteByToken("link-token", "client", null, "ultimate")]);
  expect((result[1] as any).ok).toBe(true); expectCorrectRelationship();
});
test.each(["organization", "location"] as const)("wrong %s attribution fails safely", async field => {
  mockScope = { organizationId: "org", locationId: "location", sourceBusinessId: null, partnerRecordId: null };
  records.studios[0].orgId = "org";
  Object.assign(records.care_invite[0], mockScope, field === "organization" ? { organizationId: "other" } : { locationId: "other" });
  await expect(byCode()).rejects.toBeDefined(); expect(records.client_links).toHaveLength(0);
});
test("valid Organization/Location attribution is consistent across all three relationship records", async () => {
  mockScope = { organizationId: "org", locationId: "location", sourceBusinessId: null, partnerRecordId: null };
  records.studios[0].orgId = "org"; Object.assign(records.care_invite[0], mockScope);
  await byCode(); expectCorrectRelationship();
  for (const table of ["studio_memberships", "client_links", "care_team_member"]) expect(records[table][0]).toMatchObject(mockScope);
});
test("wrong Studio owner cannot become a provider through ownership", async () => {
  fixture("studio"); records.studios[0].ownerUserId = "wrong";
  await expect(byCode()).rejects.toMatchObject({ code: "UNSUPPORTED_PROVIDER_ROLE" });
  expect(records.client_links).toHaveLength(0);
});
test("a Studio invitation bound to one physician cannot attach to a different authorized physician", async () => {
  fixture("studio");
  records.studio_invites[0].providerUserId = "provider";
  records.users[2].professionalRole = "physician";
  records.studios[0].ownerUserId = "wrong";
  await expect(byCode()).rejects.toMatchObject({ code: "INVITATION_PARTIES_CHANGED" });
  expect(records.client_links).toHaveLength(0);
});
test("provider readiness and client legal acceptance are enforced for links and codes", async () => {
  mockLegal = false;
  await expect(byCode()).rejects.toMatchObject({ code: "LEGAL_REACCEPT_REQUIRED", details: { legalForCurrentUser: true } });
  mockLegal = true; mockReady = false;
  expect(await acceptInviteByToken("link-token", "client", "ultimate", "ultimate", true)).toMatchObject({ ok: false });
  expect(records.client_links).toHaveLength(0);
});
test("a client-created physician invite still uses the client's Clinical eligibility", async () => {
  fixture("client"); mockClientAccess = { accessTier: "premium", planLookupKey: "premium" };
  await expect(byCode("provider")).rejects.toMatchObject({ code: "CLINICAL_REQUIRED" });
});
test.each(["provider", "client"] as const)("restricted/demo %s cannot use live invitation storage", async id => {
  records.demo_professional_grants.push({ id: "restricted", userId: id, state: "revoked" });
  await expect(byCode()).rejects.toMatchObject({ code: "INVITATION_DATASET_MISMATCH" });
  expect(records.client_links).toHaveLength(0);
});
test("synthetic identifiers cannot become live relationship parties", async () => {
  records.demo_professional_patients.push({ id: "client", classification: "synthetic" });
  await expect(byCode()).rejects.toMatchObject({ code: "INVITATION_DATASET_MISMATCH" });
});
test("login does not silently consume token invitations or choose between competing providers", async () => {
  expect((await autoAcceptPendingInvites("client", "client@example.invalid")).accepted).toBe(false);
  records.care_invite[0].urlToken = null;
  records.care_invite.push({ ...records.care_invite[0], id: "other-invitation" });
  expect((await autoAcceptPendingInvites("client", "client@example.invalid")).accepted).toBe(false);
  expect(records.care_invite.every(row => !row.accepted)).toBe(true);
});
