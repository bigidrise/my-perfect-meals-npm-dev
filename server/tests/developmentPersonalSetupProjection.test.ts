import type { DemoBoundaryDependencies } from "../middleware/demoDataBoundary";

const mockSelect = jest.fn();
const mockProfile = jest.fn();
const mockUpdateProfile = jest.fn();
jest.mock("../db", () => ({ db: { select: (...args: unknown[]) => mockSelect(...args) } }));
jest.mock("../services/authTokenService", () => ({ findUserByValidAuthToken: jest.fn() }));
jest.mock("../services/demoProfessionalRepository", () => ({ readDemoRestriction: jest.fn() }));
jest.mock("../services/developmentFounderDemoRepository", () => ({
  developmentFounderDemoStore: {
    profile: (...args: unknown[]) => mockProfile(...args),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
}));
jest.mock("../middleware/demoDataBoundary", () => ({ createDemoDataBoundary: (deps: unknown) => deps }));

import { demoDataBoundary } from "../middleware/demoDataBoundaryRuntime";
import { DEVELOPMENT_FOUNDER_PHYSICIAN_DEMO as authority } from "../config/developmentFounderPhysicianDemo";

const project = (demoDataBoundary as unknown as DemoBoundaryDependencies).developmentProfile!;
const actor: any = { id: authority.userId, username: "synthetic-owner", role: "client" };
const grant: any = { authority: "development_founder", state: "active" };
let previousEnvironment: string | undefined;
let previousDeployment: string | undefined;

beforeEach(() => {
  previousEnvironment = process.env.NODE_ENV;
  previousDeployment = process.env.REPLIT_DEPLOYMENT;
  process.env.NODE_ENV = "development";
  delete process.env.REPLIT_DEPLOYMENT;
  jest.clearAllMocks();
  mockProfile.mockResolvedValue({});
  mockUpdateProfile.mockResolvedValue({});
});
afterEach(() => {
  if (previousEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousEnvironment;
  if (previousDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
  else process.env.REPLIT_DEPLOYMENT = previousDeployment;
});

function storedSetup(rows: unknown[]) {
  const query = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(query);
  return query;
}

test("own existing completion survives the minimized Development bootstrap without exposing health or granting access", async () => {
  const completedAt = new Date("2026-10-01T12:00:00Z");
  const query = storedSetup([{ onboardingCompletedAt: completedAt, hasSavedMacroProfile: true }]);
  const profile = await project({ method: "GET" } as any, actor, grant);
  expect(profile).toMatchObject({
    onboardingCompletedAt: completedAt,
    hasSavedMacroProfile: true,
    operatingStatus: "demo_only",
    developmentPhysicianStudioInterface: "original",
  });
  expect(Object.keys(mockSelect.mock.calls[0][0]).sort()).toEqual(["hasSavedMacroProfile", "onboardingCompletedAt"]);
  expect(query.where).toHaveBeenCalledTimes(1);
  expect(query.limit).toHaveBeenCalledWith(1);
  for (const key of ["age", "height", "weight", "macrosDefined", "medicalConditions", "credentialNumber", "studioMembership"]) {
    expect(profile).not.toHaveProperty(key);
  }
  expect(mockUpdateProfile).not.toHaveBeenCalled();
});

test("request-supplied completion never replaces unfinished saved state", async () => {
  storedSetup([{ onboardingCompletedAt: null, hasSavedMacroProfile: false }]);
  const profile = await project({
    method: "GET", body: { onboardingCompletedAt: "fabricated", hasSavedMacroProfile: true },
  } as any, actor, grant);
  expect(profile).toMatchObject({ onboardingCompletedAt: null, hasSavedMacroProfile: false });
});

test("a deleted account cannot receive fabricated completion", async () => {
  storedSetup([]);
  await expect(project({ method: "GET" } as any, actor, grant)).rejects.toMatchObject({ code: "AUTH_REAUTHENTICATION_REQUIRED" });
});

test.each([
  ["other actor", "development", undefined, { ...actor, id: "unrelated-actor" }, grant],
  ["Production", "production", undefined, actor, grant],
  ["deployed runtime", "development", "1", actor, grant],
  ["other grant", "development", undefined, actor, { ...grant, authority: "organization" }],
])("%s does not gain this own-setup projection", async (_, environment, deployment, candidate, restriction) => {
  process.env.NODE_ENV = environment as string;
  if (deployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
  else process.env.REPLIT_DEPLOYMENT = deployment as string;
  expect(await project({ method: "GET" } as any, candidate as any, restriction as any)).toBeNull();
  expect(mockSelect).not.toHaveBeenCalled();
  expect(mockProfile).not.toHaveBeenCalled();
});
