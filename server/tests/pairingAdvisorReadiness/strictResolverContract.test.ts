import {
  createStrictOwnerAuthority, type StrictOwnerReceipt,
} from "../../services/pairingAdvisor/readiness/authority";
import { owner } from "./fixtures";

// Exercise the real resolver under the same no-save in-memory boundary as the
// established strict-owner regression suite, never a real profile or database.
jest.mock("../../services/strictOwnerRuntime", () => ({ strictOwnerDevelopmentEnabled: () => true }));
jest.mock("../../services/snackCompatibilityRepair", () => ({ developmentSnackRepairEnabled: () => true }));
jest.mock("../../services/promptBuilder", () => ({
  resolveSweetenerAllowlist: () => ({ preferred: [], avoided: [] }),
}));
jest.mock("../../services/universalMedicalGuidance", () => ({
  buildUniversalConditionGuidance: async () => [],
}));
jest.mock("../../services/glp1/resolveDailyMedicationTolerance", () => ({
  resolveDailyMedicationTolerance: async () => ({
    date: "synthetic-date", safetyEscalations: [], nutritionAdaptations: [],
  }),
}));
jest.mock("../../services/diabeticContextService", () => ({
  getDiabeticContext: async () => ({ latestGlucose: null }), getGlucoseBasedMealGuidance: () => "Synthetic guidance",
}));
jest.mock("../../services/safetyPinService", () => ({}));
jest.mock("../../lib/auditLog", () => ({ logAudit: () => { throw new Error("Audit forbidden"); } }));
const storage = require("../pairingAdvisorSafety/storageStub.cjs");
const entry = jest.requireActual("../../services/strictOwnerProtocolResolution") as {
  resolveStrictOwnerProtocolEnvelope: (id: string) => Promise<StrictOwnerReceipt>;
};
const ingredientEvidence = jest.requireActual("../../services/foodCompositionEvidence");

function syntheticUser(extra: Record<string, unknown> = {}) {
  return {
    id: owner.accountId, timezone: "America/Chicago", selectedMealBuilder: "glp1",
    allergies: [], dietaryRestrictions: [], healthConditions: [], specialtyConditions: [],
    medicalConditions: [], dislikedFoods: [], avoidedFoods: [], likedFoods: [],
    dailyCalorieTarget: 2000, dailyProteinTarget: 100, dailyCarbsTarget: 220, dailyFatTarget: 70,
    dailyStarchyCarbsTarget: 143, dailyFibrousCarbsTarget: 77,
    defaultStarchMealsPerDay: 3, starchPlanDefined: true, starchDistributionStrategy: "morning",
    performanceModeEnabled: false, planLookupKey: "pro_monthly", weight: 175, ...extra,
  };
}
function adapter() {
  return createStrictOwnerAuthority({
    resolveOwner: id => entry.resolveStrictOwnerProtocolEnvelope(id),
    requiresVerifiedIngredients: ingredientEvidence.requiresVerifiedIngredientEvidence,
    consumptionGate: () => "eligible", constraints: () => "Synthetic existing constraints",
  });
}
beforeEach(() => storage.reset());
afterEach(() => {
  expect(storage.calls.direct).toEqual([]);
  expect(storage.calls.inserts).toBe(0);
  expect(storage.calls.client.some(([sql]: [string]) => /^ROLLBACK/.test(sql))).toBe(true);
});
test("the actual healthy-owner non-applicable timezone/prescription result remains acceptable", async () => {
  const user = syntheticUser({ selectedMealBuilder: null, timezone: null });
  storage.state.rows = [[user], [user], []];
  const result = await adapter()(owner.accountId, new AbortController().signal);
  expect(result.authority.status).toBe("ready");
  expect(result.authority.subjectId).toBe(owner.accountId);
  expect(storage.calls.connects).toBe(1);
  expect(storage.calls.releases).toBe(1);
});
test("the actual GLP-1 owner receipt and prescription reach the separately typed adapter", async () => {
  const user = syntheticUser({ activeHouseholdProfileId: "synthetic-household-selection" });
  storage.state.queryRows = [{ source_kind: "medication" }];
  storage.state.rows = [[user], [user], [], [user], [{ count: 0 }], [], [{ weight: 175 }]];
  storage.state.executeRows = [{ guardrails: { mealsPerDay: 4, proteinMinG: 35, fatMaxG: 12 } }];
  const result = await adapter()(owner.accountId, new AbortController().signal);
  expect(result.authority.subjectId).toBe(owner.accountId);
  expect(result.envelope.userId).toBe(owner.accountId);
  expect(storage.calls.connects).toBe(1);
  expect(storage.calls.releases).toBe(1);
});
test("the actual missing-owner result fails closed before a ready receipt", async () => {
  storage.state.rows = [[]];
  await expect(adapter()(owner.accountId, new AbortController().signal)).rejects.toMatchObject({ code: "AUTHORITY_UNAVAILABLE" });
});
