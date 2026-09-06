import { buildCreateDishValidationOutcome } from "../services/humanFoodContext/createDishOutcome";

describe("Create a Dish outcome contract", () => {
  it("returns the actual governing rule and safe explanation for a block", () => {
    const outcome = buildCreateDishValidationOutcome("blocked", [{
      dimension: "avoidance",
      outcome: "blocked",
      code: "avoidance:chicken thighs",
      message: "Chicken thighs are on your Foods to Avoid list.",
      assurance: "deterministic",
    }]);

    expect(outcome).toEqual({
      type: "REQUEST_BLOCKED_WITH_REASON",
      governingReasonCode: "avoidance:chicken thighs",
      explanation: "Chicken thighs are on your Foods to Avoid list.",
      requestedDishPreserved: true,
      ingredientsOrPreparationAdapted: false,
      alternativesAvailable: false,
    });
  });

  it("reports review-required evidence without calling it a technical failure", () => {
    const outcome = buildCreateDishValidationOutcome("review_required", [{
      dimension: "dietary_identity",
      outcome: "review_required",
      code: "dietary_identity_unsupported:unknown",
      message: "This dietary identity cannot be verified.",
      assurance: "cannot_guarantee",
    }]);

    expect(outcome.type).toBe("REVIEW_REQUIRED_WITH_REASON");
    expect(outcome.governingReasonCode).toBe(
      "dietary_identity_unsupported:unknown",
    );
    expect(outcome.explanation).toBe(
      "This dietary identity cannot be verified.",
    );
  });
});