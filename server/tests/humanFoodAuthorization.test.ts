import {
  _resetTokenStoreForTesting,
  claimAdvisoryOverrideToken,
  issueAdvisoryOverrideToken,
} from "../services/safetyPinService";
import { validateHumanFoodCandidate } from "../services/humanFoodContext/finalValidation";
import {
  createHumanFoodRequestScope,
} from "../services/humanFoodContext/requestScope";
import {
  HUMAN_FOOD_CONTEXT_VERSION,
  type HumanFoodContext,
} from "../../shared/humanFoodContext";

function context(authorization: HumanFoodContext["authorization"]): HumanFoodContext {
  const now = new Date().toISOString();
  return {
    version: HUMAN_FOOD_CONTEXT_VERSION,
    status: "resolved",
    creator: "create_a_dish",
    actorUserId: "user-a",
    subjectUserId: "user-a",
    generationChainId: "chain",
    correlationId: "correlation",
    resolvedAt: now,
    expiresAt: now,
    diet: {
      stored: ["vegan"],
      effective: ["vegan"],
      source: "profile",
      requestOverride: null,
      adaptationOutcome: "not_needed",
    },
    flavor: {
      heat: { value: null, source: "unavailable", available: false },
      seasoningIntensity: { value: null, source: "unavailable", available: false },
      broadFlavor: { value: null, source: "unavailable", available: false },
      flavorStyle: { value: null, source: "unavailable", available: false },
      cuisine: { value: null, source: "unavailable", available: false },
      cuisineIntensity: { value: null, source: "unavailable", available: false },
      spiceComplexity: { value: null, source: "unavailable", available: false },
    },
    safety: { allergies: [], avoidedFoods: ["mushroom"], dislikedFoods: [], healthConditions: [] },
    authorization,
    nutrition: null,
    behavior: null,
    gaps: [],
    notices: [],
    blockedReasons: [],
    internalFingerprint: "test",
  };
}

describe("human food action authorizations", () => {
  beforeEach(() => _resetTokenStoreForTesting());

  it("binds acknowledgement to its exact action in addition to user and request", () => {
    const token = issueAdvisoryOverrideToken(
      "user-a", "dietary_identity:vegan", "steak", "Steak dinner", "create_a_dish",
    );
    expect(claimAdvisoryOverrideToken(token, "user-a", "Steak dinner", "recipe_maker")).toBeNull();
    expect(claimAdvisoryOverrideToken(token, "user-a", "Steak dinner", "create_a_dish")).toMatchObject({
      action: "create_a_dish",
    });
  });

  it("does not allow an acknowledgement issued for one creator to authorize another", () => {
    const token = issueAdvisoryOverrideToken(
      "user-a", "avoidance:mushroom", "mushroom", "Mushroom mousse", "dessert_creator",
    );
    expect(
      claimAdvisoryOverrideToken(token, "user-a", "Mushroom mousse", "beverage_creator"),
    ).toBeNull();
    // A failed cross-creator claim must not consume the valid acknowledgement.
    expect(
      claimAdvisoryOverrideToken(token, "user-a", "Mushroom mousse", "dessert_creator"),
    ).toMatchObject({ action: "dessert_creator" });
  });

  it("releases on failed execution and consumes only after completion", async () => {
    const token = issueAdvisoryOverrideToken(
      "user-a", "avoidance:mushroom", "mushroom", "Mushroom pasta", "create_a_dish",
    );
    expect(claimAdvisoryOverrideToken(token, "user-a", "Mushroom pasta", "create_a_dish")).not.toBeNull();
    const authorized = context({
      status: "authorized", action: "create_a_dish", reservationId: "reservation",
      waivers: [{ dimension: "avoidance", ruleCode: "avoidance:mushroom", matchedTerm: "mushroom" }],
    });
    const scope = createHumanFoodRequestScope(
      {
        actorUserId: "user-a", subjectUserId: "user-a", creator: "create_a_dish",
        advisoryOverrideToken: token,
      },
      async () => authorized,
    );
    await scope.releaseAuthorization();
    expect(claimAdvisoryOverrideToken(token, "user-a", "Mushroom pasta", "create_a_dish")).not.toBeNull();

    const completionToken = issueAdvisoryOverrideToken(
      "user-a", "avoidance:mushroom", "mushroom", "Mushroom pasta", "create_a_dish",
    );
    expect(claimAdvisoryOverrideToken(completionToken, "user-a", "Mushroom pasta", "create_a_dish")).not.toBeNull();
    const completionScope = createHumanFoodRequestScope(
      {
        actorUserId: "user-a", subjectUserId: "user-a", creator: "create_a_dish",
        advisoryOverrideToken: completionToken,
      },
      async () => context({
        status: "authorized", action: "create_a_dish", reservationId: "reservation",
        waivers: [{ dimension: "avoidance", ruleCode: "avoidance:mushroom", matchedTerm: "mushroom" }],
      }),
    );
    await completionScope.completeAuthorization();
    expect(claimAdvisoryOverrideToken(completionToken, "user-a", "Mushroom pasta", "create_a_dish")).toBeNull();
  });

  it("waives only the acknowledged dietary conflict without changing the profile", () => {
    const authorized = context({
      status: "authorized", action: "create_a_dish", reservationId: "opaque",
      waivers: [{ dimension: "dietary_identity", ruleCode: "dietary_identity:vegan", matchedTerm: "steak" }],
    });
    const steak = validateHumanFoodCandidate({ ingredients: ["steak"] }, authorized);
    expect(steak.findings.some((finding) => finding.code === "dietary_identity:vegan")).toBe(false);
    const chicken = validateHumanFoodCandidate({ ingredients: ["chicken"] }, authorized);
    expect(chicken.findings.some((finding) => finding.code === "dietary_identity:vegan")).toBe(true);
    expect(authorized.diet.stored).toEqual(["vegan"]);
    expect(authorized.safety.avoidedFoods).toEqual(["mushroom"]);

    const avoidanceOnly = context({
      status: "authorized", action: "create_a_dish", reservationId: "opaque",
      waivers: [{ dimension: "avoidance", ruleCode: "avoidance:mushroom", matchedTerm: "mushroom" }],
    });
    const mushroom = validateHumanFoodCandidate({ ingredients: ["mushroom"] }, avoidanceOnly);
    expect(mushroom.findings.some((finding) => finding.code === "avoidance:mushroom")).toBe(false);
  });
});