import { CreateDishIntentSchema } from "../../shared/createDishIngredientExpansion";
import {
  buildCreateDishContractPrompt,
  resolveCreateDishContract,
} from "../services/createDish/dishContract";
import {
  buildCreateDishIntentRepairInstructions,
  evaluateCreateDishIntentEvidence,
  isBroadIngredientOnlyCreateDishIntent,
} from "../services/createDish/createDishIntent";

function intent(requestedDish: string, canonicalName: string, category = "prepared-dish") {
  return CreateDishIntentSchema.parse({
    creator: "create_a_dish",
    originalText: requestedDish,
    ingredient: {
      canonicalId: category === "prepared-dish" ? `semantic-${requestedDish.replaceAll(" ", "-")}` : canonicalName.toLowerCase(),
      canonicalName,
      category,
    },
    resolvedCombination: {
      form: null, texture: null, flavor: null,
      selectionSource: {
        form: "not_applicable", texture: "not_applicable", flavor: "not_applicable",
      },
    },
  });
}

describe("Create a Dish resolved dish contract", () => {
  test.each([
    ["potato salad", "Potato", "starchy-carb", "potato"],
    ["pasta salad", "pasta salad", "prepared-dish", "pasta"],
    ["macaroni salad", "macaroni salad", "prepared-dish", "macaroni"],
    ["chicken salad", "Chicken", "protein", "chicken"],
    ["egg salad", "egg salad", "prepared-dish", "egg"],
    ["fruit salad", "fruit salad", "prepared-dish", "fruit"],
  ])("%s retains its specific core instead of a generic leafy salad", (dish, canonical, category, core) => {
    const resolved = resolveCreateDishContract(intent(dish, canonical, category));
    expect(resolved).toMatchObject({ requestedDish: dish, namedFamily: "salad", namedCore: core });
    const prompt = buildCreateDishContractPrompt(resolved);
    expect(prompt).toContain(`"${dish}"`);
    expect(prompt).toContain("do not impose a leafy-green or grain base");
  });

  test("lettuce wraps require a leafy vessel, not a tortilla garnish", () => {
    const resolved = resolveCreateDishContract(intent("lettuce wraps", "lettuce wraps"));
    expect(resolved).toMatchObject({ namedFamily: "wrap", namedCore: "lettuce", leafVessel: true });
    expect(buildCreateDishContractPrompt(resolved)).toContain("lettuce leaves as the wrap vessel");
    expect(isBroadIngredientOnlyCreateDishIntent(intent("lettuce wraps", "lettuce wraps"))).toBe(false);
    expect(isBroadIngredientOnlyCreateDishIntent(intent("potato salad", "potato salad"))).toBe(false);
  });

  test.each(["chili", "tacos", "pizza", "lasagna", "casserole"])(
    "%s retains its named identity outside the salad/wrap contract", (dish) => {
      const resolved = resolveCreateDishContract(intent(dish, dish));
      expect(resolved.namedFamily).toBeNull();
      expect(buildCreateDishContractPrompt(resolved)).toContain(`"${dish}"`);
    },
  );

  test("cuisine changes compatible preparation, not the requested dish", () => {
    const base = intent("potato salad", "Potato", "starchy-carb");
    const resolved = resolveCreateDishContract(CreateDishIntentSchema.parse({ ...base, cuisine: "Japanese" }));
    expect(buildCreateDishContractPrompt(resolved)).toContain("without replacing the requested dish");
  });

  test("potato inflections and named varieties prove a real ingredient, not the title", () => {
    const requested = intent("potato salad", "Potato", "starchy-carb");
    for (const potato of ["potato", "potatoes", "Yukon Gold potatoes", "baby potatoes"]) {
      expect(evaluateCreateDishIntentEvidence({
        name: "Herbed Potato Salad",
        ingredients: [{ name: potato }, { name: "celery" }],
        instructions: "Boil and toss with dressing.",
      }, requested).passed).toBe(true);
    }
    for (const missing of [
      "cauliflower florets", "potato-flavored seasoning", "potato starch",
      "without potatoes", "replace potato with cauliflower", "substitute cauliflower for potato",
    ]) {
      expect(evaluateCreateDishIntentEvidence({
        name: "Potato Salad",
        ingredients: [{ name: missing }],
        instructions: "Toss and serve.",
      }, requested).ingredient).toBe(false);
    }
  });

  test("changing an adaptable dressing does not erase the requested potato salad", () => {
    const requested = intent("potato salad", "Potato", "starchy-carb");
    expect(evaluateCreateDishIntentEvidence({
      name: "Herbed Potato Salad",
      ingredients: ["baby potatoes", "celery", "egg-free dressing"],
      instructions: "Cook the potatoes and toss with celery and egg-free dressing.",
    }, requested).passed).toBe(true);
    expect(evaluateCreateDishIntentEvidence({
      name: "Herbed Potato Salad",
      ingredients: ["cauliflower", "celery", "egg-free dressing"],
      instructions: "Toss with celery and egg-free dressing.",
    }, requested).passed).toBe(false);
  });

  test("named composed salads use actual ingredient evidence, including fruit species", () => {
    for (const [dish, ingredient] of [
      ["pasta salad", "bowtie pasta"],
      ["macaroni salad", "elbow macaroni"],
      ["chicken salad", "cooked chicken breast"],
      ["egg salad", "boiled eggs"],
      ["fruit salad", "strawberries"],
    ]) {
      expect(evaluateCreateDishIntentEvidence({
        name: dish,
        ingredients: [{ name: ingredient }],
        instructions: "Toss the ingredients.",
      }, intent(dish, dish)).ingredient).toBe(true);
      expect(evaluateCreateDishIntentEvidence({
        name: dish,
        ingredients: [{ name: "celery" }],
        instructions: "Toss the ingredients.",
      }, intent(dish, dish)).ingredient).toBe(false);
    }
  });

  test("lettuce leaves must actually form the wraps", () => {
    const requested = intent("lettuce wraps", "lettuce wraps");
    expect(evaluateCreateDishIntentEvidence({
      name: "Chicken Lettuce Wraps",
      ingredients: ["romaine lettuce leaves", "chicken"],
      instructions: "Spoon chicken into lettuce leaves and fold into wraps.",
    }, requested).passed).toBe(true);
    for (const candidate of [
      { ingredients: ["chicken", "tortillas"], instructions: "Wrap chicken in tortillas with lettuce garnish." },
      { ingredients: ["lettuce leaves", "tortillas"], instructions: "Wrap the filling in tortillas and serve lettuce on the side." },
      { ingredients: ["without lettuce leaves", "chicken"], instructions: "Wrap in tortillas." },
      { ingredients: ["lettuce-flavored seasoning", "chicken"], instructions: "Fill tortillas." },
    ]) {
      expect(evaluateCreateDishIntentEvidence({
        name: "Lettuce Wraps",
        ...candidate,
      }, requested).ingredient).toBe(false);
    }
  });

  test("repair explains the missing role and conflicts without granting safety approval", () => {
    const requested = intent("potato salad", "Potato", "starchy-carb");
    const resolved = resolveCreateDishContract(requested, {
      identityAnchor: "potato salad", dishForm: "composed salad",
      definingComponents: ["potato base"], adaptableComponents: ["dressing"],
      conflicts: [{ component: "dressing", guardrail: "egg allergy", directive: "Use an egg-free dressing." }],
      adaptationBlock: "",
    });
    const repair = buildCreateDishIntentRepairInstructions(requested, ["ingredient"], resolved);
    expect(repair).toContain("ingredient list did not affirm the defining potato");
    expect(repair).toContain("Use an egg-free dressing.");
    expect(repair).toContain('Keep the named dish "potato salad"');
    expect(repair).toContain("never weaken allergies");
  });
});