import {
  INGREDIENT_MEASUREMENT_ERROR_COPY,
  isIngredientMeasurementError,
} from "../ingredientMeasurementError";

const measurement = {
  code: "final_ingredient_measurements_invalid",
  outcome: "repairable",
};

describe("Ingredient measurement error protection", () => {
  test.each([
    { code: "INGREDIENT_SANITY_RETRY_EXHAUSTED" },
    { reasonCode: "INGREDIENT_SANITY_RETRY_EXHAUSTED" },
    {
      code: "HUMAN_FOOD_FINAL_VALIDATION_FAILED",
      findings: [measurement],
    },
  ])("recognizes measurement failures: %j", data => {
    expect(isIngredientMeasurementError(data)).toBe(true);
  });

  test.each([
    null,
    undefined,
    {},
    { code: "UNKNOWN_ERROR" },
    { code: "INGREDIENT_SANITY_RETRY_EXHAUSTED", safetyBlocked: true },
    { code: "INGREDIENT_SANITY_RETRY_EXHAUSTED", safetyAmbiguous: true },
    {
      code: "INGREDIENT_SANITY_RETRY_EXHAUSTED",
      outcome: { type: "REQUEST_BLOCKED_WITH_REASON" },
    },
    {
      code: "INGREDIENT_SANITY_RETRY_EXHAUSTED",
      outcome: { type: "REVIEW_REQUIRED_WITH_REASON" },
    },
    {
      code: "HUMAN_FOOD_FINAL_REVIEW_REQUIRED",
      findings: [measurement],
    },
    ...[
      { outcome: "blocked" },
      { outcome: "review_required" },
      { code: "final_nutrition_invalid" },
      { code: "final_serving_mismatch" },
    ].map(finding => ({
      code: "HUMAN_FOOD_FINAL_VALIDATION_FAILED",
      findings: [measurement, finding],
    })),
  ])("preserves higher-priority errors: %j", data => {
    expect(isIngredientMeasurementError(data)).toBe(false);
  });

  test("uses safe source-owned display copy", () => {
    expect(INGREDIENT_MEASUREMENT_ERROR_COPY).toBe(
      "We could not verify the ingredient measurements. Please try again."
    );
  });
});
