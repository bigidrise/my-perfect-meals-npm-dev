import {
  CreateDishIntentSchema,
  ExpandIngredientRequestSchema,
} from "../../shared/createDishIngredientExpansion";
import {
  buildCreateDishIntentPrompt,
  mealHonorsCreateDishIntent,
  revalidateCreateDishIntent,
} from "../services/createDish/createDishIntent";
import { expandCreateDishIngredient } from "../services/createDish/ingredientExpansionService";

async function chickenIntent() {
  const expansion = await expandCreateDishIngredient(
    ExpandIngredientRequestSchema.parse({
      ingredientInput: "Chicken",
      creator: "create_a_dish",
      useAiForGaps: false,
      surprisePolicy: {
        delegatedDimensions: [],
        selectedOptionIds: {
          form: "cubed",
          method: "stir-fried",
          texture: "tender-crisp",
          flavor: "teriyaki",
          cuisine: "japanese",
        },
      },
    }),
  );
  return CreateDishIntentSchema.parse({
    creator: "create_a_dish",
    originalText: "Chicken",
    ingredient: {
      canonicalId: expansion.ingredient.canonicalId,
      canonicalName: expansion.ingredient.canonicalName,
      category: expansion.ingredient.category,
    },
    resolvedCombination: expansion.resolvedCombination,
  });
}

describe("Create a Dish generation intent", () => {
  test("revalidates a coherent intent and builds an isolated culinary directive", async () => {
    const intent = await chickenIntent();
    const validated = await revalidateCreateDishIntent(intent, []);
    expect(validated.resolvedCombination.method?.id).toBe("stir-fried");
    expect(buildCreateDishIntentPrompt(validated)).toContain(
      "[CREATE A DISH — VALIDATED CULINARY INTENT]",
    );
  });

  test("rejects a tampered option ID", async () => {
    const intent = await chickenIntent();
    await expect(
      revalidateCreateDishIntent(
        {
          ...intent,
          resolvedCombination: {
            ...intent.resolvedCombination,
            method: { ...intent.resolvedCombination.method!, id: "laser-cooked" },
          },
        },
        [],
      ),
    ).rejects.toThrow();
  });

  test("checks preparation evidence in the generated recipe", async () => {
    const intent = await chickenIntent();
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Teriyaki Chicken Stir-Fry",
          ingredients: ["cubed chicken"],
          instructions: ["Stir-fry the diced chicken until tender-crisp."],
        },
        intent,
      ),
    ).toBe(true);
    expect(
      mealHonorsCreateDishIntent(
        { name: "Roast Chicken", instructions: ["Roast whole chicken."] },
        intent,
      ),
    ).toBe(false);
  });

  test("accepts imperative preparation wording but rejects negated evidence", async () => {
    const intent = await chickenIntent();
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Teriyaki Chicken",
          ingredients: ["diced chicken", "teriyaki sauce"],
          instructions: ["Stir fry the chicken until tender."],
        },
        intent,
      ),
    ).toBe(true);
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Teriyaki Chicken",
          ingredients: ["diced chicken", "teriyaki sauce"],
          instructions: ["Do not stir fry; bake the chicken instead."],
        },
        intent,
      ),
    ).toBe(false);
  });

  test("requires governed preparation evidence for the selected texture", async () => {
    const intent = await chickenIntent();
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Teriyaki Chicken",
          ingredients: ["diced chicken", "teriyaki sauce"],
          instructions: ["Stir fry quickly until the chicken is tender-crisp."],
        },
        intent,
      ),
    ).toBe(true);
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Teriyaki Chicken",
          ingredients: ["diced chicken", "teriyaki sauce"],
          instructions: ["Bake slowly until very soft."],
        },
        intent,
      ),
    ).toBe(false);
  });
});