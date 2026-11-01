// Prompt-delivery and response-preservation contracts, NOT live model judgment.
// Fail fast on unexpected DB access; the only provider is this injected mock.
jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
}));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { FEATURE_USAGE_KNOWLEDGE, getFeatureUsageKnowledge } from "../services/coaching/featureUsageKnowledge";
import { CHEF_CONVERSATION_INSTRUCTIONS, getChefConversationInstructions } from "../services/coaching/conciergeInstructions";
import { getDevelopmentPlatformKnowledge } from "../services/coaching/platformKnowledge";
import { PLATFORM_HELP_KNOWLEDGE } from "../services/coaching/platformHelpKnowledge";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";
import type { ConciergeGoal } from "../../shared/coaching/schemas";
import type { PendingRecommendation } from "../services/coaching/conciergeNavigationState";

const environment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; });
afterAll(() => { process.env.NODE_ENV = environment; });
const tools = getCornerCapabilities(["all"], "development").map(cap => ({
  id: cap.id, label: cap.label, description: cap.description,
  featureTarget: cap.id, scope: "adult" as const,
}));
const preparation: ConciergeGoal = {
  activity: "prepare", occasion: "meal", restaurant: "unknown",
  dishChosen: true, specialty: "none", explicitFeatureId: null,
};
const shopping: ConciergeGoal = { ...preparation, activity: "shop_for_meal" };
const product: ConciergeGoal = { ...preparation, activity: "find_product", occasion: "unknown", dishChosen: false };
const action = (destinationId: string, goal: ConciergeGoal) => ({ mode: "food_assistance", destinationId, goal });

async function reply(userMessage: string, message: string, extra: Record<string, unknown> = {}, options: {
  history?: Array<{ role: string; content: string }>;
  pending?: PendingRecommendation;
  availableTools?: typeof tools;
} = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    memberNeed: "feature_help", responsePurpose: "answer", message,
    conversationMessage: null, recommendationMessage: null, handoffMessage: null,
    navigationIntent: "none", conciergeDecision: null, creatorRequest: null,
    redFlag: false, redFlagReason: null, contactCare: null, careDisposition: "none", ...extra,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage, history: options.history ?? [], rollingContext: null,
    context: { coachingContextBlock: "Synthetic authorized context. Do not infer clinical or professional authority." },
    tools: options.availableTools ?? tools, pendingRecommendation: options.pending,
  });
  expect(create).toHaveBeenCalledTimes(1);
  const request = create.mock.calls[0][0];
  return { result, request, wire: JSON.parse(request.messages[1].content) };
}

describe("Development food destination knowledge", () => {
  it("keeps source-reviewed suitability Development-only without changing approved routes, access or Production labels", () => {
    expect(getFeatureUsageKnowledge("production")).toBe(FEATURE_USAGE_KNOWLEDGE);
    expect(getChefConversationInstructions("production")).toBe(CHEF_CONVERSATION_INSTRUCTIONS);
    for (const id of ["create_a_dish", "grocery_create_meal", "grocery_find_product"] as const) {
      const usage = getFeatureUsageKnowledge("development")[id]!;
      expect(usage.suitability).toEqual(expect.objectContaining({
        purpose: expect.any(String), suitableNeeds: expect.any(Array), notFor: expect.any(Array),
        informationNeeded: expect.any(Array), offerWhen: expect.any(String), deferWhen: expect.any(String),
        safetyBoundaries: expect.any(Array), relatedFeatures: expect.any(Array),
      }));
      expect(usage.suitability).not.toHaveProperty("verifiedSources");
      expect(FEATURE_USAGE_KNOWLEDGE[id]!.suitability).toBeUndefined();
      const dev = getCornerCapabilities(["all"], "development").find(cap => cap.id === id)!;
      const production = getCornerCapabilities(["all"], "production").find(cap => cap.id === id)!;
      expect(dev.route).toBe(production.route);
      expect(production.label).toBe(COACH_DESTINATIONS[id].label);
      expect(production.description).not.toContain("Suitability and timing:");
    }
    expect(COACH_DESTINATIONS.grocery_create_meal.route).toBe("/shopping-list-v2");
    expect(COACH_DESTINATIONS.grocery_find_product.route).toBe("/shopping-list-v2");
    expect(COACH_DESTINATIONS.grocery_create_meal.access).toBe("pro");
  });

  it("delivers the exact Build a Meal terminology across all active knowledge surfaces in the single call", async () => {
    const { request, wire } = await reply("How do these meal tools differ?", "Create a Dish is for preparing a chosen dish; Build a Meal helps with meal shopping.");
    expect(wire.availableFeatures.find((feature: { id: string }) => feature.id === "grocery_create_meal").label)
      .toBe("Grocery Store Coach — Build a Meal");
    expect(wire.platformKnowledge.featureUsage.grocery_create_meal.descriptionInput).toContain("then Build a Meal");
    expect(JSON.stringify(wire)).not.toContain("also called Create a Meal");
    expect(request.messages[0].content).not.toContain("also called Create a Meal");
    expect(request.messages[0].content).toContain("the conversational front door to My Perfect Meals");
    expect(request.messages[0].content).toContain("natural conversational paragraphs, not numbered educational articles");
    expect(request.messages[0].content).toContain("stop questioning once sufficient information is available");
    expect(wire.platformKnowledge.featureUsage.create_a_dish.suitability.offerWhen).toContain("preparation intent");
    expect(wire.platformKnowledge.featureUsage.grocery_create_meal.suitability.safetyBoundaries.join(" "))
      .toContain("no automatic Coach sheet, tab selection, request transfer");
    expect(wire.platformKnowledge.featureUsage.grocery_find_product.suitability.notFor.join(" ")).toContain("Product Scan");
    expect(PLATFORM_HELP_KNOWLEDGE.shopping.controls[0]).toContain("also called Create a Meal");
  });

  it.each([
    ["I want to make chicken soup.", "create_a_dish", preparation,
      "Create a Dish can help you make that soup. Want to open it?"],
    ["I'm shopping for ingredients for chicken soup.", "grocery_create_meal", shopping,
      "Build a Meal in Grocery Store Coach can help with the meal and what to buy. Want to open Grocery Store Coach?"],
    ["I'm at the grocery store and want to find a broth to buy.", "grocery_find_product", product,
      "Find a Product in Grocery Store Coach can help you explore broth options to buy. Want to open Grocery Store Coach?"],
  ] as const)("preserves a supplied relevant offer for %s without adding discovery", async (user, id, goal, message) => {
    const { result } = await reply(user, message, {
      responsePurpose: "feature_only_offer", navigationIntent: "recommendation", conciergeDecision: action(id, goal),
    });
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.navigation?.state).toBe("recommendation_pending");
    expect(result.presentation?.navigation?.destinationId).toBe(id);
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });

  it("preserves one cooking-versus-shopping clarification without a premature offer", async () => {
    const message = "Are you looking to prepare a dish or work out what groceries to buy?";
    const { result } = await reply("Can you help me with chicken soup?", message, { responsePurpose: "clarify" });
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });

  it("passes an already-answered shopping clarification through without restarting discovery", async () => {
    const history = [{ role: "user", content: "Can you help with soup?" },
      { role: "assistant", content: "Do you want to prepare a dish or plan what groceries to buy?" }];
    const message = "Build a Meal can help plan your soup and shopping list. Want to open Grocery Store Coach?";
    const { result, wire } = await reply("I'm shopping and need to know what to buy.", message, {
      responsePurpose: "feature_only_offer", navigationIntent: "recommendation",
      conciergeDecision: action("grocery_create_meal", shopping),
    }, { history });
    expect(wire.history).toEqual(history);
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.navigation?.destinationId).toBe("grocery_create_meal");
  });

  it("retains direct Create a Dish navigation without another permission question", async () => {
    const message = "Describe your dish in the editable field, then use Create My Dish when ready.";
    const { result } = await reply("Open Create a Dish.", message, {
      memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "direct_request",
      handoffMessage: message,
      conciergeDecision: action("create_a_dish", { ...preparation, explicitFeatureId: "create_a_dish" }),
    });
    // An open-only request contains no grounded dish idea to transfer. The
    // existing honest transfer notice may accompany the handoff, not permission.
    expect(result.presentation?.message).toContain(message);
    expect(result.presentation?.message).toContain("I couldn't verify the request text for transfer");
    expect(result.presentation?.message).not.toMatch(/would you like|want to open/i);
    expect(result.presentation?.navigation?.state).toBe("direct_navigation");
    expect(result.presentation?.destinationId).toBe("create_a_dish");
  });

  it("uses the first acceptance for a parent-page Grocery Coach handoff, not a second permission question", async () => {
    const offer = "Build a Meal can help with your meal shopping. Want to open Grocery Store Coach?";
    const first = await reply("I'm planning what groceries to buy for soup.", offer, {
      responsePurpose: "feature_only_offer", navigationIntent: "recommendation",
      conciergeDecision: action("grocery_create_meal", shopping),
    });
    const message = "In Shopping List, select Grocery Store Coach, then Build a Meal.";
    const { result } = await reply("Yes, please.", message, {
      memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "confirmed", handoffMessage: message,
    }, { pending: first.result.presentation!.navigation!, history: [
      { role: "user", content: "I'm planning what groceries to buy for soup." }, { role: "assistant", content: offer },
    ] });
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.navigation?.state).toBe("navigation_confirmed");
    expect(result.presentation?.destinationId).toBe("grocery_create_meal");
    expect(COACH_DESTINATIONS.grocery_create_meal.route).toBe("/shopping-list-v2");
  });

  it.each(["affiliate_enrollment", "grocery_create_meal"])("rejects an invalid or unavailable %s action despite plausible prose", async id => {
    const continuation = "No destination has opened. We can keep discussing your goal here.";
    const { result } = await reply("Help me get started.", "Want to open it?", {
      responsePurpose: "feature_only_offer", navigationIntent: "recommendation",
      conciergeDecision: action(id, shopping), conversationMessage: continuation,
    }, { availableTools: tools.filter(tool => tool.id !== id) });
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });

  it.each([
    ["grocery_create_meal", preparation],
    ["create_a_dish", shopping],
  ] as const)("rejects %s when the supplied semantic activity belongs to the other workflow", async (id, goal) => {
    const message = "Do you want preparation help or help planning groceries?";
    const { result } = await reply("I need help with soup.", "Want to open that tool?", {
      responsePurpose: "feature_only_offer", navigationIntent: "recommendation",
      conciergeDecision: action(id, goal), conversationMessage: message,
    });
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });

  it.each(["become an affiliate", "white-label My Perfect Meals", "offer nutrition services to my organization"])(
    "keeps an informational business inquiry to %s action-free without invented enrollment", async goal => {
      const message = "This chat has no verified enrollment handoff for that inquiry. Existing business information and authorized workspace options remain subject to your account's access; I can't confirm eligibility or availability here.";
      const { result, wire } = await reply(`I want to ${goal}.`, message);
      expect(result.presentation?.message).toBe(message);
      expect(result.presentation?.navigation).toBeUndefined();
      expect(result.todayPlan.items).toEqual([]);
      expect(wire.availableFeatures.every((feature: { id: string }) => feature.id in COACH_DESTINATIONS)).toBe(true);
      expect(wire.platformKnowledge.featureCatalog.some((feature: { audience: string }) =>
        feature.audience !== "member")).toBe(false);
      expect(getDevelopmentPlatformKnowledge()?.featureCatalog.some(fact => fact.id === "professional_studios")).toBe(false);
    },
  );
});
