import { buildDevelopmentWorkspaceMetadata, canDiscoverDevelopmentWorkspaces } from "../services/developmentWorkspaceDiscovery";
import { DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO as authority } from "../config/developmentFounderPhysicianDemo";
import { createDemoDataBoundary } from "../middleware/demoDataBoundary";
import { canEnterStudio } from "@shared/studioAccess";

const grant: any = {
  id: authority.grantId, userId: authority.userId, workspaceId: authority.workspaceId,
  clinicId: authority.clinicId, authority: "development_founder",
  state: "active", persona: "physician", operatingStatus: "demo_only",
  lifetime: "permanent_founder", expiresAt: null, approverId: "fixture-approver",
  trainingBasis: "demo_only_waiver", trainingWaiverReason: "Isolated fixture authorization",
};
const snapshot = {
  userId: authority.userId, onboardingCompletedAt: "2026-01-01",
  professionalRole: "business",
  studio: { id: authority.clinicId, ownerUserId: authority.userId, name: "Existing fixture Clinic", type: "clinic", status: "active" },
  organizations: [{ id: "own-org", name: "Existing Business Organization", role: "owner",
    relationshipType: "internal_staff", locations: [{ id: "own-location", name: "Own Location", role: "owner", isDefault: true }] }],
};
const oldEnvironment = process.env.NODE_ENV;
const oldDeployment = process.env.REPLIT_DEPLOYMENT;
beforeEach(() => { process.env.NODE_ENV = "development"; delete process.env.REPLIT_DEPLOYMENT; });
afterAll(() => {
  if (oldEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnvironment;
  if (oldDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT; else process.env.REPLIT_DEPLOYMENT = oldDeployment;
});

test("recognizes original Clinic and Business/Organization without granting clinical access or changing the snapshot", () => {
  const before = JSON.stringify(snapshot);
  const { availability, studioAccess } = buildDevelopmentWorkspaceMetadata(snapshot);
  expect(availability.personal.destination).toBe("/dashboard");
  expect(availability.organization).toMatchObject({ available: true, organizations: snapshot.organizations });
  expect(availability.studio).toMatchObject({ available: true, destination: "/pro-portal", kind: "clinic", operatingContext: null });
  expect(studioAccess).toMatchObject({ authorized: false, studioReady: false, state: "needs_review",
    restriction: { code: "PHYSICIAN_AUTHORITY_UNVERIFIED" } });
  expect(canEnterStudio(studioAccess)).toBe(false);
  expect(JSON.stringify(snapshot)).toBe(before);
});
test("even a Physician identity does not remove the live-data restriction", () => {
  const result = buildDevelopmentWorkspaceMetadata({ ...snapshot, professionalRole: "physician" });
  expect(result.studioAccess.restriction?.code).toBe("DEVELOPMENT_DEMO_RESTRICTED");
  expect(canEnterStudio(result.studioAccess)).toBe(false);
});
test.each([
  { userId: "another-owner" },
  { studio: { ...snapshot.studio, ownerUserId: "another-owner" } },
  { studio: { ...snapshot.studio, id: "replacement-clinic" } },
  { studio: { ...snapshot.studio, status: "disconnected" } },
  { studio: { ...snapshot.studio, type: "studio" } },
])("fails closed for mismatched ownership/status: %p", patch => {
  expect(() => buildDevelopmentWorkspaceMetadata({ ...snapshot, ...patch })).toThrow();
});
test("only the exact current founder authority may discover metadata", () => {
  expect(canDiscoverDevelopmentWorkspaces(authority.userId, grant)).toBe(true);
});
test("the established local grant needs no rewrite to add a clinicId claim", () => {
  const existingFormat = { ...grant };
  delete existingFormat.clinicId;
  expect(canDiscoverDevelopmentWorkspaces(authority.userId, existingFormat)).toBe(true);
});
test.each([
  { state: "prepared" }, { state: "revoked" }, { state: "expired" },
  { userId: "another-user" }, { id: "another-grant" }, { clinicId: "another-clinic" },
  { workspaceId: "another-workspace" }, { authority: "organization" }, { persona: "trainer" },
  { expiresAt: "2020-01-01T00:00:00Z" },
])("rejects changed authority: %p", patch => {
  expect(canDiscoverDevelopmentWorkspaces(authority.userId, { ...grant, ...patch })).toBe(false);
});
test.each([["production", undefined], ["development", "1"], ["development", "true"]])(
  "never enables discovery in %s deployed=%s", (environment, deployment) => {
    process.env.NODE_ENV = environment;
    if (deployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = deployment;
    expect(canDiscoverDevelopmentWorkspaces(authority.userId, grant)).toBe(false);
  },
);

async function request(path: string, method = "GET", candidate = grant) {
  const next = jest.fn();
  const res: any = { set: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const metadata = jest.fn(async (_req, actor, restriction) => {
    if (!canDiscoverDevelopmentWorkspaces(actor.id, restriction)) return null;
    const result = buildDevelopmentWorkspaceMetadata(snapshot);
    return path.split("?")[0].endsWith("/availability")
      ? { availability: result.availability } : { studioAccess: result.studioAccess };
  });
  const boundary = createDemoDataBoundary({
    actor: async () => ({ id: authority.userId } as any),
    restriction: async () => candidate,
    developmentWorkspaceMetadata: metadata,
  });
  await boundary({ method, originalUrl: path } as any, res, next);
  return { res, next, metadata };
}
test.each(["availability", "studio-access"])("serves only authenticated own %s metadata without calling normal application handlers", async suffix => {
  const { res, next, metadata } = await request(`/api/business/workspace/${suffix}?userId=someone-else&organizationId=foreign`);
  expect(res.json).toHaveBeenCalled();
  expect(res.status).not.toHaveBeenCalled();
  expect(metadata).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
});
test.each([
  ["/api/pro/clients", "GET"], ["/api/pro/workspace/foreign-patient", "GET"],
  ["/api/business/workspace/foreign-organization", "GET"], ["/objects/private-patient-file", "GET"],
  ["/api/business/workspace/select", "POST"], ["/api/business/workspace/availability", "POST"],
  ["/api/business/workspace/studio-access", "DELETE"],
])("retains denial for %s %s", async (path, method) => {
  const { res, next, metadata } = await request(path, method);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(metadata).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});
test("a revoked grant cannot use the discovery exception", async () => {
  const { res, next } = await request("/api/business/workspace/availability", "GET", { ...grant, state: "revoked" });
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});
test.each([undefined, {}, { authorized: true }, { authorized: true, studioActive: true, studioReady: true, state: "needs_review" }])(
  "HTTP-success metadata is not authorization: %p", access => expect(canEnterStudio(access as any)).toBe(false),
);
test("normal ready Trainer access remains allowed", () => {
  expect(canEnterStudio({ authorized: true, studioActive: true, studioReady: true, state: "active" })).toBe(true);
});
