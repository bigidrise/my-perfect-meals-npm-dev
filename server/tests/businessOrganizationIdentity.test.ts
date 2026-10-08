/**
 * Execute the actual create-org handler against an in-memory database only.
 * Organization authority must not replace a persisted practitioner identity.
 */
import express from "express";
import request from "supertest";
import { getTableColumns, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { users } from "@shared/schema";
import { businesses, businessMembers, businessInvitations } from "../db/schema/business";
import { organizationLocations, organizationMemberships, locationMemberships } from "../db/schema/workspaces";
import { buildWorkspaceAvailability } from "../services/workspaceAvailabilityService";
import businessRouter from "../routes/businessRoutes";

type Row = Record<string, any>;
type Branch = "explicit-new" | "initial-new" | "existing-owner";
const mockRows = new Map<object, Row[]>();
const mockWrites: Array<{ table: object; values: Row; matches: number }> = [];
const mockWorkspace = jest.fn();
const mockProviderActivation = jest.fn();
let mockActor: Row | null;
let mockCollision = false;
let account: Row;

jest.mock("drizzle-orm", () => ({
  ...jest.requireActual("drizzle-orm"),
  eq: (column: unknown, value: unknown) => ({ kind: "eq", column, value }),
  ne: (column: unknown, value: unknown) => ({ kind: "ne", column, value }),
  isNull: (column: unknown) => ({ kind: "null", column }),
  and: (...conditions: unknown[]) => ({ kind: "and", conditions }),
  or: (...conditions: unknown[]) => ({ kind: "or", conditions }),
}));

function matches(table: object, row: Row, clause: any): boolean {
  if (!clause) return true;
  if (clause.kind === "and") return clause.conditions.every((part: any) => matches(table, row, part));
  if (clause.kind === "or") return clause.conditions.some((part: any) => matches(table, row, part));
  const key = Object.entries(getTableColumns(table as any)).find(([, column]) => column === clause.column)?.[0];
  if (!key) throw new Error("Unrecognized query column");
  if (clause.kind === "null") return row[key] == null;
  let value = clause.value;
  if (value instanceof SQL) {
    // The schema's role union excludes legacy empty strings. The handler
    // compares that historical value using a typed SQL literal instead.
    if (new PgDialect().sqlToQuery(value).sql !== "''") throw new Error("Unexpected SQL comparison");
    value = "";
  }
  return clause.kind === "ne" ? row[key] !== value : row[key] === value;
}

function selectQuery() {
  let table: object;
  let clause: any;
  const query: any = {
    from(value: object) { table = value; return query; },
    where(value: any) { clause = value; return query; },
    limit() { return query; },
    then(resolve: any, reject: any) {
      return Promise.resolve((mockRows.get(table) || []).filter(row => matches(table, row, clause))).then(resolve, reject);
    },
  };
  return query;
}

function writeQuery(table: object, kind: "insert" | "update") {
  let values: Row;
  let clause: any;
  let result: Row[] | undefined;
  const run = () => {
    if (result) return result;
    const rows = mockRows.get(table) || [];
    if (kind === "insert") {
      if (table === businesses && mockCollision) {
        mockCollision = false;
        mockRows.set(table, [existingBusiness()]);
        throw Object.assign(new Error("unique owner conflict"), { code: "23505" });
      }
      result = [{ id: `fixture-${rows.length}`, ...values }];
      mockRows.set(table, [...rows, ...result]);
    } else {
      result = rows.filter(row => matches(table, row, clause));
      result.forEach(row => Object.assign(row, values));
    }
    mockWrites.push({ table, values, matches: result.length });
    return result;
  };
  const query: any = {
    values(value: Row) { values = value; return query; },
    set(value: Row) { values = value; return query; },
    where(value: any) { clause = value; return query; },
    returning() { return query; },
    onConflictDoUpdate() { return query; },
    then(resolve: any, reject: any) {
      // Promise boundary preserves database-style rejection semantics.
      return Promise.resolve().then(run).then(resolve, reject);
    },
  };
  return query;
}

jest.mock("../db", () => {
  const db: any = {
    select: () => selectQuery(),
    insert: (table: object) => writeQuery(table, "insert"),
    update: (table: object) => writeQuery(table, "update"),
    execute: jest.fn(async (statement: SQL) => {
      const query = new PgDialect().sqlToQuery(statement);
      if (/UPDATE users SET professional_role = 'business'/i.test(query.sql)) {
        const target = (mockRows.get(users) || []).find(row => row.id === query.params[0]);
        const guarded = query.sql.includes("professional_role IS NULL OR professional_role = ''");
        const eligible = target && (!guarded || target.professionalRole == null || target.professionalRole === "");
        if (eligible) target.professionalRole = "business";
        mockWrites.push({ table: users, values: { professionalRole: "business" }, matches: eligible ? 1 : 0 });
      }
      return { rows: [] };
    }),
  };
  db.transaction = (callback: any) => callback(db);
  return { db };
});
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockActor) return res.status(401).json({ error: "Authentication required" });
    req.authUser = mockActor;
    next();
  },
}));
jest.mock("../middleware/requireProAccess", () => ({ requireProAccess: (_req: any, _res: any, next: any) => next() }));
jest.mock("../middleware/requireProOrOrgAdmin", () => ({ requireProOrOrgAdmin: (_req: any, _res: any, next: any) => next() }));
jest.mock("../middleware/requireAdmin", () => ({ requireAdmin: (_req: any, _res: any, next: any) => next() }));
jest.mock("../services/organizationWorkspaceService", () => ({
  ensureCanonicalWorkspaceForBusiness: (...args: unknown[]) => mockWorkspace(...args),
  resolveActiveWorkspace: jest.fn(),
  WorkspaceContextError: class extends Error {},
}));
jest.mock("../routes/organizationWorkspaceRoutes", () => ({
  __esModule: true, default: require("express").Router(),
}));
jest.mock("../services/businessPilotAuthorizationService", () => ({
  BusinessPilotAuthorizationError: class extends Error {},
  findClaimedBusinessPilotAuthorizationForUser: jest.fn().mockResolvedValue(null),
}));
jest.mock("../services/organizationalPilotAuthorizationService", () => ({
  PilotAuthorizationError: class extends Error {},
}));
jest.mock("../services/organizationalPilotInvitationService", () => ({
  PilotInvitationError: class extends Error {},
  findOrganizationalPilotInvitation: jest.fn().mockResolvedValue(null),
}));
jest.mock("../services/emailService", () => ({ sendBusinessInviteEmail: jest.fn() }));
jest.mock("../services/emailIdentityService", () => ({
  normalizeEmailIdentity: (email: string) => email.trim().toLowerCase(),
  resolveEmailIdentityForUser: async (id: string) => {
    const user = (mockRows.get(users) || []).find(row => row.id === id);
    return { status: user ? "unique" : "missing", user, candidates: user ? [user] : [] };
  },
}));
jest.mock("../services/organizationInvitationBatchService", () => ({ MAX_ORGANIZATION_INVITATION_BATCH: 100 }));
jest.mock("../services/bp1OrganizationAttributionService", () => ({}));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn(), getClientIp: jest.fn() }));
jest.mock("../lib/orgContext", () => ({ loadOrgContext: jest.fn() }));
jest.mock("../services/stripeRuntimePolicy", () => ({ assertStripeBillingOwnership: jest.fn() }));
jest.mock("../services/procareActivation", () => ({
  activateProCareClient: (...args: unknown[]) => mockProviderActivation(...args),
  ActivationError: class extends Error {},
}));
jest.mock("../services/businessPilotGuidanceService", () => ({ WEEKS: [] }));
jest.mock("../services/businessPilotDeliveryService", () => ({}));
jest.mock("stripe", () => ({ __esModule: true, default: jest.fn() }));

const app = express();
app.use(express.json());
app.use("/api/business", businessRouter);

function existingBusiness(overrides: Row = {}): Row {
  return {
    id: "existing-business", ownerUserId: "owner", name: "Test Organization",
    status: "active", commercialAccessMode: "onboarding_pilot",
    commercialAccessStartedAt: new Date("2026-10-01T00:00:00Z"),
    commercialAccessEndsAt: new Date("2026-10-31T00:00:00Z"),
    stripeSubscriptionId: null, ...overrides,
  };
}

function arrange(branch: Branch, professionalRole: string | null) {
  account.professionalRole = professionalRole;
  // Deliberately stale caller snapshot: persistence, not caller role, is authoritative.
  mockActor = { id: account.id, professionalRole: null };
  if (branch === "existing-owner") mockRows.set(businesses, [existingBusiness()]);
}

function createOrganization(branch: Branch, extra: Row = {}) {
  return request(app).post("/api/business/create-org").send({
    name: "Test Organization",
    ...(branch === "explicit-new" ? { creationIntent: "create-new", creationRequestId: "request-one" } : {}),
    ...extra,
  });
}

function expectOwnerAuthority() {
  expect(mockRows.get(businessMembers)).toEqual([
    expect.objectContaining({ businessId: expect.any(String), userId: account.id, role: "owner", status: "active" }),
  ]);
  expect(mockWorkspace).toHaveBeenCalledWith(mockRows.get(businesses)![0].id);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRows.clear();
  mockWrites.length = 0;
  mockCollision = false;
  account = {
    id: "owner", role: "coach", professionalRole: null,
    isProCare: true, procareTrainingCompleted: true, authSecurityVersion: 7,
    planLookupKey: "original-personal-plan", entitlements: ["original-entitlement"],
    credentialEvidence: "unchanged", trainingEvidence: "unchanged",
    legalAcceptance: "unchanged", studioVerification: "unchanged",
    relationshipEvidence: "unchanged", consentEvidence: "unchanged",
  };
  mockRows.set(users, [account, { id: "unrelated-account", professionalRole: "physician" }]);
  mockRows.set(businesses, []);
  mockRows.set(businessMembers, []);
  mockActor = { id: account.id };
  mockWorkspace.mockResolvedValue({ organizationId: "organization", locationId: "location" });
});

const branches: Branch[] = ["explicit-new", "initial-new", "existing-owner"];
const practitionerCases = branches.flatMap(branch =>
  ["physician", "trainer", "dietitian", "nurse_practitioner"].map(role => [branch, role] as const),
);

test.each(practitionerCases)("%s preserves established %s identity and owner authority", async (branch, role) => {
  arrange(branch, role);
  const before = structuredClone(account);
  const response = await createOrganization(branch);
  expect(response.status).toBe(branch === "explicit-new" ? 201 : 200);
  expect(account).toEqual(before);
  expectOwnerAuthority();
  expect(mockRows.get(users)![1]).toEqual({ id: "unrelated-account", professionalRole: "physician" });
  expect(mockWrites.filter(write => write.table === users)).toEqual([
    { table: users, values: { professionalRole: "business" }, matches: 0 },
  ]);
  expect(mockProviderActivation).not.toHaveBeenCalled();
  expectAuthorizedWorkspaceChoices(role);
});

function expectAuthorizedWorkspaceChoices(role: string) {
  // Readiness/entitlement are pre-existing fixture evidence, not privileges
  // granted by organization ownership. The real resolver is unchanged.
  const organizations = [{
    id: "organization", name: "Fixture Organization", role: "owner", relationshipType: "internal_staff",
    locations: [{ id: "location", name: "Fixture Location", role: "owner", isDefault: true }],
  }];
  const choices = buildWorkspaceAvailability({
    onboardingCompletedAt: "2026-10-01", professionalRole: account.professionalRole,
    organizations, studioEntitled: true, existingStudioStatus: "active", studioReady: true,
  });
  expect(choices).toMatchObject({
    personal: { available: true, destination: "/dashboard" },
    organization: { available: true, destination: "/business-dashboard" },
    studio: { available: true, destination: role === "physician" ? "/pro/physician-clients" : "/pro/clients", readiness: "ready" },
  });
  const before = structuredClone(account);
  for (const studioReady of [false, true]) {
    const unavailable = buildWorkspaceAvailability({
      onboardingCompletedAt: "2026-10-01", professionalRole: account.professionalRole,
      organizations, studioEntitled: false, existingStudioStatus: "active", studioReady,
    });
    expect(unavailable.studio.available).toBe(false);
    expect(unavailable.organization.available).toBe(true);
    expect(unavailable.personal.available).toBe(true);
  }
  const notReady = buildWorkspaceAvailability({
    onboardingCompletedAt: "2026-10-01", professionalRole: account.professionalRole,
    organizations, studioEntitled: true, existingStudioStatus: "active", studioReady: false,
  });
  expect(notReady.studio.available).toBe(false);
  expect(account).toEqual(before);
}

test.each(["physician", "trainer", "dietitian", "nurse_practitioner"].flatMap(role =>
  ["/api/business/invite/accept", "/api/business/invite/fixture-token/accept"].map(path => [role, path] as const),
))("%s joining through %s preserves identity, qualifications and authorized Studio choices", async (role, path) => {
  account.professionalRole = role;
  account.email = "member@example.invalid";
  mockActor = { id: account.id, email: account.email, professionalRole: null };
  mockRows.set(businesses, [existingBusiness({
    ownerUserId: "another-owner", organizationId: "organization", plan: "clinical_business_monthly", seatLimit: 5,
  })]);
  mockRows.set(businessInvitations, [{
    id: "fixture-invitation", token: "fixture-token", email: account.email,
    businessId: "existing-business", sourceBusinessId: "existing-business",
    organizationId: "organization", locationId: "location", role: "admin",
    relationshipType: "internal_staff", status: "pending", invitationType: "team_member",
    expiresAt: new Date(Date.now() + 86400000),
  }]);
  mockRows.set(organizationLocations, [{ id: "location", organizationId: "organization", status: "active" }]);
  mockRows.set(organizationMemberships, []);
  mockRows.set(locationMemberships, []);
  const before = structuredClone(account);
  const response = await request(app).post(path).send({ token: "fixture-token" });
  expect(response.status).toBe(200);
  expect(account).toEqual(before);
  expect(mockRows.get(businessMembers)).toEqual([expect.objectContaining({
    businessId: "existing-business", userId: account.id, role: "admin", status: "active",
  })]);
  expect(mockRows.get(businessInvitations)![0].status).toBe("accepted");
  expect(mockProviderActivation).not.toHaveBeenCalled();
  expectAuthorizedWorkspaceChoices(role);
});

test.each(branches)("%s preserves a legitimate Business-only owner without granting practitioner identity", async branch => {
  arrange(branch, "business");
  account.role = "client";
  account.isProCare = false;
  account.procareTrainingCompleted = false;
  const before = structuredClone(account);
  const response = await createOrganization(branch);
  expect(response.status).toBe(branch === "explicit-new" ? 201 : 200);
  expect(account).toEqual(before);
  expectOwnerAuthority();
  expect(mockProviderActivation).not.toHaveBeenCalled();
});

test.each(branches.flatMap(branch => [null, ""].map(role => [branch, role] as const)))(
  "%s initializes only missing Business identity (%s); request input cannot grant a clinical role",
  async (branch, role) => {
    arrange(branch, role);
    account.role = "client";
    account.isProCare = false;
    account.procareTrainingCompleted = false;
    const before = structuredClone(account);
    const response = await createOrganization(branch, { professionalRole: "physician", role: "admin", isProCare: true });
    expect(response.status).toBe(branch === "explicit-new" ? 201 : 200);
    expect(account).toEqual({ ...before, professionalRole: "business" });
    expectOwnerAuthority();
    expect(mockProviderActivation).not.toHaveBeenCalled();
    expect(mockWrites.every(write => [businesses, businessMembers, users].includes(write.table as any))).toBe(true);
  },
);

test.each(branches)("%s leaves legacy/unknown identity untouched rather than normalizing or repairing it", async branch => {
  arrange(branch, "doctor");
  const before = structuredClone(account);
  expect((await createOrganization(branch)).status).toBe(branch === "explicit-new" ? 201 : 200);
  expect(account).toEqual(before);
});

test("existing owner membership is reused without duplication or rewriting its authority", async () => {
  arrange("existing-owner", "physician");
  const membership = { id: "owner-membership", businessId: "existing-business", userId: account.id, role: "owner", status: "active" };
  mockRows.set(businessMembers, [membership]);
  expect((await createOrganization("existing-owner")).status).toBe(200);
  expect(mockRows.get(businessMembers)).toEqual([membership]);
  expect(account.professionalRole).toBe("physician");
});

test("pending existing organization activation and rename preserve practitioner identity", async () => {
  arrange("existing-owner", "trainer");
  mockRows.set(businesses, [existingBusiness({ status: "pending_billing", name: "Old Name", commercialAccessMode: null })]);
  expect((await createOrganization("existing-owner")).status).toBe(200);
  expect(account.professionalRole).toBe("trainer");
  expect(mockRows.get(businesses)![0]).toMatchObject({ name: "Test Organization", status: "active", commercialAccessMode: "onboarding_pilot" });
  expectOwnerAuthority();
});

test("paid existing organization keeps commercial history as well as practitioner identity", async () => {
  arrange("existing-owner", "physician");
  const business = existingBusiness({ commercialAccessMode: "paid", stripeSubscriptionId: "existing-subscription" });
  mockRows.set(businesses, [business]);
  const before = structuredClone(business);
  expect((await createOrganization("existing-owner")).status).toBe(200);
  expect(business).toEqual(before);
  expect(account.professionalRole).toBe("physician");
});

test.each([true, false])("explicit creation replay keeps practitioner identity (pending activation: %s)", async pending => {
  arrange("explicit-new", "dietitian");
  mockRows.set(businesses, [existingBusiness({
    creationRequestId: "request-one",
    ...(pending ? { status: "pending_billing", commercialAccessMode: null } : {}),
  })]);
  const response = await createOrganization("explicit-new");
  expect(response.status).toBe(200);
  expect(response.body.created).toBe(false);
  expect(account.professionalRole).toBe("dietitian");
  expect(mockWrites.filter(write => write.table === users || write.table === businessMembers)).toHaveLength(0);
  expect(mockWorkspace).toHaveBeenCalledWith("existing-business");
});

test("creation request owned by another account still fails before writing identity or authority", async () => {
  arrange("explicit-new", "nurse_practitioner");
  mockRows.set(businesses, [existingBusiness({ creationRequestId: "request-one", ownerUserId: "another-owner" })]);
  expect((await createOrganization("explicit-new")).status).toBe(500);
  expect(mockWrites).toHaveLength(0);
  expect(mockWorkspace).not.toHaveBeenCalled();
  expect(account.professionalRole).toBe("nurse_practitioner");
});

test("initial-setup unique-conflict recovery returns the existing organization without changing identity", async () => {
  arrange("initial-new", "physician");
  mockCollision = true;
  const response = await createOrganization("initial-new");
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ businessId: "existing-business", created: false });
  expect(account.professionalRole).toBe("physician");
  expect(mockWrites.filter(write => write.table === users)).toHaveLength(0);
});

test("replaying a successful explicit request does not create a second organization or owner membership", async () => {
  arrange("explicit-new", "physician");
  expect((await createOrganization("explicit-new")).status).toBe(201);
  expect((await createOrganization("explicit-new")).status).toBe(200);
  expect(account.professionalRole).toBe("physician");
  expect(mockRows.get(businesses)).toHaveLength(1);
  expectOwnerAuthority();
});

test("authentication and request validation still block organization creation", async () => {
  mockActor = null;
  expect((await createOrganization("initial-new")).status).toBe(401);
  mockActor = { id: account.id };
  expect((await createOrganization("initial-new", { name: "x" })).status).toBe(400);
  expect((await createOrganization("explicit-new", { creationRequestId: "" })).status).toBe(400);
  expect(mockWrites).toHaveLength(0);
});
