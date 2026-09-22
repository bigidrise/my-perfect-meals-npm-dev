import { HUMAN_FOOD_CONTEXT_VERSION, type HumanFoodContext } from "../../shared/humanFoodContext";
import type { HumanFoodCandidate } from "../../shared/humanFoodValidation";
import { enforceFinalCreatorCandidates } from "../services/humanFoodContext/enforceFinalCreatorCandidates";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
import { resolveFlavorCompatibility } from "../services/humanFoodContext/flavorCompatibility";
import { buildHumanFoodPromptBlock } from "../services/humanFoodContext/buildHumanFoodPromptBlock";
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
    authorization: { status: "not_required", waivers: [] },
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

  it.each([
    ["Nutrition Priorities ON", ["omega_3_food_sources"]],
    ["Nutrition Priorities OFF", []],
  ])("keeps Mediterranean request authority through validation and repair with %s", async (_label, selectedPriorityIds) => {
    const foodContext = context({
      creator: "create_a_dish",
      flavor: resolveFlavorCompatibility(
        {
          cuisinePreference: "American",
          heatPreference: "none",
          palateSpiceTolerance: "mild",
          palateSeasoningIntensity: "balanced",
          palateFlavorStyle: "classic",
          flavorPreference: "unsure",
        },
        { cuisine: "Mediterranean" },
      ),
      nutritionPriorities: {
        schemaVersion: 1,
        registryVersion: "nutrition-priorities.v1",
        selectedPriorityIds: selectedPriorityIds as any,
        updatedAt: "2026-09-22T00:00:00.000Z",
      },
    });
    const validate = validator(foodContext, "pasta");
    const mediterranean = candidate(
      "Mediterranean Tomato Pasta",
      ["pasta", "tomato", "olive oil", "basil"],
      {
        evidence: {
          ...candidate("", []).evidence,
          cuisine: "Mediterranean",
          heat: "mild",
          seasoningIntensity: "strong",
          broadFlavor: "savory",
          flavorStyle: "bright",
        },
      },
    );
    const american = candidate(
      "American Cream Sauce Pasta",
      ["pasta", "cream", "cheddar"],
      {
        evidence: {
          ...candidate("", []).evidence,
          cuisine: "American",
          heat: "medium",
          seasoningIntensity: "strong",
          broadFlavor: "savory",
          flavorStyle: "bright",
        },
      },
    );

    expect(foodContext.flavor.heat).toEqual({
      value: "none",
      source: "current_profile",
      available: true,
    });
    expect(foodContext.flavor.broadFlavor.available).toBe(false);
    expect(buildHumanFoodPromptBlock(foodContext)).toContain("- Heat: none");
    expect(buildHumanFoodPromptBlock(foodContext)).not.toContain("- Broad flavor: unsure");
    expect(validate(mediterranean).outcome).toBe("pass");
    const americanValidation = validate(american);
    expect(americanValidation.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "cuisine_mismatch", outcome: "repairable" }),
    ]));
    expect(americanValidation.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "heat_mismatch" }),
    ]));
    expect(americanValidation.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "broad_flavor_mismatch" }),
    ]));
    expect(americanValidation.repairInstructions.join(" ")).not.toContain("unsure");

    const result = await enforceFinalCreatorCandidates({
      candidates: [american],
      validate,
      repair: async (instructions) => {
        expect(instructions.join(" ")).toContain('Keep cuisine aligned to "Mediterranean"');
        return [mediterranean];
      },
    });
    expect(result.repairAttempted).toBe(true);
    expect(result.accepted).toEqual([mediterranean]);
    expect(result.validations.every(({ result: item }) =>
      item.authoritativeContextFingerprint === "one-authoritative-context")).toBe(true);
  });

  it.each([
    ["Mediterranean pasta with no heat", "none"],
    ["spicy Mediterranean pasta", "hot"],
    ["mild Mediterranean pasta", "mild"],
  ])("keeps explicit request heat authoritative for %s", (requestedDish, requestedHeat) => {
    const foodContext = context({
      creator: "create_a_dish",
      flavor: resolveFlavorCompatibility(
        { heatPreference: "unsure" },
        { cuisine: "Mediterranean", heat: requestedHeat },
      ),
    });
    expect(foodContext.flavor.heat).toEqual({
      value: requestedHeat,
      source: "request",
      available: true,
    });

    const matching = validateHumanFoodCandidate(candidate(
      "Mediterranean Pasta",
      ["pasta", "tomato", "olive oil"],
      {
        evidence: {
          ...candidate("", []).evidence,
          cuisine: "Mediterranean",
          heat: requestedHeat,
        },
      },
    ), foodContext, { requestedDish, requestedCategory: "dinner" });
    expect(matching.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "heat_mismatch" }),
    ]));

    const mismatch = validateHumanFoodCandidate(candidate(
      "Mediterranean Pasta",
      ["pasta", "tomato", "olive oil"],
      {
        evidence: {
          ...candidate("", []).evidence,
          cuisine: "Mediterranean",
          heat: requestedHeat === "hot" ? "mild" : "hot",
        },
      },
    ), foodContext, {
      requestedDish,
      requestedCategory: "dinner",
      executionState: createHumanFoodRequestExecutionState(),
    });
    expect(mismatch.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "heat_mismatch", outcome: "repairable" }),
    ]));
    expect(mismatch.repairInstructions.join(" ")).toContain(
      `Keep heat aligned to "${requestedHeat}"`,
    );
  });

  it.each([
    ["none", "medium"],
    ["mild", "hot"],
    ["hot", "mild"],
  ])("uses saved heat %s as guidance without rejecting candidate heat %s", (savedHeat, candidateHeat) => {
    const foodContext = context({
      creator: "create_a_dish",
      flavor: resolveFlavorCompatibility({ heatPreference: savedHeat }),
    });
    expect(buildHumanFoodPromptBlock(foodContext)).toContain(`- Heat: ${savedHeat}`);

    const result = validateHumanFoodCandidate(candidate(
      "Mediterranean Pasta",
      ["pasta", "tomato", "olive oil"],
      {
        evidence: {
          ...candidate("", []).evidence,
          heat: candidateHeat,
        },
      },
    ), foodContext, {
      requestedDish: "Mediterranean pasta",
      requestedCategory: "dinner",
      executionState: createHumanFoodRequestExecutionState(),
    });
    expect(result.findings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "heat_mismatch" }),
    ]));
    expect(result.repairInstructions.join(" ")).not.toContain("Keep heat aligned");
  });

  it("keeps profile palate fields soft while explicit broad flavor remains enforceable", () => {
    const profileContext = context({
      creator: "create_a_dish",
      flavor: resolveFlavorCompatibility({
        heatPreference: "mild",
        flavorPreference: "comfort",
        palateSeasoningIntensity: "bold",
        palateFlavorStyle: "bright",
      }),
    });
    const differingCandidate = candidate(
      "Mediterranean Pasta",
      ["pasta", "tomato", "olive oil"],
      {
        evidence: {
          ...candidate("", []).evidence,
          heat: "hot",
          broadFlavor: "savory",
          seasoningIntensity: "light",
          flavorStyle: "classic",
        },
      },
    );
    const profileResult = validateHumanFoodCandidate(
      differingCandidate,
      profileContext,
      { requestedDish: "Mediterranean pasta", requestedCategory: "dinner" },
    );
    expect(profileResult.outcome).toBe("pass");

    const requestContext = context({
      creator: "create_a_dish",
      flavor: resolveFlavorCompatibility(
        {},
        {
          broadFlavor: "comfort",
          seasoningIntensity: "bold",
          flavorStyle: "bright",
        },
      ),
    });
    const requestResult = validateHumanFoodCandidate(
      differingCandidate,
      requestContext,
      {
        requestedDish: "Mediterranean pasta",
        requestedCategory: "dinner",
        executionState: createHumanFoodRequestExecutionState(),
      },
    );
    expect(requestResult.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "broad_flavor_mismatch", outcome: "repairable" }),
      expect.objectContaining({ code: "seasoning_intensity_mismatch", outcome: "repairable" }),
      expect.objectContaining({ code: "flavor_style_mismatch", outcome: "repairable" }),
    ]));
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