import { buildNutritionSummary } from "../services/nutritionSummary/buildNutritionSummary";

const envelope = {
  medicalHardLimits: [],
  medicalOptimization: [],
  thyroidSupport: false,
  hormoneOptimization: false,
  performanceOverlay: "performance",
  pregnancySupport: true,
  pregnancySupportContext: { stage: "trimester-2", weekOfPregnancy: 20 },
  therapeuticSupport: false,
  dietaryIdentity: ["vegetarian"],
  cuisinePreference: "italian",
  selectedMealBuilder: null,
} as any;
const extras = {
  dailyCalorieTarget: 2200,
  dailyProteinTarget: 135,
  dailyCarbTarget: 230,
  dailyFatTarget: 70,
  performanceContext: { trainingType: "cycling" },
  weeklyTrainingSchedule: { schedule: { sunday: "strength", monday: "off" } },
  latestGlucose: 150,
};

describe("Nutrition Life Plan baseline authority", () => {
  afterEach(() => jest.useRealTimers());

  it("keeps saved macros independent of training and rest days", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-20T15:00:00Z"));
    const sunday = buildNutritionSummary(envelope, extras, { includeDayContext: false });
    const training = buildNutritionSummary(envelope, extras);
    jest.setSystemTime(new Date("2026-09-21T15:00:00Z"));
    const monday = buildNutritionSummary(envelope, extras, { includeDayContext: false });
    const rest = buildNutritionSummary(envelope, extras);

    for (const result of [sunday, training, monday, rest]) {
      expect(result.activeInputs.macros).toMatchObject({
        calories: 2200, proteinG: 135, carbsG: 230, fatG: 70,
      });
    }
    expect(training.activeInputs.performance?.detail).toBe("Strength Day");
    expect(sunday.activeInputs.performance?.detail).toBe("Cycling");
    expect(rest.activeInputs.performance?.detail).toBe("Cycling");
    expect(sunday.compositeExplanation).toEqual(monday.compositeExplanation);
    expect(training.compositeExplanation).not.toEqual(sunday.compositeExplanation);
  });

  it("excludes pregnancy week and glucose from baseline without dropping the protocol", () => {
    const baseline = buildNutritionSummary(envelope, { ...extras, latestGlucose: null }, { includeDayContext: false });
    const dynamic = buildNutritionSummary(envelope, extras);
    expect(baseline.activeInputs.pregnancy?.detail).toBe("Second Trimester");
    expect(dynamic.activeInputs.pregnancy?.detail).toBe("Week 20");
    expect((baseline.nutritionDrivers?.liveMetrics ?? []).some(m => m.label === "Pregnancy Week")).toBe(false);
    expect(dynamic.nutritionDrivers?.liveMetrics).toContainEqual({ label: "Pregnancy Week", value: "Week 20" });
    expect(baseline.activeInputs.dietary).toContain("Vegetarian");
  });
});