import type { NutritionPersonalizationSummary } from "./nutritionSummary/buildNutritionSummary";

export function filterNutritionSummaryForProvider(
  summary: NutritionPersonalizationSummary,
  professionalRole: string | null | undefined,
): NutritionPersonalizationSummary {
  if (professionalRole === "physician") return summary;

  const { foodInclusionPriorityIds: _withheldFoodInclusionPriorities, ...coachingSummary } = summary;
  return {
    ...coachingSummary,
    activeInputs: {
      ...summary.activeInputs,
      health: [],
      pregnancy: null,
      therapeutic: null,
    },
    nutritionDrivers: null,
    nutritionPriorities: [],
    compositeExplanation:
      "This coaching view includes the client's authorized nutrition, activity, adherence, dietary, and macro information. Clinical and therapeutic details are withheld.",
    professionalUpdates: undefined,
  };
}