import {
  buildPediatricHumanFoodContext,
  toPediatricHumanFoodCandidate,
} from "../services/humanFoodContext/pediatricContextAdapter";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";

describe("My Perfect Beginnings shared Human Food Context", () => {
  beforeAll(() => {
    process.env.SESSION_SECRET ||= "test-session-secret";
  });

  test("uses child constraints without manufacturing a specialty diet", () => {
    const context = buildPediatricHumanFoodContext({
      actorUserId: "parent",
      subjectId: "child",
      resolverContext: null,
      allergies: [],
      dietaryPattern: "omnivore",
      explicitCuisine: null,
    });

    expect(context.creator).toBe("my_perfect_beginning");
    expect(context.diet.effective).toEqual([]);
    expect(context.safety.healthConditions).toEqual([]);
  });

  test("keeps explicit cuisine and child allergy authority", () => {
    const context = buildPediatricHumanFoodContext({
      actorUserId: "parent",
      subjectId: "child",
      resolverContext: null,
      allergies: [
        { allergenId: "milk", severity: "confirmed_allergy" },
        { allergenId: "other", customAllergenName: "kiwi", severity: "preference_avoid" },
      ],
      dietaryPattern: "vegetarian",
      explicitCuisine: "Korean",
    });

    expect(context.flavor.cuisine).toMatchObject({
      value: "Korean",
      source: "request",
    });
    expect(context.safety.allergies).toEqual(["milk"]);
    expect(context.safety.avoidedFoods).toEqual(["kiwi"]);
    expect(context.diet.effective).toEqual(["vegetarian"]);
  });

  test("validates the fully structured pediatric recipe", () => {
    const context = buildPediatricHumanFoodContext({
      actorUserId: "parent",
      subjectId: "child",
      resolverContext: null,
      allergies: [{ allergenId: "milk", severity: "confirmed_allergy" }],
      dietaryPattern: "omnivore",
      explicitCuisine: "Mediterranean",
    });
    const candidate = toPediatricHumanFoodCandidate({
      recipeName: "Mediterranean Chicken and Rice",
      cuisine: "Mediterranean",
      whyThisVersionIsBetter: "A soft, balanced family meal.",
      ingredients: [
        { name: "chicken", quantity: "4 oz" },
        { name: "rice", quantity: "1/2 cup" },
        { name: "tomato", quantity: "1/2 cup" },
      ],
      instructions: ["Cook until soft and age appropriate."],
    }, context);

    expect(validateHumanFoodCandidate(candidate, context, {
      requestedDish: "Mediterranean chicken and rice",
      requestedCategory: "meal",
    }).outcome).toBe("pass");
  });

  test("blocks a child allergy after pediatric patching", () => {
    const context = buildPediatricHumanFoodContext({
      actorUserId: "parent",
      subjectId: "child",
      resolverContext: null,
      allergies: [{ allergenId: "milk", severity: "confirmed_allergy" }],
      dietaryPattern: "omnivore",
      explicitCuisine: null,
    });
    const candidate = toPediatricHumanFoodCandidate({
      recipeName: "Creamy Pasta",
      ingredients: [{ name: "whole milk", quantity: "1 cup" }],
      instructions: ["Stir."],
    }, context);

    expect(validateHumanFoodCandidate(candidate, context).outcome).toBe("blocked");
  });
});