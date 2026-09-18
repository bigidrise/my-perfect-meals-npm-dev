import { scaleIngredientQuantity } from "../services/servingScaling";

describe("Craving Creator ingredient serving scaling", () => {
  it.each([
    ["2", 3, "6"],
    ["1/2", 2, "1"],
    ["1 1/2", 2, "3"],
  ])("scales %s by %s exactly once", (quantity, servings, expected) => {
    expect(scaleIngredientQuantity(quantity, servings)).toBe(expected);
  });

  it("preserves customary nonnumeric quantities instead of corrupting them", () => {
    expect(scaleIngredientQuantity("to taste", 3)).toBe("to taste");
  });
});