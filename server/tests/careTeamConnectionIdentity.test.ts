import express from "express";
import request from "supertest";
import { getTableColumns } from "drizzle-orm";
import { users } from "@shared/schema";
import { careInvite, careAccessCode, careTeamMember } from "../db/schema/careTeam";
import { studios, studioMemberships } from "../db/schema/studio";
import { clientLinks } from "../db/schema/procare";
import router from "../routes/careTeamRoutes";

// No database connection or external service is used by this suite.
type Row = Record<string, any>;
let mockActor: Row | null;
const mockRows = new Map<object, Row[]>();
const mockWrites: Array<{ table: object; values: Row; where?: any }> = [];
const mockBuildAccess = jest.fn();
const mockProviderAccess = jest.fn();
const mockLegal = jest.fn();
const mockActivate = jest.fn();
const mockValidateAttribution = jest.fn();
const mockReadiness = jest.fn();
const mockEmailCandidates = jest.fn();
const mockSendInvite = jest.fn();
const mockResolveAttribution = jest.fn();

jest.mock("nanoid", () => ({ nanoid: () => "unit-test-id" }));
jest.mock("drizzle-orm", () => ({
  ...jest.requireActual("drizzle-orm"),
  eq: (column: unknown, value: unknown) => ({ column, value }),
  and: (...conditions: unknown[]) => ({ conditions }),
  or: (...alternatives: unknown[]) => ({ alternatives }),
}));

function matches(table: object, row: Row, clause: any): boolean {
  if (!clause) return true;
  if (clause.conditions) return clause.conditions.every((part: any) => matches(table, row, part));
  if (clause.alternatives) return clause.alternatives.some((part: any) => matches(table, row, part));
  const key = Object.entries(getTableColumns(table as any)).find(([, column]) => column === clause.column)?.[0];
  if (!key) throw new Error("Unrecognized query column");
  return row[key] === clause.value;
}

function selectQuery() {
  let table: object;
  let clause: any;
  const query: any = {
    from(value: object) { table = value; return query; },
    where(value: any) { clause = value; return query; },
    limit() { return query; },
    for() { return query; },
    then(resolve: any, reject: any) {
      return Promise.resolve((mockRows.get(table) || []).filter(row => matches(table, row, clause))).then(resolve, reject);
    },
  };
  return query;
}

function writeQuery(table: object, kind: "insert" | "update" | "delete") {
  let values: Row = {};
  let clause: any;
  let result: Row[];
  const run = () => {
    if (result) return result;
    const rows = mockRows.get(table) || [];
    mockWrites.push({ table, values, where: clause });
    if (kind === "insert") {
      result = [{ id: `member-${rows.length}`, ...values }];
      mockRows.set(table, [...rows, ...result]);
    } else {
      result = rows.filter(row => matches(table, row, clause));
      if (kind === "update") result.forEach(row => Object.assign(row, values));
      else mockRows.set(table, rows.filter(row => !result.includes(row)));
    }
    return result;
  };
  const query: any = {
    values(value: Row) { values = value; return query; },
    set(value: Row) { values = value; return query; },
    where(value: any) { clause = value; return query; },
    returning() { return query; },
    then(resolve: any, reject: any) { return Promise.resolve(run()).then(resolve, reject); },
  };
  return query;
}

jest.mock("../db", () => ({
  db: {
    select: () => selectQuery(),
    insert: (table: object) => writeQuery(table, "insert"),
    update: (table: object) => writeQuery(table, "update"),
    delete: (table: object) => writeQuery(table, "delete"),
  },
}));
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockActor) return res.status(401).json({ error: "Authentication required" });
    req.authUser = mockActor;
    next();
  },
  buildAuthUserWithEffectiveAccess: (...args: unknown[]) => mockBuildAccess(...args),
}));
jest.mock("../middleware/requireEmailService", () => ({ requireEmailService: (_req: any, _res: any, next: any) => next() }));
jest.mock("../middleware/requireMfa", () => ({ requireMfa: (_req: any, _res: any, next: any) => next() }));
jest.mock("../services/emailService", () => ({
  sendCareTeamInvite: (...args: unknown[]) => mockSendInvite(...args),
}));
jest.mock("../services/procareProviderAccess", () => ({
  providerHasProCareStudioAccess: (...args: unknown[]) => mockProviderAccess(...args),
}));
jest.mock("../services/legalCheck", () => ({ checkLegalAcceptance: (...args: unknown[]) => mockLegal(...args) }));
jest.mock("../services/procareStudioReadiness", () => ({
  readOwnedBusinessStudio: async (id: string) => (mockRows.get(studios) || []).find(row => row.ownerUserId === id) ?? null,
  getProviderStudioReadiness: (...args: unknown[]) => mockReadiness(...args),
  isStudioProviderRole: (role: unknown) => ["trainer", "physician", "dietitian", "nurse_practitioner"].includes(role as string),
  ensureProviderStudioReady: (...args: unknown[]) => mockReadiness(...args),
}));
jest.mock("../services/procareActivation", () => ({
  activateProCareClient: (...args: unknown[]) => mockActivate(...args),
  deactivateProCareClient: jest.fn(),
  ActivationError: class extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));
jest.mock("../services/emailIdentityService", () => ({
  findEmailIdentityCandidates: (...args: unknown[]) => mockEmailCandidates(...args),
  normalizeEmailIdentity: (value: string) => value.trim().toLowerCase(),
  resolveEmailIdentityForUser: async () => ({
    status: "unique", candidates: [mockActor], user: mockActor,
  }),
}));
jest.mock("../services/bp1OrganizationAttributionService", () => ({
  resolveProviderStudioAttribution: (...args: unknown[]) => mockResolveAttribution(...args),
  validateBp1Attribution: (...args: unknown[]) => mockValidateAttribution(...args),
}));
jest.mock("../services/organizationWorkspaceService", () => ({
  WorkspaceContextError: class extends Error {},
  discoverAuthorizedWorkspaces: async () => [],
}));

const app = express();
app.use(express.json());
app.use("/api/care-team", router);
const permissions = { canViewMacros: true, canAddMeals: false, canEditPlan: false };
let client: Row;
let professional: Row;
let invitation: Row;

function arrange(direction: "client_invites" | "professional_invites") {
  invitation.userId = direction === "client_invites" ? client.id : professional.id;
  invitation.email = direction === "client_invites" ? professional.email : client.email;
  mockActor = direction === "client_invites" ? professional : client;
  mockRows.get(studios)![0].type = professional.professionalRole === "physician" ? "clinic" : "studio";
}
function connect(body: Row = { code: "TEST-CODE" }) {
  return request(app).post("/api/care-team/connect").send(body);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRows.clear();
  mockWrites.length = 0;
  client = { id: "client", email: "client@example.invalid", professionalRole: null, planLookupKey: "mpm_ultimate_monthly", accessTier: "PAID_FULL" };
  professional = { id: "professional", email: "provider@example.invalid", professionalRole: "physician", planLookupKey: "mpm_ultimate_monthly", accessTier: "PAID_FULL" };
  invitation = {
    id: "invite", userId: professional.id, email: client.email, inviteCode: "TEST-CODE",
    expiresAt: new Date(Date.now() + 60_000), accepted: false, role: "physician", permissions,
    organizationId: null, locationId: null, sourceBusinessId: null, partnerRecordId: null,
  };
  mockRows.set(users, [client, professional]);
  mockRows.set(careInvite, [invitation]);
  mockRows.set(careAccessCode, []);
  mockRows.set(careTeamMember, []);
  mockRows.set(studios, [{ id: "studio", name: "Test clinic", ownerUserId: professional.id, status: "active", type: "clinic", orgId: null }]);
  mockActor = client;
  mockBuildAccess.mockReset().mockImplementation(async user => ({ ...user }));
  mockProviderAccess.mockReset().mockResolvedValue(true);
  mockLegal.mockReset().mockResolvedValue({ allAccepted: true, missing: [] });
  mockValidateAttribution.mockReset().mockResolvedValue(undefined);
  // Stage 4 commits its locked invitation checks inside activation's transaction.
  // Invoke that callback rather than skipping it with a resolved-value mock.
  mockActivate.mockReset().mockImplementation(async (_client, _provider, _source, callback, scope) => {
    const activation = { studioId: "studio", studioName: "Test clinic", membershipId: "membership", clientLinkId: "link" };
    mockRows.set(studioMemberships, [{ id: "membership", studioId: "studio", clientUserId: client.id, status: "active", isArchived: false, ...(scope ?? {}) }]);
    mockRows.set(clientLinks, [{ id: "link", clientUserId: client.id, proUserId: professional.id, active: true, ...(scope ?? {}) }]);
    if (callback) await callback(jest.requireMock("../db").db, activation);
    return activation;
  });
  mockReadiness.mockReset().mockImplementation(async id => (await mockProviderAccess(mockRows.get(users)!.find(row => row.id === id)))
    ? { ok: true } : { ok: false, code: "COACH_NOT_SUBSCRIBED" });
  mockEmailCandidates.mockReset().mockResolvedValue([]);
  mockSendInvite.mockReset().mockResolvedValue(undefined);
  mockResolveAttribution.mockReset().mockImplementation(async (_id, _studio, scope) => scope
    ? { ...scope, sourceBusinessId: invitation.sourceBusinessId, partnerRecordId: invitation.partnerRecordId } : null);
});

test.each(["client_invites", "professional_invites"] as const)("%s: gates and creates the relationship using the actual identities", async direction => {
  arrange(direction);
  const res = await connect({ code: "TEST-CODE", clientUserId: "attacker", proUserId: "attacker" });
  expect(res.status).toBe(200);
  expect(mockProviderAccess).toHaveBeenCalledWith(expect.objectContaining({ id: professional.id, professionalRole: "physician" }));
  expect(mockLegal).toHaveBeenCalledWith(client.id, "patient_physician");
  expect(mockActivate).toHaveBeenCalledWith(client.id, professional.id, "invitation_care_invite", expect.any(Function), null);
  expect(res.body.member).toMatchObject({ userId: client.id, proUserId: professional.id, status: "active" });
  expect(invitation.accepted).toBe(true);
  // Activation is mocked; the invitation transaction itself must not rewrite
  // either participant's identity, and resolves effective access for the client.
  expect(mockWrites.some(write => write.table === users)).toBe(false);
  expect(professional.professionalRole).toBe("physician");
  expect(client.professionalRole).toBeNull();
  expect(mockBuildAccess).toHaveBeenCalledWith(client);
});

test("client-created pending placeholder becomes exactly one identity-bound active relationship", async () => {
  arrange("client_invites");
  mockRows.set(careTeamMember, [{ id: "pending-member", userId: client.id, email: professional.email, status: "pending", permissions }]);
  const res = await connect();
  expect(res.status).toBe(200);
  expect(res.body.member).toMatchObject({ userId: client.id, proUserId: professional.id, status: "active" });
  expect(mockRows.get(careTeamMember)).toHaveLength(1);
  // The canonical transaction replaces the pending UI placeholder. Preserve
  // the incoming regression's no-duplication/row-identity intent on its receipt.
  const memberId = res.body.member.id;
  expect(mockRows.get(careTeamMember)![0].id).toBe(memberId);
  expect((await connect()).body.member.id).toBe(memberId);
  expect(mockRows.get(careTeamMember)).toHaveLength(1);
});

test.each(["client_invites", "professional_invites"] as const)("%s: the professional's Clinical plan cannot substitute for client eligibility", async direction => {
  client.planLookupKey = "mpm_premium_monthly";
  arrange(direction);
  const res = await connect();
  expect(res.status).toBe(403);
  expect(res.body.code).toBe("CLINICAL_REQUIRED");
  expect(mockActivate).not.toHaveBeenCalled();
  expect(mockWrites).toHaveLength(0);
});

test("client-created invitation uses effective access instead of the client's raw personal plan", async () => {
  client.planLookupKey = "mpm_basic_monthly";
  mockBuildAccess.mockResolvedValueOnce({ ...client, planLookupKey: "mpm_ultimate_monthly", accessTier: "PAID_FULL" });
  arrange("client_invites");
  expect((await connect()).status).toBe(200);
  expect(mockActivate).toHaveBeenCalledWith(client.id, professional.id, "invitation_care_invite", expect.any(Function), null);
});

test.each(["client_invites", "professional_invites"] as const)("%s: provider subscription failures still block activation", async direction => {
  arrange(direction);
  mockProviderAccess.mockResolvedValueOnce(false);
  const res = await connect();
  expect(res.status).toBe(403);
  expect(res.body.error).toBe("COACH_NOT_SUBSCRIBED");
  expect(mockActivate).not.toHaveBeenCalled();
  expect(mockWrites).toHaveLength(0);
});

test.each(["client_invites", "professional_invites"] as const)("%s: missing client agreements check the client, not the actor", async direction => {
  arrange(direction);
  mockLegal.mockResolvedValueOnce({ allAccepted: false, missing: ["patient-agreement"] });
  const res = await connect();
  expect(res.status).toBe(409);
  expect(res.body).toMatchObject({ code: "LEGAL_REACCEPT_REQUIRED", flow: "patient_physician" });
  expect(mockLegal).toHaveBeenCalledWith(client.id, "patient_physician");
  expect(mockActivate).not.toHaveBeenCalled();
  expect(mockWrites).toHaveLength(0);
});

test("a Business account without an authorized Studio still returns UNSUPPORTED_PROVIDER_ROLE", async () => {
  professional.professionalRole = "business";
  arrange("client_invites");
  mockRows.set(studios, []);
  const res = await connect();
  expect(res.status).toBe(403);
  expect(res.body.code).toBe("UNSUPPORTED_PROVIDER_ROLE");
  expect(mockActivate).not.toHaveBeenCalled();
});

test("a Business Studio owner creates an explicitly provider-bound invitation and connects without changing identity", async () => {
  professional.professionalRole = "business";
  arrange("professional_invites");
  mockActor = professional;
  mockEmailCandidates.mockResolvedValue([client]);
  const identities = JSON.stringify(mockRows.get(users));
  const sent = await request(app).post("/api/care-team/invite").send({ email: client.email, role: "trainer", permissions });
  expect(sent.status).toBe(200);
  const created = mockWrites.find(write => write.table === careInvite)!.values;
  expect(created).toMatchObject({ providerUserId: professional.id, clientUserId: client.id, role: "studio_operator" });
  expect(mockWrites.filter(write => write.table === careTeamMember)).toHaveLength(0);
  mockActor = client;
  const accepted = await connect({ code: created.inviteCode });
  expect(accepted.status).toBe(200);
  expect(accepted.body.member).toMatchObject({ userId: client.id, proUserId: professional.id, role: "studio_operator" });
  expect(JSON.stringify(mockRows.get(users))).toBe(identities);
  const again = await connect({ code: created.inviteCode });
  expect(again.status).toBe(200);
  expect(JSON.stringify(mockRows.get(users))).toBe(identities);
  expect(mockWrites.some(write => write.table === users || write.table === studios)).toBe(false);
});

test("a malformed Business Studio invitation requires reissue and never reverses or activates its parties", async () => {
  professional.professionalRole = "business";
  arrange("professional_invites");
  invitation.clientUserId = professional.id;
  invitation.providerUserId = null;
  const identities = JSON.stringify(mockRows.get(users));
  const response = await connect();
  expect(response.status).toBe(409);
  expect(response.body).toMatchObject({ code: "INVITATION_REISSUE_REQUIRED", reissueRequired: true });
  expect(mockActivate).not.toHaveBeenCalled();
  expect(mockWrites).toHaveLength(0);
  expect(JSON.stringify(mockRows.get(users))).toBe(identities);
});

test("a business-only caller can invite a provider as a client but gains no provider privileges", async () => {
  client.professionalRole = "business";
  mockActor = client;
  mockEmailCandidates.mockResolvedValue([professional]);
  const sent = await request(app).post("/api/care-team/invite").send({ email: professional.email, role: "physician", permissions });
  expect(sent.status).toBe(200);
  const created = mockWrites.find(write => write.table === careInvite)!.values;
  expect(created).toMatchObject({ clientUserId: client.id, providerUserId: professional.id, role: "physician" });
  mockActor = professional;
  expect((await connect({ code: created.inviteCode })).status).toBe(200);
  expect(client.professionalRole).toBe("business");
});

test("a reusable provider code applies the same authorized nonclinical Business Studio context", async () => {
  professional.professionalRole = "business";
  arrange("professional_invites");
  mockRows.set(careInvite, []);
  mockRows.set(careAccessCode, [{
    id: "access-fixture", proUserId: professional.id, code: "TEST-CODE",
    expiresAt: new Date(Date.now() + 60_000),
  }]);
  const response = await connect();
  expect(response.status).toBe(200);
  expect(response.body.member).toMatchObject({ userId: client.id, proUserId: professional.id, role: "studio_operator" });
  expect(professional.professionalRole).toBe("business");
});

test.each(["client_invites", "professional_invites"] as const)("%s: expired invitations do not activate or write anything", async direction => {
  arrange(direction);
  invitation.expiresAt = new Date(Date.now() - 60_000);
  const result = await connect();
  expect(result.status).toBe(410);
  expect(result.body.code).toBe("EXPIRED");
  expect(mockActivate).not.toHaveBeenCalled();
  expect(mockWrites).toHaveLength(0);
});

test.each(["client_invites", "professional_invites"] as const)("%s: a forwarded invitation cannot be accepted by a different account", async direction => {
  arrange(direction);
  mockActor = { ...mockActor, email: "other@example.invalid" };
  expect((await connect()).status).toBe(403);
  expect(mockBuildAccess).not.toHaveBeenCalled();
  expect(mockActivate).not.toHaveBeenCalled();
  expect(mockWrites).toHaveLength(0);
});

test("accepting the same invitation stays bound to the exact existing relationship", async () => {
  arrange("client_invites");
  expect((await connect()).status).toBe(200);
  expect((await connect()).status).toBe(200);
  expect(mockRows.get(careTeamMember)).toHaveLength(1);
  expect(mockActivate.mock.calls.every(call => call[0] === client.id && call[1] === professional.id)).toBe(true);
});

test.each(["client_invites", "professional_invites"] as const)("%s: organization attribution is validated and passed through unchanged", async direction => {
  arrange(direction);
  invitation.organizationId = "organization";
  invitation.locationId = "location";
  invitation.sourceBusinessId = "business";
  invitation.partnerRecordId = "partner";
  expect((await connect()).status).toBe(200);
  const attribution = { organizationId: "organization", locationId: "location", sourceBusinessId: "business", partnerRecordId: "partner" };
  expect(mockValidateAttribution).toHaveBeenCalledWith(attribution);
  expect(mockActivate).toHaveBeenCalledWith(client.id, professional.id, "invitation_care_invite", expect.any(Function), attribution);
});

test("access-code acceptance keeps its established client/professional direction", async () => {
  mockRows.set(careInvite, []);
  mockRows.set(careAccessCode, [{ code: "TEST-CODE", proUserId: professional.id, expiresAt: new Date(Date.now() + 60_000) }]);
  expect((await connect()).status).toBe(200);
  expect(mockActivate).toHaveBeenCalledWith(client.id, professional.id, "care_team_access_code");
  expect(mockLegal).toHaveBeenCalledWith(client.id, "patient_physician");
  expect(mockBuildAccess).not.toHaveBeenCalled();
});

test("invalid codes fail before access checks and activation", async () => {
  expect((await connect({ code: "UNKNOWN" })).status).toBe(400);
  expect(mockProviderAccess).not.toHaveBeenCalled();
  expect(mockActivate).not.toHaveBeenCalled();
});

test("unauthenticated acceptance is still rejected", async () => {
  mockActor = null;
  expect((await connect()).status).toBe(401);
  expect(mockActivate).not.toHaveBeenCalled();
});

function sendInvitation(role: unknown = "doctor") {
  return request(app).post("/api/care-team/invite").send({
    email: "recipient@example.invalid", role, permissions,
  });
}

test.each(["physician", "trainer", "dietitian", "nurse_practitioner"])(
  "%s sends provider invitations using persisted identity, not the selected UI category or stale actor state",
  async role => {
    professional.professionalRole = role;
    mockActor = { ...professional, professionalRole: "physician" };
    const before = { ...professional };
    const response = await sendInvitation(role === "physician" ? "trainer" : "doctor");
    expect(response.status).toBe(200);
    expect(mockReadiness).toHaveBeenCalledWith(professional.id);
    expect(mockSendInvite).toHaveBeenCalledWith(expect.objectContaining({ role }));
    expect(mockRows.get(careInvite)!.at(-1)).toMatchObject({ userId: professional.id, role });
    expect(response.body.member.role).toBe(role);
    expect(professional).toEqual(before);
    expect(mockActivate).not.toHaveBeenCalled();
    expect(mockRows.get(careTeamMember)).toHaveLength(0);
  },
);

test("provider readiness denial still prevents sending or persisting an invitation", async () => {
  mockActor = professional;
  mockReadiness.mockResolvedValueOnce({ ok: false, code: "PHASE1_CERT_REQUIRED", message: "Certification required" });
  const response = await sendInvitation();
  expect(response.status).toBe(403);
  expect(response.body.code).toBe("PHASE1_CERT_REQUIRED");
  expect(mockWrites).toHaveLength(0);
  expect(mockSendInvite).not.toHaveBeenCalled();
});

test.each(["doctor", "coach", "nutritionist", "np", "rn", "pa", "medical"])(
  "stored legacy %s cannot gain provider authority by selecting a canonical category",
  async legacyRole => {
    professional.professionalRole = legacyRole;
    mockActor = professional;
    const response = await sendInvitation("physician");
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("PROFESSIONAL_ROLE_REVIEW_REQUIRED");
    expect(mockReadiness).not.toHaveBeenCalled();
    expect(mockWrites).toHaveLength(0);
    expect(mockSendInvite).not.toHaveBeenCalled();
    expect(professional.professionalRole).toBe(legacyRole);
  },
);

test.each([null, "business"])(
  "client/Business identity %s can request doctor without acquiring physician identity or authorization",
  async role => {
    client.professionalRole = role;
    mockActor = client;
    const response = await sendInvitation("doctor");
    expect(response.status).toBe(200);
    expect(mockRows.get(careInvite)!.at(-1)).toMatchObject({ userId: client.id, role: "physician" });
    expect(response.body.member.role).toBe("physician");
    expect(client.professionalRole).toBe(role);
    expect(mockReadiness).not.toHaveBeenCalled();
    expect(mockActivate).not.toHaveBeenCalled();
  },
);

test.each(["rn", "pa", "medical", "coach", "nutritionist", "business"])(
  "unsupported client-requested %s is rejected rather than granting a recipient occupation",
  async requestedRole => {
    mockActor = client;
    const response = await sendInvitation(requestedRole);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("UNSUPPORTED_REQUESTED_PROVIDER_ROLE");
    expect(mockWrites).toHaveLength(0);
    expect(mockSendInvite).not.toHaveBeenCalled();
  },
);

test("a client-requested physician category does not authorize a Business-only recipient at connect", async () => {
  arrange("client_invites");
  invitation.role = "physician";
  professional.professionalRole = "business";
  const response = await connect();
  expect(response.status).toBe(403);
  expect(response.body.code).toBe("UNSUPPORTED_PROVIDER_ROLE");
  expect(mockActivate).not.toHaveBeenCalled();
  expect(mockWrites).toHaveLength(0);
});

test("a legacy inviter identity requires review rather than silently reversing invitation direction", async () => {
  arrange("professional_invites");
  professional.professionalRole = "doctor";
  const response = await connect();
  expect(response.status).toBe(409);
  expect(response.body.code).toBe("PROFESSIONAL_ROLE_REVIEW_REQUIRED");
  expect(mockActivate).not.toHaveBeenCalled();
  expect(mockWrites).toHaveLength(0);
});

test("a requested physician category never changes a trainer recipient's identity, legal flow, or active card label", async () => {
  arrange("client_invites");
  invitation.role = "physician";
  professional.professionalRole = "trainer";
  mockRows.get(studios)![0].type = "studio";
  client.planLookupKey = "mpm_premium_monthly";
  mockRows.set(careTeamMember, [{
    id: "pending-member", userId: client.id, email: professional.email,
    role: "physician", status: "pending", permissions,
  }]);
  const response = await connect();
  expect(response.status).toBe(200);
  expect(response.body.member.role).toBe("trainer");
  expect(professional.professionalRole).toBe("trainer");
  expect(mockLegal).toHaveBeenCalledWith(client.id, "client");
  expect(mockProviderAccess).toHaveBeenCalledWith(expect.objectContaining({ professionalRole: "trainer" }));
});

test("legacy invitation metadata cannot replace the verified provider's active relationship label", async () => {
  arrange("professional_invites");
  invitation.role = "rn";
  const response = await connect();
  expect(response.status).toBe(200);
  expect(response.body.member.role).toBe("physician");
  expect(professional.professionalRole).toBe("physician");
  expect(mockLegal).toHaveBeenCalledWith(client.id, "patient_physician");
});
