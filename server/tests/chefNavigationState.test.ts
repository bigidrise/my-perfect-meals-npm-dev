jest.mock("../db", () => ({ db: { execute: jest.fn() } }));
jest.mock("../services/coaching/adapters", () => ({ getAdapter: jest.fn() }));
jest.mock("../services/coaching/conversationSummarizer", () => ({ loadBoundedHistory: jest.fn() }));
jest.mock("../../client/src/components/coaching/CoachFeatureAction", () => ({
  __esModule: true,
  default: ({ destinationId }: any) => require("react").createElement("button", null, `Open ${destinationId}`),
}));
const mockCreate = jest.fn();
jest.mock("openai", () => ({
  __esModule: true, default: jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } })),
}));
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "../db";
import { engine } from "../services/coaching/engine";
import { getAdapter } from "../services/coaching/adapters";
import { loadBoundedHistory } from "../services/coaching/conversationSummarizer";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { loadPendingRecommendation } from "../services/coaching/conciergeNavigationState";
import CoachBubble from "../../client/src/components/coaching/CoachBubble";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";

const originalEnvironment = process.env.NODE_ENV;
const subject = { subjectType: "user" as const, subjectId: "member", ownerId: "member" };
const unknown = { activity: "unknown", occasion: "unknown", restaurant: "unknown",
  dishChosen: false, specialty: "none", explicitFeatureId: null };
const travel = { ...unknown, activity: "travel" };
const dessert = { ...unknown, activity: "prepare", occasion: "dessert" };
const request = "I'm going on a Carnival cruise. Can you help me find somewhere to eat?";
const invitation = "My Perfect Getaway can help explore your cruise dining options. Would you like to use it?";
const guidance = "Great. Search your cruise or destination, then choose a dining area if prompted.";
let stored: any;
let statements: string[];
beforeEach(() => {
  process.env.NODE_ENV = "development";
  jest.clearAllMocks(); mockCreate.mockReset(); stored = undefined; statements = [];
  (getAdapter as jest.Mock).mockReturnValue({
    loadSubject: async () => subject, loadAdditionalContext: async () => ({}),
    safetyRules: [], availableTools: getCornerCapabilities(["all"]),
  });
  // Deliberately omit text history: stored structured state must own continuity.
  (loadBoundedHistory as jest.Mock).mockResolvedValue({ recentMessages: [], rollingContext: null });
  (db.execute as jest.Mock).mockImplementation(async query => {
    const { sql, params } = new PgDialect().sqlToQuery(query);
    statements.push(sql);
    if (sql.includes("SELECT m.structured_payload")) return { rows: stored ? [{ structured_payload: stored }] : [] };
    if (sql.includes("INSERT INTO coach_messages") && sql.includes("structured_payload")) {
      stored = JSON.parse(params.find((p: any) => typeof p === "string" && p.startsWith("{")) as string);
    }
    return { rows: [{ id: "owned-conversation" }] };
  });
});
afterAll(() => { process.env.NODE_ENV = originalEnvironment; });
const run = (message: string) => engine.run({
  specialization: "corner", subject, userMessage: message, conversationId: "owned-conversation",
}, { authUser: { id: "member" } } as any);
const html = (response: any) => renderToStaticMarkup(React.createElement(CoachBubble, {
  structured: response, enableConcierge: true,
}));
function model(extra: Record<string, any> = {}) {
  mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
    message: "Let's get you started with My Perfect Getaway.",
    navigationIntent: "direct_request",
    // Also simulate a falsely explicit model goal; there is no named feature in
    // the actual member request, so neither field may self-authorize navigation.
    conciergeDecision: { mode: "food_assistance", destinationId: "my_perfect_getaway",
      goal: { ...travel, explicitFeatureId: "my_perfect_getaway" } },
    recommendationMessage: invitation, handoffMessage: guidance,
    conversationMessage: "Would you prefer exploring dining options or preparing food?",
    ...extra,
  }) } }] });
}

test("exact live failure goes through engine persistence, then restored Yes renders the handoff button", async () => {
  model();
  const first = await run(request);
  expect(first.presentation?.message).toBe(invitation);
  expect(first.presentation?.destinationId).toBeUndefined();
  expect(first.presentation?.navigation?.state).toBe("recommendation_pending");
  expect(first.todayPlan.items).toEqual([]);
  expect(html(first)).not.toContain("<button");
  expect(html(first)).not.toContain("get you started");
  // Actual persistTurn serialized the state; reloading does not consult a summary.
  expect(stored.presentation.navigation.destinationId).toBe("my_perfect_getaway");
  expect(await loadPendingRecommendation("owned-conversation", "member"))
    .toMatchObject({ state: "recommendation_pending", destinationId: "my_perfect_getaway" });
  model({ navigationIntent: "confirmed", conciergeDecision: null });
  const second = await run("Yes.");
  expect(second.presentation).toMatchObject({
    message: guidance, destinationId: "my_perfect_getaway",
    navigation: { state: "navigation_confirmed" },
  });
  expect(html(second)).toContain("<button");
  expect(html(second)).toContain("Open my_perfect_getaway");
  expect(html(second)).not.toContain(invitation);
  const payload = JSON.parse(mockCreate.mock.calls[1][0].messages[1].content);
  expect(payload.pendingRecommendation.destinationId).toBe("my_perfect_getaway");
  expect(payload.platformKnowledge.featureUsage.my_perfect_getaway.descriptionInput).toContain("Search");
  expect(mockCreate).toHaveBeenCalledTimes(2);
  expect(await loadPendingRecommendation("owned-conversation", "member")).toBeUndefined();
  expect(statements.find(s => s.includes("SELECT m.structured_payload"))).toContain("c.owner_id");
});

test.each(["my_perfect_getaway", "dessert_creator"] as const)(
  "direct named navigation to %s does not require a pending record", async id => {
    model({ conciergeDecision: { mode: "food_assistance", destinationId: id,
      goal: { ...(id === "dessert_creator" ? dessert : travel), explicitFeatureId: id } } });
    const result = await run(`Open ${COACH_DESTINATIONS[id].label}.`);
    expect(result.presentation?.navigation?.state).toBe("direct_navigation");
    expect(result.presentation?.destinationId).toBe(id);
    expect(html(result)).toContain("<button");
  });

test("dessert recommendation and short agreement retain dessert without text history", async () => {
  const question = "Dessert Creator can help with a whole cake. Would you like to use it?";
  const handoff = "Great. Describe the dessert or choose its type and flavor, then review the yield.";
  const decision = { mode: "food_assistance", destinationId: "dessert_creator", goal: dessert };
  model({ conciergeDecision: decision, recommendationMessage: question, handoffMessage: handoff });
  expect((await run("Help me make a whole cake.")).presentation?.navigation?.state).toBe("recommendation_pending");
  model({ navigationIntent: "confirmed", conciergeDecision: null, handoffMessage: handoff });
  const result = await run("Sure.");
  expect(result.presentation?.message).toBe(handoff);
  expect(result.presentation?.destinationId).toBe("dessert_creator");
  expect(html(result)).toContain("<button");
});

test("Find Meals assistance confirms into the meal-generating screen, not the listing-only route", async () => {
  const question = "Find Meals Near Me can suggest nearby restaurants and meals. Would you like to use it?";
  const handoff = "Describe your craving, then enter a ZIP code or share your location and submit the meal search.";
  model({ conciergeDecision: { mode: "food_assistance", destinationId: "find_meals_near_me",
    goal: { ...unknown, activity: "eat_out", restaurant: "not_chosen" } },
    recommendationMessage: question, handoffMessage: handoff });
  const first = await run("I don't know where to eat near me.");
  expect(first.presentation?.message).toBe(question);
  expect(html(first)).not.toContain("<button");
  model({ navigationIntent: "confirmed", conciergeDecision: null, handoffMessage: handoff });
  const second = await run("Yes.");
  expect(second.presentation?.destinationId).toBe("find_meals_near_me");
  expect(second.presentation?.message).toBe(handoff);
  expect(html(second)).toContain("<button");
  expect(COACH_DESTINATIONS.find_meals_near_me.route).toBe("/social-hub/find");
  expect(COACH_DESTINATIONS.find_meals_near_me.access).toBe("pro");
});

test("a correction replaces pending intent rather than confirming the old destination", async () => {
  model(); await run(request);
  model({ navigationIntent: "recommendation",
    conciergeDecision: { mode: "food_assistance", destinationId: "dessert_creator", goal: dessert },
    recommendationMessage: "Would you like to use Dessert Creator for that cake?" });
  const result = await run("Actually, help me make a whole cake instead.");
  expect(result.presentation?.navigation?.destinationId).toBe("dessert_creator");
  expect(html(result)).not.toContain("<button");
});

test.each(["I changed my mind.", "Which of those would you suggest?"])(
  "declines and unresolved choices clear pending navigation: %s", async message => {
    model(); await run(request);
    model({ navigationIntent: "none", conciergeDecision: null, message: "What would you prefer instead?" });
    expect((await run(message)).presentation?.navigation).toBeUndefined();
    model({ navigationIntent: "confirmed" });
    expect(html(await run("Yes."))).not.toContain("<button");
  });

test("multiple feature suggestions cannot be accepted as one pending destination", async () => {
  model({ navigationIntent: "none", conciergeDecision: null,
    message: "Would you prefer My Perfect Getaway or Dessert Creator?" });
  await run("I'm not sure whether to cook or go out.");
  model({ navigationIntent: "confirmed" });
  expect(html(await run("Yes."))).not.toContain("<button");
});

test("a stored recommendation still cannot bypass the current available-tool check", async () => {
  model(); await run(request);
  (getAdapter as jest.Mock)().availableTools = [];
  model({ navigationIntent: "confirmed", conciergeDecision: null });
  const result = await run("Yes.");
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(html(result)).not.toContain("<button");
});

test.each([null, "Let's get you started."])("invalid recommendation wording fails closed: %s", async text => {
  model({ recommendationMessage: text });
  const result = await run(request);
  expect(html(result)).not.toContain("<button");
  expect(result.presentation?.message).not.toContain("get you started");
});

test("confirmation cannot show a button without model-authored handoff guidance", async () => {
  model(); await run(request);
  model({ navigationIntent: "confirmed", handoffMessage: null });
  const result = await run("Yes.");
  expect(html(result)).not.toContain("<button");
  expect(result.presentation?.navigation?.state).toBe("recommendation_pending");
});

test("a button cannot reuse the recommendation pitch as its handoff", async () => {
  model(); await run(request);
  model({ navigationIntent: "confirmed", handoffMessage: invitation });
  expect(html(await run("Yes."))).not.toContain("<button");
});

test("a model cannot turn competing named direct choices into one approved destination", async () => {
  model();
  expect(html(await run("Open My Perfect Getaway or Dessert Creator, I'm not sure."))).not.toContain("<button");
});

test("clinical escalation clears pending state and suppresses every navigation surface", async () => {
  model(); await run(request);
  model({ redFlag: true, redFlagReason: "Please get urgent medical help.", navigationIntent: "confirmed" });
  const result = await run("Yes, but I feel seriously unwell.");
  expect(result.meta.redFlag).toBe(true);
  expect(result.presentation?.navigation).toBeUndefined();
  expect(html(result)).not.toContain("<button");
  expect(await loadPendingRecommendation("owned-conversation", "member")).toBeUndefined();
});

test("legacy or mismatched navigation metadata cannot render a Development button", () => {
  const value: any = { presentation: { kind: "concierge", message: "Let's get you started.",
    destinationId: "my_perfect_getaway" }, todayPlan: { items: [
      { kind: "use_feature", destinationId: "my_perfect_getaway", text: "Open" },
    ] }, whatIFound: "", whatItCouldMean: "", learningOpportunity: null };
  expect(html(value)).not.toContain("<button");
  value.presentation.navigation = { state: "recommendation_pending", destinationId: "my_perfect_getaway" };
  expect(html(value)).not.toContain("<button");
  value.presentation.navigation = { state: "navigation_confirmed", destinationId: "dessert_creator" };
  expect(html(value)).not.toContain("<button");
});
