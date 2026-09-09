import { ExpandIngredientRequestSchema } from "../../shared/createDishIngredientExpansion";
import { expandCreateDishIngredient } from "../services/createDish/ingredientExpansionService";

const request = (ingredientInput: string, extra: Record<string, unknown> = {}) =>
  ExpandIngredientRequestSchema.parse({
    ingredientInput,
    creator: "create_a_dish",
    useAiForGaps: false,
    ...extra,
  });

describe("Create a Dish ingredient expansion", () => {
  test.each([
    ["Chicken", ["breast", "thigh", "ground"]],
    ["Beef", ["steak-cut", "ground", "strips"]],
    ["Salmon", ["fillet", "chunks", "flaked"]],
    ["Duck", ["breast", "leg", "shredded"]],
    ["Tofu", ["cubes", "slabs", "crumbled"]],
    ["Pork", ["tenderloin", "chops", "ground"]],
    ["Eggs", ["whole", "whisked", "separated"]],
    ["Broccoli", ["florets", "chopped", "stems"]],
    ["Octopus", ["tentacles", "whole-small", "sliced"]],
  ])("%s receives governed forms", async (input, expected) => {
    const result = await expandCreateDishIngredient(request(input));
    expect(result.ingredient.status).toBe("recognized");
    expect(result.options.forms.map((item) => item.id)).toEqual(
      expect.arrayContaining(expected),
    );
  });

  test("salmon and tofu never inherit chicken anatomy", async () => {
    for (const input of ["Salmon", "Tofu"]) {
      const result = await expandCreateDishIngredient(request(input));
      expect(result.options.forms.map((item) => item.id)).not.toEqual(
        expect.arrayContaining(["breast", "thigh"]),
      );
    }
  });

  test("dimensions stay separate", async () => {
    const result = await expandCreateDishIngredient(request("Chicken"));
    expect(result.options.forms.find((item) => item.id === "ground")?.dimension).toBe("form");
    expect(result.options.methods.find((item) => item.id === "grilled")?.dimension).toBe("method");
    expect(result.options.textures.find((item) => item.id === "crispy-exterior")?.dimension).toBe("texture");
    expect(result.options.flavors.find((item) => item.id === "teriyaki")?.dimension).toBe("flavor");
    expect(result.options.cuisines.find((item) => item.id === "japanese")?.dimension).toBe("cuisine");
  });

  test("specific natural-language input is recognized and preserves inferred intent", async () => {
    const result = await expandCreateDishIngredient(
      request("crispy teriyaki chicken thighs"),
    );
    expect(result.ingredient.canonicalId).toBe("chicken");
    expect(result.inferredSelectionIds).toMatchObject({
      form: "thigh",
      texture: "crispy-exterior",
      flavor: "teriyaki",
    });
  });

  test("Create-a-Dish compatibility adds stir-frying without replacing governed mappings", async () => {
    const result = await expandCreateDishIngredient(request("Chicken"));
    expect(result.options.methods.map((item) => item.id)).toEqual(
      expect.arrayContaining(["grilled", "baked", "stir-fried"]),
    );
  });

  test("existing technique mappings and blocked methods remain authoritative", async () => {
    const salmon = await expandCreateDishIngredient(request("Salmon"));
    expect(salmon.options.methods.map((item) => item.id)).toContain("pan-seared");
    expect(salmon.options.methods.map((item) => item.id)).not.toContain("fried");
  });

  test.each(["Steak", "Fish"])("%s returns clarification", async (input) => {
    const result = await expandCreateDishIngredient(request(input));
    expect(result.ingredient.status).toMatch(/^clarification_/);
    expect(result.ingredient.clarification?.choices.length).toBeGreaterThan(1);
    expect(result.options.forms).toEqual([]);
  });

  test("a clarified beef steak preserves the steak form", async () => {
    const result = await expandCreateDishIngredient(request("Beef steak"));
    expect(result.ingredient.canonicalId).toBe("beef");
    expect(result.inferredSelectionIds.form).toBe("steak-cut");
  });

  test("nonsense input is unsupported and receives no generic options", async () => {
    const result = await expandCreateDishIngredient(request("zzq blorp 991"));
    expect(result.ingredient.status).toBe("unsupported");
    expect(result.options.forms).toEqual([]);
    expect(result.options.methods).toEqual([]);
  });

  test("explicit allergen flavor is removed without removing adaptable flavors", async () => {
    const result = await expandCreateDishIngredient(request("Tofu"), {
      allergyTags: ["peanut"],
    });
    expect(result.options.flavors.map((item) => item.id)).not.toContain("peanut-lime");
    expect(result.options.flavors.map((item) => item.id)).toContain("teriyaki");
  });

  test("Surprise Me resolves one coherent delegated combination", async () => {
    const result = await expandCreateDishIngredient(
      request("Chicken", {
        surprisePolicy: {
          delegatedDimensions: ["form", "method", "texture", "flavor"],
          selectedOptionIds: {},
        },
      }),
    );
    expect(result.resolvedCombination?.form).not.toBeNull();
    expect(result.resolvedCombination?.method).not.toBeNull();
    expect(result.resolvedCombination?.flavor).not.toBeNull();
    expect(result.resolvedCombination?.selectionSource.form).toBe("system_selected");
    expect(
      result.resolvedCombination?.texture?.compatibleMethodIds,
    ).toContain(result.resolvedCombination?.method?.id);
  });

  test("one delegated dimension preserves a user-selected option", async () => {
    const result = await expandCreateDishIngredient(
      request("Chicken", {
        surprisePolicy: {
          delegatedDimensions: ["flavor"],
          selectedOptionIds: { form: "cubed", method: "grilled" },
        },
      }),
    );
    expect(result.resolvedCombination?.form?.id).toBe("cubed");
    expect(result.resolvedCombination?.method?.id).toBe("grilled");
    expect(result.resolvedCombination?.selectionSource.flavor).toBe("system_selected");
  });

  test("unknown client option IDs are rejected", async () => {
    await expect(
      expandCreateDishIngredient(
        request("Chicken", {
          surprisePolicy: {
            delegatedDimensions: [],
            selectedOptionIds: { form: "invented-cut" },
          },
        }),
      ),
    ).rejects.toThrow("UNKNOWN_OPTION_ID");
  });

  test.each([
    {
      forms: [{ id: "wing-fin", label: "Wing Fin", dimension: "form", confidence: "medium" }],
    },
    {
      methods: [{ id: "laser-cooked", label: "Laser Cooked", dimension: "method", confidence: "medium" }],
    },
    {
      flavors: [{ id: "medical", label: "Low Sodium Diabetes Cure", dimension: "flavor", confidence: "medium" }],
    },
  ])("malformed or invented AI options are discarded", async (aiOutput) => {
    const result = await expandCreateDishIngredient(
      ExpandIngredientRequestSchema.parse({
        ingredientInput: "Duck",
        creator: "create_a_dish",
        useAiForGaps: true,
      }),
      { aiProvider: { expand: async () => aiOutput } },
    );
    expect(result.warnings.map((item) => item.code)).toContain("AI_VALIDATION_FAILED");
    expect(result.options.forms.length).toBeGreaterThan(0);
  });

  test("AI arrays are bounded and container dimensions must agree", async () => {
    const tooMany = Array.from({ length: 7 }, (_, index) => ({
      id: `flavor-${index}`,
      label: `Flavor ${index}`,
      dimension: "flavor",
      confidence: "medium",
    }));
    const result = await expandCreateDishIngredient(
      ExpandIngredientRequestSchema.parse({
        ingredientInput: "Duck",
        creator: "create_a_dish",
        useAiForGaps: true,
      }),
      { aiProvider: { expand: async () => ({ forms: tooMany }) } },
    );
    expect(result.warnings.map((item) => item.code)).toContain("AI_VALIDATION_FAILED");
  });

  test("an incompatible user-selected texture is not silently replaced", async () => {
    const result = await expandCreateDishIngredient(
      request("Chicken", {
        surprisePolicy: {
          delegatedDimensions: [],
          selectedOptionIds: {
            method: "boiled",
            texture: "crispy-exterior",
          },
        },
      }),
    );
    expect(result.resolvedCombination).toBeNull();
    expect(result.warnings.map((item) => item.code)).toContain(
      "NO_COMPATIBLE_COMBINATION",
    );
  });

  test("valid bounded AI flavor can supplement governed options", async () => {
    const result = await expandCreateDishIngredient(
      ExpandIngredientRequestSchema.parse({
        ingredientInput: "Duck",
        creator: "create_a_dish",
        useAiForGaps: true,
      }),
      {
        aiProvider: {
          expand: async () => ({
            flavors: [
              {
                id: "plum-ginger",
                label: "Plum Ginger",
                dimension: "flavor",
                confidence: "medium",
              },
            ],
          }),
        },
      },
    );
    expect(result.options.flavors.find((item) => item.id === "plum-ginger")?.source).toBe("validated_ai");
  });

  test("non-Create-a-Dish scope is rejected", async () => {
    const unsafe = { ...request("Chicken"), creator: "craving_creator" as any };
    await expect(expandCreateDishIngredient(unsafe)).rejects.toThrow(
      "CREATE_DISH_SCOPE_REQUIRED",
    );
  });
});
