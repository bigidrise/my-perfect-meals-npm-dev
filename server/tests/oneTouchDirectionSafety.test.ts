import type { OneTouchDirection } from "@shared/oneTouch";
import { validateOneTouchDirectionSafety } from "../services/oneTouch/directions";
import { buildGuestEnvelope } from "../services/protocolEnvelope";

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
  it("does not infer shrimp from a cuisine or cooking method but blocks explicitly named shrimp", () => {
    const safeContext = { ...context, diet: { effective: [] }, safety: { ...context.safety, avoidedFoods: [] } };
    expect(validateOneTouchDirectionSafety(
      { ...direction(["beef", "cauliflower"], "Thai"), title: "Beef and Cauliflower Stir-Fry" },
      safeContext, undefined, "Thai",
    )).toEqual([]);
    expect(validateOneTouchDirectionSafety(
      { ...direction(["chicken", "okra"], "Cajun"), title: "Chicken Gumbo" },
      safeContext, { ...buildGuestEnvelope(), allergies: ["shellfish"] }, "Cajun",
    )).toEqual([]);
    expect(validateOneTouchDirectionSafety(
      { ...direction(["shrimp", "cauliflower"], "Thai"), title: "Shrimp Stir-Fry" },
      safeContext, undefined, "Thai",
    )).toContain("forbidden_ingredient:shrimp");
  });
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