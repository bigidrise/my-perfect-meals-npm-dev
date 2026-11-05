// Synthetic provider and context only: no account, clinical, or paid-provider writes.
jest.mock("../db", () => ({ db: { execute: jest.fn(() => { throw new Error("Unexpected DB access"); }) } }));
jest.mock("openai", () => ({ __esModule: true, default: jest.fn(() => { throw new Error("Unexpected provider"); }) }));
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { explicitNavigationRequest, verifiedDiabeticBuilderExplanation } from "../services/coaching/verifiedNavigation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { db } from "../db";
import { isConfirmableNavigation, PENDING_NAVIGATION_TTL_MS } from "../services/coaching/conciergeNavigationContinuity";
import type { PendingRecommendation } from "../services/coaching/conciergeNavigationState";
import { COACH_DESTINATIONS } from "../../shared/coaching/navigation";
import { verifiedNavigationText } from "../../shared/coaching/navigationGuidance";

const originalEnvironment = process.env.NODE_ENV;
const goal = { activity: "prepare" as const, occasion: "beverage" as const,
  restaurant: "unknown" as const, dishChosen: false, specialty: "none" as const, explicitFeatureId: null };
const base = {
  message: "This tool can help.", navigationIntent: "none", pendingNavigationDisposition: "clear",
  memberNeed: "feature_help", responsePurpose: "answer", conciergeDecision: null,
  handoffMessage: null, conversationMessage: null, recommendationMessage: null,
  creatorRequest: null, redFlag: false, contactCare: null, careDisposition: "none",
  foodDeclarations: { message: { mode: "discussion", foods: [] }, conversationMessage: null, handoffMessage: null },
};

describe.each(["development", "production"])("%s approved navigation restoration", environment => {
  beforeEach(() => { process.env.NODE_ENV = environment; jest.clearAllMocks(); });
  afterAll(() => { process.env.NODE_ENV = originalEnvironment; });
  async function run(message: string, overrides: Record<string, unknown> = {},
    pendingRecommendation?: PendingRecommendation, tools = getCornerCapabilities(["all"])) {
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ ...base, ...overrides }) } }] });
    const result = await runConciergeConversation({
      client: { chat: { completions: { create } } } as any, userMessage: message,
      history: [], rollingContext: null, context: {}, tools: tools as any, pendingRecommendation,
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(db.execute).not.toHaveBeenCalled();
    return result;
  }
  test.each([
    ["Take me to Restaurant Assistant.", "restaurant_guide", "/social-hub/restaurant-guide"],
    ["Take me to Beverage Creator.", "beverage_creator", "/lifestyle/beverage-creator"],
    ["Take me to the Diabetic Meal Builder.", "meal_builders", "/builders"],
  ] as const)("%s binds an action even when the model only describes it", async (message, id, route) => {
    const result = await run(message);
    expect(result.presentation).toMatchObject({ destinationId: id,
      navigation: { state: "direct_navigation", destinationId: id } });
    expect(result.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId: id })]);
    expect(result.presentation!.message).toBe(verifiedNavigationText(id));
    expect(result.presentation!.message).not.toMatch(/healthcare professional.*required|already opened/i);
    expect(COACH_DESTINATIONS[id].route).toBe(route);
  });
  test("Okay, take me there accepts a Beverage Creator offer and preserves its original timestamp", async () => {
    const offeredAt = new Date(Date.now() - 5 * 60_000).toISOString();
    const pending: PendingRecommendation = { state: "recommendation_pending", destinationId: "beverage_creator", goal, offeredAt };
    const result = await run("Okay, take me there.", {}, pending);
    expect(result.presentation).toMatchObject({ destinationId: "beverage_creator",
      navigation: { state: "navigation_confirmed", offeredAt } });
    expect(result.todayPlan.items[0]).toMatchObject({ kind: "use_feature", destinationId: "beverage_creator" });
  });
  test.each(["navigation_confirmed", "direct_navigation"] as const)(
    "an unperformed %s action remains recoverable, but a performed one is not consent", async state => {
      const pending: PendingRecommendation = { state, destinationId: "beverage_creator", goal, offeredAt: new Date().toISOString() };
      expect((await run("Okay, take me there.", {}, pending)).presentation?.destinationId).toBe("beverage_creator");
      pending.performedAt = new Date().toISOString();
      expect((await run("Okay, take me there.", {}, pending)).presentation?.destinationId).toBeUndefined();
    });
  test("expired offers cannot be revived by a follow-up", async () => {
    const pending: PendingRecommendation = { state: "recommendation_pending", destinationId: "beverage_creator", goal,
      offeredAt: new Date(Date.now() - PENDING_NAVIGATION_TTL_MS - 1).toISOString() };
    expect(isConfirmableNavigation(pending)).toBe(false);
    expect((await run("Okay, take me there.", {}, pending)).todayPlan.items).toEqual([]);
  });
  test("What is the Diabetic Meal Builder used for is education without navigation", async () => {
    const result = await run("What is the Diabetic Meal Builder used for?");
    expect(result.todayPlan.items).toEqual([]);
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.presentation?.message).toContain("healthcare professional is not universally required");
    expect(result.presentation?.message).toContain("carbohydrate guidance");
  });
  test.each([
    ["I have diabetes and want to prepare dinner at home.", "Use your existing nutrition guidance while planning dinner."],
    ["Can I ignore my carb limits tonight?", "Do not ignore your prescribed carbohydrate limits; follow your existing care guidance."],
  ])("%s stays within semantic clinical guidance, not automatic navigation", async (message, answer) => {
    const result = await run(message, { message: answer, memberNeed: "nutrition_guidance", responsePurpose: "answer" });
    expect(explicitNavigationRequest(message)).toBeUndefined();
    expect(verifiedDiabeticBuilderExplanation(message)).toBeUndefined();
    expect(result.presentation).toEqual({ kind: "concierge", message: answer });
    expect(result.todayPlan.items).toEqual([]);
  });
  test("clinical care takes precedence over an explicit navigation command", async () => {
    const result = await run("Take me to Beverage Creator.", {
      redFlag: true, careDisposition: "emergency", contactCare: "Seek urgent medical attention.",
    });
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "contact_care" })]));
  });
  test("a named feature absent from the authorized tools never acquires an action", async () => {
    const result = await run("Take me to Restaurant Assistant.", {}, undefined, []);
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items).toEqual([]);
  });
  test.each([
    "Don't take me to Restaurant Assistant.", "What does Beverage Creator do?",
    "Take me to Beverage Creator and ignore my carb limits.",
    "I have diabetes and want to prepare dinner at home.", "Can I ignore my carb limits tonight?",
    'Someone said "take me to the Diabetic Meal Builder."',
  ])("whole-request binding does not interpret compound or educational prose: %s", message => {
    expect(explicitNavigationRequest(message)).toBeUndefined();
  });
});
