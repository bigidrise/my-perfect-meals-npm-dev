// Mocked contract/prompt delivery, not evidence of live model judgment.
jest.mock("../db", () => ({ db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) } }));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { getDevelopmentPlatformKnowledge, getPlatformGuidanceInstructions, PLATFORM_GUIDANCE_INSTRUCTIONS } from "../services/coaching/platformKnowledge";
import { getFeatureUsageKnowledge, FEATURE_USAGE_KNOWLEDGE } from "../services/coaching/featureUsageKnowledge";
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
const planning = (id: "my_perfect_menu" | "meal_builders"): ConciergeGoal =>
  ({ ...unknown, activity: "plan_meals", explicitFeatureId: id });
const dish: ConciergeGoal = { ...unknown, activity: "prepare", occasion: "meal", dishChosen: true };
const choice = "We can start by planning your meals, creating an individual dish, or exploring Lifestyle features. What would you like to try first?";
const methodChoice = "Would you like My Perfect Menu to suggest meals for you, or would you rather create your own meals with Chef?";
type History = Array<{ role: string; content: string }>;

async function reply(userMessage: string, message: string, extra: Record<string, unknown> = {}, options: {
  history?: History; pending?: PendingRecommendation; unavailable?: boolean; rollingContext?: string;
} = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    memberNeed: "feature_help", responsePurpose: "answer", navigationIntent: "none", message,
    conversationMessage: null, recommendationMessage: null, handoffMessage: null,
    conciergeDecision: null, creatorRequest: null, redFlag: false, redFlagReason: null,
    contactCare: null, careDisposition: "none", ...extra,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any, userMessage, history: options.history ?? [],
    rollingContext: options.rollingContext ?? null, context: { coachingContextBlock: "Authorized context; setup state unknown." },
    tools: options.unavailable ? [] : tools, pendingRecommendation: options.pending,
  });
  expect(create).toHaveBeenCalledTimes(1);
  const request = create.mock.calls[0][0];
  const wire = JSON.parse(request.messages[1].content);
  if (result.presentation) expect(result.whatIFound).toBe(result.presentation.message);
  return { result, wire, request };
}
function noAction(result: Awaited<ReturnType<typeof reply>>["result"]) {
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.presentation?.navigation).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
}
function offer(id: string, goal: ConciergeGoal) {
  return { responsePurpose: "feature_only_offer", navigationIntent: "recommendation",
    conciergeDecision: { mode: "food_assistance", destinationId: id, goal } };
}

test("Development instructions distinguish activities and planning methods without a mandatory interview", () => {
  const instructions = getPlatformGuidanceInstructions("development");
  expect(instructions).toContain("planning a day of meals, creating an individual dish, or exploring Lifestyle");
  expect(instructions).toContain("contextual guidance, not a mandatory welcome or decision tree");
  expect(instructions).toContain("do not repeat an activity choice already made");
  expect(instructions).toContain("Planning a day of meals does not by itself choose My Perfect Menu");
  expect(instructions).toContain("Create With Chef is a workflow INSIDE the Meal Builder");
  expect(instructions).toContain("A clear single-dish preparation request instead fits the separate Create a Dish");
  expect(instructions).toContain("stop without a sign-off");
  expect(instructions).toContain("Do not claim to know exact onboarding or Macro Calculator completion");
  expect(instructions).toContain("Existing safety, access and single-confirmation contracts remain authoritative");
  expect(instructions.match(/^NEW MEMBER ORIENTATION:/gm)).toHaveLength(1);
  expect(instructions.match(/^MEAL STARTING PAGES:/gm)).toHaveLength(1);
});

test.each([
  ["I just signed up. I don't know what to do.", choice, "unclear"],
  ["Let's plan my meals.", methodChoice, "feature_help"],
])("preserves useful clarification without an early recommendation: %s", async (question, text, memberNeed) => {
  const { result, request } = await reply(question, text, { memberNeed, responsePurpose: "clarify" });
  expect(request.messages[0].content).toContain(getPlatformGuidanceInstructions("development"));
  expect(result.presentation?.message).toBe(text);
  noAction(result);
});

test.each(["my_perfect_menu", "meal_builders"] as const)(
  "preserves the chosen %s planning method and its first confirmed handoff", async id => {
    const own = id === "meal_builders";
    const requestText = own ? "I'd rather create my own meals with Chef." : "I'd like suggested meal ideas.";
    const text = own
      ? "Meal Builders gets you to your builder, where you can create meals in individual slots with Chef. Would you like to start there?"
      : "My Perfect Menu suggests personalized meal ideas to add to your plan. Would you like to start there?";
    const history: History = [{ role: "user", content: "Let's plan my meals." }, { role: "assistant", content: methodChoice }];
    const first = await reply(requestText, text, offer(id, planning(id)), { history });
    expect(first.wire.history).toEqual(history);
    expect(first.result.presentation?.navigation).toMatchObject({ state: "recommendation_pending", destinationId: id });
    expect(first.result.todayPlan.items).toEqual([]);
    const handoff = own
      ? "Open Meal Builders and continue to your available builder. Choose a day and meal slot, then use Create With Chef. Continue in other slots and save your plan."
      : "Open My Perfect Menu, choose Breakfast, Lunch, Dinner or Snack, then Choose This on an idea. Select its date and meal slot to create it and add it to your builder.";
    const acceptedHistory: History = [...history, { role: "user", content: requestText }, { role: "assistant", content: text }];
    const second = await reply("Yes", handoff, { memberNeed: "navigation", responsePurpose: "handoff",
      navigationIntent: "confirmed", conciergeDecision: null, handoffMessage: handoff,
    }, { history: acceptedHistory, pending: first.result.presentation?.navigation });
    expect(second.wire.pendingRecommendation).toEqual(first.result.presentation?.navigation);
    expect(second.result.presentation?.navigation).toMatchObject({ state: "navigation_confirmed", destinationId: id });
    expect(second.result.presentation?.message).toBe(handoff);
    expect(second.result.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId: id })]);
  });

test("retains the goal across orientation, planning choice, method choice and acceptance", async () => {
  const history: History = [];
  const turn = async (question: string, text: string, extra: Record<string, unknown> = {}, pending?: PendingRecommendation) => {
    const current = await reply(question, text, extra, { history: [...history], pending,
      rollingContext: "The member is starting their personal meal plan, not shopping or creating one dish." });
    expect(current.wire.history).toEqual(history);
    expect(current.wire.earlierConversation).toContain("personal meal plan");
    history.push({ role: "user", content: question }, { role: "assistant", content: current.result.presentation!.message });
    return current;
  };
  noAction((await turn("I'm new and not sure where to start.", choice,
    { memberNeed: "unclear", responsePurpose: "clarify" })).result);
  noAction((await turn("Let's plan a day of meals.", methodChoice, { responsePurpose: "clarify" })).result);
  const selected = await turn("I want to create them myself with Chef.",
    "Meal Builders lets you create meals in your builder's slots. Would you like to start there?",
    offer("meal_builders", planning("meal_builders")));
  expect(selected.result.presentation?.navigation?.destinationId).toBe("meal_builders");
  const handoff = "Open Meal Builders, continue to your builder, choose a day and slot, then use Create With Chef.";
  const confirmed = await turn("Yes", handoff, { memberNeed: "navigation", responsePurpose: "handoff",
    navigationIntent: "confirmed", handoffMessage: handoff }, selected.result.presentation?.navigation);
  expect(confirmed.result.presentation?.navigation?.state).toBe("navigation_confirmed");
  expect(confirmed.result.presentation?.message).toBe(handoff);
});

test.each(["I just want to try making a dish.", "I want to make homemade chicken soup."])(
  "a clear individual-dish request bypasses the orientation questions: %s", async request => {
    const text = "Create a Dish can help you make that dish. Would you like to use it?";
    const goal = { ...dish, dishChosen: request.includes("chicken soup") };
    const { result } = await reply(request, text, offer("create_a_dish", goal));
    expect(result.presentation?.message).toBe(text);
    expect(result.presentation?.navigation).toMatchObject({ state: "recommendation_pending", destinationId: "create_a_dish" });
    expect(result.todayPlan.items).toEqual([]);
  });

test("Lifestyle exploration stays useful and informational without an unrelated feature action", async () => {
  const text = "Lifestyle includes creating dishes, cravings, drinks, pairings and dining-out tools. You can open Lifestyle in the app; I can't provide its landing-page button here.";
  const { result, wire } = await reply("I'd like to see what Lifestyle features are available.", text);
  expect(result.presentation?.message).toBe(text);
  expect(wire.platformKnowledge.platformHelp.lifestyle.chefDestination).toBeNull();
  expect(wire.platformKnowledge.platformHelp.lifestyle.categories.join(" ")).toContain("Fridge Rescue");
  noAction(result);
});

test("an attempted Lifestyle landing-page action is rejected rather than added or substituted", async () => {
  const { result } = await reply("Open the Lifestyle landing page.",
    "Open Lifestyle using this button.", offer("lifestyle", { ...unknown, activity: "plan_meals" }));
  noAction(result);
  expect(Object.keys(COACH_DESTINATIONS)).toHaveLength(20);
  expect(Object.values(COACH_DESTINATIONS).some(destination => destination.route === "/lifestyle")).toBe(false);
});

test.each(["my_perfect_menu", "meal_builders", "create_a_dish"] as const)(
  "the guided choice cannot grant unavailable %s access", async id => {
    const { result } = await reply("I'd like to use that workflow.",
      `${COACH_DESTINATIONS[id].label} can help. Would you like to use it?`,
      offer(id, id === "create_a_dish" ? dish : planning(id)), { unavailable: true });
    noAction(result);
  });

test.each(["referral", "emergency"])("required %s takes precedence over the orientation and proposed action", async care => {
  const { result } = await reply("I need help with meals.", "Seek the indicated medical care now.", {
    ...offer("my_perfect_menu", planning("my_perfect_menu")), careDisposition: care,
    redFlag: care === "emergency", contactCare: "Seek the indicated medical care now.",
  });
  expect(result.presentation).toBeUndefined();
  expect(result.meta.redFlag).toBe(true);
  expect(result.todayPlan.items).toEqual([{ horizon: "today", kind: "contact_care", text: "Seek the indicated medical care now." }]);
});

test("audited planning facts and Lifestyle guidance are Development-only without changing Production records", () => {
  const usage = getFeatureUsageKnowledge("development");
  expect(usage.my_perfect_menu?.controls.join(" ")).toContain("Three personalized text-based ideas");
  expect(usage.my_perfect_menu?.controls.join(" ")).toContain("after choosing an idea");
  expect(usage.my_perfect_menu?.notes.join(" ")).toContain("Performance & Competition requires date");
  expect(usage.meal_builders?.controls.join(" ")).toContain("Create With Chef");
  expect(usage.meal_builders?.notes.join(" ")).toContain("not a chosen builder, day or slot");
  expect(getPlatformGuidanceInstructions("production")).toBe(PLATFORM_GUIDANCE_INSTRUCTIONS);
  expect(getFeatureUsageKnowledge("production")).toBe(FEATURE_USAGE_KNOWLEDGE);
  expect(FEATURE_USAGE_KNOWLEDGE.my_perfect_menu?.controls.join(" ")).not.toContain("Three personalized text-based ideas");
  process.env.NODE_ENV = "production";
  expect(getDevelopmentPlatformKnowledge()?.platformHelp).not.toHaveProperty("lifestyle");
});
