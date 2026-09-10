import { getCreateDishServerErrorMessage } from "../createDishError";

describe("getCreateDishServerErrorMessage", () => {
  it("returns an approved structured user-facing message", () => {
    expect(
      getCreateDishServerErrorMessage({
        code: "HUMAN_FOOD_FINAL_REVIEW_REQUIRED",
        message: "We couldn't verify enough evidence to return this food safely.",
      }),
    ).toBe("We couldn't verify enough evidence to return this food safely.");
  });

  it("uses the deterministic explanation for a governed outcome", () => {
    expect(
      getCreateDishServerErrorMessage({
        outcome: {
          type: "REQUEST_BLOCKED_WITH_REASON",
          explanation: "Chicken thighs are on your Foods to Avoid list.",
        },
      }),
    ).toBe("Chicken thighs are on your Foods to Avoid list.");
  });

  it("shows the bounded Create a Dish intent-preservation message", () => {
    expect(
      getCreateDishServerErrorMessage({
        reasonCode: "create_dish_intent_not_preserved",
        message: "We couldn't preserve those preparation choices safely. Try changing one choice or use Surprise Me.",
      }),
    ).toBe(
      "We couldn't preserve those preparation choices safely. Try changing one choice or use Surprise Me.",
    );
  });

  it.each([
    { message: "Raw provider failure" },
    { code: "INTERNAL_PROVIDER_ERROR", message: "Raw provider failure" },
    {
      outcome: {
        type: "TECHNICAL_FAILURE",
        explanation: "Provider stack trace",
      },
    },
    { code: "HUMAN_FOOD_FINAL_REVIEW_REQUIRED", message: "" },
  ])("keeps the generic fallback for unsafe or unstructured errors", (response) => {
    expect(getCreateDishServerErrorMessage(response)).toBeNull();
  });
});