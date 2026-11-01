// Synthetic single-call contracts. These prove knowledge delivery, preservation
// and server navigation enforcement, never a live model's semantic judgment.
jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
}));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { getFeatureUsageKnowledge, FEATURE_USAGE_KNOWLEDGE } from "../services/coaching/featureUsageKnowledge";
import { getChefConversationInstructions, CHEF_CONVERSATION_INSTRUCTIONS } from "../services/coaching/conciergeInstructions";
import { getPlatformGuidanceInstructions, PLATFORM_GUIDANCE_INSTRUCTIONS } from "../services/coaching/platformKnowledge";
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
const prepare: ConciergeGoal = { activity: "prepare", occasion: "meal", restaurant: "unknown",
  specialty: "none", dishChosen: true, explicitFeatureId: null };
const craving: ConciergeGoal = { ...prepare, occasion: "snack" };
const dessert: ConciergeGoal = { ...prepare, occasion: "dessert" };
const gathering: ConciergeGoal = { ...prepare, activity: "gathering", occasion: "unknown", dishChosen: false };
const sushi: ConciergeGoal = { ...prepare, specialty: "sushi" };
const discovery: ConciergeGoal = { ...prepare, activity: "eat_out", restaurant: "not_chosen" };
const drink: ConciergeGoal = { ...prepare, occasion: "beverage", dishChosen: false };
const action = (destinationId: string, goal: ConciergeGoal) => ({ mode: "food_assistance", destinationId, goal });
async function turn(userMessage: string, message: string, extra: Record<string, unknown> = {}, options: {
  history?: Array<{ role: string; content: string }>; pending?: PendingRecommendation;
  availableTools?: typeof tools;
} = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    memberNeed: "feature_help", responsePurpose: "answer", message,
    conversationMessage: null, recommendationMessage: null, handoffMessage: null,
    navigationIntent: "none", conciergeDecision: null, creatorRequest: null,
    careDisposition: "none", contactCare: null, redFlag: false, redFlagReason: null, ...extra,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage, history: options.history ?? [], rollingContext: null,
    context: { coachingContextBlock: "Synthetic authorized member context; existing physician instructions take precedence." },
    tools: options.availableTools ?? tools, pendingRecommendation: options.pending,
  });
  expect(create).toHaveBeenCalledTimes(1);
  const request = create.mock.calls[0][0];
  return { result, request, wire: JSON.parse(request.messages[1].content) };
}

describe("Development occasion/serving intent and direct-to-feature contracts", () => {
  it.each([
    ["I want to make homemade chicken soup.", "create_a_dish", prepare],
    ["I'm craving a little chocolate dessert to make.", "craving_creator", craving],
    ["I'm craving homemade chicken nuggets.", "craving_creator", craving],
    ["Make three servings of chicken nuggets to satisfy our craving.", "craving_creator", craving],
    ["I want to cook chicken nuggets for a family dinner.", "create_a_dish", prepare],
    ["I want to bake a whole apple pie.", "dessert_creator", dessert],
    ["I want to make a whole cake for my family.", "dessert_creator", dessert],
    ["I'm cooking the complete Thanksgiving dinner for my family.", "my_perfect_gatherings", gathering],
    ["I want to make mashed potatoes as one Thanksgiving side.", "create_a_dish", prepare],
    ["I want to bake one whole pie for Thanksgiving.", "dessert_creator", dessert],
    ["I want to make sushi at home.", "sushi_creator", sushi],
    ["Find me a sushi restaurant.", "find_meals_near_me", discovery],
    ["Help me order sushi at the restaurant I've already chosen.", "restaurant_guide", { ...discovery, restaurant: "chosen" }],
    ["I want to create a strawberry shake.", "beverage_creator", drink],
    ["I want to create a post-workout recovery drink.", "athlete_beverage_creator", { ...drink, specialty: "workout" }],
    ["I'm shopping for soup ingredients.", "grocery_create_meal", { ...prepare, activity: "shop_for_meal" }],
    ["I want to find a grocery product to buy.", "grocery_find_product", { ...prepare, activity: "find_product" }],
  ] as const)("retains a concise supplied offer and pending state for %s", async (user, id, goal) => {
    const tool = tools.find(tool => tool.id === id)!;
    const message = `${tool.label} can help with that. Want to open it?`;
    const { result, wire } = await turn(user, message, {
      responsePurpose: "feature_only_offer", navigationIntent: "recommendation", conciergeDecision: action(id, goal),
    });
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.navigation).toMatchObject({ state: "recommendation_pending", destinationId: id });
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
    expect(wire.latestMemberMessage).toBe(user);
  });

  it.each([
    ["I want dessert.", "A personal treat, or a complete dessert like a cake or pie?"],
    ["I'm in the mood for sushi.", "Are you thinking of making sushi at home or going out for it?"],
    ["I don't know what I want for dinner.", "Would you like to cook something or find somewhere to eat?"],
  ])("preserves one narrowing question without premature navigation for %s", async (user, message) => {
    const { result } = await turn(user, message, { responsePurpose: "clarify" });
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
    expect(message.match(/\?/g)).toHaveLength(1);
  });

  it("uses successive dinner answers only while a meaningful choice remains, then stops discovery", async () => {
    const history = [
      { role: "user", content: "I want to cook dinner but don't know what." },
      { role: "assistant", content: "Something light or more filling?" },
      { role: "user", content: "Something light." },
    ];
    const question = "Would you prefer soup or a salad?";
    const narrowed = await turn("Something light.", question, { responsePurpose: "clarify" },
      { history: history.slice(0, 2) });
    expect(narrowed.result.presentation?.message).toBe(question);
    const message = "Create a Dish can help you make soup. Want to open it?";
    const { result, wire } = await turn("Soup sounds good.", message, {
      responsePurpose: "feature_only_offer", navigationIntent: "recommendation",
      conciergeDecision: action("create_a_dish", prepare),
    }, { history: [...history, { role: "assistant", content: question }] });
    expect(wire.history).toEqual([...history, { role: "assistant", content: question }]);
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.navigation?.state).toBe("recommendation_pending");
  });

  it("accepts the first yes, preserves the original dish via grounded evidence, and supplies verified instructions", async () => {
    const original = "I want to make homemade chicken soup.";
    const offer = "Create a Dish can help with that. Want to open it?";
    const first = await turn(original, offer, {
      responsePurpose: "feature_only_offer", navigationIntent: "recommendation",
      conciergeDecision: action("create_a_dish", prepare),
    });
    const message = "Review the editable dish description, then use Create My Dish when ready.";
    const { result } = await turn("Yes.", message, {
      memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "confirmed",
      handoffMessage: message, creatorRequest: { idea: "homemade chicken soup", memberTurns: [0] },
    }, { pending: first.result.presentation!.navigation!, history: [
      { role: "user", content: original }, { role: "assistant", content: offer },
    ] });
    expect(result.presentation?.navigation?.state).toBe("navigation_confirmed");
    expect(result.presentation?.destinationId).toBe("create_a_dish");
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.creatorRequest).toEqual({ destinationId: "create_a_dish", idea: "homemade chicken soup" });
    expect(result.todayPlan.items.some(item => item.kind === "use_feature" && item.destinationId === "create_a_dish")).toBe(true);
    expect(result.presentation?.message).not.toMatch(/[?]|already opened|already generated/i);
  });

  it("retains direct named Sushi Creator navigation without redundant confirmation", async () => {
    const message = "Describe your sushi, then use Create My Sushi when ready.";
    const { result } = await turn("Open Sushi Creator.", message, {
      memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "direct_request",
      handoffMessage: message, conciergeDecision: action("sushi_creator", { ...sushi, explicitFeatureId: "sushi_creator" }),
    });
    expect(result.presentation?.navigation?.state).toBe("direct_navigation");
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.destinationId).toBe("sushi_creator");
    expect(result.presentation?.creatorRequest).toBeUndefined();
  });

  it("does not manufacture authorization from a yes without stored pending state", async () => {
    const { result } = await turn("Yes.", "Describe your sushi.", {
      memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "confirmed",
      handoffMessage: "Describe your sushi.", conciergeDecision: action("sushi_creator", sushi),
    });
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });

  it("does not let a clear request override unavailable access or required care", async () => {
    const extra = { responsePurpose: "feature_only_offer", navigationIntent: "recommendation",
      conciergeDecision: action("my_perfect_gatherings", gathering),
      conversationMessage: "We can discuss the occasion here without opening a tool." };
    const unavailable = await turn("Help me plan Thanksgiving.", "Want to open Gatherings?", extra,
      { availableTools: tools.filter(tool => tool.id !== "my_perfect_gatherings") });
    expect(unavailable.result.presentation?.destinationId).toBeUndefined();
    expect(unavailable.result.todayPlan.items).toEqual([]);
    const care = await turn("I need help eating.", "Seek the appropriate medical assessment.", {
      ...extra, responsePurpose: "care", careDisposition: "referral", contactCare: "Seek medical assessment.",
    });
    expect(care.result.todayPlan.items.some(item => item.kind === "contact_care")).toBe(true);
    expect(care.result.presentation?.destinationId).toBeUndefined();
  });

  it("delivers verified suitability and concise handoff instructions without changing Production or model settings", async () => {
    const { request, wire } = await turn("How do I choose the right tool?", "Your activity determines the useful feature.");
    for (const id of ["craving_creator", "dessert_creator", "my_perfect_gatherings", "sushi_creator",
      "restaurant_guide", "find_meals_near_me"] as const) {
      expect(wire.platformKnowledge.featureUsage[id].suitability).toEqual(expect.objectContaining({
        purpose: expect.any(String), notFor: expect.any(Array), informationNeeded: expect.any(Array),
        offerWhen: expect.any(String), safetyBoundaries: expect.any(Array),
      }));
      expect(wire.platformKnowledge.featureUsage[id].suitability).not.toHaveProperty("verifiedSources");
      expect(FEATURE_USAGE_KNOWLEDGE[id]?.suitability).toBeUndefined();
      expect(getCornerCapabilities(["all"], "development").find(cap => cap.id === id)?.route).toBe(COACH_DESTINATIONS[id].route);
    }
    expect(getFeatureUsageKnowledge("development").sushi_creator!.generationAction).toContain("Create My Sushi");
    expect(getFeatureUsageKnowledge("development").craving_creator!.suitability!.safetyBoundaries.join(" "))
      .toContain("not a routing threshold");
    expect(getFeatureUsageKnowledge("development").dessert_creator!.suitability!.informationNeeded.join(" "))
      .toContain("never the sole routing rule");
    expect(getFeatureUsageKnowledge("development").my_perfect_gatherings!.suitability!.notFor.join(" "))
      .toContain("single Thanksgiving");
    expect(request.messages[0].content).toContain("not a tutorial or an interview");
    expect(request.messages[0].content).toContain("do not invent a prefill");
    expect(getFeatureUsageKnowledge("production")).toBe(FEATURE_USAGE_KNOWLEDGE);
    expect(getChefConversationInstructions("production")).toBe(CHEF_CONVERSATION_INSTRUCTIONS);
    expect(getPlatformGuidanceInstructions("production")).toBe(PLATFORM_GUIDANCE_INSTRUCTIONS);
    expect(request.model).toBe("gpt-4o");
    expect(request.temperature).toBe(0.4);
    expect(request.max_tokens).toBe(2000);
  });
});
