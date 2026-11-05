jest.mock("../db", () => ({
  db: { execute: jest.fn(() => { throw new Error("Unexpected database access"); }) },
}));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { verifiedNavigationText } from "../../shared/coaching/navigationGuidance";
import { fallbackQuality, selectRejectedConversation, HANDOFF_RECOVERY, MISSING_PENDING_RECOVERY } from "../services/coaching/conciergeFallback";
import { inspectConversationPurpose } from "../services/coaching/conversationPurpose";
import type { PendingRecommendation } from "../services/coaching/conciergeNavigationState";

const environment = process.env.NODE_ENV;
beforeEach(() => { process.env.NODE_ENV = "development"; });
afterAll(() => { process.env.NODE_ENV = environment; });
const original = "Chef, I want to bake a whole apple pie for my family.";
const goal = { activity: "prepare", occasion: "dessert", restaurant: "unknown",
  dishChosen: true, specialty: "none", explicitFeatureId: null };
const action = { mode: "food_assistance", destinationId: "dessert_creator", goal };
const offer = "Dessert Creator can help you make that apple pie. Want me to take you there?";
const tools = [{ id: "dessert_creator", label: "Dessert Creator", description: "Create a complete dessert.",
  featureTarget: "dessert_creator", scope: "adult" as const }];
async function reply(extra: Record<string, unknown> = {}, options: {
  pending?: PendingRecommendation; userMessage?: string; history?: Array<{ role: string; content: string }>;
  unavailable?: boolean;
} = {}) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    memberNeed: "feature_help", responsePurpose: "answer_with_offer",
    message: offer, navigationIntent: "none", recommendationMessage: null,
    handoffMessage: null, conversationMessage: ":apple:", conciergeDecision: action,
    creatorRequest: null, redFlag: false, redFlagReason: null, contactCare: null, careDisposition: "none", ...extra,
  }) } }] });
  const result = await runConciergeConversation({
    client: { chat: { completions: { create } } } as any, userMessage: options.userMessage ?? original,
    history: options.history ?? [], rollingContext: null, pendingRecommendation: options.pending,
    context: { coachingContextBlock: "PRIVATE_PROFILE_SENTINEL" }, tools: options.unavailable ? [] : tools,
  });
  expect(create).toHaveBeenCalledTimes(1);
  if (result.presentation) expect(result.presentation.message).toBe(result.whatIFound);
  return { result, request: create.mock.calls[0][0] };
}
function noAction(result: Awaited<ReturnType<typeof reply>>["result"]) {
  expect(result.presentation?.destinationId).toBeUndefined();
  expect(result.presentation?.navigation).toBeUndefined();
  expect(result.todayPlan.items).toEqual([]);
}

describe("Development rejected-response reliability", () => {
  it.each([":apple:", ":apple: :cake:", "🍎🥧", "✨", "1️⃣", "...?!", "", "   "])(
    "rejects placeholder fallback %j", async conversationMessage => {
      expect(fallbackQuality(conversationMessage)).toBe("placeholder");
      const { result } = await reply({ conversationMessage });
      expect(result.presentation?.message).toBe(HANDOFF_RECOVERY);
      expect(result.meta.concierge?.rendering).toBe("retry");
      noAction(result);
    });
  it.each(["Sure!", "Great!", "Got it.", "Absolutely!", "I can help with that.",
    ":apple: Sounds like a delicious plan!", "Okay, great!", "You're welcome."])(
    "does not persist a generic acknowledgment as rejected-response fallback: %s", async conversationMessage => {
      expect(fallbackQuality(conversationMessage)).toBe("acknowledgment");
      const { result } = await reply({ conversationMessage });
      expect(result.presentation?.message).toBe(HANDOFF_RECOVERY);
      noAction(result);
    });
  it("evaluates both candidates rather than trusting the longer one", () => {
    const screen = jest.fn((value?: string | null) => value?.includes("UNSAFE") ? undefined : value ?? undefined);
    const selection = selectRejectedConversation({ message: "UNSAFE ".repeat(40),
      conversationMessage: "Which part of baking the pie would you like help with?" }, screen);
    expect(screen).toHaveBeenCalledTimes(2);
    expect(selection.outcomes).toEqual({ message: "unsafe", conversationMessage: "useful" });
    expect(selection.selectedField).toBe("conversationMessage");
  });
  it("preserves independently useful canonical text when the continuation is a shortcode", async () => {
    const message = "A whole apple pie is a complete dessert recipe, rather than an individually portioned craving.";
    const { result } = await reply({ message });
    expect(result.presentation?.message).toBe(message);
    noAction(result);
  });
  it("preserves a useful independent clarification without reviving rejected metadata", async () => {
    const message = "Which part of baking the pie would you like help with?";
    const { result } = await reply({ conversationMessage: message });
    expect(result.presentation?.message).toBe(message);
    noAction(result);
  });
  it("rejects unsafe whole candidates without stripping a rejected offer or recovering a separate pitch", async () => {
    const { result } = await reply({
      message: "Use https://untrusted.invalid/ to finish.", conversationMessage: offer, recommendationMessage: offer,
    });
    expect(result.presentation?.message).toBe(HANDOFF_RECOVERY);
    noAction(result);
  });
  it("keeps purpose consistency strict for all contradictory offer fields", () => {
    const valid = { responsePurpose: "answer_with_offer", memberNeed: "feature_help",
      navigationIntent: "recommendation", conciergeDecision: action };
    expect(inspectConversationPurpose(valid).valid).toBe(true);
    for (const extra of [{ navigationIntent: "none" }, { memberNeed: "navigation" }, { memberNeed: "unclear" },
      { conciergeDecision: null }, { conciergeDecision: { ...action, mode: "clarification" } }]) {
      expect(inspectConversationPurpose({ ...valid, ...extra })).toMatchObject({ valid: false, reason: "purpose_conflict" });
    }
  });
  it("reproduces rejected apple-pie output followed by YES without fabricating pending navigation", async () => {
    const first = await reply();
    noAction(first.result);
    const history = [{ role: "user", content: original },
      { role: "assistant", content: first.result.presentation!.message }];
    const second = await reply({ conversationMessage: ":apple: Sounds like a delicious plan!" }, {
      userMessage: "YES", pending: first.result.presentation?.navigation, history,
    });
    expect(second.result.presentation?.message).toBe(HANDOFF_RECOVERY);
    expect(JSON.parse(second.request.messages[1].content).history).toEqual(history);
    expect(JSON.parse(second.request.messages[1].content).pendingRecommendation).toBeNull();
    noAction(second.result);
  });
  it("recovers helpfully from confirmed YES without owned pending state", async () => {
    const { result } = await reply({ responsePurpose: "handoff", memberNeed: "navigation",
      navigationIntent: "confirmed", conciergeDecision: null, message: "Sure!", conversationMessage: null,
    }, { userMessage: "YES" });
    expect(result.presentation?.message).toBe(MISSING_PENDING_RECOVERY);
    noAction(result);
  });
  it("preserves valid pending recommendation and its first accepted handoff", async () => {
    const first = await reply({ responsePurpose: "feature_only_offer", navigationIntent: "recommendation" });
    expect(first.result.presentation?.message).toBe(offer);
    expect(first.result.presentation?.navigation?.state).toBe("recommendation_pending");
    const text = "Great! Open Dessert Creator below to get started.";
    const { result } = await reply({
      memberNeed: "navigation", responsePurpose: "handoff", navigationIntent: "confirmed",
      conciergeDecision: null, handoffMessage: text, message: text, conversationMessage: null,
    }, { pending: first.result.presentation?.navigation, userMessage: "YES" });
    expect(result.presentation?.message).toBe(verifiedNavigationText("dessert_creator"));
    expect(result.presentation?.navigation?.state).toBe("navigation_confirmed");
    expect(result.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId: "dessert_creator" })]);
  });
  it("preserves entitlement rejection", async () => {
    const { result } = await reply({ navigationIntent: "recommendation" }, { unavailable: true });
    noAction(result);
    expect(result.presentation?.message).toBe(HANDOFF_RECOVERY);
  });
  it("preserves actual clinical escalation even when every other field conflicts", async () => {
    const care = "Seek urgent medical assessment now.";
    const { result } = await reply({ responsePurpose: "INVALID", redFlag: true,
      contactCare: care, careDisposition: "emergency", message: care });
    expect(result.meta.redFlag).toBe(true);
    expect(result.presentation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([{ horizon: "today", kind: "contact_care", text: care }]);
  });
  it("logs closed metadata indicators and both candidate outcomes, never raw values or member/profile text", async () => {
    const log = jest.spyOn(console, "info").mockImplementation(() => {});
    try {
      await reply({ memberNeed: "PRIVATE_NEED", conciergeDecision: { mode: "PRIVATE_MODE",
        destinationId: "PRIVATE_DESTINATION", goal: { secret: "PRIVATE_GOAL" } } });
      const output = JSON.stringify(log.mock.calls);
      expect(output).toContain("pendingInputPresent");
      expect(output).toContain("authorizedActionEmitted");
      expect(output).toContain("placeholder");
      for (const text of [original, offer, ":apple:", "PRIVATE_NEED", "PRIVATE_MODE",
        "PRIVATE_DESTINATION", "PRIVATE_GOAL", "PRIVATE_PROFILE_SENTINEL"]) expect(output).not.toContain(text);
    } finally { log.mockRestore(); }
  });
  it("Production uses the same placeholder protection and purpose schema", async () => {
    process.env.NODE_ENV = "production";
    const { result, request } = await reply({ conciergeDecision: { ...action, destinationId: "invalid" } });
    expect(result.presentation?.message).not.toBe(":apple:");
    expect(result.meta.concierge?.rendering).toBe("retry");
    expect(request.response_format.json_schema.schema.properties).toHaveProperty("responsePurpose");
  });
});
