jest.mock("../db", () => ({ db: { execute: jest.fn(() => { throw Error("No persistence in transcript tests"); }) } }));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { explicitCustomerSelection, navigationGoal } from "../services/coaching/verifiedNavigation";
import { conciseFeatureHandoff } from "../services/coaching/featurePresentation";
import type { PendingRecommendation } from "../services/coaching/conciergeNavigationState";
import type { CoachDestinationId } from "../../shared/coaching/navigation";
import { getChefConversationInstructions } from "../services/coaching/conciergeInstructions";

const environment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = environment === "production" ? "production" : "development"; });
afterAll(() => { process.env.NODE_ENV = environment; });
const tools = getCornerCapabilities(["all"], "development").map(tool => ({ ...tool, scope: "adult" as const, featureTarget: tool.id }));
const shopping = ["Take me to open my grocery list.", "How about my shopping list? Take me to my shopping list.", "Open My Shopping List."];
const menu = ["My perfect menu would be great. I don't know what I want, so I want you to choose for me.",
  "I already said I wanted my perfect menu. I said menu."];
const cases = [
  ["I have chicken, rice, and broccoli in my refrigerator.", "Yes.", "fridge_rescue", "use_ingredients", "meal", "none", "unknown"],
  ["I want to make a protein shake.", "yes", "beverage_creator", "prepare", "beverage", "none", "unknown"],
  ["I need a pre-workout drink.", "yes", "athlete_beverage_creator", "prepare", "beverage", "workout", "unknown"],
  ["Help me choose what to eat at a restaurant.", "yes", "restaurant_guide", "eat_out", "meal", "none", "chosen"],
  ["small treat", "yes", "craving_creator", "prepare", "snack", "none", "unknown"],
] as const;
async function run(message: string, raw: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    message: "Which workflow do you need?", conversationMessage: null, navigationIntent: "none",
    pendingNavigationDisposition: "clear", memberNeed: "unclear", responsePurpose: "clarify",
    conciergeDecision: null, careDisposition: "none", redFlag: false, foodDeclarations: null, ...raw,
  }) } }] });
  const response = await runConciergeConversation({ client: { chat: { completions: { create } } } as any,
    userMessage: message, history: [], rollingContext: null, tools,
    context: { chefFoodCompatibility: { subjectUserId: "synthetic-owner" } }, ...extra });
  expect(create).toHaveBeenCalledTimes(1);
  return response;
}
function expectAction(response: Awaited<ReturnType<typeof run>>, id: CoachDestinationId, state: string) {
  expect(response.presentation?.destinationId).toBe(id);
  expect(response.presentation?.navigation?.state).toBe(state);
  expect(response.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId: id })]);
  expect(response.presentation?.message).toBe(conciseFeatureHandoff(id));
  expect(response.foodCompatibility).toBeUndefined();
  expect(response.presentation?.message).not.toMatch(/already opened|has opened|couldn't reliably check/i);
}

test.each(shopping)("exact founder Shopping List command: %s", async message => {
  expectAction(await run(message), "shopping_list", "direct_navigation");
});
test.each(menu)("exact founder explicit Menu selection needs no second permission: %s", async message => {
  expectAction(await run(message, { responsePurpose: "answer_with_offer", memberNeed: "feature_help",
    navigationIntent: "recommendation" }), "my_perfect_menu", "direct_navigation");
});
test.each(cases)("exact offer and confirmation sequence: %s → %s", async (request, answer, id, activity, occasion, specialty, restaurant) => {
  const goal = { ...navigationGoal(id), explicitFeatureId: null, activity, occasion, specialty, restaurant };
  const offer = await run(request, { message: `Would you like to use ${tools.find(tool => tool.id === id)!.label}?`,
    responsePurpose: "feature_only_offer", memberNeed: "feature_help", navigationIntent: "recommendation",
    conciergeDecision: { mode: "food_assistance", destinationId: id, goal },
    foodDeclarations: { message: { mode: "none", foods: [] }, conversationMessage: null, handoffMessage: null } });
  expect(offer.presentation?.navigation?.state).toBe("recommendation_pending");
  expect(offer.presentation?.destinationId).toBeUndefined();
  expect(offer.todayPlan.items).toEqual([]);
  expectAction(await run(answer, {}, {
    history: [{ role: "user", content: request }, { role: "assistant", content: offer.presentation!.message }],
    pendingRecommendation: offer.presentation!.navigation,
  }), id, "navigation_confirmed");
});
test.each(["sure", "open it", "yes please", "go ahead"])("equivalent confirmation binds only the valid pending target: %s", async answer => {
  const pending: PendingRecommendation = { state: "recommendation_pending", destinationId: "beverage_creator",
    goal: { ...navigationGoal("beverage_creator"), activity: "prepare", occasion: "beverage" }, offeredAt: new Date().toISOString() };
  expectAction(await run(answer, { conciergeDecision: { mode: "food_assistance", destinationId: "dessert_creator" } },
    { pendingRecommendation: pending }), "beverage_creator", "navigation_confirmed");
});
test.each(["I want to plan meals for the week.", "How does My Perfect Menu work?",
  "Don't open My Perfect Menu.", "My Perfect Menu or Meal Builders?", "\"Open My Shopping List.\"",
  "Open My Shopping List. Actually no.", "I don't want My Perfect Menu.", "Open My Shopping List. No.",
  "Open My Shopping List. Don't.", "Open My Shopping List. Not my shopping list.", "My Perfect Menu?",
  "Don't send me to Beverage Creator.", "Send me to Beverage Creator. Do not send me there."])("unselected, educational or refused request isn't a binding: %s", message => {
  expect(explicitCustomerSelection(message)).toBeUndefined();
});
test("restaurant clarification survives invalid inactive food declarations", async () => {
  const response = await run("I want to eat at a restaurant.", { message:
    "Restaurant Guide helps at a chosen restaurant. Find Meals Near Me helps find one. Which option do you need?" });
  expect(response.presentation?.message).toContain("Restaurant Guide");
  expect(response.presentation?.message).toContain("Find Meals Near Me");
  expect(response.presentation?.navigation).toBeUndefined();
  expect(response.todayPlan.items).toEqual([]);
  expect(response.foodCompatibility).toBeUndefined();
});
test("accumulated repeated founder requests recover after an earlier failed answer", async () => {
  const history: Array<{ role: string; content: string }> = [{ role: "user", content: "I want to plan meals for the week." },
    { role: "assistant", content: "I couldn't complete that response. Nothing has been opened. Please try your request again." }];
  for (const request of [...menu, ...shopping]) {
    const response = await run(request, {}, { history });
    expectAction(response, menu.includes(request) ? "my_perfect_menu" : "shopping_list", "direct_navigation");
    history.push({ role: "user", content: request }, { role: "assistant", content: response.presentation!.message });
  }
});
test("the exact weekly planning request stays a choice until the founder selects Menu", async () => {
  const request = "I want to plan meals for the week.";
  const choice = await run(request, {
    message: "Would you like My Perfect Menu for meal ideas or Meal Builders for dated meal planning?",
    foodDeclarations: { message: { mode: "none", foods: [] }, conversationMessage: null, handoffMessage: null },
  });
  expect(choice.presentation?.destinationId).toBeUndefined();
  expect(choice.presentation?.navigation).toBeUndefined();
  expect(choice.todayPlan.items).toEqual([]);
  const history = [{ role: "user", content: request }, { role: "assistant", content: choice.presentation!.message }];
  for (const selection of menu) {
    const response = await run(selection, {}, { history });
    expectAction(response, "my_perfect_menu", "direct_navigation");
    history.push({ role: "user", content: selection }, { role: "assistant", content: response.presentation!.message });
  }
});
test("topic change replaces the old pending offer with the named selection", async () => {
  expectAction(await run(menu[0], {}, { pendingRecommendation: { state: "recommendation_pending",
    destinationId: "beverage_creator", goal: navigationGoal("beverage_creator"), offeredAt: new Date().toISOString() } }),
  "my_perfect_menu", "direct_navigation");
});
test.each(["yes", "sure", "open it"])("no fresh offer means no action for %s", async answer => {
  const response = await run(answer, {}, { pendingRecommendation: { state: "recommendation_pending",
    destinationId: "beverage_creator", goal: navigationGoal("beverage_creator"), offeredAt: "2020-01-01T00:00:00Z" } });
  expect(response.presentation?.destinationId).toBeUndefined();
  expect(response.todayPlan.items).toEqual([]);
});
test("access and care remain authoritative for a clear named request", async () => {
  const denied = await run(shopping[0], {}, { tools: tools.filter(tool => tool.id !== "shopping_list") });
  expect(denied.presentation?.destinationId).toBeUndefined();
  expect(denied.todayPlan.items).toEqual([]);
  const emergency = await run(shopping[0], { careDisposition: "emergency", redFlag: true, contactCare: "Seek urgent help." });
  expect(emergency.meta.redFlag).toBe(true);
  expect(emergency.todayPlan.items.some(item => typeof item !== "string" && item.kind === "use_feature")).toBe(false);
});
test("Production uses the same explicit-selection instructions and direct actions", async () => {
  expect(getChefConversationInstructions("development")).toContain("An explicit feature selection is navigation consent");
  process.env.NODE_ENV = "production";
  const response = await run(shopping[0]);
  expect(response.presentation?.destinationId).toBe("shopping_list");
  expect(response.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId: "shopping_list" })]);
});
