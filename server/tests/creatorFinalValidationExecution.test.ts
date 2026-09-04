import { HUMAN_FOOD_CONTEXT_VERSION, type HumanFoodContext } from "../../shared/humanFoodContext";
import type { HumanFoodCandidate } from "../../shared/humanFoodValidation";
import { enforceFinalCreatorCandidates } from "../services/humanFoodContext/enforceFinalCreatorCandidates";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
import { createHumanFoodRequestExecutionState } from "../services/humanFoodContext/requestExecutionState";

const unavailable = { value: null, source: "unavailable" as const, available: false };
function context(overrides: Partial<HumanFoodContext> = {}): HumanFoodContext {
  return {
    version: HUMAN_FOOD_CONTEXT_VERSION,
    status: "resolved",
    creator: "craving_creator",
    actorUserId: "authenticated-user",
    subjectUserId: "authenticated-user",
    generationChainId: "chain",
    correlationId: "request",
    resolvedAt: "2026-09-03T00:00:00.000Z",
    expiresAt: "2026-09-03T00:05:00.000Z",
    diet: { stored: [], effective: [], source: "profile", requestOverride: null, adaptationOutcome: "not_needed" },
    flavor: {
      heat: unavailable, seasoningIntensity: unavailable, broadFlavor: unavailable,
      flavorStyle: unavailable, cuisine: unavailable, cuisineIntensity: unavailable,
      spiceComplexity: unavailable,
    },
    safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
    nutrition: null,
    behavior: null,
    gaps: [],
    notices: [],
    blockedReasons: [],
    internalFingerprint: "one-authoritative-context",
    ...overrides,
  };
}

function candidate(
  name: string,
  ingredients: HumanFoodCandidate["ingredients"],
  overrides: Partial<HumanFoodCandidate> = {},
): HumanFoodCandidate {
  return {
    name,
    category: "dinner",
    ingredients,
    evidence: {
      sourceType: "generated_recipe",
      ingredientEvidence: "structured_generation",
      preparationEvidence: "structured_generation",
      nutritionEvidence: "structured_generation",
      dietaryIdentityCompliant: true,
      dishIdentityPreserved: true,
      categoryIdentityPreserved: true,
    },
    ...overrides,
  };
}

function validator(foodContext: HumanFoodContext, requestedDish: string, category = "dinner") {
  const state = createHumanFoodRequestExecutionState();
  return (food: HumanFoodCandidate) => validateHumanFoodCandidate(food, foodContext, {
    requestedDish,
    requestedCategory: category,
    executionState: state,
  });
}

describe("Stage 2C creator final-validation execution", () => {
  it("performs one repair, revalidates it, and preserves the context fingerprint", async () => {
    const foodContext = context({
      safety: { allergies: [], avoidedFoods: ["mushroom"], dislikedFoods: [], healthConditions: [] },
    });
    const validate = validator(foodContext, "chicken curry");
    let repairs = 0;
    const result = await enforceFinalCreatorCandidates({
      candidates: [candidate("Chicken Curry", ["chicken", "spinach", "mushroom"])],
      validate,
      repair: async (instructions) => {
        repairs += 1;
        expect(instructions.join(" ")).toContain("one-authoritative-context");
        expect(instructions.join(" ")).toContain("Preserve the requested cuisine");
        return [candidate("Chicken Curry", ["chicken", "spinach", "tomato"])];
      },
    });

    expect(repairs).toBe(1);
    expect(result.accepted).toHaveLength(1);
    expect(result.validations).toHaveLength(2);
    expect(result.validations.every(({ result: item }) =>
      item.authoritativeContextFingerprint === "one-authoritative-context")).toBe(true);
  });

  it("never repairs or leaks a blocked allergy candidate", async () => {
    const repair = jest.fn(async () => []);
    const result = await enforceFinalCreatorCandidates({
      candidates: [candidate("Salmon Dinner", [{ name: "", item: "salmon" }])],
      validate: validator(context({
        safety: { allergies: ["fish"], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
      }), "salmon dinner"),
      repair,
    });
    expect(result.accepted).toEqual([]);
    expect(repair).not.toHaveBeenCalled();
    expect(result.validations[0].result.outcome).toBe("blocked");
  });

  it("rejects an identical repaired candidate even when it otherwise passes", async () => {
    const initial = candidate("Chicken Curry", ["chicken", "spinach", "mushroom"]);
    const repaired = candidate("Chicken Curry", ["chicken", "spinach", "mushroom"]);
    let call = 0;
    const result = await enforceFinalCreatorCandidates({
      candidates: [initial],
      validate: (food) => {
        call += 1;
        const base = validator(context(), "chicken curry")(food);
        return call === 1
          ? { ...base, outcome: "repairable", repairInstructions: ["repair"] }
          : { ...base, outcome: "pass" };
      },
      repair: async () => [repaired],
    });
    expect(result.accepted).toEqual([]);
    expect(result.repeatedRepairRejected).toBe(true);
  });

  it("keeps review-required evidence out of returned candidates", async () => {
    const result = await enforceFinalCreatorCandidates({
      candidates: [candidate("Restaurant Curry", ["chicken", "spinach"], {
        evidence: { sourceType: "restaurant", ingredientEvidence: "unknown", preparationEvidence: "unknown" },
      })],
      validate: validator(context(), "restaurant curry"),
      repair: async () => [],
    });
    expect(result.accepted).toEqual([]);
    expect(result.validations[0].result.outcome).toBe("review_required");
  });

  it("accepts a recognizable Indian lactose-free cake", () => {
    const foodContext = context({
      safety: { allergies: ["lactose"], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
      flavor: {
        ...context().flavor,
        cuisine: { value: "Indian", source: "request", available: true },
        cuisineIntensity: { value: "authentic", source: "request", available: true },
      },
    });
    const result = validateHumanFoodCandidate(candidate(
      "Indian Cardamom Cake",
      ["almond flour", "coconut milk", "cardamom", "egg", "apple"],
      { evidence: { ...candidate("", []).evidence, cuisine: "Indian", cuisineIntensity: "authentic" } },
    ), foodContext, { requestedDish: "Indian cake", requestedCategory: "dinner" });
    expect(result.outcome).toBe("pass");
  });

  it("does not treat plain steak as a lactose conflict", () => {
    const result = validateHumanFoodCandidate(
      candidate("Grilled Steak", ["beef", "broccoli", "olive oil"]),
      context({ safety: { allergies: ["lactose"], avoidedFoods: [], dislikedFoods: [], healthConditions: [] } }),
      { requestedDish: "steak", requestedCategory: "dinner" },
    );
    expect(result.outcome).toBe("pass");
  });

  it("accepts an evidenced GLP-1 compliant dessert instead of automatically denying dessert", () => {
    const result = validateHumanFoodCandidate(candidate(
      "Chocolate Brownie",
      ["cocoa", "egg", "avocado"],
      { category: "dessert", evidence: { ...candidate("", []).evidence, glp1Compliant: true } },
    ), context({
      safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: ["GLP-1"] },
    }), { requestedDish: "chocolate brownie", requestedCategory: "dessert" });
    expect(result.outcome).toBe("pass");
  });

  it("accepts shellfish-free gumbo and exhausted-starch sushi structures", () => {
    const gumbo = validateHumanFoodCandidate(
      candidate("Chicken and Okra Gumbo", ["chicken", "okra", "tomato"]),
      context({ safety: { allergies: ["shellfish"], avoidedFoods: [], dislikedFoods: [], healthConditions: [] } }),
      { requestedDish: "gumbo", requestedCategory: "dinner" },
    );
    const sushi = validateHumanFoodCandidate(candidate(
      "Salmon Cucumber Sushi",
      ["salmon", "cucumber", "avocado", "nori"],
      { category: "sushi", nutrition: { calories: 220, protein: 24, carbs: 7, fat: 10, starchyCarbs: 0 } },
    ), context({
      nutrition: {
        activeConstraints: { consumedStarchExhausted: true },
        projectedRemaining: { calories: 500, protein: 40, carbs: 30, fat: 20 },
      } as any,
    }), { requestedDish: "sushi", requestedCategory: "sushi" });
    expect(gumbo.outcome).toBe("pass");
    expect(sushi.outcome).toBe("pass");
  });

  it("keeps vegan identity inside applicable diabetes carbohydrate limits", () => {
    const foodContext = context({
      diet: {
        stored: ["vegan"], effective: ["vegan"], source: "profile",
        requestOverride: null, adaptationOutcome: "not_needed",
      },
      safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: ["diabetes"] },
      nutrition: {
        activeConstraints: { consumedStarchExhausted: false },
        projectedRemaining: { calories: 500, protein: 35, carbs: 35, fat: 20 },
      } as any,
    });
    const result = validateHumanFoodCandidate(candidate(
      "Tofu Vegetable Curry",
      ["tofu", "spinach", "tomato"],
      {
        nutrition: { calories: 380, protein: 25, carbs: 28, fat: 15, starchyCarbs: 8 },
        evidence: {
          ...candidate("", []).evidence,
          dietaryIdentityCompliant: true,
          diabetesCompliant: true,
        },
      },
    ), foodContext, { requestedDish: "tofu curry", requestedCategory: "dinner" });
    expect(result.outcome).toBe("pass");
  });

  it("accepts culturally strong lower-sodium food only with clinical evidence", () => {
    const foodContext = context({
      safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: ["hypertension"] },
      flavor: {
        ...context().flavor,
        cuisine: { value: "Indian", source: "request", available: true },
        seasoningIntensity: { value: "strong", source: "request", available: true },
      },
    });
    const result = validateHumanFoodCandidate(candidate(
      "Strongly Spiced Indian Lentils",
      ["lentils", "spinach", "tomato", "cumin"],
      {
        evidence: {
          ...candidate("", []).evidence,
          cuisine: "Indian",
          seasoningIntensity: "strong",
          clinicalDirectivesCompliant: true,
        },
      },
    ), foodContext, { requestedDish: "Indian lentils", requestedCategory: "dinner" });
    expect(result.outcome).toBe("pass");
  });
});