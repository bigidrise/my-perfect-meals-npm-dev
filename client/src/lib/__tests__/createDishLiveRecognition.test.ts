import {
  canRenderCreateDishPreparation,
  resolveCreateDishRecognitionSource,
  shouldApplyCreateDishRecognitionResult,
} from "../createDishLiveRecognition";

describe("Create a Dish live recognition coordinator", () => {
  test("manual chicken is recognized and may render preparation", () => {
    expect(resolveCreateDishRecognitionSource("chicken", "chicken")).toEqual({
      sourceText: "chicken",
      shouldMirror: false,
    });
    expect(canRenderCreateDishPreparation({
      resultSource: "chicken",
      currentVisibleValue: "chicken",
      status: "recognized",
    })).toBe(true);
  });

  test("voice chicken uses the same recognition source", () => {
    expect(resolveCreateDishRecognitionSource("chicken", "chicken").sourceText).toBe("chicken");
  });

  test("predictive DOM replacement wins over stale React state", () => {
    expect(resolveCreateDishRecognitionSource("chicken", "chi")).toEqual({
      sourceText: "chicken",
      shouldMirror: true,
    });
  });

  test("late chi response is ignored when the field displays chicken", () => {
    expect(shouldApplyCreateDishRecognitionResult({
      requestSource: "chi",
      currentVisibleValue: "chicken",
      responseSubmittedText: "chi",
    })).toBe(false);
    expect(canRenderCreateDishPreparation({
      resultSource: "chi",
      currentVisibleValue: "chicken",
      status: "unsupported",
    })).toBe(false);
  });

  test("pasted chicken uses the visible value", () => {
    expect(resolveCreateDishRecognitionSource("chicken", "").sourceText).toBe("chicken");
  });

  test("clear prevents an old recognition result from returning", () => {
    expect(shouldApplyCreateDishRecognitionResult({
      requestSource: "chicken",
      currentVisibleValue: "",
      responseSubmittedText: "chicken",
    })).toBe(false);
  });

  test("programmatic prefill uses the same normalized recognition source", () => {
    expect(resolveCreateDishRecognitionSource("  Chicken Breast  ", "").sourceText)
      .toBe("chicken breast");
  });
});