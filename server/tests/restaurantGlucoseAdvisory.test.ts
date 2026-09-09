import { HUMAN_FOOD_CONTEXT_VERSION, type HumanFoodContext } from "../../shared/humanFoodContext";
import { applyRestaurantGlucoseProduceAdvisory } from "../services/restaurantGlucoseAdvisory";

const unavailable = { value: null, source: "unavailable" as const, available: false };
const context: HumanFoodContext = {
  version: HUMAN_FOOD_CONTEXT_VERSION, status: "resolved", creator: "recipe_maker",
  actorUserId: "user", subjectUserId: "user", generationChainId: "chain", correlationId: "test",
  resolvedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
  diet: { stored: [], effective: [], source: "profile", requestOverride: null, adaptationOutcome: "not_needed" },
  flavor: { heat: unavailable, seasoningIntensity: unavailable, broadFlavor: unavailable, flavorStyle: unavailable, cuisine: unavailable, cuisineIntensity: unavailable, spiceComplexity: unavailable },
  safety: { allergies: [], avoidedFoods: [], dislikedFoods: [], healthConditions: [] },
  nutrition: null, behavior: null, authorization: { status: "not_required", waivers: [] },
  diabetesFoodPreferences: {
    state: "HIGH", preferenceBand: "HIGH", valueMgdl: 190, context: "RANDOM", source: "LOG", ageMinutes: 1,
    criticalLow: false, criticalHigh: false, preferencesConfigured: true,
    selectedFruits: ["Blueberries"], selectedVegetables: ["Broccoli"],
    safetyOverride: { active: false, reason: null, allowedProduce: [] },
  },
  gaps: [], notices: [], blockedReasons: [], internalFingerprint: "glucose-context",
};

describe("restaurant glucose-produce advisory", () => {
  it("removes a structured recommendation containing disallowed produce", () => {
    expect(applyRestaurantGlucoseProduceAdvisory([
      { meal: { name: "Chicken bowl", ingredients: ["chicken", "banana"] } },
    ], context)).toEqual([]);
  });

  it("retains unverified restaurant facts only with explicit advisory guidance", () => {
    const [result] = applyRestaurantGlucoseProduceAdvisory([
      { meal: { name: "Chicken bowl", ingredients: [] } },
    ], context);
    expect(result.glucoseProduceGuidance).toMatchObject({
      status: "advisory_unverified",
      approvedFruits: ["Blueberries"],
      approvedVegetables: ["Broccoli"],
    });
  });
});