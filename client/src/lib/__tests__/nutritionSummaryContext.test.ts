import { composeNutritionSummary, type NutritionSummaryDynamicContext } from "@/lib/nutritionSummaryContext";
import type { NutritionPersonalizationSummary as Summary } from "@/types/nutritionSummary";

const baseline = {
  activeInputs: {
    macros: { calories: 2200, proteinG: 135, carbsG: 230, fatG: 70 },
    performance: { label: "Athletic Performance", detail: "Cycling" },
    pregnancy: { label: "Pregnancy Nutrition", detail: "Second Trimester" },
    health: [],
  },
  nutritionDrivers: {
    medicalConditions: [],
    therapeuticInputs: [],
    liveMetrics: [{ label: "Training Phase", value: "Off-Season" }],
  },
  compositeExplanation: "Stable cycling plan",
  nutritionPriorities: ["Fuel for exercise"],
  meta: { generatedAt: "2026-09-20T00:00:00Z" },
} as Summary;

const dynamic: NutritionSummaryDynamicContext = {
  performance: { label: "Athletic Performance", detail: "Strength Day" },
  pregnancy: { label: "Pregnancy Nutrition", detail: "Week 20" },
  liveMetrics: [
    { label: "Blood Glucose", value: "150 mg/dL" },
    { label: "Pregnancy Week", value: "Week 20" },
  ],
  compositeExplanation: "Strength Day · Week 20",
  professionalUpdates: [{
    id: "care-1", kind: "macros", title: "Targets updated",
    detail: "Review update", changedAt: "2026-09-20T00:00:00Z", href: "/dashboard",
  }],
  nextDayBoundaryAt: "2026-09-21T00:00:00Z",
};

describe("Dashboard Life Plan recomposition", () => {
  it("shows baseline immediately when dynamic context is pending or unavailable", () => {
    expect(composeNutritionSummary(baseline)).toBe(baseline);
    expect(composeNutritionSummary(baseline).activeInputs.macros?.calories).toBe(2200);
  });

  it("updates dynamic explanations and metrics without touching saved baseline targets", () => {
    const result = composeNutritionSummary(baseline, dynamic);
    expect(result.activeInputs.macros).toBe(baseline.activeInputs.macros);
    expect(result.activeInputs.performance?.detail).toBe("Strength Day");
    expect(result.activeInputs.pregnancy?.detail).toBe("Week 20");
    expect(result.compositeExplanation).toBe("Strength Day · Week 20");
    expect(result.nutritionDrivers?.liveMetrics).toEqual([
      { label: "Training Phase", value: "Off-Season" },
      { label: "Blood Glucose", value: "150 mg/dL" },
      { label: "Pregnancy Week", value: "Week 20" },
    ]);
    expect(result.professionalUpdates?.[0]?.id).toBe("care-1");
    expect(baseline.activeInputs.performance?.detail).toBe("Cycling");
    expect(baseline.nutritionDrivers?.liveMetrics).toHaveLength(1);
  });

  it("does not copy arbitrary dynamic fields into the baseline", () => {
    const result = composeNutritionSummary(baseline, {
      ...dynamic,
      activeInputs: { macros: { calories: 1 } },
    } as NutritionSummaryDynamicContext);
    expect(result.activeInputs.macros?.calories).toBe(2200);
    expect(result.nutritionPriorities).toEqual(["Fuel for exercise"]);
  });
});