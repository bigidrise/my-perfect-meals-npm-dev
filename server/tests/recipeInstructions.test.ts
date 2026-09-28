import { parseGeneratedRecipeSteps } from "../services/recipeInstructions";

describe("generated recipe instructions", () => {
  it("preserves ordered discrete steps without joining them", () => {
    expect(parseGeneratedRecipeSteps([
      "Heat the oil.", "Add the vegetables.", "Serve warm.",
    ])).toEqual(["Heat the oil.", "Add the vegetables.", "Serve warm."]);
  });

  it("repairs a model response with numbered legacy prose only at the generation boundary", () => {
    expect(parseGeneratedRecipeSteps("1. Heat the oil. 2. Add the vegetables. 3. Serve warm."))
      .toEqual(["Heat the oil.", "Add the vegetables.", "Serve warm."]);
    expect(parseGeneratedRecipeSteps(["1. Heat the oil. 2. Serve warm."]))
      .toEqual(["Heat the oil.", "Serve warm."]);
    expect(parseGeneratedRecipeSteps(["Heat the oil. Serve warm."]))
      .toEqual(["Heat the oil.", "Serve warm."]);
  });

  it("fails on missing or malformed steps rather than inventing a recipe", () => {
    expect(() => parseGeneratedRecipeSteps(undefined)).toThrow();
    expect(() => parseGeneratedRecipeSteps(["Heat the oil.", null])).toThrow();
  });
});