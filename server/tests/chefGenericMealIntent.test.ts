// Deterministic evidence/selection contracts, not live-model interpretation.
jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
}));
jest.mock("../services/coaching/featureIntelligence", () => ({
  ...jest.requireActual("../services/coaching/featureIntelligence"),
  featureIntelligenceEnabled: () => false,
}));

import { COACH_DESTINATIONS, mentionsCoachDestination } from "../../shared/coaching/navigation";
import type { ConciergeGoal } from "../../shared/coaching/schemas";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { validateConciergeGoal } from "../services/coaching/conciergeGoal";
import { CHEF_CONVERSATION_INSTRUCTIONS, getChefConversationInstructions } from "../services/coaching/conciergeInstructions";
import type { PendingRecommendation } from "../services/coaching/conciergeNavigationState";

const environment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; });
afterAll(() => { process.env.NODE_ENV = environment; });
const tools = getCornerCapabilities(["all"], "development").map(cap => ({
  id: cap.id, label: cap.label, description: cap.description,
  featureTarget: cap.id, scope: "adult" as const,
}));
const unknown: ConciergeGoal = {
  activity: "unknown", occasion: "unknown", restaurant: "unknown",
  dishChosen: false, specialty: "none", explicitFeatureId: null,
};
const explicitGrocery: ConciergeGoal = { ...unknown, explicitFeatureId: "grocery_create_meal" };
const shopping: ConciergeGoal = { ...unknown, activity: "shop_for_meal" };
const decision = (goal = explicitGrocery, destinationId = "grocery_create_meal") =>
  ({ mode: "food_assistance", destinationId, goal });
const genericRequests = [
  "Can you create a meal for me?",
  "Build me a meal.",
  "I want to create a meal, but I don't need groceries.",
];
const clarification = "My Perfect Menu suggests meal ideas; Create a Dish starts with a dish you choose. Would you prefer My Perfect Menu or Create a Dish?";
type History = Array<{ role: string; content: string }>;

async function reply(userMessage: string, extra: Record<string, unknown> = {}, options: {
  history?: History; pending?: PendingRecommendation; unavailable?: boolean;
} = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    memberNeed: "feature_help", responsePurpose: "feature_only_offer",
    navigationIntent: "recommendation",
    message: "Grocery Store Coach can help plan dinner and its shopping list. Would you like to use Grocery Store Coach?",
    conversationMessage: clarification, recommendationMessage: null, handoffMessage: null,
    conciergeDecision: decision(), creatorRequest: null,
    redFlag: false, redFlagReason: null, contactCare: null, careDisposition: "none",
    ...extra,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage, history: options.history ?? [], rollingContext: null,
    context: {}, tools: options.unavailable ? [] : tools,
    pendingRecommendation: options.pending,
  });
  expect(create).toHaveBeenCalledTimes(1);
  return { result, request: create.mock.calls[0][0] };
}

function noAction(result: Awaited<ReturnType<typeof reply>>["result"]) {
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.presentation?.navigation).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
}

test.each([...genericRequests, "Create a Meal", "Build a Meal", "Open Create a Meal.", "Open Build a Meal."])(
  "generic meal wording cannot bind an explicit Grocery Coach request: %s", text => {
    expect(mentionsCoachDestination(text, "grocery_create_meal", "development")).toBe(false);
    expect(validateConciergeGoal(decision(), tools, [text])).toMatchObject({
      mode: "clarification", destinationId: null,
    });
  },
);

test.each([
  "Open Grocery Store Coach.",
  "Open Grocery Coach — Create a Meal.",
  "Use Grocery Store Coach > Build a Meal.",
  "Let's use Grocery Coach to plan dinner.",
])("preserves a genuine named request: %s", text => {
  expect(mentionsCoachDestination(text, "grocery_create_meal", "development")).toBe(true);
  expect(validateConciergeGoal(decision(), tools, [text])?.destinationId).toBe("grocery_create_meal");
});

test("shopping assistance still qualifies without a literal feature name", () => {
  const text = "Help me buy ingredients to make dinner.";
  expect(mentionsCoachDestination(text, "grocery_create_meal", "development")).toBe(false);
  expect(validateConciergeGoal(decision(shopping), tools, [text])?.destinationId).toBe("grocery_create_meal");
});

test("an earlier named request cannot supply stale explicit-name evidence", () => {
  expect(validateConciergeGoal(decision(), tools, [
    "Open Grocery Store Coach.", genericRequests[2],
  ])).toMatchObject({ mode: "clarification", destinationId: null });
});

test.each(genericRequests)("rejects an incorrect explicit Grocery pitch, retaining useful ambiguity handling: %s", async text => {
  const { result, request } = await reply(text);
  noAction(result);
  expect(result.presentation?.message).toBe(clarification);
  expect(request.messages[0].content).toContain("does not establish shopping intent");
  expect(request.messages[0].content).toContain("Do not force a feature list");
});

test("a model-authored explanation of meal options needs no destination", async () => {
  const { result } = await reply(genericRequests[0], {
    responsePurpose: "clarify", navigationIntent: "none",
    message: clarification, conversationMessage: null, conciergeDecision: null,
  });
  noAction(result);
  expect(result.presentation?.message).toBe(clarification);
});

test("a named direct request retains the Grocery Store Coach parent-page handoff", async () => {
  const { result } = await reply("Open Grocery Store Coach.", {
    memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "direct_request",
    message: "In Shopping List, select Grocery Store Coach, then Build a Meal.",
    handoffMessage: "In Shopping List, select Grocery Store Coach, then Build a Meal.",
  });
  expect(result.presentation?.destinationId).toBe("grocery_create_meal");
  expect(result.presentation?.navigation?.state).toBe("direct_navigation");
  expect(result.todayPlan.items).toEqual([expect.objectContaining({
    kind: "use_feature", destinationId: "grocery_create_meal",
  })]);
});

test("shopping assistance remains an offer until accepted", async () => {
  const { result } = await reply("Help me buy ingredients to make dinner.", {
    conciergeDecision: decision(shopping),
  });
  expect(result.presentation?.navigation).toMatchObject({
    state: "recommendation_pending", destinationId: "grocery_create_meal", goal: shopping,
  });
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
});

test.each([
  ["Help me buy ingredients to make dinner.", shopping],
  ["Open Grocery Store Coach.", explicitGrocery],
] as const)("accepts a genuine follow-up without repeating the feature name: %s", async (initial, goal) => {
  const pending: PendingRecommendation = {
    state: "recommendation_pending", destinationId: "grocery_create_meal", goal,
  };
  const { result } = await reply("Yes, please.", {
    memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "confirmed",
    message: "In Shopping List, select Grocery Store Coach, then Build a Meal.",
    handoffMessage: "In Shopping List, select Grocery Store Coach, then Build a Meal.",
    conciergeDecision: null,
  }, {
    pending, history: [
      { role: "user", content: initial },
      { role: "assistant", content: "Would you like to use Grocery Store Coach?" },
    ],
  });
  expect(result.presentation?.destinationId).toBe("grocery_create_meal");
  expect(result.presentation?.navigation?.state).toBe("navigation_confirmed");
});

test("a generic direct-request tag is not navigation consent even with a shopping goal", async () => {
  const { result } = await reply(genericRequests[0], {
    memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "direct_request",
    conciergeDecision: decision(shopping),
  });
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
});

test("a change of mind rejects stale Grocery name evidence despite a prior pending offer", async () => {
  const { result } = await reply(genericRequests[2], {}, {
    pending: { state: "recommendation_pending", destinationId: "grocery_create_meal", goal: explicitGrocery },
    history: [
      { role: "user", content: "Open Grocery Store Coach." },
      { role: "assistant", content: "Would you like to use Grocery Store Coach?" },
    ],
  });
  noAction(result);
  expect(result.presentation?.message).toBe(clarification);
});

test("a resolved change to preparing a dish replaces Grocery Coach with a new offer", async () => {
  const goal: ConciergeGoal = { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true };
  const { result } = await reply("Actually, no groceries. I want to make lasagna.", {
    message: "Create a Dish can help with your lasagna. Would you like to use Create a Dish?",
    conciergeDecision: decision(goal, "create_a_dish"),
  }, {
    pending: { state: "recommendation_pending", destinationId: "grocery_create_meal", goal: shopping },
    history: [{ role: "user", content: "Help me buy ingredients to make dinner." }],
  });
  expect(result.presentation?.navigation).toMatchObject({
    state: "recommendation_pending", destinationId: "create_a_dish", goal,
  });
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
});

test("unavailable tools remain unavailable even for an explicit Grocery request", async () => {
  expect(validateConciergeGoal(decision(), [], ["Open Grocery Store Coach."])?.destinationId).toBeNull();
  const { result } = await reply("Open Grocery Store Coach.", {}, { unavailable: true });
  noAction(result);
});

test("care still overrides an explicit Grocery request", async () => {
  const { result } = await reply("Open Grocery Store Coach.", {
    responsePurpose: "care", redFlag: true, redFlagReason: "Urgent warning signs.",
    careDisposition: "emergency", contactCare: "Seek emergency medical help now.",
  });
  expect(result.meta.redFlag).toBe(true);
  expect(result.todayPlan.items.some(item => item.kind === "contact_care")).toBe(true);
  expect(result.todayPlan.items.some(item => item.kind === "use_feature")).toBe(false);
  expect(result.presentation?.destinationId).toBeUndefined();
});

test("the correction does not change Production matching or its released prompt", () => {
  process.env.NODE_ENV = "production";
  expect(mentionsCoachDestination(genericRequests[0], "grocery_create_meal", "production")).toBe(true);
  expect(validateConciergeGoal(decision(), tools, [genericRequests[0]])?.destinationId).toBe("grocery_create_meal");
  expect(getChefConversationInstructions("production")).toBe(getChefConversationInstructions("development"));
  expect(getChefConversationInstructions("production")).toContain("GROCERY MEAL INTENT:");
  expect(COACH_DESTINATIONS.grocery_create_meal).toEqual({
    label: "Grocery Coach — Create a Meal", navigationLabel: "Grocery Store Coach",
    route: "/shopping-list-v2", access: "pro",
  });
});
