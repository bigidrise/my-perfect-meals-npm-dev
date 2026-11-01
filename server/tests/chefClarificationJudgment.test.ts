jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
}));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getChefConversationInstructions, CHEF_CONVERSATION_INSTRUCTIONS } from "../services/coaching/conciergeInstructions";
import { runSafetyGate } from "../services/coaching/safety";
import type { PendingRecommendation } from "../services/coaching/conciergeNavigationState";

const environment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; });
afterAll(() => { process.env.NODE_ENV = environment; });
const tools = [{
  id: "beverage_creator", label: "Beverage Creator", description: "Make a drink.",
  featureTarget: "beverage_creator", scope: "adult" as const,
}];
const goal = {
  activity: "prepare", occasion: "beverage", restaurant: "unknown",
  dishChosen: false, specialty: "none", explicitFeatureId: null,
};
const decision = { mode: "food_assistance", destinationId: "beverage_creator", goal };
const initial = "I feel a little nauseous this morning, but I still need breakfast. Maybe a shake. What do you recommend?";
const persistent = "I've actually been feeling nauseous for the last few days, and I'm having trouble eating regular meals. What would you suggest?";
const fluidQuestion = "Are you able to keep fluids down?";
const advice = "A small, light breakfast may be easier to tolerate than a large meal; use what you know you tolerate.";
const offer = "Beverage Creator can help you make a drink. Would you like to open it?";
const referral = "Please contact a healthcare professional about the persistent symptoms and difficulty eating.";
const authorizedContext = "Synthetic member context: vegetarian preference. Other restrictions are unknown. Follow any supplied physician instructions.";

async function reply(message: string, extra: Record<string, unknown> = {}, options: {
  userMessage?: string; history?: Array<{ role: string; content: string }>;
  rollingContext?: string; pending?: PendingRecommendation;
} = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    memberNeed: "nutrition_guidance", responsePurpose: "answer", message,
    navigationIntent: "none", conciergeDecision: null, recommendationMessage: null,
    conversationMessage: null, handoffMessage: null, creatorRequest: null,
    careDisposition: "none", redFlag: false, redFlagReason: null, contactCare: null,
    ...extra,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage: options.userMessage ?? initial, history: options.history ?? [],
    rollingContext: options.rollingContext ?? null,
    context: { coachingContextBlock: authorizedContext }, tools,
    pendingRecommendation: options.pending,
  });
  expect(create).toHaveBeenCalledTimes(1);
  const request = create.mock.calls[0][0];
  return { result, request, wire: JSON.parse(request.messages[1].content) };
}
function expectActionFree(result: Awaited<ReturnType<typeof reply>>["result"]) {
  expect(result.presentation?.navigation).toBeUndefined();
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
}

describe("Development clarification judgment contracts (not live model judgment)", () => {
  it.each([
    ["What does dietary fiber do?", "Dietary fiber supports bowel regularity and can help with fullness."],
    ["I feel mildly nauseous but I can drink and tolerate my usual breakfast. Is a smaller breakfast reasonable?", advice],
  ])("preserves a sufficient direct answer without inventing an interview: %s", async (userMessage, message) => {
    const { result } = await reply(message, {}, { userMessage });
    expect(result.presentation?.message).toBe(message);
    expect(result.whatIFound).toBe(message);
    expect(result.meta.redFlag).toBe(false);
    expectActionFree(result);
  });

  it.each([
    [initial, fluidQuestion],
    ["I'm avoiding a food but I don't know whether my restriction affects breakfast choices.", "Which food do you need to avoid?"],
    ["I want to improve how I eat for training.", "What would you most like your nutrition to help with?"],
    ["I'd like help getting dinner.", "Are you planning to prepare dinner or get something already made?"],
  ])("keeps one material clarification action-free: %s", async (userMessage, message) => {
    const { result } = await reply(message, { responsePurpose: "clarify" }, { userMessage });
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.message?.match(/\?/g)).toHaveLength(1);
    expectActionFree(result);
  });

  it("supports conditional advice plus one question with the existing clarify purpose", async () => {
    const message = `${advice} ${fluidQuestion}`;
    const { result } = await reply(message, { responsePurpose: "clarify" });
    expect(result.presentation?.message).toBe(message);
    expect(result.meta.concierge?.rendering).toBe("primary");
    expectActionFree(result);
  });

  it("acknowledges the persistent-symptom follow-up, preserving its clarification and nonemergency care guidance", async () => {
    const earlier = `${advice} ${offer}`;
    const message = `This has continued and is now affecting regular meals, so food suggestions alone are not enough. ${fluidQuestion}`;
    const history = [{ role: "user", content: initial }, { role: "assistant", content: earlier }];
    const { result, wire } = await reply(message, {
      responsePurpose: "care", careDisposition: "referral", contactCare: referral,
    }, { userMessage: persistent, history });
    expect(wire.history).toEqual(history);
    expect(wire.latestMemberMessage).toBe(persistent);
    expect(result.presentation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([{
      horizon: "today", kind: "contact_care", text: `${message}\n\n${referral}`,
    }]);
    expect(JSON.stringify(result)).not.toContain("Beverage Creator");
    // Legacy redFlag is the care-renderer marker for referrals too, not proof
    // that the member was classified as an emergency.
    expect(result.meta.redFlag).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/911|emergency room/);
  });

  it("preserves model-classified prompt assessment for inability to keep fluids down", async () => {
    const userMessage = "I cannot keep fluids down and I am having trouble eating.";
    const care = "Seek prompt medical assessment rather than relying on food or drink suggestions.";
    const { result } = await reply(care, {
      responsePurpose: "care", careDisposition: "referral", contactCare: care,
    }, { userMessage });
    expect(result.presentation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([{ horizon: "today", kind: "contact_care", text: care }]);
    expect(result.meta.redFlag).toBe(true);
  });

  it("retains the existing deterministic serious-warning gate without adding symptom thresholds", async () => {
    const safety = await runSafetyGate("I have chest pain and trouble breathing.");
    expect(safety.triggered).toBe(true);
    expect(safety.class).toBe("emergency");
    expect(safety.reason).toBe("acute_cardiac");
  });

  it("keeps urgent model-classified care ahead of contradictory navigation metadata", async () => {
    const care = "Seek emergency medical help now for the serious symptoms described.";
    const { result } = await reply(care, {
      responsePurpose: "handoff", memberNeed: "navigation", navigationIntent: "direct_request",
      conciergeDecision: { ...decision, goal: { ...goal, explicitFeatureId: "beverage_creator" } },
      handoffMessage: "Describe your drink on the page.",
      redFlag: true, careDisposition: "emergency", contactCare: care,
    }, { userMessage: "I am struggling to breathe. Open Beverage Creator." });
    expect(result.presentation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([{ horizon: "today", kind: "contact_care", text: care }]);
    expect(JSON.stringify(result)).not.toContain("Describe your drink");
  });

  it.each([
    ["I can keep fluids down, but large meals are difficult.", "Since fluids stay down, a smaller amount of food may be easier to tolerate."],
    ["Actually, I cannot keep fluids down.", "Please seek prompt medical assessment for the difficulty keeping fluids down."],
  ])("passes the newly supplied answer and latest correction without repeating the question: %s", async (userMessage, message) => {
    const history = [
      { role: "user", content: persistent },
      { role: "assistant", content: `${referral} ${fluidQuestion}` },
    ];
    const needsCare = userMessage.startsWith("Actually");
    const { result, wire } = await reply(message, needsCare ? {
      responsePurpose: "care", careDisposition: "referral", contactCare: message,
    } : {}, {
      userMessage, history, rollingContext: "Earlier context: the member was unsure about fluid tolerance.",
    });
    expect(wire.history).toEqual(history);
    expect(wire.latestMemberMessage).toBe(userMessage);
    expect(wire.earlierConversation).toContain("unsure");
    expect(wire.authorizedNutritionContext).toBe(authorizedContext);
    expect(wire.memberStatements.map((turn: { text: string }) => turn.text)).toEqual([persistent, userMessage]);
    const displayed = result.presentation?.message ?? result.todayPlan.items[0].text;
    expect(displayed).toBe(message);
    expect(displayed).not.toContain(fluidQuestion);
    if (!needsCare) expectActionFree(result);
  });

  it("defers an earlier pending offer when the next turn needs a material clarification", async () => {
    const { result: first } = await reply(`${advice} ${offer}`, {
      responsePurpose: "answer_with_offer", navigationIntent: "recommendation", conciergeDecision: decision,
    });
    const { result } = await reply(fluidQuestion, { responsePurpose: "clarify" }, {
      userMessage: persistent, pending: first.presentation?.navigation,
    });
    expect(first.presentation?.navigation?.state).toBe("recommendation_pending");
    expect(result.presentation?.message).toBe(fluidQuestion);
    expectActionFree(result);
  });

  it("rejects the old premature feature-only pattern instead of treating the clarification as consent", async () => {
    const { result } = await reply(offer, {
      responsePurpose: "feature_only_offer", navigationIntent: "recommendation",
      conciergeDecision: decision, recommendationMessage: offer,
      conversationMessage: fluidQuestion,
    }, { userMessage: persistent });
    expect(result.presentation?.message).toBe(fluidQuestion);
    expectActionFree(result);
  });

  it.each(["clarify", "answer", undefined, "INVALID"])("rejects conflicting or missing purpose %s without retaining the offer", async responsePurpose => {
    const { result } = await reply(offer, {
      responsePurpose, navigationIntent: "recommendation", conciergeDecision: decision,
      conversationMessage: `${advice} ${fluidQuestion}`,
    });
    expect(result.presentation?.message).toBe(`${advice} ${fluidQuestion}`);
    expectActionFree(result);
    expect(JSON.stringify(result)).not.toContain(offer);
  });

  it("returns retry rather than inventing a helpful answer when the rejected offer has no safe continuation", async () => {
    const { result } = await reply(offer, {
      responsePurpose: "clarify", navigationIntent: "recommendation", conciergeDecision: decision,
    }, { userMessage: persistent });
    expect(result.meta.concierge?.rendering).toBe("retry");
    expectActionFree(result);
  });

  it("preserves the complete canonical answer and accepts its optional offer once", async () => {
    const message = `${advice} ${offer}`;
    const { result: first } = await reply(message, {
      responsePurpose: "answer_with_offer", navigationIntent: "recommendation",
      conciergeDecision: decision, recommendationMessage: "DISCARDED_SHORT_PITCH",
    }, { userMessage: "Fluids stay down. I want to prepare a light drink for breakfast." });
    expect(first.presentation?.message).toBe(message);
    expect(first.presentation?.navigation?.state).toBe("recommendation_pending");
    expect(first.presentation?.destinationId).toBeUndefined();
    const handoff = "Describe your drink on the page.";
    const { result: accepted } = await reply(handoff, {
      responsePurpose: "handoff", memberNeed: "navigation",
      navigationIntent: "confirmed", handoffMessage: handoff,
    }, { userMessage: "Yes, please.", pending: first.presentation?.navigation });
    expect(accepted.presentation?.message).toBe(handoff);
    expect(accepted.presentation?.navigation?.state).toBe("navigation_confirmed");
    expect(accepted.presentation?.destinationId).toBe("beverage_creator");
    expect(accepted.todayPlan.items).toHaveLength(1);
    expect(JSON.stringify(accepted)).not.toMatch(/DISCARDED_SHORT_PITCH|Would you like/);
  });

  it("preserves direct feature navigation without making clarification mandatory", async () => {
    const message = "Describe your drink on the page.";
    const { result } = await reply(message, {
      memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "direct_request",
      conciergeDecision: { ...decision, goal: { ...goal, explicitFeatureId: "beverage_creator" } },
      handoffMessage: message,
    }, { userMessage: "Open Beverage Creator." });
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.navigation?.state).toBe("direct_navigation");
    expect(result.presentation?.destinationId).toBe("beverage_creator");
  });

  it("reconciles judgment instructions in the same call without changing model settings or external fields", async () => {
    const { request } = await reply(fluidQuestion, { responsePurpose: "clarify" });
    const system = request.messages[0].content;
    expect(system).toContain("single highest-value unresolved detail");
    expect(system).toContain("clarify may include useful conditional advice");
    expect(system).toContain("not a vague invitation to repeat the problem");
    expect(system).toContain("turn an ordinary nutrition question into a medical interview");
    expect(system).toContain("Use answers already supplied");
    expect(system).toContain("Defer the offer while a material safety or usefulness question remains unresolved");
    expect(system).toContain("persistent symptoms materially limiting intake may warrant nonemergency medical follow-up");
    expect(system).toContain("Do not wait for its answer before recommending necessary care");
    expect(system).toContain("claim to have checked information not actually supplied");
    expect(system).not.toContain("For an unexplained difficulty or feeling unwell, invite the member to explain");
    expect(request.model).toBe("gpt-4o");
    expect(request.temperature).toBe(0.4);
    expect(request.max_tokens).toBe(2000);
    expect(request.messages).toHaveLength(2);
    expect(request.response_format.json_schema.schema.properties.responsePurpose.enum).toEqual([
      "answer", "clarify", "answer_with_offer", "feature_only_offer", "handoff", "care",
    ]);
  });

  it("does not apply the new clarification instructions outside Development", () => {
    for (const env of ["production", "test", undefined]) {
      expect(getChefConversationInstructions(env)).toBe(CHEF_CONVERSATION_INSTRUCTIONS);
    }
    expect(getChefConversationInstructions("development")).not.toBe(CHEF_CONVERSATION_INSTRUCTIONS);
  });
});
