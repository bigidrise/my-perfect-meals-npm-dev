import {
  SafetyResolutionRecorder, assertStrictOwner, establishOwnerDay,
  type StrictOwnerScope,
} from "../../services/nutritionResolutionContext";

let mockRuntime = true;
jest.mock("../../services/strictOwnerRuntime", () => ({
  strictOwnerDevelopmentEnabled: () => mockRuntime,
}));
jest.mock("../../services/snackCompatibilityRepair", () => ({ developmentSnackRepairEnabled: () => mockRuntime }));
jest.mock("../../services/promptBuilder", () => ({
  resolveSweetenerAllowlist: jest.fn(() => ({ preferred: [], avoided: [] })),
}));
jest.mock("../../services/universalMedicalGuidance", () => ({ buildUniversalConditionGuidance: jest.fn(async () => []) }));
jest.mock("../../services/glp1/resolveDailyMedicationTolerance", () => ({
  resolveDailyMedicationTolerance: jest.fn(async () => ({
    date: "synthetic-date", safetyEscalations: [], nutritionAdaptations: [],
  })),
}));
jest.mock("../../services/diabeticContextService", () => ({
  getDiabeticContext: jest.fn(async () => ({ latestGlucose: null })),
  getGlucoseBasedMealGuidance: () => "Synthetic diabetes guidance",
}));
jest.mock("../../services/safetyPinService", () => ({}));
jest.mock("../../lib/auditLog", () => ({ logAudit: () => { throw new Error("Audit forbidden"); } }));

const storage = require("./storageStub.cjs");
const entry = jest.requireActual("../../services/strictOwnerProtocolResolution") as {
  resolveStrictOwnerProtocolEnvelope(id: string): Promise<{
    status: string; prescription?: Record<string, unknown>;
    envelope?: Record<string, unknown>; sources?: Record<string, { status: string }>;
    failedSources?: string[];
  }>;
};
const protocol = jest.requireActual("../../services/protocolEnvelope");
const activation = jest.requireActual("../../services/glp1/currentMealAuthority");
const prescription = jest.requireActual("../../services/prescriptionResolver");
const tolerance = require("../../services/glp1/resolveDailyMedicationTolerance").resolveDailyMedicationTolerance as jest.Mock;
const guidance = require("../../services/universalMedicalGuidance").buildUniversalConditionGuidance as jest.Mock;
const diabetic = require("../../services/diabeticContextService").getDiabeticContext as jest.Mock;
const sweeteners = require("../../services/promptBuilder").resolveSweetenerAllowlist as jest.Mock;
const boundary = jest.requireActual("../../services/myPerfectMenu/developmentNoSave");

function owner(extra: Record<string, unknown> = {}) {
  return {
    id: "synthetic-owner", timezone: "America/Chicago", selectedMealBuilder: "glp1",
    allergies: [], dietaryRestrictions: [], healthConditions: [], specialtyConditions: [],
    medicalConditions: [], dislikedFoods: [], avoidedFoods: [], likedFoods: [],
    dailyCalorieTarget: 2000, dailyProteinTarget: 100, dailyCarbsTarget: 220, dailyFatTarget: 70,
    dailyStarchyCarbsTarget: 143, dailyFibrousCarbsTarget: 77,
    defaultStarchMealsPerDay: 3, starchPlanDefined: true, starchDistributionStrategy: "morning",
    performanceModeEnabled: false, planLookupKey: "pro_monthly", weight: 175,
    ...extra,
  };
}
function scope(now = "2026-10-19T12:00:00Z"): StrictOwnerScope {
  return {
    mode: "pairing_advisor_owner", ownerId: "synthetic-owner", now: new Date(now),
    resolution: new SafetyResolutionRecorder(),
  };
}
function prepare(extra: Record<string, unknown> = {}) {
  const user = owner(extra);
  storage.state.queryRows = [{ source_kind: "medication" }];
  storage.state.rows = [
    [user], [user], [], // envelope owner, strict-only performance flag, provider interventions
    [user], [{ count: 0 }], [], [{ weight: 175 }], // real prescription dependencies
  ];
  storage.state.executeRows = [{ guardrails: { mealsPerDay: 4, proteinMinG: 35, fatMaxG: 12 } }];
  return user;
}
beforeEach(() => {
  storage.reset(); mockRuntime = true;
  tolerance.mockResolvedValue({ date: "synthetic-date", safetyEscalations: [], nutritionAdaptations: [] });
  guidance.mockResolvedValue([]);
  diabetic.mockResolvedValue({ latestGlucose: null });
  sweeteners.mockImplementation(() => ({ preferred: [], avoided: [] }));
});

describe("disconnected strict-owner end-to-end resolution", () => {
  test.each([null, "household-a", "household-b"])("saved household %s cannot change owner GLP-1 or prescription", async selection => {
    prepare({ activeHouseholdProfileId: selection });
    const result = await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner");
    expect(result.status).toBe("complete");
    expect(result.envelope?.userId).toBe("synthetic-owner");
    expect(result.prescription).toMatchObject({ proteinTarget: 140, fatTarget: 48, starchMealsAllowed: 3 });
    expect(result.sources?.glp1_activation.status).toBe("success");
    expect(storage.calls.inserts).toBe(0);
    expect(storage.calls.direct).toEqual([]);
    expect(storage.calls.client.filter(([sql]: [string]) => sql.includes("health_protocol_sources"))).toHaveLength(1);
    expect(storage.calls.connects).toBe(1);
    expect(storage.calls.releases).toBe(1);
  });
  test("complete strict calculation equals existing calculation without household selection", async () => {
    const user = prepare();
    const result = await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner");
    storage.reset();
    // Legacy activation is intentionally unchanged, so use its existing explicit source.
    storage.state.rows = [[{ ...user, medicalConditions: ["glp1"] }], [{ count: 0 }], [], [{ weight: 175 }]];
    storage.state.executeRows = [{ guardrails: { mealsPerDay: 4, proteinMinG: 35, fatMaxG: 12 } }];
    storage.state.allowMaterialization = true;
    const normal = await prescription.resolveDailyNutritionPrescription({
      userId: "synthetic-owner", dateISO: (result.prescription as Record<string, unknown>).date,
    });
    expect(result.prescription).toEqual(normal);
  });
  test("healthy owner without date-sensitive sources does not require timezone or a prescription", async () => {
    const user = owner({ selectedMealBuilder: null, timezone: null });
    storage.state.rows = [[user], [user], []];
    const result = await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner");
    expect(result.status).toBe("complete");
    expect(result.sources?.timezone.status).toBe("not_applicable");
    expect(result.sources?.prescription.status).toBe("not_applicable");
  });
  test("missing owner is legitimately absent but cannot issue authority", async () => {
    storage.state.rows = [[]];
    const result = await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner");
    expect(result.status).toBe("unavailable");
    expect(result.failedSources).toContain("owner_profile");
  });
  test("a mismatched storage identity cannot issue authority", async () => {
    prepare({ id: "synthetic-other" });
    expect((await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner")).status).toBe("unavailable");
  });
  test("strict runtime denial occurs before acquiring a connection", async () => {
    mockRuntime = false;
    expect((await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner")).status).toBe("unavailable");
    expect(storage.calls.connects).toBe(0);
  });
  test.each(["", "Invalid/Zone"])("required invalid timezone %s cannot become UTC fallback success", async timezone => {
    prepare({ timezone });
    const result = await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner");
    expect(result.status).toBe("unavailable");
    expect(result.failedSources).toContain("timezone");
  });
  test("required tolerance failure is not neutral success", async () => {
    prepare(); tolerance.mockRejectedValueOnce(new Error("Synthetic failed tolerance read"));
    expect((await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner")).failedSources).toContain("glp1_tolerance");
  });
  test("required guidance failure is not an empty successful block", async () => {
    prepare(); guidance.mockRejectedValueOnce(new Error("Synthetic failed guidance"));
    expect((await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner")).failedSources).toContain("condition_guidance");
  });
  test("required provider read failure is not legitimate absence", async () => {
    prepare(); storage.state.rows[2] = new Error("Synthetic provider outage");
    expect((await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner")).failedSources).toContain("provider_interventions");
  });
  test("guardrail read outage cannot use existing default as complete authority", async () => {
    prepare(); storage.state.executeError = new Error("Synthetic guardrail outage");
    expect((await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner")).failedSources).toContain("glp1_guardrails");
  });
  test("a successfully absent guardrail row retains the existing default policy", async () => {
    prepare(); storage.state.executeRows = [];
    const result = await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner");
    expect(result.status).toBe("complete");
    expect(result.sources?.glp1_guardrails.status).toBe("absent");
    expect(result.prescription?.fatTarget).toBe(60);
  });
  test("malformed guardrails fail rather than masquerading as defaults", async () => {
    prepare(); storage.state.executeRows = [{ guardrails: { fatMaxG: "invalid" } }];
    expect((await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner")).failedSources).toContain("glp1_guardrails");
  });
  test("optional preference failure does not block complete clinical authority", async () => {
    prepare();
    sweeteners.mockImplementationOnce(() => { throw new Error("Synthetic optional preference failure"); });
    const result = await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner");
    expect(result.status).toBe("complete");
    expect(result.sources?.preferences.status).toBe("incomplete");
  });
  test("daily state propagates scope through the real canonical resolver and uses the same prescription", async () => {
    const user = prepare({ specialtyConditions: ["performance-nutrition"] });
    storage.state.rows = [
      [user], [user], [], [{ source: "macro_calculator" }],
      [user], [user], [{ count: 0 }], [], [{ weight: 175 }],
    ];
    storage.state.executeQueue = [
      storage.state.executeRows,
      [{ calories: 0, protein: 0, carbs: 0, fat: 0, starchy_carbs: 0, fibrous_carbs: 0 }],
      [{ calories: 0, protein: 0, carbs: 0, fat: 0, starchy_carbs: 0 }],
    ];
    const result = await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner");
    expect(result.status).toBe("complete");
    expect(result.sources?.daily_state.status).toBe("success");
    expect(storage.calls.inserts).toBe(0);
    expect(storage.calls.client.filter(([sql]: [string]) => sql.includes("health_protocol_sources"))).toHaveLength(1);
  });
  test("failed daily ledger cannot silently omit required daily state", async () => {
    const user = prepare({ specialtyConditions: ["performance-nutrition"] });
    storage.state.rows[3] = new Error("Synthetic stored prescription read failed");
    const result = await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner");
    expect(result.status).toBe("unavailable");
    expect(result.failedSources).toContain("daily_state");
    expect(user.id).toBe("synthetic-owner");
  });
  test("diabetes read failure cannot become non-applicability", async () => {
    prepare({ healthConditions: ["diabetes"] });
    diabetic.mockRejectedValueOnce(new Error("Synthetic diabetes outage"));
    expect((await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner")).failedSources).toContain("diabetes_context");
  });
  test("active competition with missing required data cannot silently disappear", async () => {
    prepare({ specialtyConditions: ["competition-prep"] });
    expect((await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner")).failedSources).toContain("competition");
  });
  test("performance calculation failure is strict-only and cannot use a fallback receipt", async () => {
    const performance = jest.requireActual("../../services/protocol/performanceProtocolResolver");
    const spy = jest.spyOn(performance, "resolveTodayTargets").mockImplementation(() => { throw new Error("Synthetic performance failure"); });
    try {
      const user = prepare({
        performanceModeEnabled: true, weeklyTrainingSchedule: {}, performanceProtocolConfig: {},
      });
      const strictResult = await entry.resolveStrictOwnerProtocolEnvelope("synthetic-owner");
      expect(strictResult.status).toBe("unavailable");
      expect(strictResult.failedSources).toContain("performance");
      storage.reset();
      storage.state.rows = [[{ ...user, medicalConditions: ["glp1"] }], [{ count: 0 }], [], [{ weight: 175 }]];
      storage.state.executeRows = [];
      storage.state.allowMaterialization = true;
      const legacy = await prescription.resolveDailyNutritionPrescription({ userId: user.id, dateISO: "2026-10-19" });
      expect(legacy.rationaleCodes).toContain("performance_resolver_error_fallback");
    } finally { spy.mockRestore(); }
  });
});

describe("scope, source ledger and date boundaries", () => {
  test("identity mismatch and explicit household subjects fail before source access", async () => {
    expect(() => assertStrictOwner(scope(), "other")).toThrow();
    expect(() => assertStrictOwner(scope(), "synthetic-owner", true)).toThrow();
    expect(storage.calls.direct).toEqual([]);
  });
  test("household GLP-1 suppression is unchanged without opt-in", async () => {
    const result = await activation.resolveCurrentGLP1MealAuthority(owner({
      selectedMealBuilder: null, activeHouseholdProfileId: "household-a",
    }), true);
    expect(result).toEqual([]);
    expect(storage.calls.direct).toEqual([]);
  });
  test("current activation sources are read once per strict request and never cached across requests", async () => {
    storage.state.queryRows = [{ source_kind: "medication" }];
    const first = scope();
    const subject = owner({ selectedMealBuilder: null, activeHouseholdProfileId: "household-a" });
    expect(await activation.resolveCurrentGLP1MealAuthority(subject, false, { strictOwner: first })).toEqual(["verifiedMedication"]);
    await activation.resolveCurrentGLP1MealAuthority(subject, false, { strictOwner: first });
    storage.state.queryRows = [];
    expect(await activation.resolveCurrentGLP1MealAuthority(subject, false, { strictOwner: scope() })).toEqual([]);
    expect(storage.calls.direct).toHaveLength(2);
  });
  test("concurrent scopes keep independent caches and ledgers", async () => {
    const first = scope(), second = scope();
    await Promise.all([first, second].map(s => activation.resolveCurrentGLP1MealAuthority(owner(), false, { strictOwner: s })));
    expect(storage.calls.direct).toHaveLength(2);
    first.resolution.fail("glp1_activation", "read_failed");
    expect(second.resolution.get("glp1_activation")?.status).not.toBe("incomplete");
  });
  test.each([
    ["2026-10-19T04:59:00Z", "2026-10-18"],
    ["2026-10-19T05:01:00Z", "2026-10-19"],
    ["2026-11-01T06:30:00Z", "2026-11-01"],
    ["2026-11-01T07:30:00Z", "2026-11-01"],
  ])("owner-local midnight/DST date %s → %s", (now, date) => {
    expect(establishOwnerDay(scope(now), "America/Chicago").day.localDate).toBe(date);
  });
  test("all required sources must be reported; optional preference failure alone is not required", () => {
    const recorder = new SafetyResolutionRecorder();
    expect(recorder.incompleteSources()).toContain("daily_state");
    recorder.fail("preferences", "read_failed");
    expect(recorder.incompleteSources()).not.toContain("preferences");
    recorder.fail("glp1_tolerance", "read_failed");
    recorder.notApplicable("glp1_tolerance", "unsafe_attempt_to_erase_failure");
    expect(recorder.get("glp1_tolerance")?.status).toBe("incomplete");
  });
  test("strict bypass flags are rejected before querying", async () => {
    expect(await protocol.loadUserProtocolEnvelope("synthetic-owner", undefined, {
      strictOwner: scope(), skipDiabetesGlucose: true,
    })).toBeNull();
    expect(storage.calls.selects).toEqual([]);
  });
  test("canonical date mismatch fails before any storage read", async () => {
    const canonical = jest.requireActual("../../services/nutritionStateService");
    const s = establishOwnerDay(scope(), "America/Chicago");
    await expect(canonical.resolveDailyNutritionState("synthetic-owner", "2026-10-20", undefined, {
      strictOwner: s,
    })).rejects.toThrow();
    expect(storage.calls.selects).toEqual([]);
  });
  test("tolerance receives the established owner timezone, local date and clock", async () => {
    prepare();
    const s = scope("2026-10-19T04:59:00Z");
    await boundary.withDevelopmentNoSaveDatabase(storage.pool, async () => {
      await protocol.loadUserProtocolEnvelope("synthetic-owner", undefined, { strictOwner: s });
    });
    expect(tolerance).toHaveBeenCalledWith({
      userId: "synthetic-owner", dateStr: "2026-10-18", timezone: "America/Chicago", now: s.now,
    });
  });
});
