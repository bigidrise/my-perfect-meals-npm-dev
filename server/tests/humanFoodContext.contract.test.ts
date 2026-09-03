import assert from "node:assert/strict";
import {
  HUMAN_FOOD_CONTEXT_VERSION,
  type HumanFoodContext,
} from "../../shared/humanFoodContext";
import { resolveFlavorCompatibility } from "../services/humanFoodContext/flavorCompatibility";
import { buildHumanFoodPromptBlock } from "../services/humanFoodContext/buildHumanFoodPromptBlock";
import { validateHumanFoodResult } from "../services/humanFoodContext/validateHumanFoodResult";
import {
  buildRejectedCandidatePrompt,
  createHumanFoodRequestExecutionState,
  recordRejectedHumanFoodCandidate,
} from "../services/humanFoodContext/requestExecutionState";
import { createHumanFoodRequestScope } from "../services/humanFoodContext/requestScope";
import { freezeHumanFoodContext } from "../services/humanFoodContext/resolveHumanFoodContext";
import { buildCreatorAllergenAdaptationPrompt } from "../services/humanFoodContext/adapters";

process.env.SESSION_SECRET ||= "human-food-context-test-secret";

const flavor = resolveFlavorCompatibility(
  {
    heatPreference: "hot",
    palateSpiceTolerance: "mild",
    palateSeasoningIntensity: "balanced",
    palateFlavorStyle: "classic",
    cuisinePreference: "Thai",
    cuisineIntensity: "authentic",
    flavorPreference: "bright",
  },
  { heat: "medium", cuisine: "Vietnamese" },
);

assert.equal(flavor.heat.value, "medium");
assert.equal(flavor.heat.source, "request");
assert.equal(flavor.cuisine.value, "Vietnamese");
assert.equal(flavor.seasoningIntensity.available, false);
assert.equal(flavor.flavorStyle.available, false);
assert.equal(flavor.spiceComplexity.available, false);

const now = Date.now();
const context: HumanFoodContext = {
  version: HUMAN_FOOD_CONTEXT_VERSION,
  status: "resolved_with_gaps",
  creator: "dessert_creator",
  actorUserId: "actor-a",
  subjectUserId: "subject-a",
  generationChainId: "chain-a",
  correlationId: "correlation-a",
  resolvedAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 60_000).toISOString(),
  diet: {
    stored: ["vegan"],
    effective: ["vegetarian"],
    source: "request",
    requestOverride: "vegetarian",
    adaptationOutcome: "request_override_applied",
  },
  flavor,
  safety: {
    allergies: ["peanut"],
    avoidedFoods: ["mushroom"],
    dislikedFoods: [],
    healthConditions: [],
  },
  nutrition: {
    authority: "nutritionStateService",
    resolution: { status: "resolved", reasonCodes: [] },
    activeConstraints: {
      generationContext: "standard",
      starchSlotsExhausted: false,
      calorieBudgetExhausted: false,
      proteinBudgetMet: false,
      consumedStarchExhausted: true,
      projectedStarchConflict: true,
    },
    projectedRemaining: {
      calories: 500,
      protein: 40,
      carbs: 30,
      fat: 20,
      starchyCarbs: 0,
      fibrousCarbs: 20,
      starchMealsRemaining: 0,
    },
    remaining: {
      calories: 500,
      protein: 40,
      carbs: 30,
      fat: 20,
      starchyCarbs: 0,
      fibrousCarbs: 20,
      starchMealsRemaining: 0,
    },
    starch: {
      consumed: {
        targetGrams: 30,
        confirmedGrams: 30,
        uncertainGrams: 0,
        remainingGrams: 0,
        mealsUsed: 1,
        mealsRemaining: 0,
        exhausted: true,
        classificationStatus: "VERIFIED",
      },
      projected: {
        reservedGrams: 0,
        projectedGrams: 30,
        projectedRemainingGrams: 0,
        projectedMealsUsed: 1,
        projectedConflict: true,
      },
    },
  } as any,
  behavior: null,
  gaps: ["flavor.spiceComplexity"],
  notices: [],
  blockedReasons: [],
  internalFingerprint: "internal-only",
};

const prompt = buildHumanFoodPromptBlock(context);
assert.match(prompt, /Cuisine: Vietnamese/);
assert.match(prompt, /Effective diet: vegetarian/);
assert.match(prompt, /Hard allergy exclusions: peanut/);
assert.match(prompt, /Canonical nutrition authority: nutritionStateService/);
assert.match(prompt, /Consumed-starch authority: 0g/);
assert.doesNotMatch(prompt, /internal-only/);

assert.deepEqual(
  validateHumanFoodResult({
    ingredients: [{ name: "non-starchy vegetables" }],
    nutrition: { calories: 350, carbs: 20, fat: 12, starchyCarbs: 0 },
  }, context),
  { valid: true, violations: [] },
);
assert.equal(
  validateHumanFoodResult({ ingredients: [{ name: "peanut butter" }] }, context).valid,
  false,
);

const adaptableConflict = {
  result: "BLOCKED",
  blockedTerms: ["milk"],
  blockedCategories: ["lactose"],
  ambiguousTerms: [],
  message: "Milk requires adaptation.",
  allergyConflict: {
    type: "conflict_adaptable",
    allergens: ["lactose"],
    matchedTerms: ["milk"],
    dishName: "Indian milk cake",
  },
} as const;
const lactoseContext = structuredClone(context);
lactoseContext.safety.allergies = ["lactose intolerance"];
const intolerancePrompt = buildCreatorAllergenAdaptationPrompt(
  "dessert_creator",
  "Indian milk cake",
  adaptableConflict,
  lactoseContext,
);
assert.match(intolerancePrompt ?? "", /INTOLERANCE ADAPTATION/);
assert.match(intolerancePrompt ?? "", /Preserve the requested cuisine/);
assert.match(intolerancePrompt ?? "", /materially different safe ingredient strategy/);

const milkAllergyContext = structuredClone(context);
milkAllergyContext.safety.allergies = ["milk protein allergy"];
const allergyPrompt = buildCreatorAllergenAdaptationPrompt(
  "dessert_creator",
  "Indian milk cake",
  {
    ...adaptableConflict,
    blockedCategories: ["milk"],
    allergyConflict: {
      ...adaptableConflict.allergyConflict,
      allergens: ["milk"],
    },
  },
  milkAllergyContext,
);
assert.match(allergyPrompt ?? "", /TRUE ALLERGY ADAPTATION/);
assert.match(allergyPrompt ?? "", /fully milk-protein-free substitute/);

assert.equal(
  buildCreatorAllergenAdaptationPrompt(
    "dessert_creator",
    "peanut brittle",
    {
      ...adaptableConflict,
      allergyConflict: {
        type: "conflict_identity_collapse",
        allergens: ["peanut"],
        matchedTerms: ["peanut brittle"],
        dishName: "peanut brittle",
      },
    },
    context,
  ),
  null,
);
assert.equal(
  validateHumanFoodResult({
    ingredients: [{ name: "rice" }],
    nutrition: { calories: 600, carbs: 45, fat: 25, starchyCarbs: 20 },
  }, context).valid,
  false,
);

const executionState = createHumanFoodRequestExecutionState();
recordRejectedHumanFoodCandidate(executionState, {
  name: "First Bowl",
  ingredients: [{ name: "rice" }, { name: "tofu" }],
});
assert.match(buildRejectedCandidatePrompt(executionState), /first bowl\|rice,tofu/);

const frozen = freezeHumanFoodContext(structuredClone(context));
assert.equal(Object.isFrozen(frozen), true);
assert.equal(Object.isFrozen(frozen.flavor), true);

async function verifyRequestScopes(): Promise<void> {
  let resolveCount = 0;
  const resolver = async () => {
    resolveCount += 1;
    return frozen;
  };
  const requestInput = {
    actorUserId: "actor-a",
    subjectUserId: "subject-a",
    creator: "dessert_creator" as const,
  };
  const firstRequest = createHumanFoodRequestScope(requestInput, resolver);
  const [firstA, firstB] = await Promise.all([firstRequest.resolve(), firstRequest.resolve()]);
  assert.equal(firstA, firstB);
  assert.equal(resolveCount, 1);

  const rerollRequest = createHumanFoodRequestScope(requestInput, resolver);
  assert.equal(await rerollRequest.resolve(), frozen);
  assert.equal(resolveCount, 2);
}

verifyRequestScopes()
  .then(() => console.log("Human Food Context contract tests passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
