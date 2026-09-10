import {
  CreateDishIntentSchema,
  ExpandIngredientRequestSchema,
} from "../../shared/createDishIngredientExpansion";
import {
  buildCreateDishIntentPrompt,
  buildCreateDishIntentDishSubject,
  evaluateCreateDishIntentEvidence,
  isBroadIngredientOnlyCreateDishIntent,
  mealHonorsCreateDishIntent,
  revalidateCreateDishIntent,
} from "../services/createDish/createDishIntent";
import { expandCreateDishIngredient } from "../services/createDish/ingredientExpansionService";
import { resolveVarietyClassificationInput } from "../services/createDish/varietyClassificationInput";

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
    resolvedCombination: {
      form: expansion.resolvedCombination?.form ?? null,
      texture: expansion.resolvedCombination?.texture ?? null,
      flavor: expansion.resolvedCombination?.flavor ?? null,
      selectionSource: {
        form: expansion.resolvedCombination?.selectionSource.form ?? "not_applicable",
        texture: expansion.resolvedCombination?.selectionSource.texture ?? "not_applicable",
        flavor: expansion.resolvedCombination?.selectionSource.flavor ?? "not_applicable",
      },
    },
  });
}

async function intentFor(
  ingredientInput: string,
  selectedOptionIds: { form?: string; texture?: string; flavor?: string },
) {
  const expansion = await expandCreateDishIngredient(
    ExpandIngredientRequestSchema.parse({
      ingredientInput,
      creator: "create_a_dish",
      useAiForGaps: false,
      surprisePolicy: {
        delegatedDimensions: [],
        selectedOptionIds,
      },
    }),
  );
  if (!expansion.resolvedCombination) throw new Error(`Missing test combination for ${ingredientInput}`);
  return CreateDishIntentSchema.parse({
    creator: "create_a_dish",
    originalText: ingredientInput,
    ingredient: {
      canonicalId: expansion.ingredient.canonicalId,
      canonicalName: expansion.ingredient.canonicalName,
      category: expansion.ingredient.category,
    },
    resolvedCombination: {
      form: expansion.resolvedCombination.form,
      texture: expansion.resolvedCombination.texture,
      flavor: expansion.resolvedCombination.flavor,
      selectionSource: {
        form: expansion.resolvedCombination.selectionSource.form,
        texture: expansion.resolvedCombination.selectionSource.texture,
        flavor: expansion.resolvedCombination.selectionSource.flavor,
      },
    },
  });
}

describe("Create a Dish generation intent", () => {
  test("keeps appended instructions out of Variety classification input", () => {
    const augmented = "Salmon\n\nSafety remains authoritative; adapt if one requires a change.";
    expect(resolveVarietyClassificationInput(augmented, "Salmon")).toBe("Salmon");
    expect(resolveVarietyClassificationInput(augmented, "Salmon")).not.toContain("change");
  });

  test("distinguishes a broad ingredient from an explicit prepared dish", async () => {
    const intent = await chickenIntent();
    expect(
      isBroadIngredientOnlyCreateDishIntent({
        ...intent,
        originalText: "Chicken!",
      }),
    ).toBe(true);
    expect(
      isBroadIngredientOnlyCreateDishIntent({
        ...intent,
        originalText: "crispy teriyaki chicken thighs",
      }),
    ).toBe(false);
  });

  test("revalidates a coherent intent and builds an isolated culinary directive", async () => {
    const intent = await chickenIntent();
    const validated = await revalidateCreateDishIntent(intent, []);
    expect(validated.resolvedCombination.form?.id).toBe("cubed");
    expect(validated.resolvedCombination.texture?.id).toBe("tender-crisp");
    expect(validated.resolvedCombination.flavor?.id).toBe("teriyaki");
    expect(buildCreateDishIntentPrompt(validated)).toContain(
      "[CREATE A DISH — HARD CULINARY INTENT]",
    );
    expect(buildCreateDishIntentPrompt(validated)).toContain(
      "Do not vary any selected form/cut, texture, or flavor.",
    );
  });

  test.each([
    ["Chicken", { form: "cubed", texture: "crispy-exterior", flavor: "teriyaki" }],
    ["Salmon", { texture: "flaky", flavor: "lemon-herb" }],
    ["Tofu", { texture: "crunchy", flavor: "korean-inspired" }],
    ["Turkey", { form: "ground", flavor: "mexican-inspired" }],
  ])("revalidates the Phase 3 hard-intent combination for %s", async (ingredient, selections) => {
    const intent = await intentFor(ingredient, selections);
    const validated = await revalidateCreateDishIntent(intent, []);
    expect(validated.ingredient.canonicalName).toBe(ingredient);
    expect(validated.resolvedCombination.form?.id ?? null).toBe(selections.form ?? null);
    expect(validated.resolvedCombination.texture?.id ?? null).toBe(selections.texture ?? null);
    expect(validated.resolvedCombination.flavor?.id ?? null).toBe(selections.flavor ?? null);
    const prompt = buildCreateDishIntentPrompt(validated);
    expect(prompt).toContain("[CREATE A DISH — HARD CULINARY INTENT]");
    for (const selectedId of Object.values(selections)) {
      expect(prompt.toLowerCase()).toContain(selectedId.replace(/-/g, " ").split(" ")[0]);
    }
  });

  test("rejects a tampered option ID", async () => {
    const intent = await chickenIntent();
    await expect(
      revalidateCreateDishIntent(
        {
          ...intent,
          resolvedCombination: {
            ...intent.resolvedCombination,
            form: { ...intent.resolvedCombination.form!, id: "laser-cut" },
          },
        },
        [],
      ),
    ).rejects.toThrow();
  });

  test("rejects stale hidden Method and Cuisine expansion fields", async () => {
    const intent = await chickenIntent();
    await expect(
      revalidateCreateDishIntent(
        {
          ...intent,
          resolvedCombination: {
            ...intent.resolvedCombination,
            method: {
              id: "air-fried",
              label: "Air-Fried",
              dimension: "method",
              compatibleWith: [],
              incompatibleWith: [],
              source: "catalog",
            },
            cuisine: {
              id: "cajun",
              label: "Cajun",
              dimension: "cuisine",
              compatibleWith: [],
              incompatibleWith: [],
              source: "catalog",
            },
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

  test("accepts bounded Flaked salmon and Lemon Herb culinary evidence", async () => {
    const intent = await intentFor("Salmon", {
      form: "flaked",
      flavor: "lemon-herb",
    });
    const evidence = evaluateCreateDishIntentEvidence(
      {
        name: "Lemon and Herb Salmon",
        ingredients: ["salmon fillet", "lemon", "parsley"],
        instructions: ["Cook gently until the salmon separates into flakes."],
      },
      intent,
    );
    expect(evidence).toMatchObject({
      ingredient: true,
      form: true,
      flavor: true,
      passed: true,
    });
  });

  test("accepts crunchy Korean-inspired tofu through governed culinary markers", async () => {
    const intent = await intentFor("Tofu", {
      texture: "crunchy",
      flavor: "korean-inspired",
    });
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Gochujang Tofu",
          ingredients: ["tofu", "gochujang", "sesame oil"],
          instructions: ["Air-fry until the tofu is crispy and golden-brown."],
        },
        intent,
      ),
    ).toBe(true);
  });

  test("requires actual Ground and Mexican-Inspired turkey evidence", async () => {
    const intent = await intentFor("Turkey", {
      form: "ground",
      flavor: "mexican-inspired",
    });
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Chipotle Ground Turkey Bowl",
          ingredients: ["ground turkey", "chipotle", "black beans"],
          instructions: ["Brown the minced turkey with chipotle seasoning."],
        },
        intent,
      ),
    ).toBe(true);
    const wholeRoastEvidence = evaluateCreateDishIntentEvidence(
      {
        name: "Herb-Roasted Turkey",
        ingredients: ["whole turkey", "rosemary"],
        instructions: ["Never use ground turkey; roast the turkey whole."],
      },
      intent,
    );
    expect(wholeRoastEvidence.form).toBe(false);
    expect(wholeRoastEvidence.flavor).toBe(false);
    expect(wholeRoastEvidence.passed).toBe(false);
    expect(buildCreateDishIntentDishSubject(intent)).toBe(
      "Ground Mexican-Inspired Turkey",
    );
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Turkey with Warm Spices",
          ingredients: ["turkey breast", "ground cumin", "chipotle"],
          instructions: ["The turkey is not ground; roast the breast whole."],
        },
        intent,
      ),
    ).toBe(false);
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Turkey with Diced Onion",
          ingredients: ["turkey breast", "diced onion", "chipotle"],
          instructions: ["Roast the turkey breast with diced onion."],
        },
        intent,
      ),
    ).toBe(false);
    for (const replacementInstruction of [
      "Replace ground turkey with whole turkey.",
      "Use whole turkey rather than ground turkey.",
      "Swap ground turkey for whole turkey.",
      "Substitute whole turkey for ground turkey.",
    ]) {
      expect(
        mealHonorsCreateDishIntent(
          {
            name: "Chipotle Turkey",
            ingredients: ["turkey", "chipotle"],
            instructions: [replacementInstruction],
          },
          intent,
        ),
      ).toBe(false);
    }
  });

  test("recognizes Ground when the canonical ingredient already encodes the form", async () => {
    const intent = await intentFor("Ground Beef", {
      form: "ground",
      flavor: "mexican-inspired",
    });
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Chipotle Ground Beef Bowl",
          ingredients: ["ground beef", "chipotle", "black beans"],
          instructions: ["Brown the ground beef with chipotle."],
        },
        intent,
      ),
    ).toBe(true);
  });

  test("does not treat standalone purpose wording as texture negation", async () => {
    const intent = await intentFor("Chicken", {
      form: "cubed",
      texture: "crispy-exterior",
      flavor: "teriyaki",
    });
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Teriyaki Chicken",
          ingredients: ["cubed chicken", "teriyaki sauce"],
          instructions: ["Bake for crispy edges, then glaze with teriyaki sauce."],
        },
        intent,
      ),
    ).toBe(true);
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Teriyaki Chicken",
          ingredients: ["cubed chicken", "teriyaki sauce"],
          instructions: ["Cook without oil until crispy, then add teriyaki sauce."],
        },
        intent,
      ),
    ).toBe(true);
  });

  test("recognizes the simple form ID within an alternative-label form", async () => {
    const intent = await intentFor("Salmon", {
      form: "patties",
      flavor: "lemon-herb",
    });
    expect(
      mealHonorsCreateDishIntent(
        {
          name: "Lemon Herb Salmon Patties",
          ingredients: ["salmon patties", "lemon", "parsley"],
          instructions: ["Cook the salmon patties until browned."],
        },
        intent,
      ),
    ).toBe(true);
  });

  test("accepts a selected form when it is the affirmative replacement target", async () => {
    const intent = await intentFor("Turkey", {
      form: "ground",
      flavor: "mexican-inspired",
    });
    for (const instruction of [
      "Replace whole turkey with ground turkey and season with chipotle.",
      "Swap whole turkey for ground turkey and season with chipotle.",
      "Substitute ground turkey for whole turkey and season with chipotle.",
    ]) {
      expect(
        mealHonorsCreateDishIntent(
          {
            name: "Chipotle Turkey",
            ingredients: ["ground turkey", "chipotle"],
            instructions: [instruction],
          },
          intent,
        ),
      ).toBe(true);
    }
  });
});