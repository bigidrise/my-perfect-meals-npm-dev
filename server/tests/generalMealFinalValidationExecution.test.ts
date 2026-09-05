import { readFileSync } from "node:fs";
import { HUMAN_FOOD_CONTEXT_VERSION, type HumanFoodContext } from "../../shared/humanFoodContext";
import type { HumanFoodCandidate } from "../../shared/humanFoodValidation";
import { enforceFinalCreatorCandidates } from "../services/humanFoodContext/enforceFinalCreatorCandidates";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
import { createHumanFoodRequestExecutionState } from "../services/humanFoodContext/requestExecutionState";

const unavailable = { value: null, source: "unavailable" as const, available: false };
const baseContext = (overrides: Partial<HumanFoodContext> = {}): HumanFoodContext => ({
  version: HUMAN_FOOD_CONTEXT_VERSION,
  status: "resolved",
  creator: "recipe_maker",
  actorUserId: "authenticated-user",
  subjectUserId: "authenticated-user",
  generationChainId: "stage-2d-chain",
  correlationId: "stage-2d-request",
  resolvedAt: "2026-09-04T00:00:00.000Z",
  expiresAt: "2026-09-04T00:05:00.000Z",
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
  internalFingerprint: "stage-2d-context",
  ...overrides,
});

const meal = (
  name: string,
  ingredients: HumanFoodCandidate["ingredients"],
  overrides: Partial<HumanFoodCandidate> = {},
): HumanFoodCandidate => ({
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
});

describe("Stage 2D canonical general-meal final validation", () => {
  it("wires every in-scope canonical type and uses authenticated subject resolution", () => {
    const source = readFileSync("server/routes.ts", "utf8");
    expect(source).toContain('new Set(["create-with-chef", "snack-creator", "premade", "craving"])');
    expect(source).toContain("const effectiveUserId: string = delegatedClientId ?? authUserId");
    expect(source).toContain("enforceFinalCreatorCandidates({");
    expect(source).toContain("HUMAN_FOOD_FINAL_REVIEW_REQUIRED");
  });

  it("preserves one context through one materially different repair", async () => {
    const context = baseContext({
      safety: { allergies: [], avoidedFoods: ["mushroom"], dislikedFoods: [], healthConditions: [] },
    });
    const state = createHumanFoodRequestExecutionState();
    const validate = (candidate: HumanFoodCandidate) =>
      validateHumanFoodCandidate(candidate, context, {
        requestedDish: "chicken curry",
        requestedCategory: "dinner",
        executionState: state,
      });
    const result = await enforceFinalCreatorCandidates({
      candidates: [meal("Chicken Curry", ["chicken", "spinach", "mushroom"])],
      validate,
      repair: async (instructions) => {
        expect(instructions.join(" ")).toContain("stage-2d-context");
        return [meal("Chicken Curry", ["chicken", "spinach", "tomato"])];
      },
    });
    expect(result.repairAttempted).toBe(true);
    expect(result.accepted).toHaveLength(1);
    expect(result.validations.every(({ result: item }) =>
      item.authoritativeContextFingerprint === "stage-2d-context")).toBe(true);
  });

  it.each([
    {
      label: "Indian lactose-free cake",
      candidate: meal("Indian Cardamom Cake", ["almond flour", "coconut milk", "cardamom", "egg", "apple"], {
        evidence: { ...meal("", []).evidence, cuisine: "Indian" },
      }),
      context: baseContext({
        safety: { allergies: ["lactose"], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
        flavor: { ...baseContext().flavor, cuisine: { value: "Indian", source: "request", available: true } },
      }),
      dish: "Indian cake", category: "dinner", outcome: "pass",
    },
    {
      label: "lactose-safe steak",
      candidate: meal("Grilled Steak", ["beef", "broccoli", "olive oil"]),
      context: baseContext({ safety: { allergies: ["lactose"], avoidedFoods: [], dislikedFoods: [], healthConditions: [] } }),
      dish: "steak", category: "dinner", outcome: "pass",
    },
    {
      label: "GLP-1 snack",
      candidate: meal("Chocolate Brownie", ["cocoa", "egg", "avocado"], {
        category: "dessert",
        evidence: { ...meal("", []).evidence, glp1Compliant: true },
      }),
      context: baseContext({ safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: ["GLP-1"] } }),
      dish: "chocolate brownie", category: "dessert", outcome: "pass",
    },
    {
      label: "vegan diabetes meal",
      candidate: meal("Tofu Curry", ["tofu", "spinach", "tomato"], {
        nutrition: { calories: 360, protein: 24, carbs: 28, fat: 14, starchyCarbs: 8 },
        evidence: { ...meal("", []).evidence, diabetesCompliant: true },
      }),
      context: baseContext({
        diet: { stored: ["vegan"], effective: ["vegan"], source: "profile", requestOverride: null, adaptationOutcome: "not_needed" },
        safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: ["diabetes"] },
        nutrition: { activeConstraints: { consumedStarchExhausted: false }, projectedRemaining: { calories: 500, protein: 40, carbs: 35, fat: 20 } } as any,
      }),
      dish: "tofu curry", category: "dinner", outcome: "pass",
    },
    {
      label: "strong lower-sodium cuisine",
      candidate: meal("Strongly Spiced Lentils", ["lentils", "cumin", "tomato"], {
        evidence: { ...meal("", []).evidence, cuisine: "Indian", seasoningIntensity: "strong", clinicalDirectivesCompliant: true },
      }),
      context: baseContext({
        safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: ["hypertension"] },
        flavor: {
          ...baseContext().flavor,
          cuisine: { value: "Indian", source: "request", available: true },
          seasoningIntensity: { value: "strong", source: "request", available: true },
        },
      }),
      dish: "lentils", category: "dinner", outcome: "pass",
    },
    {
      label: "meal after starch exhaustion",
      candidate: meal("Rice Bowl", ["rice", "chicken"], {
        nutrition: { calories: 350, protein: 25, carbs: 30, fat: 10, starchyCarbs: 20 },
      }),
      context: baseContext({
        nutrition: { activeConstraints: { consumedStarchExhausted: true }, projectedRemaining: { calories: 500, protein: 40, carbs: 40, fat: 20 } } as any,
      }),
      dish: "rice bowl", category: "dinner", outcome: "blocked",
    },
    {
      label: "snack after starch exhaustion",
      candidate: meal("Cracker Snack", ["crackers"], {
        category: "snack",
        nutrition: { calories: 180, protein: 5, carbs: 22, fat: 6, starchyCarbs: 18 },
      }),
      context: baseContext({
        nutrition: { activeConstraints: { consumedStarchExhausted: true }, projectedRemaining: { calories: 300, protein: 20, carbs: 30, fat: 15 } } as any,
      }),
      dish: "cracker snack", category: "snack", outcome: "blocked",
    },
  ])("$label → $outcome", ({ candidate, context, dish, category, outcome }) => {
    expect(validateHumanFoodCandidate(candidate, context, {
      requestedDish: dish,
      requestedCategory: category,
    }).outcome).toBe(outcome);
  });

  it("never returns a blocked allergy conflict or an invalid bounded repair", async () => {
    const context = baseContext({
      safety: { allergies: ["shellfish"], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
    });
    const validate = (candidate: HumanFoodCandidate) =>
      validateHumanFoodCandidate(candidate, context, {
        requestedDish: "adapted gumbo",
        requestedCategory: "dinner",
      });
    const repair = jest.fn(async () => [meal("Shrimp Gumbo", ["shrimp", "okra"])]);
    const result = await enforceFinalCreatorCandidates({
      candidates: [meal("Shrimp Gumbo", ["shrimp", "okra"])],
      validate,
      repair,
    });
    expect(result.accepted).toEqual([]);
    expect(repair).not.toHaveBeenCalled();
  });
});