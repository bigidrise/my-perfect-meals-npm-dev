jest.mock("../db", () => ({ db: { execute: jest.fn(() => { throw new Error("Unexpected DB access"); }) } }));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { COACH_DESTINATIONS, type CoachDestinationId } from "../../shared/coaching/navigation";
import { COACH_NAVIGATION_GUIDANCE, verifiedNavigationOffer, verifiedNavigationText } from "../../shared/coaching/navigationGuidance";
import { explicitNavigationRequest, navigationDestinationQuestion } from "../services/coaching/verifiedNavigation";
import type { PendingRecommendation } from "../services/coaching/conciergeNavigationState";

const environment = process.env.NODE_ENV;
afterAll(() => { process.env.NODE_ENV = environment; });
const baseline = {
  message: "A long explanation of administration is not the navigation answer the member requested.",
  memberNeed: "feature_help", responsePurpose: "answer", navigationIntent: "none",
  pendingNavigationDisposition: "clear", conciergeDecision: null, conversationMessage: null,
  handoffMessage: null, recommendationMessage: null, creatorRequest: null,
  redFlag: false, contactCare: null, careDisposition: "none",
};
const goal = { activity: "business", occasion: "unknown", restaurant: "unknown",
  specialty: "none", dishChosen: false, explicitFeatureId: null };

describe.each(["development", "production"])("%s concise navigation", runtime => {
  beforeEach(() => { process.env.NODE_ENV = runtime; });
  async function reply(input: string, overrides = {}, pendingRecommendation?: PendingRecommendation,
    tools = getCornerCapabilities(["all"])) {
    const create = jest.fn().mockResolvedValue({ choices: [{ message: {
      content: JSON.stringify({ ...baseline, ...overrides }),
    } }] });
    return runConciergeConversation({ client: { chat: { completions: { create } } } as any,
      userMessage: input, history: [], rollingContext: null, context: {},
      tools: tools as any, pendingRecommendation });
  }
  test("a business-starting need gets one offer, not administrator explanations or a premature button", async () => {
    const result = await reply("I want to start a business with My Perfect Meals. Where do I go?", {
      conciergeDecision: { mode: "food_assistance", destinationId: "business_suite", goal },
    });
    expect(result.presentation?.message).toBe(verifiedNavigationOffer("business_suite"));
    expect(result.presentation?.navigation).toMatchObject({
      state: "recommendation_pending", destinationId: "business_suite",
    });
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });
  test("a feature-only offer replaces long workflow explanations without truncating nutrition advice", async () => {
    const long = "Beverage Creator collects your drink preferences and servings. " +
      "It lets you choose several settings before you begin, and you can review the information on its page. " +
      "You do not need these instructions here, because the destination already provides the necessary workflow. " +
      "Would you like to go there?";
    const result = await reply("Which feature helps me make a drink?", {
      message: long, responsePurpose: "feature_only_offer", navigationIntent: "recommendation",
      conciergeDecision: { mode: "food_assistance", destinationId: "beverage_creator",
        goal: { ...goal, activity: "prepare", occasion: "beverage" } },
    });
    expect(result.presentation?.message).toBe(verifiedNavigationOffer("beverage_creator"));
    expect(result.presentation?.destinationId).toBeUndefined();
    const advice = "Nutrition advice should not be truncated merely to fit a navigation template. ".repeat(5).trim();
    expect((await reply("Explain this nutrition guidance.", {
      message: advice, memberNeed: "nutrition_guidance", responsePurpose: "answer",
    })).presentation?.message).toBe(advice);
  });
  test.each(Object.keys(COACH_DESTINATIONS) as CoachDestinationId[])(
    "%s offers on a destination question, then hands off once with only verified directions", async id => {
      const name = COACH_NAVIGATION_GUIDANCE[id].aliases[0];
      const question = `Where can I find ${name}?`;
      expect(navigationDestinationQuestion(question)).toBe(id);
      expect(explicitNavigationRequest(question)).toBeUndefined();
      const offered = await reply(question, { navigationIntent: "direct_request" });
      expect(offered.presentation?.message).toBe(verifiedNavigationOffer(id));
      expect(offered.presentation?.destinationId).toBeUndefined();
      expect(offered.todayPlan.items).toEqual([]);
      const pending = offered.presentation!.navigation as PendingRecommendation;
      const accepted = await reply("Yes.", {}, pending);
      expect(accepted.presentation).toMatchObject({ destinationId: id,
        message: verifiedNavigationText(id),
        navigation: { state: "navigation_confirmed", offeredAt: pending.offeredAt },
      });
      expect(accepted.presentation?.message).not.toMatch(/\?|would you like|contact.*support/i);
      expect(accepted.todayPlan.items).toHaveLength(1);
    });
  test.each(Object.keys(COACH_DESTINATIONS) as CoachDestinationId[])(
    "%s direct command skips permission and returns verified directions", async id => {
      const result = await reply(`Take me to ${COACH_NAVIGATION_GUIDANCE[id].aliases[0]}.`);
      expect(result.presentation).toMatchObject({ message: verifiedNavigationText(id), destinationId: id,
        navigation: { state: "direct_navigation" } });
      expect(result.presentation?.message).not.toMatch(/\?/);
    });
  test("Business Suite uses the existing authenticated entry, not business privileges", () => {
    expect(COACH_DESTINATIONS.business_suite).toEqual({
      label: "Business Suite", route: "/business-center", access: "authenticated",
    });
    expect(verifiedNavigationText("business_suite")).toBe("You can find it under More → Business Suite.");
  });
  test("established business management offers Organization Hub without changing the starting destination", async () => {
    const result = await reply("I've already started my business. Where can I manage my organization?", {
      conciergeDecision: { mode: "food_assistance", destinationId: "business_organization",
        goal: { ...goal, activity: "manage_business" } },
    });
    expect(result.presentation?.message).toBe(verifiedNavigationOffer("business_organization"));
    expect(result.presentation?.navigation).toMatchObject({
      state: "recommendation_pending", destinationId: "business_organization",
    });
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
    expect(COACH_DESTINATIONS.business_suite.route).toBe("/business-center");
    expect(COACH_DESTINATIONS.business_organization).toEqual({
      label: "Business Organization", route: "/business-organizations", access: "authenticated",
    });
  });
  test("a business-management offer cannot redirect its acceptance to Business Suite", async () => {
    const offered = await reply("Where is Business Organization?");
    const pending = offered.presentation!.navigation as PendingRecommendation;
    const result = await reply("Yes.", {
      conciergeDecision: { mode: "food_assistance", destinationId: "business_suite", goal },
    }, pending);
    expect(result.presentation?.destinationId).toBe("business_organization");
    expect(result.presentation?.navigation).toMatchObject({
      state: "navigation_confirmed", destinationId: "business_organization", offeredAt: pending.offeredAt,
    });
  });
  test("organization management does not produce an action when unavailable", async () => {
    const result = await reply("Take me to Business Organization.", {}, undefined,
      getCornerCapabilities(["all"]).filter(tool => tool.id !== "business_organization"));
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.presentation?.navigation).toBeUndefined();
  });
  test("care still overrides a destination question", async () => {
    const result = await reply("Where is Beverage Creator?", {
      redFlag: true, careDisposition: "emergency", contactCare: "Seek urgent medical care.",
    });
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.meta.redFlag).toBe(true);
  });
  test("an unavailable destination does not acquire an offer or button", async () => {
    const result = await reply("Where is Business Suite?", {}, undefined, []);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.presentation?.destinationId).toBeUndefined();
  });
  test("feature explanations stay distinct from destination consent", async () => {
    const answer = "Business Suite is where you start an organization or manage the organizations you can access.";
    const result = await reply("What is Business Suite used for?", { message: answer });
    expect(result.presentation?.message).toBe(answer);
    expect(result.presentation?.navigation).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });
});
