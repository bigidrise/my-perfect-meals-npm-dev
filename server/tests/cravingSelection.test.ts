import { CRAVING_CATEGORIES } from "../../shared/cravingCategories";
import { resolveCravingSelection, filterCravingSelectionCandidates } from "../services/craving/categorySelection";
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
  it("rejects a BBQ-titled stir-fry and accepts actual grilled food", async () => {
    const wrong = { ...recipe("Mexican BBQ chicken"), instructions: ["Stir-fry chicken in a wok with vegetables."] };
    const correct = { ...recipe("Pollo asado"), instructions: ["Marinate with lime and achiote, then grill the chicken."] };
    const create = jest.fn().mockResolvedValue(response([decision(0, { categoryMatch: false }), decision(1)]));
    const result = await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [wrong, correct], resolveCravingSelection("bbq-grilled", "Grill", "")!);
    expect(result).toEqual([correct]);
    expect(JSON.parse(create.mock.calls[0][0].messages[1].content).candidates[0].instructions).toEqual(wrong.instructions);
    expect(create.mock.calls[0][0].messages[0].content).toContain("Titles, cuisine adjectives and self-claims alone are NOT proof");
  });
  it("filters a wrong primary cooking method and protein-only repetition", async () => {
    const options = [recipe(), recipe("Oven burger"), recipe("Same burger with turkey")];
    const create = jest.fn().mockResolvedValue(response([
      decision(0), decision(1, { cookingMethodMatch: false }), decision(2, { distinct: false }),
    ]));
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, options, resolveCravingSelection("burgers-sandwiches", "Grill", "")!)).toEqual([options[0]]);
  });
  it("supplies already accepted recipes during refill instead of checking a batch in isolation", async () => {
    const accepted = recipe();
    const duplicate = recipe("Same burger with lamb");
    const create = jest.fn().mockResolvedValue(response([decision(0, { distinct: false })]));
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [duplicate], resolveCravingSelection("burgers-sandwiches", "", "")!, [accepted])).toEqual([]);
    expect(JSON.parse(create.mock.calls[0][0].messages[1].content).alreadyAccepted[0].ingredients).toEqual(accepted.ingredients);
  });
  it.each([
    [], [decision(1)], [decision(0), decision(0)], [{ ...decision(0), categoryMatch: "true" }],
  ])("fails closed on incomplete, out-of-range, duplicate or malformed review %j", async decisions => {
    const create = jest.fn().mockResolvedValue(response(decisions));
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [recipe()], resolveCravingSelection("burgers-sandwiches", "", "")!)).toEqual([]);
  });
  it("never accepts title-only evidence even when the reviewer claims a match", async () => {
    const create = jest.fn().mockResolvedValue(response([decision(0)]));
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [{ name: "Burger" }], resolveCravingSelection("burgers-sandwiches", "", "")!)).toEqual([]);
  });
  it("fails closed on provider unavailability without inventing clearance", async () => {
    const create = jest.fn().mockRejectedValue(new Error("synthetic provider unavailable"));
    expect(await filterCravingSelectionCandidates({ chat: { completions: { create } } }, [recipe()], resolveCravingSelection("burgers-sandwiches", "", "")!)).toEqual([]);
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
});
