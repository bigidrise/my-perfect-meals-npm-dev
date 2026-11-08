jest.mock("../db", () => ({ db: { execute: jest.fn() } }));
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "../db";
import { loadNavigationRecoveryContext, type PendingRecommendation } from "../services/coaching/conciergeNavigationState";
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { NAVIGATION_RECOVERY_WINDOW_MS, isNavigationFailureComplaint } from "../services/coaching/navigationRecovery";
import { PENDING_NAVIGATION_TTL_MS } from "../services/coaching/conciergeNavigationContinuity";

const originalEnvironment = process.env.NODE_ENV;
const now = new Date("2026-11-08T12:00:00Z");
const filler = ": If you need further assistance or have any other questions, feel free to ask!";
const complaint = "Okay, you asked me would I like to use Fridge Rescue. I said yes, and you didn't give me Fridge Rescue.";
const goal = { activity: "use_ingredients" as const, occasion: "meal" as const,
  restaurant: "unknown" as const, dishChosen: false, specialty: "none" as const, explicitFeatureId: null };
const offer = (age = 3 * 60 * 60 * 1000): PendingRecommendation => ({
  state: "recommendation_pending", destinationId: "fridge_rescue", goal,
  offeredAt: new Date(now.getTime() - age).toISOString(),
});
const assistant = (navigation?: PendingRecommendation) => ({
  role: "assistant", content: navigation ? "Would you like to use Fridge Rescue?" : filler,
  created_at: now, structured_payload: {
    presentation: { kind: "concierge", message: navigation ? "Would you like to use Fridge Rescue?" : filler,
      ...(navigation ? { navigation } : {}) },
    todayPlan: { items: [] }, meta: { redFlag: false },
  },
});
beforeEach(() => {
  process.env.NODE_ENV = "development";
  jest.useFakeTimers().setSystemTime(now);
  (db.execute as jest.Mock).mockReset().mockRejectedValue(new Error("Unexpected DB access"));
});
afterEach(() => jest.useRealTimers());
afterAll(() => { process.env.NODE_ENV = originalEnvironment; });

test("context query is owner-scoped, time-bounded and row-bounded, and crosses only failed handoffs", async () => {
  (db.execute as jest.Mock).mockResolvedValue({ rows: [
    assistant(), { role: "user", content: "Yes.", created_at: now },
    assistant(offer()),
  ] });
  expect(await loadNavigationRecoveryContext("conversation-fixture", "owner-fixture")).toEqual(offer());
  const query = new PgDialect().sqlToQuery((db.execute as jest.Mock).mock.calls[0][0]);
  expect(query.sql).toContain("c.owner_id =");
  expect(query.sql).toContain("c.id =");
  expect(query.sql).toContain("c.status = 'open'");
  expect(query.sql).toContain("m.created_at >=");
  expect(query.sql).toContain("LIMIT");
  expect(query.params).toEqual(expect.arrayContaining(["conversation-fixture", "owner-fixture", 9]));
});

test.each([
  [{ role: "user", content: "No, cancel that." }, assistant(offer())],
  [{ role: "user", content: "What is protein?" }, assistant(offer())],
  [assistant({ ...offer(), destinationId: "beverage_creator", goal: { ...goal, explicitFeatureId: "beverage_creator" } }),
    assistant(offer())],
  [{ ...assistant(), structured_payload: { presentation: { kind: "concierge", message: "Let's discuss breakfast." } } }, assistant(offer())],
  [{ ...assistant(), structured_payload: { meta: { redFlag: true } } }, assistant(offer())],
  [assistant({ ...offer(), performedAt: now.toISOString() })],
  [assistant(offer(NAVIGATION_RECOVERY_WINDOW_MS))],
  [assistant(offer(-1))],
  [assistant(), { role: "user", content: "Fridge Rescue didn't open. Open Beverage Creator instead." }, assistant(offer())],
])("does not resurrect stale, superseded, unrelated or unsafe history: %#", async rows => {
  (db.execute as jest.Mock).mockResolvedValue({ rows });
  const result = await loadNavigationRecoveryContext("conversation-fixture", "owner-fixture");
  // A newer valid destination may supply context, never the older Fridge offer.
  if (result) expect(result.destinationId).toBe("beverage_creator");
  else expect(result).toBeUndefined();
});

test("an unavailable context read fails closed", async () => {
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
  expect(await loadNavigationRecoveryContext("conversation-fixture", "owner-fixture")).toBeUndefined();
  warning.mockRestore();
});

async function reply(message: string, recovery?: PendingRecommendation,
  pending?: PendingRecommendation, extra: Record<string, unknown> = {},
  tools = getCornerCapabilities(["all"])) {
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    message: filler, conversationMessage: null, navigationIntent: "none",
    memberNeed: "feature_help", responsePurpose: "answer", conciergeDecision: null,
    pendingNavigationDisposition: "clear", careDisposition: "none", redFlag: false,
    handoffMessage: null, recommendationMessage: null, creatorRequest: null, ...extra,
  }) } }] });
  return runConciergeConversation({
    client: { chat: { completions: { create } } } as any, userMessage: message,
    history: [], rollingContext: null, context: {}, tools: tools as any,
    navigationRecoveryContext: recovery, pendingRecommendation: pending,
  });
}

test.each(["Yes.", "Sure", "Okay", "Let's do it"])("%s renews expired context, not authorization", async message => {
  const response = await reply(message, offer());
  expect(response.presentation?.message).toMatch(/expired.*Would you like/i);
  expect(response.presentation?.message).not.toContain(filler);
  expect(response.presentation?.navigation).toMatchObject({
    state: "recommendation_pending", destinationId: "fridge_rescue", offeredAt: now.toISOString(),
  });
  expect(response.presentation?.destinationId).toBeUndefined();
  expect(response.todayPlan.items).toEqual([]);
  const renewed = response.presentation!.navigation!;
  const accepted = await reply("Yes.", renewed, renewed);
  expect(accepted.presentation?.navigation?.state).toBe("navigation_confirmed");
  expect(accepted.presentation?.destinationId).toBe("fridge_rescue");
  expect(accepted.todayPlan.items).toHaveLength(1);
});

test.each(["Yes.", "Sure", "Okay", "Let's do it"])("%s immediately confirms a fresh offer", async message => {
  const pending = offer(60_000);
  const response = await reply(message, pending, pending);
  expect(response.presentation?.navigation?.state).toBe("navigation_confirmed");
  expect(response.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId: "fridge_rescue" })]);
  expect(response.presentation?.message).not.toMatch(/\?|feel free/i);
});

test("the original complaint recovers expired context even across malformed filler", async () => {
  expect(isNavigationFailureComplaint(complaint)).toBe(true);
  (db.execute as jest.Mock).mockResolvedValue({ rows: [
    assistant(), { role: "user", content: complaint }, assistant(),
    { role: "user", content: "Yes." }, assistant(offer()),
  ] });
  const recovery = await loadNavigationRecoveryContext("conversation-fixture", "owner-fixture");
  const response = await reply(complaint, recovery);
  expect(response.presentation?.navigation?.state).toBe("recommendation_pending");
  expect(response.todayPlan.items).toEqual([]);
  expect(response.presentation?.message).not.toMatch(/^:|feel free/i);
});

test("a still-fresh authorized handoff is restored without another permission request", async () => {
  const authorized = { ...offer(60_000), state: "navigation_confirmed" as const };
  const response = await reply("Fridge Rescue didn't open. The button failed.", authorized, authorized);
  expect(response.presentation?.destinationId).toBe("fridge_rescue");
  expect(response.presentation?.navigation?.offeredAt).toBe(authorized.offeredAt);
  expect(response.todayPlan.items).toHaveLength(1);
  expect(response.presentation?.message).not.toMatch(/\?/);
});

test.each([
  undefined, offer(NAVIGATION_RECOVERY_WINDOW_MS), offer(-1),
  { ...offer(), performedAt: now.toISOString() },
])("complaints without valid matching context ask for a destination, never invent one: %#", async recovery => {
  const response = await reply(complaint, recovery);
  expect(response.presentation?.message).toContain("Which feature");
  expect(response.presentation?.navigation).toBeUndefined();
  expect(response.todayPlan.items).toEqual([]);
});

test("a complaint naming a different destination cannot revive the earlier offer", async () => {
  const response = await reply("Beverage Creator didn't open. The button failed.", offer());
  expect(response.presentation?.navigation).toBeUndefined();
});

test("unrelated discussion and rejection cannot renew an expired offer", async () => {
  for (const text of ["No, cancel that.", "What is protein?", "I'm done, goodbye."]) {
    const response = await reply(text, offer());
    expect(response.presentation?.navigation).toBeUndefined();
  }
});

test("expired boundary is exactly 30 minutes and safety still wins", async () => {
  expect((await reply("yes", offer(PENDING_NAVIGATION_TTL_MS))).todayPlan.items).toEqual([]);
  const safety = await reply("yes", offer(), undefined,
    { redFlag: true, careDisposition: "emergency", contactCare: "Seek emergency care." });
  expect(safety.meta.redFlag).toBe(true);
  expect(safety.presentation?.navigation).toBeUndefined();
});

test("locked/unavailable tools cannot be renewed or restored", async () => {
  const response = await reply(complaint, offer(), undefined, {}, []);
  expect(response.presentation?.navigation).toBeUndefined();
  expect(response.todayPlan.items).toEqual([]);
});

test("explicit requests remain independent of expired context", async () => {
  const response = await reply("I want to use Fridge Rescue", offer());
  expect(response.presentation?.navigation?.state).toBe("direct_navigation");
  expect(response.todayPlan.items).toHaveLength(1);
});

test("Development recovery does not activate in Production or query its history", async () => {
  process.env.NODE_ENV = "production";
  expect(await loadNavigationRecoveryContext("conversation-fixture", "owner-fixture")).toBeUndefined();
  expect(db.execute).not.toHaveBeenCalled();
  const response = await reply("yes", offer());
  expect(response.presentation?.navigation).toBeUndefined();
});
