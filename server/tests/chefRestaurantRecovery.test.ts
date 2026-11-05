jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
}));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { fallbackQuality, selectRejectedConversation } from "../services/coaching/conciergeFallback";
import { navigationPermissionQuestion, screenConversationalContinuation, screenOrdinaryConversation } from "../services/coaching/conciergeReplyScreening";
import { verifiedRestaurantClarification } from "../services/coaching/verifiedNavigation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";

const environment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = environment === "production" ? "production" : "development"; });
afterAll(() => { process.env.NODE_ENV = environment; });
const request = "I need to eat at a restaurant.";
const fragment = ": If you already have a restaurant in mind and need help deciding what to order, the Restaurant Guide can assist with that. Let me know which option you'd like to proceed with!";
const choice = "Would you like to use Restaurant Guide for a restaurant you already chose, or Find Meals Near Me to find somewhere to eat?";
const tools = getCornerCapabilities(["all"]).map(cap => ({ ...cap, scope: "adult" as const, featureTarget: cap.id }));
async function run(raw: Record<string, unknown> = {}, extra: Record<string, unknown> = {}, message = request) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    message: choice, conversationMessage: fragment, navigationIntent: "none", pendingNavigationDisposition: "clear",
    memberNeed: "unclear", responsePurpose: "clarify", conciergeDecision: null,
    redFlag: false, careDisposition: "none", ...raw,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any, tools,
    userMessage: message, history: [], rollingContext: null, context: {}, ...extra,
  });
  expect(create).toHaveBeenCalledTimes(1);
  return result;
}
const expectNoAction = (result: Awaited<ReturnType<typeof run>>) => {
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.presentation?.navigation).toBeUndefined();
  expect(result.presentation?.creatorRequest).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
};

test("a two-workflow needs question is clarification, not permission to open one", async () => {
  expect(navigationPermissionQuestion(choice)).toBe(false);
  expect(screenOrdinaryConversation(choice).text).toBe(choice);
  const result = await run();
  expect(result.presentation?.message).toBe(choice);
  expectNoAction(result);
});

test.each([":", fragment, fragment.slice(2), "Which option would you like?", "Feel free to ask if you need more help."])(
  "rejected primary cannot expose an incomplete or malformed fallback: %s", async continuation => {
    const result = await run({ message: "Open Restaurant Guide at https://invalid.test/", conversationMessage: continuation });
    expect(result.presentation?.message).toBe(verifiedRestaurantClarification(request));
    expect(result.presentation?.message).toContain("Restaurant Guide");
    expect(result.presentation?.message).toContain("Find Meals Near Me");
    expect(result.presentation?.message).toContain("or do you need help finding");
    expectNoAction(result);
  },
);

test("a model-selected discovery offer cannot decide an unspecified restaurant need", async () => {
  const result = await run({
    message: "Would you like to use Find Meals Near Me?",
    responsePurpose: "answer_with_offer", memberNeed: "feature_help", navigationIntent: "recommendation",
    conciergeDecision: { mode: "food_assistance", destinationId: "find_meals_near_me", goal: {
      activity: "eat_out", occasion: "meal", restaurant: "not_chosen",
      dishChosen: false, specialty: "none", explicitFeatureId: null,
    } },
  });
  expect(result.presentation?.message).toBe(verifiedRestaurantClarification(request));
  expectNoAction(result);
});

test("an unrelated beverage offer is cleared and unused model declarations cannot block verified UI facts", async () => {
  const result = await run({ message: fragment, conversationMessage: ":)", foodDeclarations: null }, {
    context: { chefFoodCompatibility: { subjectUserId: "synthetic-self" } },
    history: [{ role: "user", content: "I need a pre-workout drink." }],
    pendingRecommendation: { state: "recommendation_pending", destinationId: "athlete_beverage_creator",
      offeredAt: new Date().toISOString(), goal: { activity: "unknown", occasion: "unknown", restaurant: "unknown",
        dishChosen: false, specialty: "none", explicitFeatureId: "athlete_beverage_creator" } },
  });
  expect(result.presentation?.message).toBe(verifiedRestaurantClarification(request));
  expect(result.foodCompatibility).toBeUndefined();
  expectNoAction(result);
});

test("actual care escalation remains first", async () => {
  const result = await run({ careDisposition: "emergency", redFlag: true, contactCare: "Seek urgent medical help." });
  expect(result.meta.redFlag).toBe(true);
  expect(result.presentation).toBeUndefined();
});

test.each(["Open Restaurant Guide.", "I already chose a restaurant.",
  "I need to eat at a restaurant and I have chest pain.", "I need to eat at a restaurant named Bistro.",
  "I don't need to eat at a restaurant.", "\"I need to eat at a restaurant.\""])(
  "does not replace a chosen workflow, symptom, negation or quote: %s", message => {
    expect(verifiedRestaurantClarification(message)).toBeUndefined();
  },
);

test.each(["Open Restaurant Guide or Find Meals Near Me?", "Would you like to open Restaurant Guide or Find Meals Near Me?",
  "Would you like to use Restaurant Guide?"])("opening offers remain screened: %s", message => {
  if (message.startsWith("Would")) expect(navigationPermissionQuestion(message)).toBe(true);
  else expect(screenConversationalContinuation(message).text).toBeUndefined();
});

test.each([": Here is an answer.", "; Here is an answer.", ". Start here.", ") Pick this."])(
  "rejects malformed leading punctuation without stripping clauses: %s", message => {
    expect(fallbackQuality(message)).toBe("malformed");
    expect(screenOrdinaryConversation(message).text).toBeUndefined();
    expect(screenConversationalContinuation(message).text).toBeUndefined();
  },
);

test.each(["Which option would you like?", "Restaurant Guide can help. Let me know which option you'd like.",
  "You can choose either option.", "Both options are available.", "Which option or choice would you like?"])("rejects absent alternatives: %s", message => {
  expect(fallbackQuality(message)).toBe("incomplete");
});

test.each([choice, "Sweet or savory: which would you prefer?",
  "Which would you prefer, sweet or savory?",
  "Restaurant Guide helps with a restaurant you selected. Find Meals Near Me helps find restaurants. Which option do you need?",
  "- Sweet\n- Savory\nWhich option would you like?", "Option A: Sweet. Option B: Savory. Which option would you like?"])(
  "preserves self-contained alternatives: %s", message => {
    expect(fallbackQuality(message)).toBe("useful");
  },
);

test("generic closings cannot replace a useful answer", () => {
  expect(screenConversationalContinuation("If you need more help, feel free to ask!").text).toBeUndefined();
  const result = selectRejectedConversation({ message: "The builder keeps dated meal boards.",
    conversationMessage: "If you need more help, feel free to ask!" }, text => screenConversationalContinuation(text).text);
  expect(result.text).toBe("The builder keeps dated meal boards.");
});

test("the ordinary-answer recovery path also rejects a closing-only continuation", async () => {
  const result = await run({
    message: "Open https://invalid.test/", conversationMessage: "If you need more help, feel free to ask!",
    responsePurpose: "answer",
  }, {}, "How can you help me?");
  expect(result.presentation?.message).not.toContain("feel free to ask");
  expect(result.meta.concierge?.rendering).toBe("retry");
  expectNoAction(result);
});

test("a rejected action cannot leak a malformed or incomplete continuation elsewhere", async () => {
  const result = await run({
    message: "Open https://invalid.test/", conversationMessage: fragment,
    navigationIntent: "direct_request", memberNeed: "navigation", responsePurpose: "handoff",
    conciergeDecision: { mode: "food_assistance", destinationId: "/admin", goal: {
      activity: "unknown", occasion: "unknown", restaurant: "unknown", dishChosen: false, specialty: "none", explicitFeatureId: null,
    } },
  }, {}, "Help me use the app.");
  expect(result.presentation?.message).not.toContain("which option");
  expect(result.presentation?.message).not.toMatch(/^\s*:/u);
  expectNoAction(result);
});

test("Production uses the same complete-reply screening policy", () => {
  expect(screenOrdinaryConversation(choice, "production").text).toBe(choice);
  expect(screenConversationalContinuation(": A useful independent answer.", false, "production").text)
    .toBeUndefined();
});
