import { buildNutritionSummary } from "../services/nutritionSummary/buildNutritionSummary";
import { filterNutritionSummaryForProvider } from "../services/procareClientDataPolicy";

const envelope = {
  medicalHardLimits: [],
  medicalOptimization: [],
  thyroidSupport: false,
  hormoneOptimization: false,
  performanceOverlay: "standard",
  pregnancySupport: false,
  therapeuticSupport: false,
  dietaryIdentity: [],
  cuisinePreference: null,
  selectedMealBuilder: null,
} as any;

describe("Nutrition Priorities summary visibility", () => {
  it("includes the authenticated adult subject's stable selected IDs", () => {
    const summary = buildNutritionSummary(envelope, {
      foodInclusionPriorities: {
        schemaVersion: 1,
        registryVersion: "nutrition-priorities.v1",
        selectedPriorityIds: ["fermented_foods", "plant_variety"],
        updatedAt: "2026-09-21T00:00:00.000Z",
      },
    });
    expect(summary.foodInclusionPriorityIds).toEqual([
      "fermented_foods",
      "plant_variety",
    ]);
  });

  it("treats zero, missing, or invalid selections as a neutral empty summary", () => {
    expect(
      buildNutritionSummary(envelope, {
        foodInclusionPriorities: {
          schemaVersion: 1,
          registryVersion: "nutrition-priorities.v1",
          selectedPriorityIds: [],
          updatedAt: null,
        },
      }).foodInclusionPriorityIds,
    ).toEqual([]);
    expect(buildNutritionSummary(envelope, {}).foodInclusionPriorityIds).toEqual([]);
    expect(
      buildNutritionSummary(envelope, {
        foodInclusionPriorities: {
          selectedPriorityIds: ["not_a_priority"],
        },
      }).foodInclusionPriorityIds,
    ).toEqual([]);
  });

  it("keeps physician IDs read-only while structurally omitting them from coaching DTOs", () => {
    const summary = buildNutritionSummary(envelope, {
      foodInclusionPriorities: {
        schemaVersion: 1,
        registryVersion: "nutrition-priorities.v1",
        selectedPriorityIds: ["fermented_foods", "plant_variety"],
        updatedAt: "2026-09-21T00:00:00.000Z",
      },
    });

    expect(filterNutritionSummaryForProvider(summary, "physician").foodInclusionPriorityIds)
      .toEqual(["fermented_foods", "plant_variety"]);
    expect(filterNutritionSummaryForProvider(summary, "trainer"))
      .not.toHaveProperty("foodInclusionPriorityIds");
  });
});