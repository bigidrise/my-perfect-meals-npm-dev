import type { NutritionPersonalizationSummary as Summary } from "@/types/nutritionSummary";

export interface NutritionSummaryDynamicContext {
  nextDayBoundaryAt: string;
  performance: Summary["activeInputs"]["performance"];
  pregnancy: Summary["activeInputs"]["pregnancy"];
  liveMetrics: Array<{ label: string; value: string }>;
  compositeExplanation: string;
  hydration?: Summary["hydration"];
  professionalUpdates?: Summary["professionalUpdates"];
}

/** The server owns each derived field; this only recomposes explicitly owned slots. */
export function composeNutritionSummary(
  baseline: Summary,
  dynamic?: NutritionSummaryDynamicContext,
): Summary {
  if (!dynamic) return baseline;
  const stableDrivers = baseline.nutritionDrivers;
  const liveMetrics = [
    ...(stableDrivers?.liveMetrics ?? []),
    ...dynamic.liveMetrics,
  ];
  return {
    ...baseline,
    activeInputs: {
      ...baseline.activeInputs,
      performance: dynamic.performance,
      pregnancy: dynamic.pregnancy,
    },
    nutritionDrivers: stableDrivers || liveMetrics.length
      ? {
          medicalConditions: stableDrivers?.medicalConditions ?? [],
          therapeuticInputs: stableDrivers?.therapeuticInputs ?? [],
          liveMetrics,
        }
      : null,
    compositeExplanation: dynamic.compositeExplanation,
    hydration: dynamic.hydration,
    professionalUpdates: dynamic.professionalUpdates,
  };
}