import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
import {
  toPerServingNutrition,
} from "../services/humanFoodContext/servingNutrition";
import type { HumanFoodContext } from "../../shared/humanFoodContext";

const context = {
  version: "human-food-context.v1",
  actorUserId: "user-a",
  subjectUserId: "user-a",
  status: "resolved",
  notices: [],
  internalFingerprint: "serving-contract",
  diet: { stored: [], requestOverride: null, effective: [], source: "unavailable" },
  safety: {
    allergies: [],
    avoidedFoods: [],
    dislikedFoods: [],
    healthConditions: [],
  },
  flavor: {
    cuisine: { value: "Mediterranean", source: "request", available: true },
    cuisineIntensity: { value: null, source: "unavailable", available: false },
    heat: { value: "none", source: "current_profile", available: true },
    seasoningIntensity: { value: null, source: "unavailable", available: false },
    broadFlavor: { value: null, source: "unavailable", available: false },
    flavorStyle: { value: null, source: "unavailable", available: false },
  },
  sweeteners: { preferred: [], avoided: [] },
  authorization: { status: "not_required", waivers: [] },
  nutrition: {
    prescription: { source: "profile" },
    projectedRemaining: { calories: 700, carbs: 70, fat: 30 },
    remaining: { calories: 700, carbs: 70, fat: 30 },
    activeConstraints: {
      generationContext: "standard",
      consumedStarchExhausted: false,
      projectedStarchConflict: false,
    },
  },
  behavior: null,
  gaps: [],
} as unknown as HumanFoodContext;

function totalRecipe(servings: number, perServing = {
  calories: 600,
  protein: 25,
  carbs: 60,
  fat: 20,
  starchyCarbs: 35,
}) {
  return {
    nutrition: Object.fromEntries(
      Object.entries(perServing).map(([key, value]) => [key, value * servings]),
    ),
  };
}

function candidateFor(servings: number, perServing?: Parameters<typeof totalRecipe>[1]) {
  return {
    name: "Mediterranean Pasta",
    category: "dinner",
    ingredients: ["pasta", "tomato", "olive oil"],
    nutrition: toPerServingNutrition(totalRecipe(servings, perServing), servings),
    evidence: {
      cuisine: "Mediterranean",
      heat: "mild",
      dishIdentityPreserved: true,
    },
  };
}

describe("Create a Dish serving nutrition contract", () => {
  it.each([1, 2, 3])(
    "gives the same per-serving judgment for %i serving(s)",
    (servings) => {
      const result = validateHumanFoodCandidate(candidateFor(servings), context, {
        requestedDish: "Mediterranean pasta",
        requestedCategory: "dinner",
      });
      expect(result.outcome).toBe("pass");
      expect(candidateFor(servings).nutrition).toEqual({
        calories: 600,
        protein: 25,
        carbs: 60,
        fat: 20,
        starchyCarbs: 35,
      });
    },
  );

  it("does not compare total-recipe nutrition directly with per-serving ceilings", () => {
    expect(totalRecipe(3).nutrition.carbs).toBe(180);
    expect(candidateFor(3).nutrition.carbs).toBe(60);
    expect(validateHumanFoodCandidate(candidateFor(3), context, {
      requestedDish: "Mediterranean pasta",
      requestedCategory: "dinner",
    }).outcome).toBe("pass");
  });

  it("still rejects a genuine per-serving nutrition violation", () => {
    const result = validateHumanFoodCandidate(candidateFor(3, {
      calories: 800,
      protein: 25,
      carbs: 90,
      fat: 40,
      starchyCarbs: 50,
    }), context, {
      requestedDish: "Mediterranean pasta",
      requestedCategory: "dinner",
    });
    expect(result.outcome).toBe("repairable");
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "projected_calories_budget_exceeded" }),
      expect.objectContaining({ code: "projected_carbs_budget_exceeded" }),
      expect.objectContaining({ code: "projected_fat_budget_exceeded" }),
    ]));
  });
});