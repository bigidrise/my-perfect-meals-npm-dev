import { CreateDishIntentSchema, type CreateDishSemanticIntent } from "../../shared/createDishIngredientExpansion";
import { FoodMeaningV1Schema } from "../../shared/foodMeaning";
import { buildCreateDishIntentPrompt, buildCreateDishIntentRepairInstructions, evaluateCreateDishIntentEvidence } from "../services/createDish/createDishIntent";
import { resolveCreateDishContract } from "../services/createDish/dishContract";
import { createDishMeaningEnabled, enrichFoodMeaning, resolveCreateDishFoodMeaning } from "../services/createDish/resolveFoodMeaning";
import type { DishAdaptationDirective } from "../services/dishAdaptation/types";

const intent = (originalText: string, cuisine: string | null = null) => CreateDishIntentSchema.parse({
  creator: "create_a_dish",
  originalText,
  cuisine,
  ingredient: { canonicalId: "semantic-gumbo", canonicalName: "gumbo", category: "prepared-dish" },
  resolvedCombination: {
    form: null, texture: null, flavor: null,
    selectionSource: { form: "not_applicable", texture: "not_applicable", flavor: "not_applicable" },
  },
});

const semantic = (cuisine: string): CreateDishSemanticIntent => ({
  source: "semantic",
  kind: "prepared_dish",
  canonicalName: "gumbo",
  displayName: "Gumbo",
  cuisine,
  explicitIngredients: [],
  confidence: "high",
  clarification: null,
});

const directive: DishAdaptationDirective = {
  identityAnchor: "This is gumbo",
  dishForm: "stew/broth-based",
  definingComponents: ["roux", "stock (chicken or seafood)", "the ", "vegetables"],
  adaptableComponents: ["protein"],
  conflicts: [],
  adaptationBlock: "",
};

describe("Create a Dish food meaning v1", () => {
  test("is default-off and cannot activate in production", () => {
    const previous = process.env.CREATE_DISH_FOOD_MEANING_V1;
    const node = process.env.NODE_ENV;
    try {
      delete process.env.CREATE_DISH_FOOD_MEANING_V1;
      expect(createDishMeaningEnabled()).toBe(false);
      process.env.CREATE_DISH_FOOD_MEANING_V1 = "true";
      process.env.NODE_ENV = "production";
      expect(createDishMeaningEnabled()).toBe(false);
      process.env.NODE_ENV = "development";
      expect(createDishMeaningEnabled()).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.CREATE_DISH_FOOD_MEANING_V1;
      else process.env.CREATE_DISH_FOOD_MEANING_V1 = previous;
      process.env.NODE_ENV = node;
    }
  });

  test("plain gumbo accepts a server-verified inferred cuisine, not a client assertion", async () => {
    const result = await resolveCreateDishFoodMeaning(intent("gumbo", "Creole"), null, [],
      async () => semantic("Cajun"));
    expect(result.meaning.cuisine).toEqual({ value: "Cajun", source: "semantic_inference" });
    expect(result.intent.cuisine).toBeNull();
    expect(result.meaning.concept.kind).toBe("prepared_dish");
  });

  test.each(["Cajun", "Creole"])("%s gumbo retains explicitly typed cuisine", async cuisine => {
    const interpret = jest.fn(async () => semantic(cuisine));
    const result = await resolveCreateDishFoodMeaning(intent(`${cuisine} gumbo`, cuisine), null, [], interpret);
    expect(result.meaning.cuisine).toEqual({ value: cuisine, source: "user_text" });
    expect(interpret).toHaveBeenCalledTimes(1);
  });

  test("manual cuisine remains distinct from an inferred claim", async () => {
    const result = await resolveCreateDishFoodMeaning(intent("gumbo", "Creole"), "Cajun", [],
      async () => semantic("Creole"));
    expect(result.meaning.cuisine).toEqual({ value: "Cajun", source: "user_selection" });
  });

  test("a different semantic dish cannot authorize a nonliteral cuisine", async () => {
    await expect(resolveCreateDishFoodMeaning(intent("gumbo", "Creole"), null, [],
      async () => ({ ...semantic("Creole"), canonicalName: "pizza" })))
      .rejects.toThrow("SEMANTIC_CLASSIFICATION_INCONSISTENT");
  });

  test.each([
    ["wine cooler", "cooler"],
    ["ice cream sandwich", "sandwich"],
    ["chicken fried steak", "chicken"],
    ["Boston cream pie", "pie"],
    ["peanut butter", "butter"],
  ])("preserves the compound concept %s rather than a constituent %s", async (phrase, fragment) => {
    const raw = CreateDishIntentSchema.parse({
      ...intent(phrase),
      ingredient: { canonicalId: `semantic-${phrase.replaceAll(" ", "-")}`, canonicalName: phrase, category: "prepared-dish" },
    });
    const interpret = async (): Promise<CreateDishSemanticIntent> => ({
      ...semantic(""), canonicalName: phrase, displayName: phrase, cuisine: null,
    });
    const result = await resolveCreateDishFoodMeaning(raw, null, [], interpret);
    expect(result.meaning.concept.canonicalName).toBe(phrase);
    expect(result.meaning.concept.canonicalName).not.toBe(fragment);
    await expect(resolveCreateDishFoodMeaning(raw, null, [], async () => ({
      ...await interpret(), canonicalName: fragment,
    }))).rejects.toThrow("SEMANTIC_CLASSIFICATION_INCONSISTENT");
  });

  test("gumbo is a prepared dish, not an ingredient named gumbo", async () => {
    const { intent: resolved, meaning } = await resolveCreateDishFoodMeaning(intent("Creole gumbo", "Creole"), null, []);
    const enriched = enrichFoodMeaning(meaning, directive);
    expect(FoodMeaningV1Schema.parse(enriched).components[0].role).toBe("defining");
    const contract = resolveCreateDishContract(resolved, directive, enriched);
    const good = {
      name: "Creole Gumbo",
      description: "A Creole stew with okra and a dark roux.",
      ingredients: [{ name: "dark roux" }, { name: "chicken stock" }, { name: "okra" }, { name: "chicken" }],
      instructions: ["Simmer the roux with stock, okra, and chicken into a gumbo."],
    };
    expect(evaluateCreateDishIntentEvidence(good, resolved, contract, enriched).passed).toBe(true);
    expect(evaluateCreateDishIntentEvidence({
      name: "Creole Gumbo",
      ingredients: [{ name: "chicken" }, { name: "lettuce" }],
      instructions: ["Grill and serve in a salad."],
    }, resolved, contract, enriched).ingredient).toBe(false);
    expect(buildCreateDishIntentPrompt(resolved, enriched)).toContain("its name is not a recipe ingredient");
    expect(buildCreateDishIntentRepairInstructions(resolved, ["ingredient"], contract))
      .toContain("do not list the prepared dish itself as an ingredient");
  });

  test("legacy ingredient requests still require actual ingredient evidence", () => {
    const chicken = CreateDishIntentSchema.parse({
      ...intent("chicken"),
      ingredient: { canonicalId: "chicken", canonicalName: "Chicken", category: "protein" },
    });
    expect(evaluateCreateDishIntentEvidence({
      name: "Chicken Dinner", ingredients: [{ name: "tofu" }], instructions: ["Serve."],
    }, chicken).ingredient).toBe(false);
  });
});