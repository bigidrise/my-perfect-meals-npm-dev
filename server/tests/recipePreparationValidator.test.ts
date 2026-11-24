import {
  filterPreparedMealResponse, isPreparedRecipe, validateRecipePreparation,
} from "../services/recipePreparationValidator";

const recipe = (name: string, instructions: string | string[], extra = {}) => ({
  ingredients: [{ name, quantity: "1", unit: "cup", ...extra }], instructions,
});
const strict = (value: Parameters<typeof validateRecipePreparation>[0]) =>
  validateRecipePreparation(value, { strictIngredientForms: true });

describe("shared ingredient-form and preparation consistency", () => {
  it.each([
    ["dried lentils", "Simmer dried lentils in water for 25 minutes."],
    ["lentejas secas", "Hervir las lentejas secas en agua durante 25 minutos."],
    ["dried black beans", "Boil dried black beans in broth for 90 minutes."],
    ["frijoles secos", "Cocine los frijoles secos en agua durante 2 horas."],
    ["uncooked rice", "Cook uncooked rice in water for 20 minutes."],
    ["arroz crudo", "Cocina el arroz crudo en caldo durante 20 minutos."],
    ["canned lentils, drained", "Fold canned lentils into the salad."],
    ["lentejas enlatadas escurridas", "Mezcla las lentejas enlatadas con la ensalada."],
    ["cooked rice", "Fry cooked rice with vegetables."],
    ["precooked beans", "Warm precooked beans and serve."],
    ["frozen cooked rice", "Steam the frozen cooked rice for 5 minutes."],
    ["fresh green beans", "Steam green beans until tender."],
    ["rice flour", "Mix rice flour with milk. Bake for 30 minutes."],
    ["chickpea flour", "Mix chickpea flour into batter and bake."],
  ])("accepts coherent %s without rewriting it", (name, instructions) => {
    const value = recipe(name, instructions);
    const snapshot = JSON.stringify(value);
    expect(strict(value)).toMatchObject({ isValid: true, errors: [] });
    expect(JSON.stringify(value)).toBe(snapshot);
  });

  it.each([
    ["lentils", "Warm lentils and serve."],
    ["beans", "Stir beans into the salad."],
    ["rice", "Fry rice with vegetables."],
    ["dried lentils", "Fold cooked lentils into salad."],
    ["lentejas secas", "Añade las lentejas cocidas a la ensalada."],
    ["dried beans", "Add beans and serve."],
    ["uncooked rice", "Add rice to the salad."],
    ["arroz crudo", "Mezclar el arroz cocido con tomate."],
    ["canned dried lentils", "Simmer lentils in water for 25 minutes."],
    ["canned beans", "Soak overnight. Boil beans in water for 90 minutes."],
    ["canned lentils, drained", "Add lentils without draining."],
    ["lentejas enlatadas escurridas", "Agregar las lentejas sin escurrir."],
    ["frozen beans", "Use fresh beans in the salad."],
    ["raw chicken", "Shred cooked chicken into the salad."],
    ["canned tomatoes, drained", "Add tomatoes without draining."],
    ["frozen berries", "Use fresh berries for garnish."],
  ])("rejects inconsistent or ambiguous %s", (name, instructions) => {
    expect(strict(recipe(name, instructions)).isValid).toBe(false);
  });

  it("preserves the original non-strict ambiguity warning", () => {
    expect(validateRecipePreparation(recipe("lentils", "Warm lentils.")))
      .toMatchObject({ isValid: true, warnings: [expect.any(String)] });
  });

  it.each([
    { notes: "dried" }, { preparationNote: "dried" },
    { _universal: { notes: "dried", quantity: 1, unit: "cup" } },
  ])("uses ingredient form evidence retained in notes: %p", extra => {
    expect(strict(recipe("lentils", "Fold lentils into the salad.", extra)).isValid).toBe(false);
    expect(strict(recipe("lentils", ["Add lentils to water.", "Simmer for 25 minutes."], extra)).isValid).toBe(true);
  });

  it("supports plain string ingredients without losing their amounts or forms", () => {
    expect(strict({
      ingredients: ["1 cup dried lentils"],
      instructions: "Simmer 1 cup dried lentils in water for 25 minutes.",
    }).isValid).toBe(true);
  });

  it("does not borrow the rice's cooking evidence for uncooked lentils", () => {
    expect(strict({
      ingredients: [{ name: "uncooked rice" }, { name: "dried lentils" }],
      instructions: ["Cook rice in water for 20 minutes.", "Fold lentils into the salad."],
    }).errors).toEqual(expect.arrayContaining([expect.stringContaining("lentils")]));
  });

  it("does not borrow cooking evidence from another named protein", () => {
    expect(strict({
      ingredients: [{ name: "chicken" }, { name: "dried lentils" }],
      instructions: ["Boil chicken in water for 25 minutes.", "Fold lentils into salad."],
    }).isValid).toBe(false);
  });

  it("accepts explicit joint cooking steps for two uncooked staples", () => {
    expect(strict({
      ingredients: [{ name: "uncooked rice" }, { name: "dried lentils" }],
      instructions: ["Add rice and lentils to water.", "Simmer for 30 minutes."],
    }).isValid).toBe(true);
  });

  it("rejects a changed explicit same-form quantity, but allows documented divided amounts", () => {
    expect(strict(recipe("dried lentils", "Simmer 2 cups dried lentils in water for 25 minutes.")).isValid).toBe(false);
    expect(strict(recipe("dried lentils", "Reserve half. Simmer the remaining 1/2 cup dried lentils in water for 25 minutes.")).isValid).toBe(true);
  });

  it("keeps decimal quantities intact when splitting instruction steps", () => {
    const value = recipe("dried lentils", "Simmer 1.5 cups dried lentils in water for 25 minutes.", { quantity: "1.5" });
    expect(strict(value).isValid).toBe(true);
  });

  it("allows cooking the listed dried amount before using the cooked result", () => {
    expect(strict(recipe("dried lentils", [
      "Simmer 1 cup dried lentils in water for 25 minutes.",
      "Drain and fold the cooked lentils into the salad.",
    ])).isValid).toBe(true);
  });

  it.each([
    { ingredients: [], instructions: "Bake." },
    { ingredients: ["dried lentils"], instructions: "" },
    { ingredients: [null], instructions: ["Cook."] },
  ])("rejects incomplete recipe payloads without throwing", value => {
    expect(isPreparedRecipe(value)).toBe(false);
  });

  it("preserves valid survivors, nutrition and original quantities at response release", () => {
    const good = { ...recipe("canned lentils", "Warm lentils."), calories: 300, carbs: 40 };
    const bad = { ...recipe("dried lentils", "Warm cooked lentils."), calories: 300 };
    const response = { success: true, source: "ai", meal: bad, meals: [bad, good] };
    const released = filterPreparedMealResponse(response);
    expect(released).toMatchObject({ success: true, meal: good, meals: [good] });
    expect((released as typeof response).meal).toBe(good);
    expect(response.meals).toEqual([bad, good]);
    expect(filterPreparedMealResponse({ success: true, meal: bad }).success).toBe(false);
    const blocked = { success: false, error: "allergy" };
    expect(filterPreparedMealResponse(blocked)).toBe(blocked);
  });
});
