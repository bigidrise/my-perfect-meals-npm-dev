import {
  combineConsistencyComponents,
  combineMealConsistency,
} from "../services/complianceEngine";

describe("Nutrition Activity Consistency Score", () => {
  it("combines meal completion and meal logging equally", () => {
    expect(combineMealConsistency({
      completionRate: 80,
      loggingRate: 60,
    })).toBe(70);
  });

  it("uses logging as the meal-consistency signal before planned meals exist", () => {
    expect(combineMealConsistency({
      completionRate: null,
      loggingRate: 57,
    })).toBe(57);
  });

  it("excludes unavailable macro and Hydration components from the denominator", () => {
    expect(combineConsistencyComponents({
      mealConsistency: 72,
      macroAdherence: null,
      hydrationAdherence: null,
    })).toBe(72);
  });

  it("renormalizes the score when Hydration is measurable but macros are not", () => {
    expect(combineConsistencyComponents({
      mealConsistency: 80,
      macroAdherence: null,
      hydrationAdherence: 50,
    })).toBe(70);
  });
});