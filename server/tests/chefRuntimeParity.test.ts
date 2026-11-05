jest.mock("../db", () => ({ db: { execute: jest.fn() } }));
import express from "express";
import request from "supertest";
import { db } from "../db";
import { requireAskChefAvailability } from "../middleware/requireAskChefAvailability";
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { getChefConversationInstructions } from "../services/coaching/conciergeInstructions";
import { getPlatformGuidanceInstructions } from "../services/coaching/platformKnowledge";
import { loadRecentConciergeState } from "../services/coaching/conciergeNavigationState";
import { navigationGoal } from "../services/coaching/verifiedNavigation";
import { isAskChefVisible } from "../../shared/coaching/askChefRelease";
import { featureIntelligenceEnabled } from "../services/coaching/featureIntelligence";
import type { PendingRecommendation } from "../services/coaching/conciergeNavigationState";

const originalEnvironment = process.env.NODE_ENV;
const originalAvailability = process.env.VITE_COACHES_CORNER_ENABLED;
const now = new Date().toISOString();
afterEach(() => {
  process.env.NODE_ENV = originalEnvironment;
  if (originalAvailability === undefined) delete process.env.VITE_COACHES_CORNER_ENABLED;
  else process.env.VITE_COACHES_CORNER_ENABLED = originalAvailability;
  jest.restoreAllMocks();
});

describe.each(["development", "production"])("%s approved Chef behavior", environment => {
  beforeEach(() => {
    process.env.NODE_ENV = environment;
    jest.spyOn(console, "info").mockImplementation(() => {});
  });
  const tools = getCornerCapabilities(["all"], "production")
    .map(tool => ({ ...tool, scope: "adult" as const, featureTarget: tool.id }));
  const call = async (message: string, extra: Record<string, unknown> = {}, raw: Record<string, unknown> = {}) => {
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      message: "Which workflow would you like?", memberNeed: "unclear", responsePurpose: "clarify",
      navigationIntent: "none", pendingNavigationDisposition: "clear", conciergeDecision: null,
      conversationMessage: null, recommendationMessage: null, handoffMessage: null,
      careDisposition: "none", redFlag: false, creatorRequest: null, ...raw,
    }) } }] });
    const result = await runConciergeConversation({
      client: { chat: { completions: { create } } } as any,
      userMessage: message, history: [], rollingContext: null, context: {}, tools, ...extra,
    });
    return { result, create };
  };
  test.each(["yes", "sure", "okay", "let's do it", "open it"])("re-emits a fresh unperformed action for %s", async answer => {
    const pendingRecommendation: PendingRecommendation = {
      state: "navigation_confirmed", destinationId: "beverage_creator",
      goal: navigationGoal("beverage_creator"), offeredAt: now,
    };
    const { result } = await call(answer, { pendingRecommendation });
    expect(result.presentation?.destinationId).toBe("beverage_creator");
    expect(result.presentation?.navigation?.offeredAt).toBe(now);
    expect(result.presentation?.message).not.toMatch(/\?/);
    expect(result.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId: "beverage_creator" })]);
  });
  test.each([
    ["A whole pie.", "dessert_creator"], ["A small treat.", "craving_creator"],
    ["Open Beverage Creator.", "beverage_creator"],
    ["I already said I wanted my perfect menu. I said menu.", "my_perfect_menu"],
  ])("emits the authorized selected action for %s", async (message, destinationId) => {
    const { result } = await call(message, { featureChoice: { kind: "dessert_size", offeredAt: now } });
    expect(result.presentation?.destinationId).toBe(destinationId);
    expect(result.todayPlan.items).toEqual([expect.objectContaining({ kind: "use_feature", destinationId })]);
  });
  test("ambiguous yes retains the two-way choice without inventing consent", async () => {
    const { result } = await call("yes", { featureChoice: { kind: "dessert_size", offeredAt: now } });
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.presentation?.featureChoice).toEqual({ kind: "dessert_size", offeredAt: now });
    expect(result.presentation?.message).toContain("Craving Creator");
    expect(result.presentation?.message).toContain("Dessert Creator");
  });
  test.each(["stale", "performed"] as const)("a %s offer cannot be reopened by yes", async disposition => {
    const pendingRecommendation = {
      state: "navigation_confirmed", destinationId: "beverage_creator", goal: navigationGoal("beverage_creator"),
      offeredAt: disposition === "stale" ? new Date(Date.now() - 31 * 60_000).toISOString() : now,
      ...(disposition === "performed" ? { performedAt: now } : {}),
    };
    const { result } = await call("yes", { pendingRecommendation });
    expect(result.presentation?.destinationId).toBeUndefined();
  });
  test("care escalation precedes a clear navigation selection", async () => {
    const { result } = await call("Open Beverage Creator.", {}, {
      careDisposition: "emergency", redFlag: true, contactCare: "Seek urgent medical help.",
    });
    expect(result.meta.redFlag).toBe(true);
    expect(result.presentation?.destinationId).toBeUndefined();
    expect(result.todayPlan.items.some(item => typeof item !== "string" && item.kind === "use_feature")).toBe(false);
  });
  test("unavailable destinations never gain an action through the deterministic correction", async () => {
    const { result } = await call("Open Beverage Creator.", { tools: [] });
    expect(result.presentation?.destinationId).toBeUndefined();
  });
  test("the self-scoped latest-message loader restores dessert choice and performed evidence", async () => {
    (db.execute as jest.Mock).mockResolvedValueOnce({ rows: [{
      created_at: now,
      structured_payload: { presentation: {
        featureChoice: { kind: "dessert_size", offeredAt: now },
        navigation: { state: "direct_navigation", destinationId: "beverage_creator",
          goal: navigationGoal("beverage_creator"), offeredAt: now, performedAt: now },
      } },
    }] });
    expect(await loadRecentConciergeState("synthetic-conversation", "synthetic-owner")).toMatchObject({
      featureChoice: { kind: "dessert_size", offeredAt: now }, navigation: { performedAt: now },
    });
  });
  test("the existing false availability override hides Chef APIs without blocking other platform routes", async () => {
    process.env.VITE_COACHES_CORNER_ENABLED = "false";
    const app = express();
    app.use("/api/coach", requireAskChefAvailability);
    app.get("/api/coach/bootstrap", (_req, res) => res.json({ enabled: true }));
    app.post("/api/coach/message", (_req, res) => res.json({ enabled: true }));
    app.get("/api/unrelated", (_req, res) => res.json({ untouched: true }));
    expect(isAskChefVisible(true, "false")).toBe(false);
    expect((await request(app).get("/api/coach/bootstrap")).status).toBe(404);
    expect((await request(app).post("/api/coach/message")).status).toBe(404);
    expect((await request(app).get("/api/unrelated")).body).toEqual({ untouched: true });
    process.env.VITE_COACHES_CORNER_ENABLED = "true";
    expect((await request(app).get("/api/coach/bootstrap")).body).toEqual({ enabled: true });
    expect(getChefConversationInstructions(environment)).toBe(getChefConversationInstructions("production"));
  });
  test.each(["true", "false"])("client route visibility and API protection agree for availability=%s", async availability => {
    process.env.VITE_COACHES_CORNER_ENABLED = availability;
    const app = express();
    const protectedHandler = jest.fn((_req, res) => res.json({ authenticatedFeature: true }));
    // Availability runs before protected handlers. This fixture isolates the
    // gate; real-route authentication/permissions are tested in route suites.
    app.use("/api/coach", requireAskChefAvailability);
    for (const path of ["/api/coach/bootstrap", "/api/coach/navigation", "/api/coach/navigation/performed"]) {
      app.get(path, protectedHandler);
      const result = await request(app).get(path);
      expect(result.status).toBe(availability === "true" ? 200 : 404);
    }
    expect(isAskChefVisible(environment === "production", availability)).toBe(availability === "true");
    if (availability === "false") expect(protectedHandler).not.toHaveBeenCalled();
  });
  test("TRUE does not bypass downstream authentication", async () => {
    process.env.VITE_COACHES_CORNER_ENABLED = "true";
    const app = express();
    app.use("/api/coach", requireAskChefAvailability);
    app.get("/api/coach/bootstrap", (_req, res) => { res.status(401).json({ error: "Authentication required" }); });
    expect((await request(app).get("/api/coach/bootstrap")).status).toBe(401);
  });
});

test("navigation instructions and capabilities have no Development/Production split", () => {
  expect(getPlatformGuidanceInstructions("production")).toBe(getPlatformGuidanceInstructions("development"));
  expect(getChefConversationInstructions("production")).toBe(getChefConversationInstructions("development"));
  expect(getCornerCapabilities(["all"], "production")).toEqual(getCornerCapabilities(["all"], "development"));
});
test("Feature Intelligence remains an explicitly isolated experiment, not a release dependency", () => {
  expect(featureIntelligenceEnabled({ NODE_ENV: "production", ASK_CHEF_FEATURE_INTELLIGENCE: "true" })).toBe(false);
  expect(featureIntelligenceEnabled({ NODE_ENV: "development", REPLIT_DEPLOYMENT: "1", ASK_CHEF_FEATURE_INTELLIGENCE: "true" })).toBe(false);
});
