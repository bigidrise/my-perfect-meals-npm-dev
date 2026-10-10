import { CRAVING_CATEGORIES } from "../../shared/cravingCategories";
import { resolveCravingSelection, filterCravingSelectionCandidates, cravingRecipeSignature } from "../services/craving/categorySelection";
import { cookingEvidence } from "../services/craving/recipeEvidence";
import { releaseCreateDishReplacementBatch, fillFinalCreateDishChoices } from "../services/createDish/finalChoices";

const recipe = (name = "Tandoori chicken burger") => ({
  name, ingredients: [{ name: "chicken" }, { name: "low-carb bun" }],
  instructions: ["Shape the patty, grill it, then assemble in the bun."],
});
const decision = (index: number, overrides: Record<string, unknown> = {}) => ({
  index, categoryMatch: true, cookingMethodMatch: true, distinct: true,
  reason: "Actual ingredients and preparation preserve the requested experience.", ...overrides,
});
const response = (decisions: unknown[]) => ({ choices: [{ message: { content: JSON.stringify({ decisions }) } }] });
const ambiguous = (name = "Regional specialty", ingredient = "lentils") => ({
  name, ingredients: [{ name: ingredient }, { name: "ginger" }],
  instructions: ["Prepare the mixture, cook it through, then serve."],
});

describe("Craving request-local category and preparation authority", () => {
  it.each(CRAVING_CATEGORIES)("normalizes $label with a genuinely blank or legacy-placeholder craving", category => {
    for (const craving of ["", "something delicious"]) {
      expect(resolveCravingSelection(category.value, "air-fryer", craving)).toEqual({
        category: category.value, cookingMethod: "Air Fryer", explicitCraving: "",
      });
    }
  });
  it.each(["Stovetop", "Oven", "Air Fryer", "Grill", "Slow Cooker", "No-Cook"])("preserves the UI's %s cooking method", method => {
    expect(resolveCravingSelection(undefined, method, "chicken burger")?.cookingMethod).toBe(method);
  });
  it("leaves omitted and unknown category requests on the legacy path", () => {
    expect(resolveCravingSelection(undefined, undefined, "chicken bowl")).toBeUndefined();
    expect(resolveCravingSelection("unknown", "", "chicken bowl")).toBeUndefined();
  });
  it("preserves explicit craving and rejects unsupported preparations", () => {
    expect(resolveCravingSelection("sweet", "", "chicken bowl")?.explicitCraving).toBe("chicken bowl");
    expect(() => resolveCravingSelection("sweet", "invented", "")).toThrow("supported cooking method");
  });
});

describe("Actual recipe evidence, not category labels", () => {
  it.each([
    ["surprise", "Salad", "Toss leaves and serve.", "lettuce"],
    ["burgers-sandwiches", "Lettuce-wrap burger", "Form patties, grill them and wrap in lettuce.", "lentils"],
    ["pizza-flatbreads", "Cauliflower pizza", "Press the mixture into a base, top the base and bake.", "cauliflower"],
    ["fried-crispy", "Crispy bites", "Air-fry the coated bites until crispy.", "tofu"],
    ["mexican-tex-mex", "Bean tacos", "Fill tortillas and fold each taco.", "black beans"],
    ["pasta-noodles", "Zucchini noodles", "Toss the noodles with sauce.", "zucchini"],
    ["comfort-food", "Vegetable stew", "Simmer the stew until tender.", "carrots"],
    ["breakfast", "Omelette", "Fold the eggs into an omelette.", "eggs"],
    ["asian", "Vegetable dumplings", "Fold each dumpling wrapper and steam.", "cabbage"],
    ["seafood", "Plant-based scallops", "Slice mushrooms into scallop shapes and sear.", "mushrooms"],
    ["bbq-grilled", "Grilled vegetables", "Grill the vegetable skewers.", "bell peppers"],
    ["snacks-finger-foods", "Snack bites", "Shape the mixture into bites.", "chickpeas"],
    ["sweet", "Chocolate mousse", "Whisk the chocolate mousse and chill.", "chocolate"],
    ["shakes-smoothies", "Fruit smoothie", "Blend the fruit and pour into a glass.", "berries"],
    ["something-else", "Open request", "Combine the mixture and serve.", "tomatoes"],
  ])("uses structured evidence without an extra model call for clear %s recipes", async (category, name, step, ingredient) => {
    const option = { ...recipe(name), ingredients: [{ name: ingredient }], instructions: [step] };
    const create = jest.fn();
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [option],
      resolveCravingSelection(category, "", "")!)).toEqual([option]);
    expect(create).not.toHaveBeenCalled();
  });
  it("rejects a BBQ-titled stir-fry and accepts actual grilled food", async () => {
    const wrong = { ...recipe("Mexican BBQ chicken"), instructions: ["Stir-fry chicken in a wok with vegetables."] };
    const correct = { ...recipe("Pollo asado"), instructions: ["Marinate with lime and achiote, then grill the chicken."] };
    const create = jest.fn().mockResolvedValue(response([decision(0, { categoryMatch: false }), decision(1)]));
    const result = await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [wrong, correct], resolveCravingSelection("bbq-grilled", "Grill", "")!);
    expect(result).toEqual([correct]);
    expect(create).not.toHaveBeenCalled();
  });
  it("filters a wrong primary cooking method and protein-only repetition", async () => {
    const options = [
      recipe(),
      { ...recipe("Oven burger"), instructions: ["Bake the patty in the oven and assemble in the bun."] },
      { ...recipe("Same burger with turkey"), ingredients: [{ name: "turkey" }, { name: "low-carb bun" }] },
    ];
    const create = jest.fn().mockResolvedValue(response([
      decision(0), decision(1, { cookingMethodMatch: false }), decision(2, { distinct: false }),
    ]));
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, options, resolveCravingSelection("burgers-sandwiches", "Grill", "")!)).toEqual([options[0]]);
    expect(create).not.toHaveBeenCalled();
  });
  it("supplies already accepted recipes during refill instead of checking a batch in isolation", async () => {
    const accepted = recipe();
    const duplicate = recipe("Same burger with lamb");
    const create = jest.fn().mockResolvedValue(response([decision(0, { distinct: false })]));
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [duplicate], resolveCravingSelection("burgers-sandwiches", "", "")!, [accepted])).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });
  it.each([
    [], [decision(1)], [decision(0), decision(0)], [{ ...decision(0), categoryMatch: "true" }],
  ].map(decisions => [decisions]))("fails closed on incomplete, out-of-range, duplicate or malformed review %j", async decisions => {
    const create = jest.fn().mockResolvedValue(response(decisions));
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [ambiguous()], resolveCravingSelection("comfort-food", "", "")!)).toEqual([]);
  });
  it("never accepts title-only evidence even when the reviewer claims a match", async () => {
    const create = jest.fn().mockResolvedValue(response([decision(0)]));
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [{ name: "Burger" }], resolveCravingSelection("burgers-sandwiches", "", "")!)).toEqual([]);
  });
  it("fails closed on provider unavailability without inventing clearance", async () => {
    const create = jest.fn().mockRejectedValue(new Error("synthetic provider unavailable"));
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [ambiguous()], resolveCravingSelection("comfort-food", "", "")!)).toEqual([]);
  });
  it("uses one batched review for ambiguity and caches unchanged culinary evidence within this request", async () => {
    const option = ambiguous();
    const selection = resolveCravingSelection("comfort-food", "", "")!;
    const create = jest.fn().mockResolvedValue(response([decision(0)]));
    const client = { chat: { completions: { create } } };
    expect(await filterCravingSelectionCandidates(client, [option], selection)).toEqual([option]);
    const formatted = { ...option, name: "Indian regional specialty", ingredients: option.ingredients.map(i => ({ ...i, quantity: 3 })) };
    expect(await filterCravingSelectionCandidates(client, [formatted], selection)).toEqual([formatted]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].messages[0].content).toContain("Titles, cuisine adjectives and self-claims alone are NOT proof");
    await filterCravingSelectionCandidates(client, [option], resolveCravingSelection("comfort-food", "", "")!);
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("reviews changed food/preparation again rather than reusing stale clearance", async () => {
    const selection = resolveCravingSelection("comfort-food", "", "")!;
    const create = jest.fn().mockResolvedValue(response([decision(0)]));
    const client = { chat: { completions: { create } } };
    await filterCravingSelectionCandidates(client, [ambiguous()], selection);
    await filterCravingSelectionCandidates(client, [ambiguous("Changed specialty", "chickpeas")], selection);
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("does not revive a reviewer-rejected duplicate from cached positive identity", async () => {
    const option = ambiguous();
    const selection = resolveCravingSelection("comfort-food", "", "")!;
    const create = jest.fn()
      .mockResolvedValueOnce(response([decision(0, { distinct: false })]))
      .mockRejectedValueOnce(new Error("synthetic unavailable"));
    const client = { chat: { completions: { create } } };
    expect(await filterCravingSelectionCandidates(client, [option], selection)).toEqual([]);
    expect(await filterCravingSelectionCandidates(client, [option], selection)).toEqual([]);
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("retains valid indexed decisions when neighboring indices are missing, malformed or duplicated", async () => {
    const options = [ambiguous("A", "lentils"), ambiguous("B", "chickpeas"), ambiguous("C", "rice")];
    for (const decisions of [
      [decision(0)],
      [decision(0), decision(1, { categoryMatch: "yes" })],
      [decision(0), decision(1), decision(1)],
      [decision(0), decision(9)],
    ]) {
      const create = jest.fn().mockResolvedValue(response(decisions));
      expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, options,
        resolveCravingSelection("comfort-food", "", "")!)).toEqual([options[0]]);
    }
  });
  it("retains a clear local match when review of another candidate is unavailable", async () => {
    const good = { ...recipe("Grilled burger"), instructions: ["Grill the patty and assemble in the bun."] };
    const unknown = { ...ambiguous(), instructions: ["Prepare the regional specialty on the grill and serve."] };
    const create = jest.fn().mockRejectedValue(new Error("synthetic unavailable"));
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [good, unknown],
      resolveCravingSelection("burgers-sandwiches", "Grill", "")!)).toEqual([good]);
  });
  it("permits adapted vessels and recognizable bunless burgers without mandatory ingredient words", async () => {
    const options = [
      { ...recipe("Lettuce-wrap burger"), ingredients: [{ name: "mushrooms" }, { name: "lettuce" }], instructions: ["Shape mushroom patties, grill, then wrap in lettuce."] },
      { ...recipe("Bunless burger"), ingredients: [{ name: "beef" }, { name: "pickles" }], instructions: ["Grill the burger patty and serve with pickles."] },
    ];
    const create = jest.fn();
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, options,
      resolveCravingSelection("burgers-sandwiches", "Grill", "")!)).toEqual(options);
    expect(create).not.toHaveBeenCalled();
  });
  it("does not force an incompatible category over an explicit craving", async () => {
    const bowl = { ...ambiguous("Chicken bowl", "chicken"), instructions: ["Arrange the cooked chicken and vegetables in a bowl."] };
    const create = jest.fn().mockResolvedValue(response([decision(0)]));
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [bowl],
      resolveCravingSelection("sweet", "", "chicken bowl")!)).toEqual([bowl]);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("does not let a preheat-only mention prove the selected primary cooking method", () => {
    expect(cookingEvidence({ ...recipe(), instructions: ["Preheat the air fryer.", "Stir-fry chicken in a wok."] }, "Air Fryer")).toBe("mismatch");
    expect(cookingEvidence({ ...recipe(), instructions: ["Blend the ingredients and pour into a glass."] }, "No-Cook")).toBe("match");
    expect(cookingEvidence({ ...recipe(), instructions: ["Bake the batter."] }, "No-Cook")).toBe("mismatch");
    expect(cookingEvidence({ ...recipe(), instructions: ["Stir-fry chicken, then toss with barbecue sauce."] }, "Grill")).toBe("mismatch");
    expect(cookingEvidence({ ...recipe(), instructions: ["Arrange chicken in the air fryer basket.", "Cook for 12 minutes."] }, "Air Fryer")).toBe("match");
    expect(cookingEvidence({ ...recipe(), instructions: ["Transfer vegetables into the slow cooker.", "Cook on low for six hours."] }, "Slow Cooker")).toBe("match");
    expect(cookingEvidence({ ...recipe(), instructions: ["Layer roast beef on bread and serve."] }, "No-Cook")).toBe("ambiguous");
  });
});

describe("Category refill still traverses every existing release gate", () => {
  it("does not let category compliance bypass clinical, allergy, diet or post-format validation", async () => {
    const candidates = ["clinical", "allergy", "diet", "formatted", "safe"].map(name => recipe(name));
    const reached: string[] = [];
    const released = await releaseCreateDishReplacementBatch(candidates, {
      clinical: meal => meal.name !== "clinical",
      protocol: meals => meals.filter(meal => meal.name !== "diet"),
      allergen: meals => meals.filter(meal => meal.name !== "allergy"),
      transform: async meals => meals,
      humanFood: () => true, dishIntent: () => true, format: meal => meal,
      finalFood: meal => meal.name !== "formatted",
      finalDishIntent: meal => { reached.push(meal.name); return true; },
    });
    expect(released.map(meal => meal.name)).toEqual(["safe"]);
    expect(reached).toEqual(["safe"]);
  });
  it("keeps a verified partial result instead of padding with failed category replacements", async () => {
    const safe = recipe();
    const result = await fillFinalCreateDishChoices({
      initial: [safe], initialCandidates: [safe], deadlineAt: Date.now() + 1000,
      maxRefillCalls: 2, generate: async () => [recipe("Unrelated stir-fry")],
      validate: async () => [],
    });
    expect(result.choices).toEqual([safe]);
    expect(result.refillCalls).toBe(2);
  });
  it("Craving keeps genuinely different preparations sharing ingredients, while the Create a Dish default is unchanged", async () => {
    const options = [
      { ...recipe("Thick burger"), instructions: ["Shape thick patties and grill them."] },
      { ...recipe("Smash burger"), instructions: ["Smash thin patties and grill them."] },
      { ...recipe("Renamed thick burger"), instructions: ["Shape thick patties and grill them."] },
    ];
    const input = {
      initial: options, initialCandidates: options, deadlineAt: Date.now() + 1000,
      maxRefillCalls: 0, generate: async () => [], validate: async () => [],
    };
    expect((await fillFinalCreateDishChoices({ ...input, signature: cravingRecipeSignature })).choices).toEqual(options.slice(0, 2));
    expect((await fillFinalCreateDishChoices(input)).choices).toEqual([options[0]]);
  });
});
