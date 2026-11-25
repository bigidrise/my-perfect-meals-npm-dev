import type { HumanFoodFinalValidationResult } from "../../../shared/humanFoodValidation";
import { validateGeneratedIngredientMeasurements } from "../calorieEstimator";

export const INGREDIENT_MEASUREMENT_REPAIR_HINT =
  "Provide every ingredient with an explicit positive numeric quantity and a supported measurement unit. Do not invent conversions. Preserve the requested recipe and all dietary and clinical protections.";

export function enforceGeneratedMeasurementValidation(
  result: HumanFoodFinalValidationResult,
  ingredients: unknown,
  originalMeasurementsValid: boolean,
): HumanFoodFinalValidationResult {
  if (
    originalMeasurementsValid &&
    validateGeneratedIngredientMeasurements(ingredients)
  ) {
    return result;
  }

  const outcome =
    result.outcome === "blocked" || result.outcome === "review_required"
      ? result.outcome
      : "repairable";

  return {
    ...result,
    outcome,
    findings: [
      ...result.findings,
      {
        dimension: "nutrition",
        outcome: "repairable",
        code: "final_ingredient_measurements_invalid",
        message: "Ingredient measurements could not be verified.",
        assurance: "deterministic",
        repairHint: INGREDIENT_MEASUREMENT_REPAIR_HINT,
      },
    ],
    repairInstructions:
      outcome === "repairable"
        ? [...result.repairInstructions, INGREDIENT_MEASUREMENT_REPAIR_HINT]
        : [],
  };
}
