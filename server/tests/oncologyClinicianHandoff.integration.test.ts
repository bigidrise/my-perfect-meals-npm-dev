import express from "express";
import request from "supertest";
import { ONCOLOGY_SYMPTOM_OPTIONS } from "../../shared/oncologySupportSelection";
import { loadOncologySupportSelection, saveOncologySupportSelection } from "../../client/src/lib/oncologySupportSelectionClient";

let mockClinicType = "clinic";
let mockStoredContext: any = null;
const mockWrites = jest.fn();
const mockStoredUser: any = {
  id: "test-patient", dietaryRestrictions: ["vegetarian"], allergies: ["peanut"],
  healthConditions: [], medicalConditions: [], dislikedFoods: ["mushrooms"],
  avoidedFoods: [], likedFoods: [], preferredSweeteners: [], avoidSweeteners: [],
  sweetenerPreferences: [], specialtyConditions: [], specialtyCondition: null,
  activeHouseholdProfileId: null, selectedMealBuilder: "anti_inflammatory",
  timezone: "UTC", measurementSystem: "imperial",
};
jest.mock("../db", () => ({
  pool: { query: jest.fn(async () => ({ rows: [] })) },
  db: {
    select: () => ({ from: (table: any) => ({ where: () => ({ limit: async () => {
      const name = table?.[Symbol.for("drizzle:Name")] ?? table?._?.name;
      return name === "studios" ? [{ type: mockClinicType }]
        : [{ ...mockStoredUser, oncologySupportContext: mockStoredContext }];
    } }) }) }),
    update: () => ({ set: (values: any) => ({ where: async () => {
      mockWrites(values);
      mockStoredContext = structuredClone(values.oncologySupportContext);
    } }) }),
  },
}));
jest.mock("../services/stripeProcare", () => ({ stripe: {} }));
jest.mock("../services/stripeCheckoutGuard", () => ({}));
jest.mock("../services/stripeIdentityOwnershipService", () => ({}));
jest.mock("../services/stripeRuntimePolicy", () => ({}));
jest.mock("../lib/auditLog", () => ({ logAudit: jest.fn(), getClientIp: () => "test" }));
jest.mock("../utils/verifyClinicalAccess", () => ({
  verifyClinicalAccess: async (actor: string, subject: string) => actor === "test-clinician" && subject === "test-patient",
}));
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.get("x-test-user")) return res.status(401).json({ message: "Authentication required" });
    req.authUser = { id: req.get("x-test-user") };
    next();
  },
}));
jest.mock("../middleware/requireProAccess", () => ({
  requireProAccess: (req: any, res: any, next: any) => req.get("x-test-billing") === "denied"
    ? res.status(403).json({ message: "Professional access required" }) : next(),
}));
jest.mock("../middleware/requirePhase1Cert", () => ({
  requirePhase1Cert: (_req: any, _res: any, next: any) => next(),
}));
jest.mock("../middleware/requirePhase2Training", () => ({
  requirePhase2Training: (req: any, res: any, next: any) => req.get("x-test-training") === "denied"
    ? res.status(403).json({ message: "Training required" }) : next(),
}));
jest.mock("../middleware/requireWorkspaceAccess", () => ({
  requireWorkspaceAccess: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock("../services/diabeticContextService", () => ({
  getDiabeticContext: jest.fn(async () => ({ latestGlucose: null })),
  getGlucoseBasedMealGuidance: jest.fn(() => null),
}));
jest.mock("../services/glp1/resolveDailyMedicationTolerance", () => ({
  resolveDailyMedicationTolerance: jest.fn(async () => ({ date: "2026-10-05", safetyEscalations: [], nutritionAdaptations: [] })),
}));
jest.mock("../services/healthProtocols/developmentFoodSupports", () => ({
  readDevelopmentPersonalFoodSupports: jest.fn(async () => new Set()),
}));

import router from "../routes/procareRoutes";
import { loadGenerationProtocolEnvelope, enforceBeforeGenerate, scanGeneratedOutput } from "../services/protocolEnvelope";

const app = express();
app.use(express.json());
app.use("/api/pro", router);
const originalEnv = process.env.NODE_ENV;
const originalDeployment = process.env.REPLIT_DEPLOYMENT;
const originalProduction = process.env.VITE_IS_PRODUCTION_PROJECT;
const originalOncology = process.env.ONCOLOGY_SUPPORT_V1;
const clinicianRequest = async (path: string, init: RequestInit = {}) => {
  const req = init.method === "PUT" ? request(app).put(path).send(JSON.parse(init.body as string)) : request(app).get(path);
  const response = await req.set("x-test-user", "test-clinician");
  if (response.status >= 400) throw new Error(response.body.message ?? response.body.error);
  return response.body;
};
beforeEach(() => {
  process.env.NODE_ENV = "development";
  delete process.env.REPLIT_DEPLOYMENT;
  delete process.env.VITE_IS_PRODUCTION_PROJECT;
  delete process.env.ONCOLOGY_SUPPORT_V1;
  mockStoredContext = null;
  mockClinicType = "clinic";
  mockWrites.mockClear();
});
afterAll(() => {
  process.env.NODE_ENV = originalEnv;
  for (const [key, value] of Object.entries({
    REPLIT_DEPLOYMENT: originalDeployment, VITE_IS_PRODUCTION_PROJECT: originalProduction, ONCOLOGY_SUPPORT_V1: originalOncology,
  })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
const selection = (symptoms: any[] = []) => ({
  enabled: true, symptoms, emphasis: { highProteinNutrientDensity: true },
});

describe("actual clinician client helper → registered router → storage → generation envelope", () => {
  it("retains the established protein-emphasis default for a new assignment", async () => {
    const loaded = await loadOncologySupportSelection("test-patient", clinicianRequest);
    expect(loaded).toEqual({ enabled: false, symptoms: [], emphasis: { highProteinNutrientDensity: true } });
    await saveOncologySupportSelection("test-patient", { ...loaded, enabled: true }, clinicianRequest);
    expect(mockStoredContext.emphasis.highProteinNutrientDensity).toBe(true);
  });
  it.each(ONCOLOGY_SYMPTOM_OPTIONS)("round-trips $value into the authoritative subject's meal guidance", async ({ value }) => {
    await saveOncologySupportSelection("test-patient", selection([value]), clinicianRequest);
    expect(mockStoredContext).toMatchObject({ ...selection([value]), source: "physician", locked: true });
    const loaded = await loadOncologySupportSelection("test-patient", clinicianRequest);
    expect(loaded).toEqual(selection([value]));
    await saveOncologySupportSelection("test-patient", loaded, clinicianRequest);
    const envelope = await loadGenerationProtocolEnvelope("test-patient");
    expect(envelope.oncologySupportContext?.symptoms).toEqual([value]);
    expect(envelope.conditionGuidanceBlocks.join("\n")).toContain("ONCOLOGY TOLERANCE PRIORITY");
    expect(enforceBeforeGenerate(envelope).combined).toContain("ONCOLOGY TOLERANCE PRIORITY");
    expect(envelope.allergies).toContain("peanut");
    expect(envelope.dietaryIdentity).toContain("vegetarian");
    expect(envelope.dislikedFoods ?? envelope.avoidances).toBeDefined();
  });
  it("preserves all five selections, including disable/re-enable and separate protein emphasis", async () => {
    const all = selection(ONCOLOGY_SYMPTOM_OPTIONS.map(o => o.value));
    all.emphasis.highProteinNutrientDensity = false;
    await saveOncologySupportSelection("test-patient", all, clinicianRequest);
    const loaded = await loadOncologySupportSelection("test-patient", clinicianRequest);
    expect(loaded).toEqual(all);
    await saveOncologySupportSelection("test-patient", { ...loaded, enabled: false }, clinicianRequest);
    const disabled = await loadGenerationProtocolEnvelope("test-patient");
    expect(disabled.conditionGuidanceBlocks.join("\n")).not.toContain("CANCER SUPPORT NUTRITION");
    await saveOncologySupportSelection("test-patient", { ...loaded, enabled: true }, clinicianRequest);
    expect((await loadGenerationProtocolEnvelope("test-patient")).oncologySupportContext?.symptoms).toEqual(all.symptoms);
  });
  it("keeps the original no-symptom protocol working", async () => {
    await saveOncologySupportSelection("test-patient", selection(), clinicianRequest);
    const envelope = await loadGenerationProtocolEnvelope("test-patient");
    expect(envelope.conditionGuidanceBlocks.join("\n")).toContain("FIBER ANCHOR");
    expect(envelope.conditionGuidanceBlocks.join("\n")).not.toContain("ONCOLOGY TOLERANCE PRIORITY");
  });
  it("does not bypass allergy or dietary-identity enforcement", async () => {
    await saveOncologySupportSelection("test-patient", selection(["gi_sensitivity"]), clinicianRequest);
    const envelope = await loadGenerationProtocolEnvelope("test-patient");
    const result = scanGeneratedOutput({
      name: "Chicken peanut bowl", ingredients: [{ name: "chicken" }, { name: "peanuts" }],
      instructions: ["Cook and serve."],
    } as any, envelope);
    expect(result.passed).toBe(false);
  });
  it.each([
    { label: "unauthenticated", actor: "", status: 401 },
    { label: "unrelated subject", actor: "unrelated-clinician", status: 403 },
    { label: "billing denied", actor: "test-clinician", status: 403, header: "x-test-billing" },
    { label: "training denied", actor: "test-clinician", status: 403, header: "x-test-training" },
  ])("does not write for $label", async ({ actor, status, header }) => {
    let req = request(app).put("/api/pro/oncology-support/test-patient").send(selection(["nausea"]));
    if (actor) req = req.set("x-test-user", actor);
    if (header) req = req.set(header, "denied");
    expect((await req).status).toBe(status);
    expect(mockWrites).not.toHaveBeenCalled();
  });
  it("rejects a non-clinical workspace and unsupported symptoms", async () => {
    mockClinicType = "trainer";
    await expect(saveOncologySupportSelection("test-patient", selection(["nausea"]), clinicianRequest)).rejects.toThrow();
    expect(mockWrites).not.toHaveBeenCalled();
    mockClinicType = "clinic";
    const response = await request(app).put("/api/pro/oncology-support/test-patient").set("x-test-user", "test-clinician")
      .send(selection(["invented_symptom"]));
    expect(response.status).toBe(400);
    expect(mockWrites).not.toHaveBeenCalled();
  });
  it("reports a failed save rather than a false success", async () => {
    await expect(saveOncologySupportSelection("test-patient", selection(["nausea"]), async () => { throw new Error("Save rejected"); })).rejects.toThrow("Save rejected");
  });
});
