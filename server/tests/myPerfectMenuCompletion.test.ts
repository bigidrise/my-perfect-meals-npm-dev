jest.mock("../utils/openaiSafe", () => ({ chatJson: jest.fn() }));

import { menuCompletionMealType } from "../../shared/myPerfectMenuCompletion";
import type { MyPerfectMenuConcept } from "../../shared/myPerfectMenu";
import { canIndependentlyReviewSnack, completedSnackMatchesConcept } from "../services/myPerfectMenu/snackIdentity";
import { validateMenuOccasionBatch } from "../services/myPerfectMenu/occasionSuitability";

const slots = ["breakfast", "lunch", "dinner", "meal4", "meal5", "meal6", "snacks"] as const;
const cake = {
  id: "synthetic-cake", ideaType: "snack", snackType: "dessert",
  title: "Mango Coconut Cake", description: "Baked mango and coconut cake.",
  primaryIngredients: ["mango", "coconut", "almond flour"],
  foodIdentity: { foodRole: "dessert", polarity: "sweet", formatFamily: "cake" },
} as MyPerfectMenuConcept;
const spanishCake = {
  name: "Pastel de Mango y Coco",
  ingredients: ["mango", "coco", "harina de almendra"],
  instructions: ["Mezcla los ingredientes.", "Hornea el pastel y deja enfriar."],
};

describe("Development Menu completion preserves food independently of placement", () => {
  it.each(slots)("keeps a selected dessert on snack completion when placed in %s", slot => {
    expect(menuCompletionMealType("snack", slot, true)).toBe("snack");
  });
  it.each(slots)("does not activate the repair in the legacy/Production path for %s", slot => {
    expect(menuCompletionMealType("snack", slot, false)).toBe(slot === "snacks" ? "snack" : slot);
  });
  it.each(["breakfast", "lunch", "dinner"])("keeps the original %s preparation at another destination", occasion => {
    expect(menuCompletionMealType(occasion, "meal6", true)).toBe(occasion);
  });
  it("does not turn malformed occasions into new generator meal types", () => {
    expect(menuCompletionMealType("invalid", "meal4", true)).toBe("meal4");
  });
  it("requires independent full-recipe review for an equivalent translated name", async () => {
    expect(completedSnackMatchesConcept(cake, spanishCake)).toBe(false);
    expect(canIndependentlyReviewSnack(cake, spanishCake)).toBe(true);
    const assess = jest.fn().mockResolvedValue({
      assessments: [{ id: 0, fit: "appropriate", identity: "preserved", reason: "The same baked mango-coconut cake, named in Spanish." }],
    });
    expect(await validateMenuOccasionBatch("snack", [{
      title: spanishCake.name, primaryIngredients: spanishCake.ingredients,
      instructions: spanishCake.instructions,
    }], { selectedIdea: cake, assess })).toEqual([[]]);
    expect(assess.mock.calls[0][0].system).toContain("Equivalent translations preserve identity");
    expect(JSON.parse(assess.mock.calls[0][0].user).selectedIdea.foodIdentity).toEqual(cake.foodIdentity);
  });
  it("never treats review eligibility, copied fruit or snack suitability as identity acceptance", async () => {
    const mousse = { ...cake, title: "Mousse de Coco con Frutas Tropicales",
      foodIdentity: { foodRole: "dessert", polarity: "sweet", formatFamily: "pudding_custard" } } as MyPerfectMenuConcept;
    const chicken = { name: "Ensalada de Pollo con Mango y Piña",
      ingredients: ["pollo", "mango", "piña"], instructions: ["Cocina el pollo y sirve con las frutas."] };
    expect(completedSnackMatchesConcept(mousse, chicken)).toBe(false);
    const issues = await validateMenuOccasionBatch("snack", [{
      title: chicken.name, primaryIngredients: chicken.ingredients, instructions: chicken.instructions,
    }], { selectedIdea: mousse, assess: async () => ({
      assessments: [{ id: 0, fit: "appropriate", identity: "changed", reason: "Chicken salad is not coconut mousse, despite shared fruit." }],
    }) });
    expect(issues[0]).toEqual([expect.stringContaining("occasion_identity:changed")]);
  });
  it("retains known format rejections and refuses missing recipe evidence", () => {
    expect(canIndependentlyReviewSnack(cake, { ...spanishCake, name: "Mango Coconut Pudding" })).toBe(false);
    expect(canIndependentlyReviewSnack(cake, { ...spanishCake, name: "Mango Coconut Salad" })).toBe(false);
    expect(canIndependentlyReviewSnack({ ...cake, title: spanishCake.name }, { ...spanishCake, name: "Mango Coconut Cookies" })).toBe(false);
    expect(canIndependentlyReviewSnack(cake, { name: spanishCake.name })).toBe(false);
    expect(canIndependentlyReviewSnack(cake, { ...spanishCake, ingredients: [" ", {}] })).toBe(false);
    expect(canIndependentlyReviewSnack(cake, { ...spanishCake, instructions: [] })).toBe(false);
    expect(canIndependentlyReviewSnack({ ...cake, foodIdentity: undefined }, spanishCake)).toBe(false);
  });
  it.each(["changed", "uncertain"])("fails closed for %s independent identity", async identity => {
    const issues = await validateMenuOccasionBatch("snack", [{
      title: spanishCake.name, primaryIngredients: spanishCake.ingredients, instructions: spanishCake.instructions,
    }], { selectedIdea: cake, assess: async () => ({
      assessments: [{ id: 0, fit: "appropriate", identity, reason: "Identity is not established by the evidence." }],
    }) });
    expect(issues[0]).toHaveLength(1);
  });
  it("fails closed when the independent reviewer is unavailable", async () => {
    await expect(validateMenuOccasionBatch("snack", [{
      title: spanishCake.name, primaryIngredients: spanishCake.ingredients,
    }], { selectedIdea: cake, assess: async () => { throw new Error("offline"); } }))
      .rejects.toMatchObject({ code: "MY_PERFECT_MENU_OCCASION_CHECK_UNAVAILABLE" });
  });
});
