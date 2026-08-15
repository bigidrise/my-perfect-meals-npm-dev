/**
 * Dish-form collapse regression — Task: prevent the identity validator from
 * passing a cheesecake that arrives as a parfait, bowl, or mousse.
 */
import { validateDishIdentity } from "../services/dishAdaptation/dishIdentityValidator";
import type { DishAdaptationDirective } from "../services/dishAdaptation/types";

const cheesecakeDirective: DishAdaptationDirective = {
  identityAnchor: "This IS strawberry cheesecake. Do not change the dish.",
  definingComponents: ["cream cheese filling", "graham cracker crust", "strawberry topping"],
  adaptableComponents: ["sweetener", "crust base", "topping sauce"],
  dishForm: "sliceable baked cake with crust",
  conflicts: [],
  adaptationBlock: "",
};

const baseIngredients = [
  "lactose-free cream cheese",
  "almond flour graham-style crust",
  "fresh strawberries",
  "monk fruit sweetener",
];

function mealNamed(name: string) {
  return {
    name,
    description: "A creamy strawberry dessert with a crust-style base and strawberry topping.",
    ingredients: baseIngredients,
    instructions: "Combine in a mixing bowl. Chill and serve.",
  };
}

describe("dish-form collapse detection", () => {
  const request = "strawberry cheesecake";

  it("passes a compliant cheesecake that stays a cheesecake", () => {
    const r = validateDishIdentity(request, mealNamed("Lactose-Free Strawberry Cheesecake"), cheesecakeDirective);
    expect(r.formMismatch).toBe(false);
    expect(r.catastrophicDeviation).toBe(false);
    expect(r.passed).toBe(true);
  });

  it.each([
    "Strawberry Cheesecake Parfait",
    "Strawberry Cheesecake Bowl",
    "Strawberry Cheesecake Mousse",
    "Strawberry Cheesecake Smoothie",
    "Strawberry Cheesecake Bites",
    "Strawberry Cheesecake Pudding",
  ])("rejects form collapse even when name and components pass: %s", (name) => {
    const r = validateDishIdentity(request, mealNamed(name), cheesecakeDirective);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
    expect(r.passed).toBe(false);
    expect(r.failures.join(" ")).toContain("form mismatch");
  });

  it("rejects a stew that arrives as a soup", () => {
    const directive: DishAdaptationDirective = {
      ...cheesecakeDirective,
      identityAnchor: "This IS beef stew.",
      definingComponents: ["beef chunks", "root vegetables", "thick gravy"],
      dishForm: "thick chunky stew",
    };
    const r = validateDishIdentity("beef stew", {
      name: "Beef and Vegetable Soup",
      description: "A hearty soup with beef and vegetables.",
      ingredients: ["beef", "carrots", "potatoes", "broth"],
    }, directive);
    expect(r.formMismatch).toBe(true);
    expect(r.passed).toBe(false);
  });

  it('rejects soup collapse for the canonical "stew/broth-based" dishForm (structural descriptor must not whitelist soup)', () => {
    const directive: DishAdaptationDirective = {
      ...cheesecakeDirective,
      identityAnchor: "This IS ropa vieja.",
      definingComponents: ["shredded beef", "tomato-pepper sauce", "onions"],
      dishForm: "stew/broth-based",
    };
    const r = validateDishIdentity("ropa vieja", {
      name: "Ropa Vieja Soup",
      description: "Shredded beef in a brothy tomato soup.",
      ingredients: ["beef", "tomatoes", "peppers", "onions"],
    }, directive);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
    expect(r.passed).toBe(false);
  });

  it('does not let "sandwich on bread" dishForm allow a bowl or salad', () => {
    const directive: DishAdaptationDirective = {
      ...cheesecakeDirective,
      identityAnchor: "This IS a cubano.",
      definingComponents: ["roast pork", "ham", "swiss cheese", "pickles"],
      dishForm: "sandwich on bread",
    };
    const r = validateDishIdentity("cubano", {
      name: "Cubano Bowl",
      description: "All the cubano flavors in a bowl.",
      ingredients: ["pork", "ham", "swiss", "pickles"],
    }, directive);
    expect(r.formMismatch).toBe(true);
    expect(r.passed).toBe(false);
  });

  it("keeps hybrid support when the requested dish name itself names both forms", () => {
    const r = validateDishIdentity("chicken soup bowl", {
      name: "Chicken Soup Bowl",
      description: "Hearty chicken soup served as a bowl.",
      ingredients: ["chicken", "broth", "noodles"],
    }, null);
    expect(r.formMismatch).toBe(false);
    expect(r.passed).toBe(true);
  });

  it("does not flag mentions of bowls/bread in instructions or description", () => {
    const r = validateDishIdentity(request, {
      name: "Strawberry Cheesecake (Diabetic-Friendly)",
      description: "Serve each slice in a bowl with strawberries.",
      ingredients: baseIngredients,
      instructions: "Mix filling in a large bowl. Press crust. Bake and slice.",
    }, cheesecakeDirective);
    expect(r.formMismatch).toBe(false);
    expect(r.passed).toBe(true);
  });

  it("skips the form check when no form family is recognizable in the request", () => {
    const r = validateDishIdentity("chicken adobo", {
      name: "Chicken Adobo Bowl",
      description: "Adobo served over rice.",
      ingredients: ["chicken", "soy sauce", "vinegar", "garlic"],
    }, {
      ...cheesecakeDirective,
      identityAnchor: "This IS chicken adobo.",
      definingComponents: ["chicken", "soy-vinegar braise", "garlic"],
      dishForm: undefined,
    });
    expect(r.formMismatch).toBe(false);
  });

  it("still detects form from the requested dish name without a directive", () => {
    const r = validateDishIdentity(request, mealNamed("Strawberry Cheesecake Parfait"), null);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
    expect(r.passed).toBe(false);
  });
});
