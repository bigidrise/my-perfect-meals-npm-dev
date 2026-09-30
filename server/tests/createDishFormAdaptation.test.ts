import { CreateDishIntentSchema } from "../../shared/createDishIngredientExpansion";
import { FoodMeaningV1Schema } from "../../shared/foodMeaning";
import { evaluateCreateDishIntentEvidence } from "../services/createDish/createDishIntent";
import { resolveCreateDishContract } from "../services/createDish/dishContract";
import { authorizeCreateDishFormAdaptation } from "../services/createDish/formAdaptation";
import { validateDishIdentity } from "../services/dishAdaptation/dishIdentityValidator";
import type { DishAdaptationDirective } from "../services/dishAdaptation/types";

const directive: DishAdaptationDirective = {
  identityAnchor: "Preserve the requested dish",
  definingComponents: ["ground meat patty", "bun", "condiments", "toppings"],
  adaptableComponents: ["bun"],
  dishForm: "sandwich on bread",
  conflicts: [],
  adaptationBlock: "",
};
const intent = CreateDishIntentSchema.parse({
  creator: "create_a_dish",
  originalText: "burger",
  ingredient: { canonicalId: "semantic-burger", canonicalName: "burger", category: "prepared-dish" },
  resolvedCombination: {
    form: null, texture: null, flavor: null,
    selectionSource: { form: "not_applicable", texture: "not_applicable", flavor: "not_applicable" },
  },
});
const meaning = FoodMeaningV1Schema.parse({
  version: 1, originalText: "burger",
  concept: { kind: "prepared_dish", canonicalName: "burger", source: "semantic_inference" },
  cuisine: null, components: [], uncertainty: "resolved",
});
const standard = {
  name: "Beef Burger",
  description: "A juicy burger served on a bun.",
  ingredients: [{ name: "ground beef" }, { name: "whole grain bun" }, { name: "tomato" },
    { name: "lettuce" }, { name: "mustard" }],
  instructions: ["Shape the beef into patties and cook. Stack with lettuce, tomato and mustard on the bun."],
};
const bowl = {
  name: "Beef Burger Bowl",
  description: "A burger patty with lettuce and tomato in a bowl.",
  ingredients: [{ name: "ground beef" }, { name: "lettuce" }, { name: "tomato" }, { name: "mustard" }],
  instructions: ["Shape the beef into patties and cook. Layer the vegetables, patty and mustard into a bowl."],
};
const evidence = (meal: typeof bowl, diet: string[] = ["low_carb"], selectedForm = false) => {
  const contract = resolveCreateDishContract(intent, directive, meaning);
  const adapted = authorizeCreateDishFormAdaptation(contract, directive, diet, selectedForm);
  return evaluateCreateDishIntentEvidence(meal, intent, adapted.contract, meaning);
};

describe("Create a Dish person-authorized vessel adaptation", () => {
  test("concrete patty, toppings and condiment satisfy culinary roles without literal ingredient labels", () => {
    expect(evidence(standard, [])).toMatchObject({ ingredient: true, passed: true });
  });

  test("a verified low-carb burger bowl keeps identity without a bun", () => {
    expect(evidence(bowl)).toMatchObject({ ingredient: true, passed: true });
    expect(evidence(bowl, [])).toMatchObject({ ingredient: false, passed: false });
    expect(evidence({
      ...bowl, name: "Lettuce Wrap Burger",
      ingredients: [{ name: "ground beef" }, { name: "lettuce leaves" }, { name: "tomato" }, { name: "mustard" }],
      instructions: ["Shape the beef into patties and cook. Wrap the patty in lettuce leaves with tomato and mustard."],
    }).passed).toBe(true);
  });

  test("a gluten-free bun keeps the original form; gluten-free alone does not authorize a bowl", () => {
    expect(evidence({
      ...standard,
      ingredients: standard.ingredients.map(part =>
        part.name === "whole grain bun" ? { name: "gluten-free bun" } : part),
    }, ["gluten_free"]).passed).toBe(true);
    expect(evidence(bowl, ["gluten_free"]).passed).toBe(false);
  });

  test("low-carb alone does not authorize an unrelated sandwich bowl or a user-selected form change", () => {
    const cubano = authorizeCreateDishFormAdaptation({
      ...resolveCreateDishContract(intent, directive, meaning),
      requestedDish: "cubano", definingComponents: ["roast pork", "ham", "swiss cheese", "pickles"],
      adaptableComponents: [],
    }, directive, ["low_carb"], false);
    expect(cubano.contract.permittedFormFamilies).toBeUndefined();
    expect(evidence(bowl, ["low_carb"], true).passed).toBe(false);
    const explicitlyRequested = authorizeCreateDishFormAdaptation({
      ...resolveCreateDishContract(intent, directive, meaning),
      requestedDish: "burger on a bun",
    }, directive, ["low_carb"], false);
    expect(explicitlyRequested.contract.permittedFormFamilies).toBeUndefined();
  });

  test("a title-only burger bowl and a bowl without patty structure still fail", () => {
    expect(evidence({ ...bowl, ingredients: [{ name: "rice" }], instructions: ["Serve rice in a bowl."] }).passed).toBe(false);
    expect(evidence({
      ...bowl,
      ingredients: [{ name: "lettuce" }, { name: "tomato" }, { name: "mustard" }],
      instructions: ["Layer lettuce, tomato and mustard into a bowl."],
    }).passed).toBe(false);
  });

  test("a specifically named patty material cannot silently be replaced", () => {
    const named = {
      ...resolveCreateDishContract(intent, directive, meaning),
      definingComponents: ["beef patty", "bun", "toppings"],
    };
    expect(evaluateCreateDishIntentEvidence({
      ...standard, ingredients: standard.ingredients.map(part =>
        part.name === "ground beef" ? { name: "ground turkey" } : part),
    }, intent, named, meaning).passed).toBe(false);
  });

  test("an unrelated dessert cannot use a low-carb vessel allowance to become a bowl", () => {
    const cheesecake: DishAdaptationDirective = {
      ...directive, definingComponents: ["cream cheese filling", "crust", "strawberry topping"],
      adaptableComponents: ["crust"], dishForm: "sliceable baked cake with crust",
    };
    const result = authorizeCreateDishFormAdaptation({
      ...resolveCreateDishContract(intent, cheesecake, meaning),
      requestedDish: "strawberry cheesecake",
    }, cheesecake, ["low_carb"], false);
    expect(validateDishIdentity("strawberry cheesecake", {
      name: "Strawberry Cheesecake Bowl",
      ingredients: ["cream cheese", "strawberry", "crust"],
    }, result.directive).formMismatch).toBe(true);
  });
});