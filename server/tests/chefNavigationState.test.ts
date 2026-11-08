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
import { verifiedNavigationText } from "../services/coaching/verifiedNavigation";
import CoachBubble from "../../client/src/components/coaching/CoachBubble";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";
import { FEATURE_USAGE_KNOWLEDGE } from "../services/coaching/featureUsageKnowledge";
import { mentionsCoachDestination } from "../../shared/coaching/navigation";
import { PENDING_NAVIGATION_TTL_MS } from "../services/coaching/conciergeNavigationContinuity";
import { fallbackQuality, selectRejectedConversation } from "../services/coaching/conciergeFallback";
import { screenOrdinaryConversation, screenConversationalContinuation } from "../services/coaching/conciergeReplyScreening";
import { getChefConversationInstructions } from "../services/coaching/conciergeInstructions";
import { isNavigationFailureComplaint } from "../services/coaching/navigationRecovery";
import { acceptsPendingFeature } from "../services/coaching/verifiedNavigation";
import { isUnambiguousChefClosing } from "../services/coaching/conversationReliability";

const originalEnvironment = process.env.NODE_ENV;
const subject = { subjectType: "user" as const, subjectId: "member", ownerId: "member" };
const unknown = { activity: "unknown", occasion: "unknown", restaurant: "unknown",
  dishChosen: false, specialty: "none", explicitFeatureId: null };
const travel = { ...unknown, activity: "travel" };
const dessert = { ...unknown, activity: "prepare", occasion: "dessert" };
const craving = { ...unknown, activity: "prepare", occasion: "snack" };
const cravingQuestion = "Would you like to open the Craving Creator to make a small portion of ice cream?";
const cravingHandoff = "To begin making your small portion of ice cream, open the Craving Creator and describe your craving.";
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
    if (sql.includes("SELECT m.structured_payload")) return { rows: stored ? [{ structured_payload: stored, created_at: new Date() }] : [] };
    if (sql.includes("INSERT INTO coach_messages") && sql.includes("structured_payload")) {
      stored = JSON.parse(params.find((p: any) => typeof p === "string" && p.startsWith("{")) as string);
    }
    return { rows: [{ id: "owned-conversation" }] };
  });
});

const builderGoal = { ...unknown, activity: "plan_meals", explicitFeatureId: "meal_builders" };
function builderTurn(intent: string, message: string, extra: Record<string, any> = {}) {
  model({
    message, handoffMessage: message, navigationIntent: intent,
    conciergeDecision: { mode: "food_assistance", destinationId: "meal_builders", goal: builderGoal },
    ...extra,
  });
}

test.each(["development", "production"])("%s completes the original meal-prep conversation with actual builder actions", async environment => {
  process.env.NODE_ENV = environment;
  const history: Array<{ role: string; content: string }> = [];
  const turns = [
    ["Help me get started", "Would you like help planning meals, preparing a dish, or shopping?"],
    ["Meal prep", "Are you planning meals ahead, preparing a particular dish, or shopping for ingredients?"],
    ["Meal builder", "Use the Open Meal Builders button, then open your assigned builder."],
    ["Where is my builder?", "Use the Open Meal Builders button to reach your assigned builder."],
  ];
  for (const [index, [input, answer]] of turns.entries()) {
    (loadBoundedHistory as jest.Mock).mockResolvedValue({ recentMessages: [...history], rollingContext: null });
    if (index < 2) model({ message: answer, navigationIntent: "none", conciergeDecision: null,
      pendingNavigationDisposition: "clear" });
    else builderTurn("direct_request", answer);
    const result = await run(input);
    if (index < 2) expect(result.todayPlan.items).toEqual([]);
    else {
      expect(result.presentation?.navigation).toMatchObject({ state: "direct_navigation", destinationId: "meal_builders" });
      expect(result.presentation?.destinationId).toBe("meal_builders");
      expect(result.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId: "meal_builders" })]);
      expect(html(result)).toContain("Open meal_builders");
    }
    const wire = JSON.parse(mockCreate.mock.calls[index][0].messages[1].content);
    expect(wire.history).toEqual(history);
    history.push({ role: "user", content: input }, { role: "assistant", content: answer });
  }
});

test.each(["Meal builder", "Meal Builders", "Open Meal Builders", "Take me to my meal builder"])(
  "explicit named selection %s completes without an extra permission question", async input => {
    builderTurn("direct_request", "Use the Open Meal Builders button, then open your assigned builder.");
    expect((await run(input)).presentation?.navigation?.state).toBe("direct_navigation");
  },
);

test.each(["builder", "Meal prep", "Meal preparation", "Prepare meals for the week", "Build my meals", "Where is my builder?", "meal builderish"])(
  "%s cannot self-authorize a direct builder action without established context", async input => {
    expect(mentionsCoachDestination(input, "meal_builders", "development")).toBe(false);
    builderTurn("direct_request", "Meal Builders can hold dated meals. Would you like to use it?");
    expect((await run(input)).todayPlan.items).toEqual([]);
  },
);

test("a relevant informational reply preserves the original offer and its age until contextual confirmation", async () => {
  builderTurn("recommendation", "Meal Builders can hold dated meals. Would you like to use it?");
  const offer = await run("Help me plan meals ahead.");
  const offeredAt = offer.presentation?.navigation?.offeredAt;
  expect(offeredAt).toBeDefined();
  model({ message: "Your assigned builder holds meals for the dates you choose.", navigationIntent: "none",
    conciergeDecision: null, pendingNavigationDisposition: "preserve" });
  const info = await run("Can I choose different days?");
  expect(info.presentation?.navigation).toMatchObject({ state: "recommendation_pending", offeredAt });
  expect(info.todayPlan.items).toEqual([]);
  expect(html(info)).not.toContain("Open meal_builders");
  builderTurn("confirmed", "Use the Open Meal Builders button, then open your assigned builder.");
  const confirmed = await run("Where is my builder?");
  expect(confirmed.presentation?.navigation?.state).toBe("navigation_confirmed");
  expect(confirmed.todayPlan.items).toEqual([expect.objectContaining({ destinationId: "meal_builders" })]);
});

test.each(["No, cancel that.", "Let's talk about sleep instead."])(
  "clears the offer on rejection or unrelated intent: %s", async input => {
    builderTurn("recommendation", "Meal Builders can hold dated meals. Would you like to use it?");
    await run("Help me plan meals ahead.");
    model({ message: "We can leave meal planning aside.", navigationIntent: "none", conciergeDecision: null,
      pendingNavigationDisposition: "clear" });
    await run(input);
    expect(await loadPendingRecommendation("owned-conversation", "member")).toBeUndefined();
    builderTurn("confirmed", "Use the Open Meal Builders button.");
    expect((await run("Yes")).todayPlan.items).toEqual([]);
  },
);

test("changing destinations replaces the old offer rather than retaining its authority", async () => {
  builderTurn("recommendation", "Meal Builders can hold dated meals. Would you like to use it?");
  await run("Help me plan meals ahead.");
  model({ navigationIntent: "recommendation", recommendationMessage: invitation });
  await run("I'd rather plan dining for my cruise.");
  expect((await loadPendingRecommendation("owned-conversation", "member"))?.destinationId).toBe("my_perfect_getaway");
  builderTurn("confirmed", "Use the Open Meal Builders button.");
  expect((await run("Yes")).presentation?.destinationId).not.toBe("meal_builders");
});

test("expired or future-dated original offers cannot be revived by fresh informational timestamps", async () => {
  for (const offeredAt of [new Date(Date.now() - PENDING_NAVIGATION_TTL_MS - 1).toISOString(),
    new Date(Date.now() + 60_000).toISOString(), "invalid"]) {
    stored = { presentation: { navigation: { state: "recommendation_pending", destinationId: "meal_builders",
      goal: builderGoal, offeredAt } } };
    expect(await loadPendingRecommendation("owned-conversation", "member")).toBeUndefined();
  }
});

test("bare yes cannot confirm an already completed navigation", async () => {
  builderTurn("direct_request", "Use the Open Meal Builders button.");
  await run("Meal builder");
  stored.presentation.navigation.performedAt = new Date().toISOString();
  builderTurn("confirmed", "Use the Open Meal Builders button.");
  expect((await run("Yes")).todayPlan.items).toEqual([]);
});

test("a contextual builder reference cannot borrow another destination's recent authority", async () => {
  model({ navigationIntent: "recommendation", recommendationMessage: invitation });
  await run("Help me arrange cruise dining.");
  builderTurn("direct_request", "Meal Builders can hold dated meals. Would you like to use it?");
  const result = await run("Where is my builder?");
  expect(result.todayPlan.items).toEqual([]);
  expect(result.presentation?.navigation?.state).not.toBe("direct_navigation");
});

test("a named comparison or negation is not automatically treated as consent", async () => {
  model({ message: "We can compare the workflows without opening either.", navigationIntent: "none",
    conciergeDecision: null, pendingNavigationDisposition: "clear" });
  const result = await run("Do not open Meal Builder; how does it differ from My Perfect Menu?");
  expect(result.todayPlan.items).toEqual([]);
  expect(result.presentation?.navigation).toBeUndefined();
});

test("the single model call receives meal-prep distinctions without enabling experimental systems", async () => {
  model({ message: "Are you planning meals ahead, preparing a dish, or shopping?", navigationIntent: "none",
    conciergeDecision: null, pendingNavigationDisposition: "clear" });
  await run("Meal preparation");
  expect(mockCreate).toHaveBeenCalledTimes(1);
  const system = mockCreate.mock.calls[0][0].messages[0].content;
  expect(system).toContain("MEAL PREP CLARIFICATION");
  expect(system).toContain("Do not route generic meal prep to Grocery Coach without shopping intent");
  expect(system).toContain("Chef explains and directs; specialized tools create meals and plans");
  expect(JSON.parse(mockCreate.mock.calls[0][0].messages[1].content).platformKnowledge.source)
    .not.toBe("verified_feature_intelligence");
});

test("a care escalation clears an existing offer even when preservation is requested", async () => {
  builderTurn("recommendation", "Meal Builders can hold dated meals. Would you like to use it?");
  await run("Help me plan meals ahead.");
  builderTurn("confirmed", "Seek emergency care now.", { redFlag: true, contactCare: "Emergency care",
    careDisposition: "emergency", pendingNavigationDisposition: "preserve" });
  const result = await run("I have severe chest pain.");
  expect(result.meta.redFlag).toBe(true);
  expect(result.presentation?.navigation).toBeUndefined();
  expect(await loadPendingRecommendation("owned-conversation", "member")).toBeUndefined();
});
afterAll(() => { process.env.NODE_ENV = originalEnvironment; });
const run = (message: string) => engine.run({
  specialization: "corner", subject, userMessage: message, conversationId: "owned-conversation",
}, { authUser: { id: "member" }, id: "11111111-1111-4111-8111-111111111111" } as any);
const html = (response: any) => renderToStaticMarkup(React.createElement(CoachBubble, {
  structured: response, enableConcierge: true,
}));
function model(extra: Record<string, any> = {}) {
  const intent = extra.navigationIntent ?? "direct_request";
  mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
    // Existing navigation fixtures now put their complete offer in the canonical
    // field. Explicit malformed message overrides below remain untouched.
    message: extra.recommendationMessage ?? invitation,
    navigationIntent: "direct_request",
    memberNeed: intent === "recommendation" || intent === "none" ? "feature_help" : "navigation",
    responsePurpose: intent === "recommendation" ? "feature_only_offer" : intent === "none" ? "answer" : "handoff",
    // Also simulate a falsely explicit model goal; there is no named feature in
    // the actual member request, so neither field may self-authorize navigation.
    conciergeDecision: { mode: "food_assistance", destinationId: "my_perfect_getaway",
      goal: { ...travel, explicitFeatureId: "my_perfect_getaway" } },
    recommendationMessage: invitation, handoffMessage: guidance,
    conversationMessage: "Would you prefer exploring dining options or preparing food?",
    ...extra,
  }) } }] });
}

test.each(["Open Meal Builder", "Open Diabetic Meal Builder"])(
  "%s includes the assigned builder tutorial reminder without a sign-off", async input => {
    builderTurn("direct_request", "Opening your builder. If you need more help, feel free to ask!");
    const result = await run(input);
    expect(result.presentation?.destinationId).toBe("meal_builders");
    expect(result.presentation?.message).toContain("builder available to your account");
    expect(result.presentation?.message).toContain("Watch the Builder Tutorial video at the top of your builder");
    expect(result.presentation?.message).toContain("follow the builder's steps to create your meals");
    expect(result.presentation?.message).not.toMatch(/feel free|further assistance|any.*questions|Hub Tutorial/i);
    expect(result.todayPlan.items).toEqual([expect.objectContaining({ destinationId: "meal_builders" })]);
    expect(html(result).match(/<button/g)).toHaveLength(1);
    expect(stored.presentation).toEqual(result.presentation);
  },
);

test("every repeated builder handoff retains the tutorial reminder, including when other instructions are skipped", async () => {
  builderTurn("recommendation", "Meal Builders can help you plan your meals. Would you like to use it?");
  await run("Help me plan meals ahead.");
  for (const input of ["Yes.", "Open Meal Builder", "Open Meal Builder without instructions"]) {
    builderTurn(input === "Yes." ? "confirmed" : "direct_request", "Use the builder.");
    const result = await run(input);
    expect(result.presentation?.destinationId).toBe("meal_builders");
    expect(result.presentation?.message?.match(/Builder Tutorial/g)).toHaveLength(1);
    expect(result.presentation?.message).not.toMatch(/feel free|Would you like/i);
    expect(result.todayPlan.items).toHaveLength(1);
  }
});

test("Fridge Rescue handoff preserves brief ingredient instructions and omits model-authored closing filler", async () => {
  model({ message: "Enter your ingredients. If you have any more questions, feel free to ask!",
    handoffMessage: "If you need further assistance, feel free to ask!", navigationIntent: "none",
    conciergeDecision: null });
  const result = await run("I want to use Fridge Rescue");
  expect(result.presentation?.destinationId).toBe("fridge_rescue");
  expect(result.presentation?.message).toContain("Lifestyle → Fridge Rescue");
  expect(result.presentation?.message).toContain("Enter the ingredients you already have");
  expect(result.presentation?.message).not.toMatch(/feel free|further assistance|any.*questions/i);
  expect(html(result).match(/<button/g)).toHaveLength(1);
});

test("new handoff instructions and tutorial reminders leave released Production text unchanged", () => {
  process.env.NODE_ENV = "production";
  expect(verifiedNavigationText("fridge_rescue")).toBe("You can find it under Lifestyle → Fridge Rescue.");
  expect(verifiedNavigationText("meal_builders")).toBe("You can find it under Meal Builders. Choose the builder available to your account.");
  expect(verifiedNavigationText("meal_builders", false)).toBe("Use the Open Meal Builders button.");
});

test("Development engine loads expired context, persists a fresh offer, then confirms it on the next yes", async () => {
  const originalExecute = (db.execute as jest.Mock).getMockImplementation()!;
  (db.execute as jest.Mock).mockImplementation(async query => {
    const { sql } = new PgDialect().sqlToQuery(query);
    if (sql.includes("SELECT m.role")) return { rows: stored ? [{
      role: "assistant", content: stored.presentation.message,
      structured_payload: stored, created_at: new Date(),
    }] : [] };
    return originalExecute(query);
  });
  stored = { presentation: { kind: "concierge", message: "Would you like to use Fridge Rescue?",
    navigation: { state: "recommendation_pending", destinationId: "fridge_rescue",
      offeredAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      goal: { ...unknown, activity: "use_ingredients" } } } };
  model({ navigationIntent: "none", conciergeDecision: null,
    message: ": If you need further assistance or have any other questions, feel free to ask!" });
  const renewed = await run("Yes.");
  expect(renewed.presentation?.navigation?.state).toBe("recommendation_pending");
  expect(stored.presentation.navigation).toEqual(renewed.presentation?.navigation);
  expect(html(renewed)).not.toContain("<button");
  model({ navigationIntent: "none", conciergeDecision: null, message: "Happy to help!" });
  const confirmed = await run("Yes.");
  expect(confirmed.presentation?.navigation?.state).toBe("navigation_confirmed");
  expect(stored.presentation.destinationId).toBe("fridge_rescue");
  expect(html(confirmed).match(/<button/g)).toHaveLength(1);
});

describe("initial ingredient-help response contract", () => {
  const input = "I have a bunch of food in my refrigerator and don't know what to make.";
  const filler = ": If you need further assistance or have any other questions, feel free to ask!";
  const explanation = "Fridge Rescue helps you make a meal using ingredients you already have.";
  const offer = `${explanation} Would you like to open Fridge Rescue?`;
  const goal = { ...unknown, activity: "use_ingredients" };
  const decision = { mode: "food_assistance", destinationId: "fridge_rescue", goal };
  const histories = [
    [],
    [{ role: "user", content: "What does fiber do?" },
      { role: "assistant", content: "Fiber supports digestion." }],
  ];
  function recommend(message: string, extra: Record<string, unknown> = {}) {
    model({ message, conversationMessage: null, handoffMessage: null,
      recommendationMessage: null, navigationIntent: "recommendation",
      memberNeed: "feature_help", responsePurpose: "feature_only_offer",
      conciergeDecision: decision, careDisposition: "none", ...extra });
  }
  function assertNoAction(result: any) {
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
    expect(html(result)).not.toContain("<button");
  }

  test.each(histories.map(history => [history]))(
    "persists the initial offer and immediate Yes as a complete action with history %#", async history => {
      (loadBoundedHistory as jest.Mock).mockResolvedValue({ recentMessages: history, rollingContext: null });
      expect(isNavigationFailureComplaint(input)).toBe(false);
      expect(acceptsPendingFeature(input)).toBe(false);
      expect(isUnambiguousChefClosing(input)).toBe(false);
      recommend(offer);
      const initial = await run(input);
      expect(initial.presentation?.message).toContain(explanation);
      expect(initial.presentation?.message).toMatch(/Would you like/);
      expect(initial.presentation?.navigation).toMatchObject({
        state: "recommendation_pending", destinationId: "fridge_rescue", goal,
      });
      expect(initial.presentation?.destinationId).toBeUndefined();
      expect(initial.todayPlan.items).toEqual([]);
      expect(html(initial)).not.toContain("<button");
      expect(stored.presentation.navigation).toEqual(initial.presentation?.navigation);
      expect(await loadPendingRecommendation("owned-conversation", "member")).toEqual(initial.presentation?.navigation);
      const modelInput = JSON.parse(mockCreate.mock.calls[0][0].messages[1].content);
      expect(modelInput.latestMemberMessage).toBe(input);
      expect(modelInput.history).toEqual(history);
      expect(modelInput.pendingRecommendation).toBeNull();
      expect(modelInput).not.toHaveProperty("navigationRecoveryContext");
      // Even poor model wording cannot lose an authorized acceptance.
      model({ message: filler, conversationMessage: null, navigationIntent: "none",
        conciergeDecision: null, careDisposition: "none" });
      const confirmed = await run("Yes.");
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(confirmed.presentation?.navigation).toMatchObject({
        state: "navigation_confirmed", destinationId: "fridge_rescue", goal,
      });
      expect(confirmed.presentation?.destinationId).toBe("fridge_rescue");
      expect(confirmed.presentation?.message).toBe(verifiedNavigationText("fridge_rescue"));
      expect(confirmed.presentation?.message).not.toMatch(/^:|feel free|Would you like/i);
      expect(confirmed.todayPlan.items).toEqual([expect.objectContaining({
        kind: "use_feature", destinationId: "fridge_rescue", featureTarget: "fridge_rescue",
      })]);
      expect(stored.presentation).toEqual(confirmed.presentation);
      expect(html(confirmed).match(/<button/g)).toHaveLength(1);
    },
  );

  test.each([explanation, filler])("repairs only wording backed by a validated recommendation: %s", async message => {
    recommend(message);
    const initial = await run(input);
    expect(initial.presentation?.message).toMatch(/Fridge Rescue.*Would you like/s);
    expect(initial.presentation?.message).not.toMatch(/^:|feel free/i);
    if (message === explanation) expect(initial.presentation?.message).toContain(explanation);
    expect(initial.presentation?.navigation?.state).toBe("recommendation_pending");
    expect(initial.todayPlan.items).toEqual([]);
    expect(stored.presentation.navigation.destinationId).toBe("fridge_rescue");
  });

  test.each(histories.map(history => [history]))(
    "rejects filler in canonical and fallback fields without inventing state with history %#", async history => {
      (loadBoundedHistory as jest.Mock).mockResolvedValue({ recentMessages: history, rollingContext: null });
      for (const responsePurpose of ["answer", "handoff"]) {
        model({ message: filler, conversationMessage: filler, responsePurpose,
          memberNeed: "feature_help", navigationIntent: "none", conciergeDecision: null });
        const result = await run(input);
        assertNoAction(result);
        expect(result.presentation?.message).toContain("Please try your request again");
        expect(result.presentation?.message).not.toMatch(/^:|feel free/i);
        expect(stored.presentation).toEqual(result.presentation);
      }
    },
  );

  test("feature prose without structured authority cannot create a pending offer", async () => {
    model({ message: explanation, conversationMessage: null, navigationIntent: "none", conciergeDecision: null });
    const initial = await run(input);
    assertNoAction(initial);
    expect(initial.presentation?.message).toBe(explanation);
    model({ message: filler, conversationMessage: null, navigationIntent: "confirmed", conciergeDecision: null });
    assertNoAction(await run("Yes."));
  });

  test.each([
    ["invalid goal", { conciergeDecision: { ...decision, goal: unknown } }],
    ["unrelated destination", { conciergeDecision: { ...decision, destinationId: "beverage_creator" } }],
    ["unsafe URL", { message: "Use https://example.test to continue." }],
    ["premature opening claim", { message: "Opening Fridge Rescue now." }],
  ])("wording repair does not bypass %s", async (_name, extra) => {
    recommend(explanation, extra as Record<string, unknown>);
    assertNoAction(await run(input));
    expect(stored.presentation.navigation).toBeUndefined();
  });

  test("unavailable subscription tools cannot be offered or confirmed", async () => {
    const adapter = (getAdapter as jest.Mock)();
    adapter.availableTools = adapter.availableTools.filter((tool: any) => tool.id !== "fridge_rescue");
    recommend(explanation);
    assertNoAction(await run(input));
    // Access can also change after a valid offer was stored.
    stored = { presentation: { kind: "concierge", message: offer, navigation: {
      state: "recommendation_pending", destinationId: "fridge_rescue", goal,
      offeredAt: new Date().toISOString(),
    } } };
    model({ message: filler, conversationMessage: null, navigationIntent: "none", conciergeDecision: null });
    assertNoAction(await run("Yes."));
  });

  test("care escalation wins over an otherwise ready recommendation", async () => {
    recommend(explanation, { redFlag: true, careDisposition: "emergency",
      contactCare: "Seek emergency care now." });
    const result = await run(input);
    expect(result.meta.redFlag).toBe(true);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items.some(item => item.kind === "use_feature")).toBe(false);
  });

  test("quality screening is whole-message and Development-only", () => {
    for (const text of [filler, filler.slice(2), "Feel free to ask!", "Let me know if you need anything else."]) {
      expect(fallbackQuality(text)).toBe("empty_closing");
      expect(screenOrdinaryConversation(text).reason).toBe("empty_closing");
      expect(screenConversationalContinuation(text).reason).toBe("empty_closing");
      expect(selectRejectedConversation({ message: text, conversationMessage: text },
        value => screenConversationalContinuation(value).text).text).toBeUndefined();
      expect(screenOrdinaryConversation(text, "production").text).toBe(text);
    }
    const substantive = "Fiber supports digestion. Feel free to ask!";
    expect(screenOrdinaryConversation(substantive).text).toBe(substantive);
    expect(screenOrdinaryConversation("You're welcome. Take care!").text).toBeDefined();
    expect(getChefConversationInstructions("development")).toContain("INITIAL ACTIVITY HELP:");
    expect(getChefConversationInstructions("production")).not.toContain("INITIAL ACTIVITY HELP:");
  });

  test("Production does not activate the new wording repair or filler rejection", async () => {
    process.env.NODE_ENV = "production";
    recommend(explanation);
    const initial = await run(input);
    assertNoAction(initial);
    expect(initial.presentation?.message).toBe(explanation);
    model({ message: filler, conversationMessage: null, navigationIntent: "none", conciergeDecision: null });
    expect((await run(input)).presentation?.message).toBe(filler);
  });
});

const shoppingWorkflows = [
  {
    id: "grocery_find_product", activity: "find_product",
    question: "What tomato sauce should I buy?",
    proposal: "Grocery Coach's Find a Product uses your nutrition profile to find three suitable options. Would you like to use it?",
    handoff: "Shopping List opens first. Select Grocery Store Coach, then Find a Product, and enter your request there.",
    direct: "Open Find a Product.",
  },
  {
    id: "product_scan", activity: "evaluate_product",
    question: "Can I scan this Ragu sauce to see whether it's good for me?",
    proposal: "Product Scan evaluates the actual product against your profile and can offer three alternatives. Would you like to use it?",
    handoff: "Shopping List opens first. Select Product Scan and capture the product you want evaluated.",
    direct: "Open Product Scan.",
  },
  {
    id: "grocery_create_meal", activity: "shop_for_meal",
    question: "I don't know what to eat for dinner. Can you help me shop?",
    proposal: "Grocery Coach's Create a Meal helps choose a meal and creates its grocery list. Would you like to use it?",
    handoff: "Shopping List opens first. Select Grocery Store Coach, then Build a Meal, and request your meal there.",
    direct: "Open Grocery Store Coach > Create a Meal.",
  },
];

test.each(shoppingWorkflows)("$id: recommend, persist, then confirm the same workflow without another AI pass", async workflow => {
  model({ message: workflow.proposal, navigationIntent: "recommendation",
    conciergeDecision: { mode: "food_assistance", destinationId: workflow.id,
      goal: { ...unknown, activity: workflow.activity } },
    recommendationMessage: workflow.proposal, handoffMessage: workflow.handoff });
  const first = await run(workflow.question);
  expect(first.presentation?.navigation).toMatchObject({
    state: "recommendation_pending", destinationId: workflow.id, goal: { activity: workflow.activity },
  });
  expect(first.todayPlan.items).toHaveLength(0);
  model({ message: workflow.handoff, navigationIntent: "confirmed", conciergeDecision: null,
    handoffMessage: workflow.handoff });
  const confirmed = await run("Yes, please.");
  expect(confirmed.presentation?.destinationId).toBe(workflow.id);
  expect(confirmed.presentation?.message).toBe(verifiedNavigationText(workflow.id));
  expect(confirmed.todayPlan.items).toHaveLength(1);
  expect(confirmed.todayPlan.items[0].destinationId).toBe(workflow.id);
  expect(mockCreate).toHaveBeenCalledTimes(2);
  const wire = mockCreate.mock.calls[0][0];
  const data = JSON.parse(wire.messages[1].content);
  expect(data.availableFeatures.some((feature: any) => feature.id === workflow.id)).toBe(true);
  expect(wire.messages[0].content).toContain("Interpret the intended outcome");
  expect(wire.messages[0].content).toContain("not this chat");
});

test.each(shoppingWorkflows.flatMap(workflow => workflow.id === "grocery_create_meal"
  ? [workflow, { ...workflow, direct: "Open Grocery Store Coach > Build a Meal." }] : [workflow]))("$id: explicit named request can navigate immediately", async workflow => {
  model({ message: workflow.handoff, navigationIntent: "direct_request",
    conciergeDecision: { mode: "food_assistance", destinationId: workflow.id,
      goal: { ...unknown, activity: workflow.activity, explicitFeatureId: workflow.id } },
    handoffMessage: workflow.handoff });
  const response = await run(workflow.direct);
  expect(response.presentation?.destinationId).toBe(workflow.id);
  expect(response.todayPlan.items).toHaveLength(1);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test.each(shoppingWorkflows)("$id: declining clears the offer and a later Yes cannot resurrect it", async workflow => {
  model({ message: workflow.proposal, navigationIntent: "recommendation",
    conciergeDecision: { mode: "food_assistance", destinationId: workflow.id,
      goal: { ...unknown, activity: workflow.activity } },
    recommendationMessage: workflow.proposal, handoffMessage: workflow.handoff });
  await run(workflow.question);
  model({ message: "We can keep talking about what you need.", navigationIntent: "none", conciergeDecision: null });
  const declined = await run("No thanks, I'd rather keep talking.");
  expect(declined.presentation?.navigation).toBeUndefined();
  expect(declined.todayPlan.items).toHaveLength(0);
  model({ message: "What would you like help with?", navigationIntent: "confirmed", conciergeDecision: null });
  const stale = await run("Yes.");
  expect(stale.presentation?.destinationId).toBeUndefined();
  expect(stale.todayPlan.items).toHaveLength(0);
});

test("a falsely explicit shopping request cannot skip consent", async () => {
  const workflow = shoppingWorkflows[0];
  model({ message: workflow.proposal, navigationIntent: "direct_request",
    conciergeDecision: { mode: "food_assistance", destinationId: workflow.id,
      goal: { ...unknown, activity: workflow.activity, explicitFeatureId: workflow.id } },
    recommendationMessage: workflow.proposal, handoffMessage: workflow.handoff });
  const response = await run(workflow.question);
  expect(response.presentation?.destinationId).toBeUndefined();
  expect(response.presentation?.navigation?.destinationId).toBe(workflow.id);
  expect(response.todayPlan.items).toHaveLength(0);
});

test.each(shoppingWorkflows)("$id: a different shopping task cannot authorize this workflow", async workflow => {
  const other = shoppingWorkflows.find(candidate => candidate.id !== workflow.id)!;
  model({ message: workflow.proposal, navigationIntent: "recommendation",
    conciergeDecision: { mode: "food_assistance", destinationId: workflow.id,
      goal: { ...unknown, activity: other.activity } },
    recommendationMessage: workflow.proposal, handoffMessage: workflow.handoff });
  const response = await run(other.question);
  expect(response.presentation?.destinationId).toBeUndefined();
  expect(response.presentation?.navigation).toBeUndefined();
  expect(response.todayPlan.items).toHaveLength(0);
});

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
    message: verifiedNavigationText("my_perfect_getaway"), destinationId: "my_perfect_getaway",
    navigation: { state: "navigation_confirmed" },
  });
  expect(html(second)).toContain("<button");
  expect(html(second)).toContain("Open my_perfect_getaway");
  expect(html(second)).not.toContain(invitation);
  const payload = JSON.parse(mockCreate.mock.calls[1][0].messages[1].content);
  expect(payload.pendingRecommendation.destinationId).toBe("my_perfect_getaway");
  expect(payload.platformKnowledge.featureUsage.my_perfect_getaway.descriptionInput).toContain("Search");
  expect(mockCreate).toHaveBeenCalledTimes(2);
  expect(await loadPendingRecommendation("owned-conversation", "member"))
    .toMatchObject({ state: "navigation_confirmed", destinationId: "my_perfect_getaway" });
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
  expect(result.presentation?.message).toBe(verifiedNavigationText("dessert_creator"));
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
  expect(second.presentation?.message).toBe(verifiedNavigationText("find_meals_near_me"));
  expect(html(second)).toContain("<button");
  expect(COACH_DESTINATIONS.find_meals_near_me.route).toBe("/social-hub/find");
  expect(COACH_DESTINATIONS.find_meals_near_me.access).toBe("pro");
});

test.each(["development", "production"])(
  "%s: the four-turn small ice-cream sequence persists a Craving recommendation and confirms on the first yes", async environment => {
    process.env.NODE_ENV = environment;
    const history: Array<{ role: string; content: string }> = [];
    const turns = [
      { input: "I want some ice cream.", output: {
        message: "Are you looking to buy some ice cream from the store, or are you interested in making your own ice cream at home?",
        navigationIntent: "none", conciergeDecision: null,
      } },
      { input: "make it myself", output: {
        message: "You can use Craving Creator for a small portion or Dessert Creator for a larger batch. Would you like a small portion or larger dessert recipe?",
        navigationIntent: "none", conciergeDecision: null,
      } },
      { input: "small", output: {
        message: cravingQuestion, navigationIntent: "recommendation", recommendationMessage: cravingQuestion,
        conciergeDecision: { mode: "food_assistance", destinationId: "craving_creator", goal: craving },
      } },
      { input: "yes", output: {
        message: cravingHandoff, handoffMessage: cravingHandoff,
        navigationIntent: "confirmed", conciergeDecision: null,
      } },
    ];
    for (const [index, turn] of turns.entries()) {
      (loadBoundedHistory as jest.Mock).mockResolvedValue({ recentMessages: [...history], rollingContext: null });
      model({ conversationMessage: null, recommendationMessage: null, handoffMessage: null, ...turn.output });
      const response = await run(turn.input);
      expect(response.meta.redFlag).toBe(false);
      const wire = JSON.parse(mockCreate.mock.calls[index][0].messages[1].content);
      expect(wire.latestMemberMessage).toBe(turn.input);
      expect(wire.history).toEqual(history);
      if (index < 2) {
        expect(response.presentation?.navigation).toBeUndefined();
        expect(html(response)).not.toContain("<button");
      } else if (index === 2) {
        expect(response.presentation?.navigation).toMatchObject({
          state: "recommendation_pending", destinationId: "craving_creator", goal: craving,
        });
        expect(stored.presentation.navigation.destinationId).toBe("craving_creator");
        expect(await loadPendingRecommendation("owned-conversation", "member"))
          .toMatchObject({ state: "recommendation_pending", destinationId: "craving_creator" });
        expect(html(response)).not.toContain("<button");
      } else {
        expect(wire.pendingRecommendation).toMatchObject({
          state: "recommendation_pending", destinationId: "craving_creator",
        });
        expect(response.presentation?.navigation?.state).toBe("navigation_confirmed");
        expect(response.presentation?.destinationId).toBe("craving_creator");
        expect(response.todayPlan.items).toEqual([expect.objectContaining({
          kind: "use_feature", destinationId: "craving_creator", featureTarget: "craving_creator",
        })]);
        expect(response.presentation?.message).toBe(verifiedNavigationText("craving_creator"));
        expect(html(response).match(/<button/g)).toHaveLength(1);
        expect(html(response)).toContain("Open craving_creator");
        expect(stored.presentation.navigation.state).toBe("navigation_confirmed");
        expect(await loadPendingRecommendation("owned-conversation", "member"))
          .toMatchObject({ state: "navigation_confirmed", destinationId: "craving_creator" });
      }
      history.push({ role: "user", content: turn.input },
        { role: "assistant", content: response.presentation?.message ?? "" });
    }
    expect(mockCreate).toHaveBeenCalledTimes(4);
  });

test.each([
  { recommendationMessage: undefined, destinationId: "craving_creator", navigationIntent: "recommendation" },
  { recommendationMessage: null, destinationId: "craving_creator", navigationIntent: "recommendation" },
  { recommendationMessage: null, destinationId: null, navigationIntent: "recommendation" },
])("ready structured craving goals recover omitted recommendation variants without early consent: %j", async variant => {
  model({ navigationIntent: variant.navigationIntent, message: cravingQuestion,
    recommendationMessage: variant.recommendationMessage, conversationMessage: null,
    conciergeDecision: { mode: "food_assistance", destinationId: variant.destinationId, goal: craving } });
  const offer = await run("I want to make a small portion of ice cream.");
  expect(offer.presentation?.message).toBe(cravingQuestion);
  expect(offer.presentation?.navigation).toMatchObject({
    state: "recommendation_pending", destinationId: "craving_creator",
  });
  expect(offer.presentation?.destinationId).toBeUndefined();
  expect(html(offer)).not.toContain("<button");
  model({ navigationIntent: "confirmed", conciergeDecision: null, handoffMessage: null,
    message: cravingHandoff, recommendationMessage: null });
  const confirmed = await run("yes");
  expect(confirmed.presentation?.destinationId).toBe("craving_creator");
  expect(confirmed.presentation?.navigation?.state).toBe("navigation_confirmed");
  expect(confirmed.todayPlan.items[0]).toMatchObject({ kind: "use_feature", destinationId: "craving_creator" });
  expect(html(confirmed).match(/<button/g)).toHaveLength(1);
});

test.each([undefined, null])(
  "naming Craving Creator without any structured decision cannot manufacture a pending recommendation: %s", async decision => {
    model({ navigationIntent: "recommendation", conciergeDecision: decision,
      message: cravingQuestion, recommendationMessage: cravingQuestion, conversationMessage: null });
    const response = await run("small");
    expect(response.presentation?.message).not.toBe(cravingQuestion);
    expect(response.presentation?.navigation).toBeUndefined();
    expect(response.presentation?.destinationId).toBeUndefined();
    expect(await loadPendingRecommendation("owned-conversation", "member")).toBeUndefined();
    model({ navigationIntent: "confirmed", conciergeDecision: null,
      message: "What would you like help with?", handoffMessage: cravingHandoff });
    const unboundYes = await run("yes");
    expect(unboundYes.presentation?.destinationId).toBeUndefined();
    expect(html(unboundYes)).not.toContain("<button");
  });

test("a Craving label cannot override incompatible goal metadata", async () => {
  model({ navigationIntent: "recommendation", message: cravingQuestion,
    recommendationMessage: cravingQuestion, conversationMessage: null,
    conciergeDecision: { mode: "food_assistance", destinationId: "craving_creator", goal: dessert } });
  const response = await run("small");
  expect(response.presentation?.navigation).toBeUndefined();
  expect(response.presentation?.destinationId).toBeUndefined();
  expect(html(response)).not.toContain("<button");
});

test("Craving confirmation recovery cannot bypass newly revoked access", async () => {
  model({ navigationIntent: "recommendation", message: cravingQuestion, recommendationMessage: cravingQuestion,
    conciergeDecision: { mode: "food_assistance", destinationId: "craving_creator", goal: craving } });
  await run("Help me make a small portion of ice cream.");
  (getAdapter as jest.Mock)().availableTools = [];
  model({ navigationIntent: "confirmed", conciergeDecision: null, handoffMessage: null,
    message: cravingHandoff, conversationMessage: "This feature is not available in your current access." });
  expect(html(await run("yes"))).not.toContain("<button");
});

test("an emergency after a Craving offer clears the offer before model confirmation or rendering", async () => {
  model({ navigationIntent: "recommendation", message: cravingQuestion, recommendationMessage: cravingQuestion,
    conciergeDecision: { mode: "food_assistance", destinationId: "craving_creator", goal: craving } });
  await run("Help me make a small portion of ice cream.");
  const response = await run("yes, but I have chest pain");
  expect(response.meta.redFlag).toBe(true);
  expect(response.presentation?.destinationId).toBeUndefined();
  expect(html(response)).not.toContain("<button");
  expect(await loadPendingRecommendation("owned-conversation", "member")).toBeUndefined();
  expect(mockCreate).toHaveBeenCalledTimes(1);
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

test("confirmed consent survives a missing handoff variant using verified starting instructions", async () => {
  model(); await run(request);
  model({ navigationIntent: "confirmed", handoffMessage: null });
  const result = await run("Yes.");
  expect(html(result)).toContain("<button");
  expect(result.presentation?.navigation?.state).toBe("navigation_confirmed");
  expect(result.presentation?.message).toBe(verifiedNavigationText("my_perfect_getaway"));
});

test("a repeated recommendation pitch is replaced with verified guidance after consent", async () => {
  model(); await run(request);
  model({ navigationIntent: "confirmed", handoffMessage: invitation });
  const result = await run("Yes.");
  expect(html(result)).toContain("<button");
  expect(result.presentation?.message).not.toContain(invitation);
  expect(result.presentation?.message).toBe(verifiedNavigationText("my_perfect_getaway"));
});

test.each(["development", "production"])(
  "%s: restaurant permission question persists atomically and one yes renders exactly one button", async environment => {
    process.env.NODE_ENV = environment;
    const question = "I can help explore nearby restaurants. Would you like me to assist you in discovering options?";
    const goal = { ...unknown, activity: "eat_out", restaurant: "not_chosen" };
    model({ navigationIntent: "recommendation",
      conciergeDecision: { mode: "food_assistance", destinationId: "find_meals_near_me", goal },
      recommendationMessage: question });
    const offer = await run("I wanna go to a restaurant to get ice cream.");
    expect(offer.presentation?.message).toBe(question);
    expect(offer.presentation?.navigation?.state).toBe("recommendation_pending");
    expect(stored.presentation.navigation.destinationId).toBe("find_meals_near_me");
    expect(html(offer)).not.toContain("<button");
    model({ navigationIntent: "confirmed", conciergeDecision: null, handoffMessage: null,
      recommendationMessage: question, message: "Would you like to proceed with finding some options?",
      conversationMessage: ":)" });
    const confirmed = await run("yes");
    expect(confirmed.presentation?.navigation?.state).toBe("navigation_confirmed");
    expect(confirmed.presentation?.destinationId).toBe("find_meals_near_me");
    expect(confirmed.presentation?.message).toBe(verifiedNavigationText("find_meals_near_me"));
    expect(confirmed.presentation?.message).not.toMatch(/[?？؟]/u);
    expect(html(confirmed).match(/<button/g)).toHaveLength(1);
    expect(confirmed.meta.redFlag).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    // Only observed navigation, not offering the action, consumes it.
    stored.presentation.navigation.performedAt = new Date().toISOString();
    model({ navigationIntent: "confirmed", conciergeDecision: null, message: "What would you like help with?" });
    expect((await run("yes")).presentation?.destinationId).toBeUndefined();
  });

test.each([
  "Would you like to open Find Meals Near Me?",
  "Would you like me to navigate to Find Meals Near Me?",
  "Would you like to use Find Meals Near Me?",
])("unstructured permission questions cannot be displayed or persisted as confirmable offers: %s", async message => {
  model({ navigationIntent: "none", conciergeDecision: null, message, conversationMessage: null });
  const response = await run("I wanna go to a restaurant to get ice cream.");
  expect(response.presentation?.message).not.toBe(message);
  expect(response.presentation?.navigation).toBeUndefined();
  expect(response.presentation?.destinationId).toBeUndefined();
  expect(stored.presentation.navigation).toBeUndefined();
  model({ navigationIntent: "confirmed", conciergeDecision: null, message: "What would you like help with?" });
  expect(html(await run("yes"))).not.toContain("<button");
});

// These used to be rejected merely for "assist" or "proceed". Conversational
// assistance is not navigation permission and must never create a pending action.
test.each([
  "Would you like me to assist you in discovering nearby restaurants?",
  "Would you like to proceed with finding some options?",
])("keeps general conversational help without granting navigation: %s", async message => {
  model({ navigationIntent: "none", conciergeDecision: null, message, conversationMessage: null });
  const response = await run("I wanna go to a restaurant to get ice cream.");
  expect(response.presentation?.message).toBe(message);
  expect(stored.presentation.message).toBe(message);
  expect(response.presentation?.navigation).toBeUndefined();
  expect(response.presentation?.destinationId).toBeUndefined();
  expect(response.todayPlan.items).toEqual([]);
  expect(stored.presentation.navigation).toBeUndefined();
});

test("a recommendation intent without its decision cannot display an unconfirmable permission question", async () => {
  model({ navigationIntent: "recommendation", conciergeDecision: null,
    message: "Would you like to use Find Meals Near Me?", conversationMessage: null });
  const response = await run("Help me find somewhere nearby.");
  expect(response.meta.concierge?.rendering).toBe("retry");
  expect(response.presentation?.navigation).toBeUndefined();
});

test.each([null, ":)", "Would you like to proceed?"])(
  "unusable confirmed handoff %s cannot trigger another permission cycle", async handoffMessage => {
    model(); await run(request);
    model({ navigationIntent: "confirmed", conciergeDecision: null, handoffMessage,
      message: "Would you like to proceed?", conversationMessage: null });
    const result = await run("Yes.");
    expect(result.presentation?.navigation?.state).toBe("navigation_confirmed");
    expect(result.presentation?.message).toBe(verifiedNavigationText("my_perfect_getaway"));
    expect(html(result).match(/<button/g)).toHaveLength(1);
  });

test.each([
  undefined,
  { presentation: { navigation: { state: "recommendation_pending", destinationId: "unapproved", goal: travel } } },
  { presentation: { navigation: { state: "recommendation_pending", destinationId: "my_perfect_getaway", goal: {} } } },
  { presentation: { navigation: { state: "navigation_confirmed", destinationId: "my_perfect_getaway", goal: travel,
    performedAt: new Date().toISOString() } } },
])("missing, invalid and consumed pending records cannot obtain a fallback-authorized button: %j", async record => {
  stored = record;
  model({ navigationIntent: "confirmed", conciergeDecision: null, handoffMessage: null,
    message: "What would you like help with?", conversationMessage: null });
  const result = await run("yes");
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(html(result)).not.toContain("<button");
});

test("handoff recovery cannot bypass access revoked since the recommendation", async () => {
  model(); await run(request);
  (getAdapter as jest.Mock)().availableTools = [];
  model({ navigationIntent: "confirmed", conciergeDecision: null, handoffMessage: null,
    message: "Would you like to proceed?", conversationMessage: "This feature is not available in your current access." });
  const result = await run("yes");
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.presentation?.navigation).toBeUndefined();
  expect(html(result)).not.toContain("<button");
});

test("a confirmed destination without reviewed control guidance uses only its existing button label", async () => {
  model({ navigationIntent: "recommendation", conciergeDecision: {
    mode: "food_assistance", destinationId: "sushi_creator",
    goal: { ...unknown, activity: "prepare", specialty: "sushi" },
  }, recommendationMessage: "Would you like to use Sushi Creator?" });
  await run("Help me make sushi.");
  model({ navigationIntent: "confirmed", conciergeDecision: null,
    handoffMessage: null, message: ":)", conversationMessage: null });
  const result = await run("yes");
  expect(result.presentation?.destinationId).toBe("sushi_creator");
  expect(result.presentation?.message).toBe(verifiedNavigationText("sushi_creator"));
  expect(html(result).match(/<button/g)).toHaveLength(1);
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

test("ordinary conversation needs neither navigation wording variant nor a rejection continuation", async () => {
  const message = "My Perfect Getaway helps explore travel dining; its menus may not be current.";
  model({ navigationIntent: "none", conciergeDecision: null, message,
    recommendationMessage: null, handoffMessage: null, conversationMessage: null });
  const result = await run("What does My Perfect Getaway do?");
  expect(result.presentation?.message).toBe(message);
  expect(result.meta.concierge?.rendering).toBe("primary");
  expect(html(result)).not.toContain("<button");
});

test("missing dedicated recommendation uses the canonical message without a button", async () => {
  model({ navigationIntent: "recommendation", recommendationMessage: null, handoffMessage: null,
    message: invitation });
  const result = await run(request);
  expect(result.presentation?.message).toBe(invitation);
  expect(stored.presentation.navigation.state).toBe("recommendation_pending");
  expect(result.todayPlan.items).toEqual([]);
  expect(html(result)).not.toContain("<button");
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test("a feature-naming independent explanation survives missing recommendation wording", async () => {
  const message = "My Perfect Getaway helps explore cruise dining, but current menus may differ.";
  model({ message: null, recommendationMessage: null, handoffMessage: null, conversationMessage: message });
  const result = await run(request);
  expect(result.presentation?.message).toBe(message);
  expect(result.presentation?.navigation).toBeUndefined();
  expect(result.meta.concierge?.rendering).toBe("primary");
  expect(html(result)).not.toContain("<button");
});

test("ordinary conversation can recover a feature-naming continuation without creating pending state", async () => {
  const message = "My Perfect Getaway is for exploring travel dining.";
  model({ message: " ", conversationMessage: message, navigationIntent: "none",
    conciergeDecision: null, recommendationMessage: null, handoffMessage: null });
  const result = await run("What is Getaway?");
  expect(result.presentation?.message).toBe(message);
  expect(result.presentation?.navigation).toBeUndefined();
  expect(html(result)).not.toContain("<button");
});

test("a false initial confirmed label can recover a proposal, never confirmation", async () => {
  model({ navigationIntent: "confirmed", recommendationMessage: null, message: invitation });
  const result = await run(request);
  expect(result.presentation?.navigation?.state).toBe("recommendation_pending");
  expect(html(result)).not.toContain("<button");
});

test("missing handoff uses verified instructions even when no safe model continuation exists", async () => {
  model(); await run(request);
  model({ navigationIntent: "confirmed", handoffMessage: null,
    conversationMessage: "Open My Perfect Getaway now." });
  const result = await run("Yes.");
  expect(result.meta.concierge?.rendering).toBe("primary");
  expect(html(result)).toContain("<button");
  expect(result.presentation?.message).toBe(verifiedNavigationText("my_perfect_getaway"));
  expect(await loadPendingRecommendation("owned-conversation", "member"))
    .toMatchObject({ state: "navigation_confirmed", destinationId: "my_perfect_getaway" });
});

test("a named direct request supplies verified instructions even without model handoff wording", async () => {
  const message = "My Perfect Getaway supports travel dining exploration.";
  model({ handoffMessage: null, conversationMessage: message });
  const result = await run("Open My Perfect Getaway.");
  expect(result.presentation?.message).toBe(verifiedNavigationText("my_perfect_getaway"));
  expect(result.presentation?.destinationId).toBe("my_perfect_getaway");
  expect(html(result)).toContain("<button");
});

test("a new named destination uses verified guidance without resurrecting the old offer", async () => {
  model(); await run(request);
  model({ navigationIntent: "direct_request", handoffMessage: null,
    conciergeDecision: { mode: "food_assistance", destinationId: "dessert_creator",
      goal: { ...dessert, explicitFeatureId: "dessert_creator" } },
    conversationMessage: "Open Dessert Creator now." });
  const result = await run("Open Dessert Creator.");
  expect(result.presentation?.navigation).toMatchObject({ state: "direct_navigation", destinationId: "dessert_creator" });
  expect(await loadPendingRecommendation("owned-conversation", "member"))
    .toMatchObject({ state: "direct_navigation", destinationId: "dessert_creator" });
  expect(html(result)).toContain("<button");
});

test("an invalid destination preserves conversation without restoring an invalid action", async () => {
  model({ conciergeDecision: { mode: "food_assistance", destinationId: "unregistered_destination", goal: travel },
    conversationMessage: "Which kind of dining experience interests you?" });
  const result = await run(request);
  expect(result.presentation?.message).toBe("Which kind of dining experience interests you?");
  expect(result.presentation?.navigation).toBeUndefined();
  expect(html(result)).not.toContain("<button");
});

test("diagnostics retain rejection reasons and correlation, never private text or model errors", async () => {
  const info = jest.spyOn(console, "info").mockImplementation(() => {});
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    model({ message: null, recommendationMessage: null, handoffMessage: null,
      conversationMessage: "My Perfect Getaway supports travel dining exploration." });
    await run("PRIVATE_MEMBER_TEXT");
    model({ conciergeDecision: { mode: "food_assistance", destinationId: "unregistered_destination", goal: travel },
      conversationMessage: "Open My Perfect Getaway now." });
    await run("PRIVATE_MEMBER_TEXT");
    mockCreate.mockRejectedValueOnce(Object.assign(new Error("PRIVATE_PROVIDER_TEXT"), { status: 429 }));
    await run("PRIVATE_MEMBER_TEXT");
    const logs = [...info.mock.calls, ...warn.mock.calls].flat().join("\n");
    expect(logs).toContain("reason=missing_recommendation_wording");
    expect(logs).toContain("decision_outcome=invalid_destination failure_stage=decision");
    expect(logs).toContain("reason=unusable_conversational_response");
    expect(logs).toContain("provider_status=429");
    expect(logs).toContain("request_id=11111111-1111-4111-8111-111111111111");
    expect(logs).not.toContain("PRIVATE_");
    expect(logs).not.toContain("My Perfect Getaway");
  } finally { info.mockRestore(); warn.mockRestore(); }
});
