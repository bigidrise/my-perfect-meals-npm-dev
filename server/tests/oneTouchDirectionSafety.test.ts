import type { OneTouchDirection } from "@shared/oneTouch";
import { validateOneTouchDirectionSafety } from "../services/oneTouch/directions";

const direction = (ingredients: string[], cuisine = "Chinese") => ({
  title: "Stir-fried dinner",
  description: "A savory dinner",
  primaryIngredients: ingredients,
  preparationMethod: "stir-fried",
  cuisine,
}) as OneTouchDirection;

const context = {
  authorization: { status: "none", waivers: [] },
  safety: { allergies: ["shrimp"], avoidedFoods: ["mushroom"], healthConditions: [] },
  diet: { effective: ["vegan"] },
  nutrition: null,
  diabetesFoodPreferences: null,
} as any;

describe("One-Touch lightweight direction safety", () => {
  it("rejects known allergies and avoidances before asking the Creator for a recipe", () => {
    expect(validateOneTouchDirectionSafety(direction(["shrimp"]), context, undefined, "Chinese"))
      .toContain("forbidden_ingredient:shrimp");
    expect(validateOneTouchDirectionSafety(direction(["mushroom"]), context, undefined, "Chinese"))
      .toContain("forbidden_ingredient:mushroom");
  });

  it("rejects a dietary mismatch and an incompatible requested cuisine", () => {
    const violations = validateOneTouchDirectionSafety(direction(["chicken"], "Italian"), context, undefined, "Chinese");
    expect(violations.some((item) => item.startsWith("dietary:"))).toBe(true);
    expect(violations).toContain("cuisine_mismatch:Italian");
  });

  it("does not treat a non-Vegan request as Vegan when there is no effective Vegan diet", () => {
    const withVegan = validateOneTouchDirectionSafety(direction(["chicken"]), context, undefined, "Chinese");
    const withoutVegan = validateOneTouchDirectionSafety(
      direction(["chicken"]),
      { ...context, diet: { effective: [] } },
      undefined, "Chinese",
    );
    expect(withVegan.some((item) => item.startsWith("dietary:"))).toBe(true);
    expect(withoutVegan.some((item) => item.startsWith("dietary:"))).toBe(false);
  });
});