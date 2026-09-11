import {
  canRenderCreateDishPreparation,
  getCreateDishClassificationOutcome,
  shouldAcceptCreateDishClassification,
} from "../createDishClassificationStep";

describe("Create a Dish explicit classification step", () => {
  test("accepts chicken captured when Continue is pressed", () => {
    expect(shouldAcceptCreateDishClassification({
      requestSource: "chicken",
      currentVisibleValue: "chicken",
      responseSubmittedText: "chicken",
    })).toBe(true);
    expect(getCreateDishClassificationOutcome("recognized")).toBe("ready");
  });

  test("accepts predictive text through the captured visible value, not stale mirrored state", () => {
    const visibleValue = "chicken";
    expect(shouldAcceptCreateDishClassification({
      requestSource: visibleValue,
      currentVisibleValue: visibleValue,
      responseSubmittedText: "chicken",
    })).toBe(true);
  });

  test("rejects a response when the visible value changed during classification", () => {
    expect(shouldAcceptCreateDishClassification({
      requestSource: "chicken",
      currentVisibleValue: "salmon",
      responseSubmittedText: "chicken",
    })).toBe(false);
  });

  test("recognized food may render preparation only for the classified value", () => {
    expect(canRenderCreateDishPreparation({
      resultSource: "chicken",
      classifiedValue: "chicken",
      status: "recognized",
    })).toBe(true);
    expect(canRenderCreateDishPreparation({
      resultSource: "chicken",
      classifiedValue: "salmon",
      status: "recognized",
    })).toBe(false);
  });

  test("clarification-required food stays in the first step", () => {
    expect(getCreateDishClassificationOutcome("clarification_required"))
      .toBe("needs_clarification");
  });

  test("unsupported food stays in the first step", () => {
    expect(getCreateDishClassificationOutcome("unsupported")).toBe("unsupported");
  });

  test("clarification-recommended food may continue with its preparation choices", () => {
    expect(getCreateDishClassificationOutcome("clarification_recommended")).toBe("ready");
  });
});