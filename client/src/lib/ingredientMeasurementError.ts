export const INGREDIENT_MEASUREMENT_ERROR_COPY =
  "We could not verify the ingredient measurements. Please try again.";

export function isIngredientMeasurementError(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;

  const response = data as {
    code?: unknown;
    reasonCode?: unknown;
    safetyBlocked?: boolean;
    safetyAmbiguous?: boolean;
    findings?: Array<{ code?: string; outcome?: string }>;
    outcome?: { type?: string };
  };

  if (
    response.safetyBlocked ||
    response.safetyAmbiguous ||
    response.outcome?.type === "REQUEST_BLOCKED_WITH_REASON" ||
    response.outcome?.type === "REVIEW_REQUIRED_WITH_REASON"
  ) return false;

  if (response.code === "HUMAN_FOOD_FINAL_REVIEW_REQUIRED") return false;

  const findings = Array.isArray(response.findings) ? response.findings : [];

  if (findings.some(finding =>
    finding?.outcome === "blocked" ||
    finding?.outcome === "review_required" ||
    finding?.code === "final_nutrition_invalid" ||
    finding?.code === "final_serving_mismatch"
  )) return false;

  return (
    response.code === "INGREDIENT_SANITY_RETRY_EXHAUSTED" ||
    response.reasonCode === "INGREDIENT_SANITY_RETRY_EXHAUSTED" ||
    (
      response.code === "HUMAN_FOOD_FINAL_VALIDATION_FAILED" &&
      findings.some(finding =>
        finding?.code === "final_ingredient_measurements_invalid"
      )
    )
  );
}
