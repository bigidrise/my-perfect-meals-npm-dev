import assert from "node:assert/strict";
import {
  HUMAN_FOOD_CONTEXT_VERSION,
  type HumanFoodContext,
} from "../../shared/humanFoodContext";
import { resolveFlavorCompatibility } from "../services/humanFoodContext/flavorCompatibility";
import { buildHumanFoodPromptBlock } from "../services/humanFoodContext/buildHumanFoodPromptBlock";
import {
  issueHumanFoodContextReceipt,
  redeemHumanFoodContextReceipt,
} from "../services/humanFoodContext/contextReceipt";
import { validateHumanFoodResult } from "../services/humanFoodContext/validateHumanFoodResult";

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
  nutrition: null,
  behavior: null,
  gaps: ["flavor.spiceComplexity"],
  notices: [],
  blockedReasons: [],
  rejectedCandidateSignatures: [],
  internalFingerprint: "internal-only",
};

const prompt = buildHumanFoodPromptBlock(context);
assert.match(prompt, /Cuisine: Vietnamese/);
assert.match(prompt, /Effective diet: vegetarian/);
assert.match(prompt, /Hard allergy exclusions: peanut/);
assert.doesNotMatch(prompt, /internal-only/);

const issued = issueHumanFoodContextReceipt(context);
assert.ok(issued.receipt.length >= 32);
assert.equal(
  redeemHumanFoodContextReceipt({
    receipt: issued.receipt,
    actorUserId: "actor-a",
    subjectUserId: "subject-a",
    creator: "dessert_creator",
    generationChainId: "chain-a",
  }),
  context,
);
assert.equal(
  redeemHumanFoodContextReceipt({
    receipt: issued.receipt,
    actorUserId: "actor-b",
    subjectUserId: "subject-a",
    creator: "dessert_creator",
  }),
  null,
);
assert.equal(
  redeemHumanFoodContextReceipt({
    receipt: issued.receipt,
    actorUserId: "actor-a",
    subjectUserId: "subject-a",
    creator: "beverage_creator",
  }),
  null,
);

assert.deepEqual(
  validateHumanFoodResult({ ingredients: [{ name: "oats" }] }, context),
  { valid: true, violations: [] },
);
assert.equal(
  validateHumanFoodResult({ ingredients: [{ name: "peanut butter" }] }, context).valid,
  false,
);

console.log("Human Food Context contract tests passed");
