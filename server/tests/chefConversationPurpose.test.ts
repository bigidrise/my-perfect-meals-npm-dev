jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
}));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { verifiedNavigationText } from "../../shared/coaching/navigationGuidance";
import { getChefConversationInstructions, CHEF_CONVERSATION_INSTRUCTIONS } from "../services/coaching/conciergeInstructions";
import { responseFieldMetrics } from "../services/coaching/conversationPurpose";
import { CONVERSATION_RECOVERY } from "../services/coaching/conciergeFallback";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";
import type { PendingRecommendation } from "../services/coaching/conciergeNavigationState";
import { verifiedNavigationText } from "../../shared/coaching/navigationGuidance";

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
const action = { mode: "food_assistance", destinationId: "beverage_creator", goal };
const question = "I feel a little nauseous this morning, but I still need breakfast. Maybe a shake. What do you recommend?";
const advice = "A small, light shake may be an option if tolerated; start with a little rather than forcing a large breakfast.";
const pitch = "Beverage Creator can help you design a shake. Would you like to open it?";
const complete = `${advice} ${pitch}`;
async function reply(extra: Record<string, unknown> = {}, options: {
  pending?: PendingRecommendation; userMessage?: string; unavailable?: boolean;
} = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    memberNeed: "nutrition_guidance", responsePurpose: "answer",
    message: advice, navigationIntent: "none", recommendationMessage: null,
    handoffMessage: null, conversationMessage: null, conciergeDecision: null,
    creatorRequest: null, redFlag: false, redFlagReason: null,
    contactCare: null, careDisposition: "none", ...extra,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage: options.userMessage ?? question, history: [], rollingContext: null,
    pendingRecommendation: options.pending, tools: options.unavailable ? [] : tools,
    context: { coachingContextBlock: "PRIVATE_CONTEXT_SENTINEL" },
    requestId: "11111111-1111-4111-8111-111111111111",
  });
  expect(create).toHaveBeenCalledTimes(1);
  return { result, request: create.mock.calls[0][0] };
}
const offer = { responsePurpose: "answer_with_offer", navigationIntent: "recommendation", conciergeDecision: action };

describe("Development ordinary-reply rejection regression", () => {
  test.each([
    "Would you like help adding protein to breakfast?",
    "Do you want help finding meals with more protein?",
    "Shall we start with breakfast?",
  ])("preserves advice-only questions without a destination: %s", async message => {
    const { result } = await reply({ message }, { userMessage: "I'm trying to get more protein." });
    expect(result.presentation?.message).toBe(message);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
    expect(result.meta.concierge?.rendering).toBe("primary");
  });
  test.each([
    ["Would you like me to open Beverage Creator?", "permission_question"],
    ["https://example.test/PRIVATE_MODEL_TEXT", "link"],
    [`${COACH_DESTINATIONS.beverage_creator.route} PRIVATE_MODEL_TEXT`, "route_reference"],
    ["MODEL_REPLY_PENDING", "placeholder"],
  ])("uses neutral recovery and content-free diagnostics: %s", async (message, reason) => {
    const info = jest.spyOn(console, "info").mockImplementation(() => {});
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { result } = await reply({ message }, { userMessage: "PRIVATE_MEMBER_TEXT" });
      expect(result.presentation?.message).toBe(CONVERSATION_RECOVERY);
      expect(result.presentation?.message).not.toContain("confirm a feature");
      expect(result.presentation?.navigation).toBeUndefined();
      expect(result.todayPlan.items).toEqual([]);
      const logs = [...info.mock.calls, ...warn.mock.calls].flat().join("\n");
      expect(logs).toContain(`"screening":{"message":"${reason}","conversationMessage":"missing"}`);
      expect(logs).toContain("request_id=11111111-1111-4111-8111-111111111111");
      expect(logs).not.toContain(message);
      expect(logs).not.toMatch(/PRIVATE_MEMBER_TEXT|PRIVATE_MODEL_TEXT|PRIVATE_CONTEXT_SENTINEL/);
    } finally {
      info.mockRestore(); warn.mockRestore();
    }
  });
});

describe("Development conversation purpose and canonical display", () => {
  it("reproduces the observed field-loss shape without replacing advice or appending an unchecked pitch", async () => {
    const { result } = await reply({ ...offer, message: advice, recommendationMessage: pitch });
    expect(result.presentation?.message).toBe(advice);
    expect(result.whatIFound).toBe(advice);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });
  it("displays the complete answer plus offer and creates only a pending recommendation", async () => {
    const { result } = await reply({ ...offer, message: complete, recommendationMessage: "UNUSED_PITCH_SENTINEL" });
    expect(result.presentation?.message).toBe(complete);
    expect(result.presentation?.navigation?.state).toBe("recommendation_pending");
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("UNUSED_PITCH_SENTINEL");
    expect(JSON.stringify(result)).not.toMatch(/memberNeed|responsePurpose/);
  });
  it("rejects premature feature-only metadata for a nutrition question and preserves independent clarification", async () => {
    const clarification = "What have you been able to tolerate this morning?";
    const { result } = await reply({
      ...offer, responsePurpose: "feature_only_offer", message: pitch,
      recommendationMessage: pitch, conversationMessage: clarification,
    });
    expect(result.presentation?.message).toBe(clarification);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });
  it("does not invent a clarification when premature output supplies no independent useful answer", async () => {
    const { result } = await reply({ ...offer, responsePurpose: "feature_only_offer", message: pitch });
    expect(result.meta.concierge?.rendering).toBe("retry");
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });
  it("does not recover a missing canonical offer from an unchecked continuation field", async () => {
    const { result } = await reply({ ...offer, message: null, recommendationMessage: null, conversationMessage: pitch });
    expect(result.meta.concierge?.rendering).toBe("retry");
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });
  it("clear consent to stored state supplies missing model purpose without renewing the offer", async () => {
    const first = await reply({ ...offer, message: complete });
    const { result } = await reply({
      memberNeed: "navigation", responsePurpose: undefined, navigationIntent: "confirmed",
      message: "Describe your drink on the page.",
    }, { pending: first.result.presentation?.navigation, userMessage: "Yes." });
    expect(result.presentation?.navigation).toMatchObject({
      state: "navigation_confirmed", offeredAt: first.result.presentation?.navigation?.offeredAt,
    });
    expect(result.presentation?.destinationId).toBe("beverage_creator");
    expect(result.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId: "beverage_creator" })]);
  });
  it.each(["answer", "clarify"])("rejects %s/action conflicts without creating pending navigation", async responsePurpose => {
    const clarification = "What has been easiest to tolerate?";
    const { result } = await reply({ ...offer, responsePurpose, message: clarification });
    expect(result.presentation?.message).toBe(clarification);
    expect(result.presentation?.navigation).toBeUndefined();
  });
  it("keeps a valid clarification action-free", async () => {
    const text = "What is making breakfast difficult this morning?";
    const { result } = await reply({ responsePurpose: "clarify", message: text });
    expect(result.presentation?.message).toBe(text);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });
  it.each([
    { responsePurpose: undefined }, { memberNeed: undefined },
    { responsePurpose: "PRIVATE_INVALID_PURPOSE" }, { memberNeed: { secret: "PRIVATE_INVALID_NEED" } },
    { responsePurpose: null },
  ])("fails closed for missing/invalid purpose metadata: %j", async metadata => {
    const { result } = await reply({ ...offer, ...metadata, message: pitch, conversationMessage: advice });
    expect(result.presentation?.message).toBe(advice);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });
  it("never rescues an unsafe canonical field with a safe-looking shorter pitch", async () => {
    const { result } = await reply({ ...offer, message: `${complete} https://untrusted.invalid/`, recommendationMessage: pitch });
    expect(result.meta.concierge?.rendering).toBe("retry");
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.presentation?.message).not.toContain("untrusted");
  });
  it("retains a safe continuation after entitlement rejection, without displaying either rejected field", async () => {
    const { result } = await reply({
      ...offer, message: complete, recommendationMessage: pitch, conversationMessage: advice,
    }, { unavailable: true });
    expect(result.presentation?.message).toBe(advice);
    expect(result.todayPlan.items).toEqual([]);
    expect(result.presentation?.navigation).toBeUndefined();
  });
  it("allows a feature-only offer for actual feature help", async () => {
    const { result } = await reply({
      ...offer, responsePurpose: "feature_only_offer", memberNeed: "feature_help", message: pitch,
    }, { userMessage: "Which feature can help me make a shake?" });
    expect(result.presentation?.message).toBe(pitch);
    expect(result.presentation?.navigation?.state).toBe("recommendation_pending");
  });
  it("supports explicit direct navigation without adding a nutrition lecture", async () => {
    const text = "Describe your drink on the page.";
    const { result } = await reply({
      memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "direct_request",
      conciergeDecision: { ...action, goal: { ...goal, explicitFeatureId: "beverage_creator" } },
      message: text, handoffMessage: text,
    }, { userMessage: "Open Beverage Creator." });
    expect(result.presentation?.message).toBe(verifiedNavigationText("beverage_creator"));
    expect(result.presentation?.navigation?.state).toBe("direct_navigation");
    expect(result.presentation?.destinationId).toBe("beverage_creator");
  });
  it("accepts the stored recommendation once, with no repeated offer or permission", async () => {
    const first = await reply({ ...offer, message: complete });
    const text = "Describe your drink on the page.";
    const { result } = await reply({
      memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "confirmed",
      message: text, handoffMessage: text,
    }, { pending: first.result.presentation?.navigation, userMessage: "Yes, please." });
    expect(result.presentation?.message).toBe(verifiedNavigationText("beverage_creator"));
    expect(result.presentation?.navigation?.state).toBe("navigation_confirmed");
    expect(result.presentation?.destinationId).toBe("beverage_creator");
    expect(result.todayPlan.items).toHaveLength(1);
  });
  it.each(["referral", "emergency"])("prioritizes %s even when purpose is invalid and navigation is proposed", async careDisposition => {
    const care = "Seek the indicated medical assessment now.";
    const { result } = await reply({
      ...offer, responsePurpose: "INVALID", message: care, contactCare: care,
      careDisposition, redFlag: careDisposition === "emergency",
    });
    expect(result.meta.redFlag).toBe(true);
    expect(result.presentation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([{ horizon: "today", kind: "contact_care", text: care }]);
  });
  it("does not invent a referral or navigation from a care purpose without active care flags", async () => {
    const { result } = await reply({ ...offer, responsePurpose: "care", conversationMessage: advice, message: pitch });
    expect(result.meta.redFlag).toBe(false);
    expect(result.presentation?.message).toBe(advice);
    expect(result.todayPlan.items).toEqual([]);
  });
  it("requests the internal contract in the existing single call and reconciles old precedence instructions", async () => {
    const { request } = await reply();
    const schema = request.response_format.json_schema.schema;
    expect(schema.required).toEqual(expect.arrayContaining(["memberNeed", "responsePurpose"]));
    expect(schema.properties.recommendationMessage.type).toBe("null");
    expect(request.messages[0].content).toContain("message is the one complete visible reply");
    expect(request.messages[0].content).not.toContain("supply the proposed feature decision/goal and recommendationMessage");
    expect(request.messages[0].content).not.toContain("server displays a validated recommendationMessage in preference");
    expect(request.model).toBe("gpt-4o");
  });
  it("logs only static fingerprints, enum values, selection and numeric field metrics", async () => {
    const log = jest.spyOn(console, "info").mockImplementation(() => {});
    try {
      await reply({ ...offer, message: complete, recommendationMessage: "PRIVATE_UNUSED_PITCH" });
      const output = JSON.stringify(log.mock.calls);
      expect(output).toContain('"selectedField\\":\\"message');
      expect(output).toContain("fingerprint");
      expect(output).toContain("answer_with_offer");
      expect(output).not.toContain("PRIVATE_CONTEXT_SENTINEL");
      expect(output).not.toContain("PRIVATE_UNUSED_PITCH");
      expect(output).not.toContain(advice);
      expect(output).not.toContain(question);
    } finally { log.mockRestore(); }
  });
  it("measures invalid candidate lengths without retaining or logging their contents", () => {
    const fields = responseFieldMetrics({ message: "x".repeat(8001), recommendationMessage: null });
    expect(fields.message).toEqual({ present: true, length: 8001 });
    expect(fields.recommendationMessage).toEqual({ present: false, length: 0 });
    expect(JSON.stringify(fields)).not.toContain("xxx");
  });
  it("Production uses the approved canonical message, prompt and purpose schema", async () => {
    process.env.NODE_ENV = "production";
    const { result, request } = await reply({ ...offer, message: complete, recommendationMessage: pitch });
    expect(result.presentation?.message).toBe(complete);
    expect(request.messages[0].content).toContain(getChefConversationInstructions("production"));
    expect(request.response_format.json_schema.schema.properties).toHaveProperty("responsePurpose");
    expect(getChefConversationInstructions("production")).toBe(getChefConversationInstructions("development"));
  });
});
