import {
  enforceGeneratedMeasurementValidation,
  INGREDIENT_MEASUREMENT_REPAIR_HINT,
} from "../services/humanFoodContext/generatedMeasurementValidation";
import {
  HUMAN_FOOD_VALIDATOR_VERSION,
  type HumanFoodFinalValidationResult,
} from "../../shared/humanFoodValidation";

const validIngredients = [
  { name: "chicken breast", quantity: "4", unit: "oz" },
];

const spanishIngredients = [
  { name: "pechuga de pollo", amount: "120", unit: "gramos" },
];

function result(
  outcome: HumanFoodFinalValidationResult["outcome"] = "pass",
): HumanFoodFinalValidationResult {
  return {
    validatorVersion: HUMAN_FOOD_VALIDATOR_VERSION,
    outcome,
    findings: [],
    authoritativeContextFingerprint: "test-context",
    candidateSignature: "test-candidate",
    repairInstructions: [],
  };
}

describe("Final generated measurement enforcement", () => {
  test("preserves valid English ingredients", () => {
    const original = result();
    expect(enforceGeneratedMeasurementValidation(
      original, validIngredients, true,
    )).toBe(original);
  });

  test("preserves valid Spanish ingredients", () => {
    const original = result();
    expect(enforceGeneratedMeasurementValidation(
      original, spanishIngredients, true,
    )).toBe(original);
  });

  test("rejects original defects concealed by normalization", () => {
    const checked = enforceGeneratedMeasurementValidation(
      result(), validIngredients, false,
    );
    expect(checked.outcome).toBe("repairable");
    expect(checked.repairInstructions).toContain(
      INGREDIENT_MEASUREMENT_REPAIR_HINT,
    );
  });

  test("rejects invalid final transformation measurements", () => {
    const checked = enforceGeneratedMeasurementValidation(
      result(),
      [{ name: "chicken breast", quantity: "0", unit: "oz" }],
      true,
    );
    expect(checked.outcome).toBe("repairable");
    expect(checked.findings[0].code).toBe(
      "final_ingredient_measurements_invalid",
    );
  });

  test.each(["blocked", "review_required"] as const)(
    "preserves existing %s outcome",
    outcome => {
      const checked = enforceGeneratedMeasurementValidation(
        result(outcome), validIngredients, false,
      );
      expect(checked.outcome).toBe(outcome);
      expect(checked.repairInstructions).toEqual([]);
    },
  );

  test("preserves existing repair instructions and context", () => {
    const original = result("repairable");
    original.repairInstructions = ["Preserve dietary identity"];

    const checked = enforceGeneratedMeasurementValidation(
      original, [], false,
    );

    expect(checked.repairInstructions).toContain(
      "Preserve dietary identity",
    );
    expect(checked.authoritativeContextFingerprint).toBe(
      original.authoritativeContextFingerprint,
    );
    expect(checked.candidateSignature).toBe(
      original.candidateSignature,
    );
    expect(original.findings).toEqual([]);
  });
});
