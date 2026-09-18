import {
  validateDishIdentity,
  type GeneratedMealLike,
} from "../services/dishAdaptation/dishIdentityValidator";
import type { DishAdaptationDirective } from "../services/dishAdaptation/types";

function pizzaDirective(
  request: string,
  conflicts: DishAdaptationDirective["conflicts"] = [],
): DishAdaptationDirective {
  return {
    identityAnchor: `This IS ${request}. Keep the named dish recognizable.`,
    definingComponents: ["crust or dough base", "sauce", "toppings"],
    adaptableComponents: ["flour", "cheese", "protein", "portion", "cooking method"],
    conflicts,
    adaptationBlock: "",
    dishForm: "a baked pizza with a dough or crust base, sauce, and toppings",
  };
}

function meal(
  name: string,
  description: string,
  ingredients: string[],
): GeneratedMealLike {
  return {
    name,
    description,
    ingredients: ingredients.map((name) => ({ name })),
  };
}

function expectRecognizablePizza(
  request: string,
  generated: GeneratedMealLike,
  directive: DishAdaptationDirective,
): void {
  const result = validateDishIdentity(request, generated, directive);

  expect(result.passed).toBe(true);
  expect(result.catastrophicDeviation).toBe(false);
  expect(result.formMismatch).toBe(false);

  const text = [
    generated.name,
    generated.description,
    ...(generated.ingredients ?? []).map((item) =>
      typeof item === "string" ? item : `${item.name ?? ""} ${item.item ?? ""}`,
    ),
  ]
    .join(" ")
    .toLowerCase();

  expect(text).toMatch(/crust|dough/);
  expect(text).toContain("sauce");
  expect(text).toMatch(/topping/);
}

describe("Create a Dish pizza named-dish contract", () => {
  it("preserves a plain pizza request as a recognizable pizza", () => {
    expectRecognizablePizza(
      "pizza",
      meal(
        "Classic Pizza",
        "A baked dough crust spread with tomato sauce and finished with vegetable toppings.",
        ["pizza dough crust", "tomato sauce", "vegetable toppings"],
      ),
      pizzaDirective("pizza"),
    );
  });

  it("preserves a pepperoni pizza request instead of broadening it to another dish", () => {
    expectRecognizablePizza(
      "pepperoni pizza",
      meal(
        "Pepperoni Pizza",
        "A crisp dough crust with tomato sauce, mozzarella, and pepperoni toppings.",
        ["pizza dough crust", "tomato sauce", "pepperoni toppings", "mozzarella"],
      ),
      pizzaDirective("pepperoni pizza"),
    );
  });

  it("keeps vegan and gluten-free adaptations in pizza form", () => {
    expectRecognizablePizza(
      "pizza",
      meal(
        "Vegan Gluten-Free Pizza",
        "A gluten-free crust with tomato sauce and melted vegan cheese toppings.",
        ["gluten-free flour crust", "tomato sauce", "vegan cheese toppings"],
      ),
      pizzaDirective("pizza", [
        {
          component: "wheat crust",
          guardrail: "gluten-free",
          directive: "Use a gluten-free crust; it remains pizza.",
        },
        {
          component: "dairy cheese",
          guardrail: "vegan",
          directive: "Use vegan cheese; it remains pizza.",
        },
      ]),
    );
  });

  it("keeps diabetes and GLP-1 adaptations in pizza form", () => {
    expectRecognizablePizza(
      "pizza",
      meal(
        "Diabetes- and GLP-1-Friendly Pizza",
        "A portion-controlled cauliflower-flour crust with tomato sauce and lean chicken toppings.",
        ["portion-controlled cauliflower flour crust", "tomato sauce", "lean chicken toppings"],
      ),
      pizzaDirective("pizza", [
        {
          component: "refined flour portion",
          guardrail: "diabetes",
          directive: "Use a portion-controlled lower-carbohydrate crust; it remains pizza.",
        },
        {
          component: "heavy fat",
          guardrail: "GLP-1",
          directive: "Use a lighter preparation and lean toppings; it remains pizza.",
        },
      ]),
    );
  });

  it.each([
    [
      "pizza",
      meal(
        "Pizza Bowl",
        "Pizza toppings and sauce served over a base in a bowl.",
        ["tomato sauce", "cheese toppings", "rice"],
      ),
    ],
    [
      "pepperoni pizza",
      meal(
        "Flatbread with Marinara Dip",
        "A plain flatbread with marinara dip and vegetables served separately.",
        ["flatbread", "marinara dip", "vegetables"],
      ),
    ],
  ])("rejects a %s request that escapes into a bowl or flatbread", (request, generated) => {
    const result = validateDishIdentity(
      request,
      generated,
      pizzaDirective(request),
    );

    expect(result.passed).toBe(false);
    expect(result.formMismatch || result.failures.length > 0).toBe(true);
  });
});