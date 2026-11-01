// Isolated HTTP authorization checks. No live database or paid provider calls.
jest.mock("../db", () => ({ db: { execute: jest.fn(), select: jest.fn() } }));
jest.mock("../services/coaching/engine", () => ({ engine: { run: jest.fn() } }));
jest.mock("../services/coaching/activityEvents", () => ({ emitActivityEvent: jest.fn() }));
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) =>
    req.authUser ? next() : res.status(401).json({ error: "Authentication required" }),
}));

import express from "express";
import request from "supertest";
import fs from "node:fs";
import { requireEssentialAccess } from "../middleware/requireEssentialAccess";
import { hasActivePaidSubscription, isProOrAbove } from "../../client/src/lib/subscriptionCheck";
import { PLAN_SKUS } from "../../client/src/data/planSkus";
import { PLAN_FEATURES, getTierForLookupKey, tierIncludesEntitlement } from "../../shared/planFeatures";

const oldBilling = process.env.BILLING_ENFORCED;
const oldEnvironment = process.env.NODE_ENV;
process.env.BILLING_ENFORCED = "true";
// Load the real Pro middleware only after explicitly enabling enforcement.
const coachRouter = require("../routes/coachingEngine").default;
const { db } = require("../db");
const { engine } = require("../services/coaching/engine");

function app(user: unknown) {
  const instance = express();
  instance.use(express.json());
  instance.use((req: any, _res, next) => { req.authUser = user; next(); });
  instance.use("/api/coach", coachRouter);
  // The exact same outer guard mounted on the complete real Menu router.
  instance.use("/api/my-perfect-menu", requireEssentialAccess, (_req, res) => res.json({ allowed: true }));
  return instance;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NODE_ENV = "production";
  db.execute.mockImplementation(() => { throw new Error("Unexpected database call"); });
  db.select.mockImplementation(() => { throw new Error("Unexpected profile lookup"); });
  engine.run.mockImplementation(() => { throw new Error("Unexpected provider call"); });
});
afterAll(() => {
  if (oldBilling === undefined) delete process.env.BILLING_ENFORCED;
  else process.env.BILLING_ENFORCED = oldBilling;
  process.env.NODE_ENV = oldEnvironment;
});

const consumerMatrix = [
  ["Free", "FREE", "mpm_free", false, false],
  ["Essential", "PAID_FULL", "mpm_basic", true, false],
  ["Pro", "PAID_FULL", "mpm_premium", true, true],
  ["Clinical", "PAID_FULL", "mpm_ultimate", true, true],
  ["legacy Essential", "PAID_FULL", "mpm_basic_monthly", true, false],
  ["legacy Pro", "PAID_FULL", "mpm_premium_monthly", true, true],
  ["legacy Clinical", "PAID_FULL", "mpm_ultimate_monthly", true, true],
  ["Family Essential", "PAID_FULL", "mpm_family_base", true, false],
  ["Family Pro", "PAID_FULL", "mpm_family_premium", true, true],
  ["Family Clinical", "PAID_FULL", "mpm_family_ultimate", true, true],
  ["provider Clinical", "PAID_FULL", "clinical_business_monthly", true, true],
  ["provider Studio", "PAID_FULL", "mpm_procare_trainer_5", true, true],
] as const;

test.each(consumerMatrix)("%s has matching Menu/Chef frontend and backend access", async (_label, accessTier, planLookupKey, menu, chef) => {
  const user = { id: "fixture-account", accessTier, planLookupKey };
  expect(hasActivePaidSubscription(user)).toBe(menu);
  expect(isProOrAbove(user)).toBe(chef);
  expect(tierIncludesEntitlement(getTierForLookupKey(planLookupKey), "my_perfect_menu")).toBe(menu);
  const instance = app(user);
  expect((await request(instance).post("/api/my-perfect-menu/concepts")).status).toBe(menu ? 200 : 403);
  if (chef) {
    db.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ completedAt: new Date() }] }) }) });
    engine.run.mockResolvedValue({ conversationId: "fixture-conversation", messageId: "fixture-message", todayPlan: { items: [] } });
  }
  const response = await request(instance).post("/api/coach/message").send({ message: "A fixture question." });
  expect(response.status).toBe(chef ? 200 : 403);
  expect(engine.run).toHaveBeenCalledTimes(chef ? 1 : 0);
});

const conversationPaths = [
  ["post", "/message"],
  ["get", "/conversation"],
  ["get", "/conversation/fixture/messages"],
  ["get", "/bootstrap"],
  ["get", "/messages/older?conversationId=fixture&beforeId=fixture"],
  ["get", "/plans"],
  ["post", "/plans/fixture/items/fixture/complete"],
  ["get", "/followup/due"],
  ["post", "/followup/fixture/deliver"],
  ["delete", "/message/fixture"],
  ["delete", "/conversation/fixture"],
] as const;
test.each(conversationPaths)("%s %s rejects anonymous, Free and Essential before reads or writes", async (method, route) => {
  for (const user of [
    null,
    { id: "fixture-free", accessTier: "FREE", planLookupKey: null },
    { id: "fixture-basic", accessTier: "PAID_FULL", planLookupKey: "mpm_basic" },
  ]) {
    const response = await request(app(user))[method](`/api/coach${route}`)
      .send({ message: "Hello", planLookupKey: "mpm_ultimate", accessTier: "PAID_FULL" });
    expect(response.status).toBe(user ? 403 : 401);
    if (user) expect(response.body.code).toBe("PRO_REQUIRED");
  }
  expect(db.execute).not.toHaveBeenCalled();
  expect(db.select).not.toHaveBeenCalled();
  expect(engine.run).not.toHaveBeenCalled();
});

test.each(["/concepts", "/context-status", "/effective-builder", "/validate-selection"])("Menu outer guard protects %s", async route => {
  expect((await request(app(null)).post(`/api/my-perfect-menu${route}`)).status).toBe(401);
  const denied = await request(app({ id: "fixture", accessTier: "FREE", planLookupKey: null }))
    .post(`/api/my-perfect-menu${route}`).send({ planLookupKey: "mpm_ultimate" });
  expect(denied.status).toBe(403);
  expect(denied.body.code).toBe("ESSENTIAL_REQUIRED");
});

test.each([
  { accessTier: "PAID_FULL", planLookupKey: null },
  { accessTier: "PAID_FULL", planLookupKey: "mpm_basic", pilotFullAccess: true },
  { accessTier: "PAID_FULL", planLookupKey: "mpm_basic", temporaryClinicalAccess: true },
])("existing server-resolved full access remains authorized: %j", async entitlement => {
  process.env.NODE_ENV = "development";
  engine.run.mockResolvedValue({ conversationId: "fixture", todayPlan: { items: [] } });
  const response = await request(app({ id: "fixture-account", ...entitlement }))
    .post("/api/coach/message").send({ message: "Fixture question." });
  expect(response.status).toBe(200);
});

test("activation is unchanged and destination authorization remains independent", async () => {
  const user = { id: "fixture-pro", accessTier: "PAID_FULL", planLookupKey: "mpm_premium" };
  expect((await request(app(user)).post("/api/coach/navigation").send({ destinationId: "my_perfect_menu" })).status).toBe(404);
  process.env.NODE_ENV = "development";
  const allowed = await request(app(user)).post("/api/coach/navigation").send({ destinationId: "my_perfect_menu" });
  expect(allowed.status).toBe(200);
  expect(allowed.body.route).toBe("/foods-i-enjoy");
  const denied = await request(app(user)).post("/api/coach/navigation").send({ destinationId: "my_perfect_getaway" });
  expect(denied.status).toBe(403);
  expect(denied.body).not.toHaveProperty("route");
});

test("guard wiring and minimum-tier upgrade names match the matrix", () => {
  const source = fs.readFileSync("client/src/components/Router.tsx", "utf8");
  expect(source).toContain("const GuardedMyPerfectMenu = () => <PaywallGuard component={MyPerfectMenu} />");
  for (const name of ["Home", "Welcome", "Intake", "Complete", "ProgressSlowed", "Tired"]) {
    expect(source).toMatch(new RegExp(`const GuardedChef${name} = \\(\\) => <ProGuard component=`));
    expect(source).toContain(`component={GuardedChef${name}}`);
  }
  expect(source).toContain('"/foods-i-enjoy": "My Perfect Menu"');
  expect(source).toContain('"/coach-corner": "Ask Chef"');
  expect(source).toContain('requestUpgrade({ requiredTier: "essential"');
  expect(source).toContain('requestUpgrade({ requiredTier: "pro"');
});

test("both subscription listings and discovery copy state the correct minimum tiers", () => {
  expect(PLAN_FEATURES.basic.displayFeatures.some(text => text.startsWith("My Perfect Menu"))).toBe(true);
  expect(PLAN_SKUS.find(plan => plan.sku === "mpm_basic")?.features?.some(text => text.startsWith("My Perfect Menu"))).toBe(true);
  expect(PLAN_FEATURES.premium.displayFeatures.some(text => text.startsWith("Ask Chef"))).toBe(true);
  expect(PLAN_SKUS.find(plan => plan.sku === "mpm_premium")?.features?.some(text => text.startsWith("Ask Chef"))).toBe(true);
  expect(PLAN_FEATURES.basic.displayFeatures.some(text => text.startsWith("Ask Chef"))).toBe(false);
  expect(PLAN_SKUS.find(plan => plan.sku === "mpm_basic")?.features?.some(text => text.startsWith("Ask Chef"))).toBe(false);
  expect(fs.readFileSync("client/src/pages/Learn.tsx", "utf8")).toContain('subtitle: "Included with Essential, Pro, and Clinical"');
  expect(fs.readFileSync("client/src/pages/DashboardNew.tsx", "utf8")).toContain("Essential and above");
});
