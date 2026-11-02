// Injected model replies verify prompt delivery and response contracts, not live judgment.
jest.mock("../db", () => ({ db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) } }));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { getChefConversationInstructions, CHEF_CONVERSATION_INSTRUCTIONS } from "../services/coaching/conciergeInstructions";
import { getPlatformGuidanceInstructions, PLATFORM_GUIDANCE_INSTRUCTIONS } from "../services/coaching/platformKnowledge";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";
import type { ConciergeGoal } from "../../shared/coaching/schemas";
import type { PendingRecommendation } from "../services/coaching/conciergeNavigationState";

const environment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; });
afterAll(() => { process.env.NODE_ENV = environment; });
const tools = getCornerCapabilities(["all"], "development").map(cap => ({
  id: cap.id, label: cap.label, description: cap.description, featureTarget: cap.id, scope: "adult" as const,
}));
const unknown: ConciergeGoal = { activity: "unknown", occasion: "unknown", restaurant: "unknown",
  dishChosen: false, specialty: "none", explicitFeatureId: null };
const goals = {
  my_perfect_menu: { ...unknown, activity: "plan_meals", explicitFeatureId: "my_perfect_menu" },
  meal_builders: { ...unknown, activity: "plan_meals", explicitFeatureId: "meal_builders" },
  craving_creator: { ...unknown, activity: "prepare", occasion: "snack" },
  dessert_creator: { ...unknown, activity: "prepare", occasion: "dessert" },
  create_a_dish: { ...unknown, activity: "prepare", occasion: "meal" },
  my_perfect_gatherings: { ...unknown, activity: "gathering" },
} satisfies Record<string, ConciergeGoal>;
const planning = "My Perfect Menu suggests personalized meals for your plan. Meal Builder lets you create and organize meals inside your assigned builder. Which would you prefer: My Perfect Menu or Meal Builder?";
const dessert = "Craving Creator helps with immediate sweet or savory cravings. Dessert Creator makes complete desserts such as cakes and pies. Which would you prefer: Craving Creator or Dessert Creator?";
const reversedDessert = "Dessert Creator makes complete desserts such as cakes and pies. Craving Creator helps with immediate sweet or savory cravings. Which would you prefer: Dessert Creator or Craving Creator?";
const orientation = "We can plan a day of meals, create an individual dish, or explore Lifestyle features. Which would you like to try first: meal planning, Create a Dish, or Lifestyle?";
type History = Array<{ role: string; content: string }>;

async function reply(userMessage: string, message: string, extra: Record<string, unknown> = {},
  history: History = [], pendingRecommendation?: PendingRecommendation, unavailable = false) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    memberNeed: "feature_help", responsePurpose: "answer", message,
    conversationMessage: null, recommendationMessage: null, handoffMessage: null,
    navigationIntent: "none", conciergeDecision: null, creatorRequest: null,
    redFlag: false, redFlagReason: null, contactCare: null, careDisposition: "none", ...extra,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any, userMessage, history,
    rollingContext: null, context: { coachingContextBlock: "Authorized context; safety and physician instructions remain authoritative." },
    tools: unavailable ? [] : tools, pendingRecommendation,
  });
  expect(create).toHaveBeenCalledTimes(1);
  const request = create.mock.calls[0][0];
  return { result, request, wire: JSON.parse(request.messages[1].content) };
}
function offer(id: keyof typeof goals) {
  return { responsePurpose: "feature_only_offer", navigationIntent: "recommendation",
    conciergeDecision: { mode: "food_assistance", destinationId: id, goal: goals[id] } };
}
function noAction(result: Awaited<ReturnType<typeof reply>>["result"]) {
  expect(result.presentation?.navigation).toBeUndefined();
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
}

test("the universal rule is active in Development only and reconciles the previous unnamed preference question", () => {
  const instructions = getChefConversationInstructions("development");
  expect(instructions).toContain("UNIVERSAL CHOICE CLARITY: Whenever you present two or more meaningful choices anywhere in Ask Chef");
  expect(instructions).toContain("explicitly repeats ALL available choice names");
  expect(instructions).toContain("Repeat the labels, not the full descriptions");
  expect(instructions).toContain("never assign a fixed feature to an ordinal");
  expect(instructions).toContain("Create With Chef is inside the assigned builder, not a standalone destination");
  expect(instructions).toContain("A clear whole-pie request should proceed toward Dessert Creator");
  expect(instructions).toContain("physician precedence or clinical safeguards");
  const platform = getPlatformGuidanceInstructions("development");
  expect(platform).toContain("End with a question explicitly naming My Perfect Menu and Meal Builder");
  expect(platform).toContain("question explicitly naming all three choices");
  expect(platform).not.toContain('Then ask "Which one would you prefer?"');
  expect(getChefConversationInstructions("production")).toBe(CHEF_CONVERSATION_INSTRUCTIONS);
  expect(getPlatformGuidanceInstructions("production")).toBe(PLATFORM_GUIDANCE_INSTRUCTIONS);
  expect(CHEF_CONVERSATION_INSTRUCTIONS).not.toContain("UNIVERSAL CHOICE CLARITY");
});

test.each([
  ["I want to plan my meals.", planning, ["My Perfect Menu", "Meal Builder"]],
  ["I want to make something sweet but haven't decided what.", dessert, ["Craving Creator", "Dessert Creator"]],
  ["I'm new and don't know where to start.", orientation, ["meal planning", "Create a Dish", "Lifestyle"]],
])("a contextual comparison preserves descriptions and repeats every choice label in its final question: %s",
  async (question, text, labels) => {
    const { result, request } = await reply(question as string, text as string, { responsePurpose: "clarify" });
    expect(result.presentation?.message).toBe(text);
    const finalQuestion = (text as string).slice((text as string).lastIndexOf("Which"));
    for (const label of labels) expect(finalQuestion).toContain(label);
    expect(finalQuestion.endsWith("?")).toBe(true);
    expect(request.messages[0].content).toContain("UNIVERSAL CHOICE CLARITY");
    noAction(result);
  });

test.each([
  ["Menu", planning, "my_perfect_menu"],
  ["Builder", planning, "meal_builders"],
  ["the dessert one", dessert, "dessert_creator"],
  ["the craving one", dessert, "craving_creator"],
  ["the first one", dessert, "craving_creator"],
  ["the second one", dessert, "dessert_creator"],
  ["the first one", reversedDessert, "dessert_creator"],
  ["the second one", reversedDessert, "craving_creator"],
  ["the second one", orientation, "create_a_dish"],
] as const)("contextual answer %s to %s retains %s through one confirmed handoff", async (answer, question, id) => {
  const history: History = [{ role: "user", content: "Help me choose how to get started." },
    { role: "assistant", content: question }];
  const recommendation = `${COACH_DESTINATIONS[id].label} can help with that. Want me to take you there?`;
  const first = await reply(answer, recommendation, offer(id), history);
  expect(first.wire.history).toEqual(history);
  expect(first.wire.latestMemberMessage).toBe(answer);
  expect(first.result.presentation?.message).toBe(recommendation);
  expect(first.result.presentation?.navigation).toMatchObject({ state: "recommendation_pending", destinationId: id });
  expect(first.result.todayPlan.items).toEqual([]);
  const handoff = id === "meal_builders"
    ? "Use the button below to open Meal Builders. Open your assigned builder, choose a day and meal slot, then select Create With Chef."
    : `Use the button below to open ${COACH_DESTINATIONS[id].label}.`;
  const second = await reply("Yes", handoff, { memberNeed: "navigation", responsePurpose: "handoff",
    navigationIntent: "confirmed", handoffMessage: handoff,
  }, [...history, { role: "user", content: answer }, { role: "assistant", content: recommendation }],
  first.result.presentation?.navigation);
  expect(second.wire.pendingRecommendation).toEqual(first.result.presentation?.navigation);
  // Selecting the dish activity supplies no recipe text; preserve the existing
  // honest no-transfer notice rather than treating an ordinal as a dish request.
  expect(second.result.presentation?.message).toBe(id === "create_a_dish"
    ? `${handoff}\n\nI couldn't verify the request text for transfer. You can enter it in Create a Dish.`
    : handoff);
  if (id === "create_a_dish") expect(second.result.presentation?.creatorRequest).toBeUndefined();
  expect(second.result.presentation?.message).not.toContain("?");
  expect(second.result.presentation?.navigation).toMatchObject({ state: "navigation_confirmed", destinationId: id });
  expect(second.result.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId: id })]);
});

test.each([
  ["the first one", planning, "clarify"],
  ["the third one", "Lifestyle includes dish creation, cravings, beverages and dining-out tools. You can open Lifestyle in the app; I can't provide its landing-page button here.", "answer"],
] as const)("an activity answer %s does not invent a destination", async (answer, text, responsePurpose) => {
  const { result } = await reply(answer, text, { responsePurpose }, [{ role: "assistant", content: orientation }]);
  expect(result.presentation?.message).toBe(text);
  noAction(result);
});

test("an unclear answer stays clarification rather than inventing an ordinal or destination", async () => {
  const text = "Did you mean Craving Creator for a craving, or Dessert Creator for a complete dessert?";
  const { result } = await reply("That one.", text, { responsePurpose: "clarify" },
    [{ role: "assistant", content: dessert }]);
  expect(result.presentation?.message).toBe(text);
  noAction(result);
});

test.each(["Yes", "No"] as const)("a single Gatherings recommendation accepts %s without adding alternatives", async answer => {
  const text = "My Perfect Gatherings can help you plan your Thanksgiving dinner. Want me to take you there?";
  const first = await reply("Help me plan my complete Thanksgiving dinner.", text, offer("my_perfect_gatherings"));
  expect(first.result.presentation?.message).toBe(text);
  expect(first.result.presentation?.navigation?.state).toBe("recommendation_pending");
  const handoff = "Use the button below to open My Perfect Gatherings.";
  const followup = answer === "Yes" ? handoff : "We can keep discussing what you need.";
  const second = await reply(answer, followup, answer === "Yes" ? {
    memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "confirmed", handoffMessage: handoff,
  } : {}, [{ role: "assistant", content: text }], first.result.presentation?.navigation);
  expect(second.result.presentation?.message).toBe(followup);
  if (answer === "Yes") {
    expect(second.result.presentation?.navigation).toMatchObject({ state: "navigation_confirmed", destinationId: "my_perfect_gatherings" });
  } else noAction(second.result);
});

test("a clear whole-pie request retains a single Dessert Creator offer without a comparison", async () => {
  const text = "Dessert Creator can help you make a whole apple pie. Want me to take you there?";
  const { result } = await reply("I want to make a whole apple pie.", text, offer("dessert_creator"));
  expect(result.presentation?.message).toBe(text);
  expect(result.presentation?.navigation).toMatchObject({ state: "recommendation_pending", destinationId: "dessert_creator" });
  expect(result.todayPlan.items).toEqual([]);
});

test("Create With Chef cannot be introduced as a standalone destination", async () => {
  const { result } = await reply("Builder", "Open Create With Chef.", {
    ...offer("meal_builders"), conciergeDecision: {
      mode: "food_assistance", destinationId: "create_with_chef", goal: goals.meal_builders,
    },
  }, [{ role: "assistant", content: planning }]);
  noAction(result);
  expect(Object.keys(COACH_DESTINATIONS)).toHaveLength(20);
});

test("a clear contextual selection cannot grant unavailable feature access", async () => {
  const { result } = await reply("the dessert one", "Dessert Creator can help. Want me to take you there?",
    offer("dessert_creator"), [{ role: "assistant", content: dessert }], undefined, true);
  noAction(result);
});

test("choice history without validated pending state cannot authorize a bare acceptance", async () => {
  const { result } = await reply("Yes", "Use the button below to open Dessert Creator.", {
    memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "confirmed",
  }, [{ role: "assistant", content: "Dessert Creator can help. Want me to take you there?" }]);
  noAction(result);
});

test.each(["referral", "emergency"] as const)("required %s overrides a contextual choice and proposed navigation", async careDisposition => {
  const { result } = await reply("the dessert one", "Seek the indicated medical care now.", {
    ...offer("dessert_creator"), careDisposition, redFlag: careDisposition === "emergency",
    contactCare: "Seek the indicated medical care now.",
  }, [{ role: "assistant", content: dessert }]);
  expect(result.presentation).toBeUndefined();
  expect(result.meta.redFlag).toBe(true);
  expect(result.todayPlan.items).toEqual([{ horizon: "today", kind: "contact_care", text: "Seek the indicated medical care now." }]);
});
