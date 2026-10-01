jest.mock("../db", () => ({
  db: {
    query: { diabetesProfile: { findFirst: jest.fn() } },
    select: jest.fn(),
  },
}));

import { db } from "../db";
import { getGlucoseBasedMealGuidance } from "../services/diabeticContextService";
import {
  assertDiabetesAttemptSubject,
  buildDiabetesGenerationAttempt,
} from "../services/diabetesGenerationSnapshot";
import { resolveGlucoseState } from "../services/glucoseStateResolver";
import { registerHub, resolveHubCoupling, validateMealForHub } from "../services/hubCoupling";
import { diabeticHubModule } from "../services/hubCoupling/hubModules/diabetic";

const now = new Date("2026-10-01T21:43:00.000Z");
const recordedAt = "2026-10-01T21:42:00.000Z";
const profile = {
  type: "T2D",
  hypoHistory: false,
  guardrails: { carbLimit: 150, mealFrequency: 3, fiberMin: 5, giCap: 55 },
};

function attempt(value = 100, context: "PRE_MEAL" | "RANDOM" = "PRE_MEAL") {
  const settings = { midRangeCarbs: ["broccoli"], glycemicPreferencesConfigured: true };
  return buildDiabetesGenerationAttempt("patient", {
    glucose: resolveGlucoseState({ valueMgdl: value, context, recordedAt }, settings, now),
    profile,
    settings,
    readingRecordedAt: recordedAt,
  }, now);
}

describe("server-owned diabetes generation snapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    registerHub(diabeticHubModule);
  });

  it("records the 100 reading selected before generation, not an earlier 80", () => {
    const earlier = attempt(80);
    const current = attempt(100);
    expect(current.snapshot.generatedBglMgdl).toBe(100);
    expect(current.snapshot.readingRecordedAt).toBe(recordedAt);
    expect(earlier.snapshot.generatedBglMgdl).toBe(80);
    expect(current.snapshot.generatedAt).toBe(now.toISOString());
  });

  it("uses exactly the same frozen reading/state for both prompts and hub validation", async () => {
    const current = attempt();
    const coupling = await resolveHubCoupling("diabetic", "patient", "lunch", current);
    expect(coupling).not.toBeNull();
    expect(coupling!.context!.data.latestGlucose).toBe(current.context.latestGlucose);
    expect(coupling!.promptFragment.userPromptAddition).toContain("100 mg/dL");
    expect(getGlucoseBasedMealGuidance(current.context)).toContain("100 mg/dL");
    expect(coupling!.guardrails.customRules!.glucoseState).toBe("in-range");
    expect(coupling!.guardrails.customRules!.activeGlucosePreferences).toBe(current.glucose.activePreferences);
    const meal = { ingredients: [{ name: "chicken" }], carbs: 30 } as any;
    expect(validateMealForHub(meal, "diabetic", coupling!.guardrails).isValid).toBe(true);
    expect(validateMealForHub({ ...meal, carbs: 51 }, "diabetic", coupling!.guardrails).isValid).toBe(false);
    expect(db.query.diabetesProfile.findFirst).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });

  it("does not reclassify a pre-meal reading differently in the two prompt sources", async () => {
    const current = attempt(130);
    const coupling = await resolveHubCoupling("diabetic", "patient", "lunch", current);
    expect(current.glucose.state).toBe("HIGH");
    expect(current.context.latestGlucose!.state).toBe("high-risk");
    expect(coupling!.guardrails.customRules!.glucoseState).toBe("high-risk");
    expect(getGlucoseBasedMealGuidance(current.context)).toContain("130 mg/dL");
    expect(coupling!.promptFragment.userPromptAddition).toContain("130 mg/dL");
  });

  it("keeps the snapshot unchanged when a later operation resolves 115", () => {
    const original = attempt(100);
    const later = attempt(115);
    expect(later.snapshot.generatedBglMgdl).toBe(115);
    expect(original.snapshot.generatedBglMgdl).toBe(100);
    expect(Object.isFrozen(original)).toBe(true);
    expect(Object.isFrozen(original.snapshot)).toBe(true);
    expect(Object.isFrozen(original.glucose.activePreferences)).toBe(true);
  });

  it("uses a fresh settings fallback with the timestamp of that same source", () => {
    const settings = { bloodGlucose: 100, updatedAt: recordedAt };
    const glucose = resolveGlucoseState({
      valueMgdl: 80, context: "PRE_MEAL", recordedAt: "2026-08-19T12:00:00.000Z",
    }, settings, now);
    const current = buildDiabetesGenerationAttempt("patient", {
      glucose, settings, profile, readingRecordedAt: recordedAt,
    }, now);
    expect(current.snapshot.generatedBglMgdl).toBe(100);
    expect(current.snapshot.readingSource).toBe("SETTINGS");
    expect(current.context.latestGlucose!.value).toBe(100);
  });

  it("does not label a stale historical reading as the current generation value", () => {
    const glucose = resolveGlucoseState({
      valueMgdl: 80, context: "PRE_MEAL", recordedAt: "2026-08-19T12:00:00.000Z",
    }, null, now);
    const current = buildDiabetesGenerationAttempt("patient", {
      glucose, profile, settings: null, readingRecordedAt: null,
    }, now);
    expect(current.snapshot.glucoseState).toBe("STALE");
    expect(current.snapshot.generatedBglMgdl).toBeNull();
    expect(current.context.latestGlucose).toBeNull();
    expect(current.snapshot.bglBucket).toBe("unavailable");
    expect(getGlucoseBasedMealGuidance(current.context)).not.toContain("80");
  });

  it("does not freeze or modify the inputs owned by the caller", () => {
    const settings = { midRangeCarbs: ["broccoli"] };
    const glucose = resolveGlucoseState({ valueMgdl: 100, context: "PRE_MEAL", recordedAt }, settings, now);
    const current = buildDiabetesGenerationAttempt("patient", {
      glucose, settings, profile, readingRecordedAt: recordedAt,
    }, now);
    settings.midRangeCarbs.push("spinach");
    glucose.activePreferences.push("spinach");
    expect(current.glucose.activePreferences).toEqual(["broccoli"]);
    expect(current.settings!.midRangeCarbs).toEqual(["broccoli"]);
    expect(Object.isFrozen(settings)).toBe(false);
  });

  it("rejects another subject or non-diabetic hub before accessing any glucose data", async () => {
    const current = attempt();
    expect(() => assertDiabetesAttemptSubject(current, "professional")).toThrow("subject mismatch");
    await expect(resolveHubCoupling("diabetic", "professional", "lunch", current)).rejects.toThrow("subject mismatch");
    await expect(resolveHubCoupling("glp1", "patient", "lunch", current)).rejects.toThrow("another hub");
    expect(db.select).not.toHaveBeenCalled();
  });
});