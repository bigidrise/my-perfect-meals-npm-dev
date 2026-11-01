// No application DB/bootstrap/provider imports: synthetic HTTP requests only.
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.authUser) return res.status(401).json({ error: "Authentication required" });
    next();
  },
}));

import express from "express";
import request from "supertest";
import navigationRouter from "../routes/coachingNavigation";
import {
  COACH_DESTINATIONS, resolveCoachDestinationId, validateCoachNavigationItems,
} from "../../shared/coaching/navigation";
import { getCornerCapabilities } from "../services/coaching/capabilityRegistry";
import { requireProAccess } from "../middleware/requireProAccess";
import { requireClinicalAccess } from "../middleware/requireClinicalAccess";
import { requirePurchasedPlanEntitlement } from "../middleware/requirePurchasedPlanEntitlement";
import { requireEssentialAccess } from "../middleware/requireEssentialAccess";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function app(user: unknown = { accessTier: "PAID_FULL", planLookupKey: "mpm_premium_monthly" }) {
  const instance = express();
  instance.use(express.json());
  instance.use((req: any, _res, next) => { req.authUser = user; next(); });
  instance.use("/api/coach", navigationRouter);
  return instance;
}
const originalEnv = process.env.NODE_ENV;
afterAll(() => { process.env.NODE_ENV = originalEnv; });

describe.each(["development", "production"])("%s server-validated Chef navigation", runtimeEnvironment => {
  beforeEach(() => { process.env.NODE_ENV = runtimeEnvironment; });
  test.each(["grocery_find_product", "grocery_create_meal", "product_scan"] as const)(
    "%s keeps its Pro boundary and parent-only route in both environments", async id => {
    const anonymous = await request(app(null)).post("/api/coach/navigation").send({ destinationId: id });
    expect(anonymous.status).toBe(401);
    for (const planLookupKey of ["mpm_basic_monthly", "mpm_premium_monthly", "mpm_ultimate_monthly"]) {
      const response = await request(app({ accessTier: "PAID_FULL", planLookupKey }))
        .post("/api/coach/navigation").send({ destinationId: id });
      const allowed = planLookupKey !== "mpm_basic_monthly";
      expect(response.status).toBe(allowed ? 200 : 403);
      expect(response.body.route).toBe(allowed ? "/shopping-list-v2" : undefined);
    }
    const transfer = await request(app()).post("/api/coach/navigation").send({
      destinationId: id, creatorRequest: { destinationId: "create_a_dish", idea: "Dinner" },
    });
    expect(transfer.status).toBe(400);
    expect(resolveCoachDestinationId("/shopping-list-v2")).toBeUndefined();
    process.env.NODE_ENV = "production";
    const production = await request(app()).post("/api/coach/navigation").send({ destinationId: id });
    expect(production.status).toBe(200);
    expect(production.body.route).toBe("/shopping-list-v2");
    expect(getCornerCapabilities(["all"]).some(cap => cap.id === id)).toBe(true);
  });

  test("new destinations match the guarded member entry routes, not specialized builders", () => {
    const router = readFileSync(join(process.cwd(), "client/src/components/Router.tsx"), "utf8");
    expect(COACH_DESTINATIONS.my_perfect_menu.route).toBe("/foods-i-enjoy");
    expect(COACH_DESTINATIONS.meal_builders.route).toBe("/builders");
    expect(router).toContain('<Route path="/foods-i-enjoy" component={GuardedMyPerfectMenu}');
    expect(router).toContain('<Route path="/builders" component={GuardedBuilders}');
    expect(router).toContain("const GuardedMyPerfectMenu = () => <PaywallGuard");
    expect(router).toContain("const GuardedBuilders = () => <MealBuildersGuard");
  });

  test.each(["my_perfect_menu", "meal_builders"])("%s enforces Pro access, rejects handoffs, and supports Production", async id => {
    for (const user of [null, { accessTier: "FREE", planLookupKey: null },
      { accessTier: "PAID_FULL", planLookupKey: "mpm_basic_monthly" }]) {
      const denied = await request(app(user)).post("/api/coach/navigation").send({ destinationId: id });
      expect(denied.status).toBe(user ? 403 : 401);
      expect(denied.body.route).toBeUndefined();
    }
    for (const planLookupKey of ["mpm_premium_monthly", "mpm_ultimate_monthly"]) {
      const allowed = await request(app({ accessTier: "PAID_FULL", planLookupKey }))
        .post("/api/coach/navigation").send({ destinationId: id });
      expect(allowed.status).toBe(200);
      expect(allowed.body.route).toBe(COACH_DESTINATIONS[id as keyof typeof COACH_DESTINATIONS].route);
    }
    const transfer = await request(app()).post("/api/coach/navigation").send({
      destinationId: id, creatorRequest: { destinationId: "create_a_dish", idea: "Chicken soup" },
    });
    expect(transfer.status).toBe(400);
    process.env.NODE_ENV = "production";
    const production = await request(app()).post("/api/coach/navigation").send({ destinationId: id });
    expect(production.status).toBe(200);
    expect(production.body.route).toBe(COACH_DESTINATIONS[id as keyof typeof COACH_DESTINATIONS].route);
    expect(getCornerCapabilities(["all"]).some(cap => cap.id === id)).toBe(true);
  });

  test.each(Object.entries(COACH_DESTINATIONS))("%s resolves only its fixed route", (id, destination) => {
    const items = validateCoachNavigationItems([
      { kind: "use_feature", featureTarget: id, destinationId: "untrusted" },
    ], true);
    expect(items[0].destinationId).toBe(id);
    const sameRoute = Object.values(COACH_DESTINATIONS).filter(other => other.route === destination.route);
    expect(resolveCoachDestinationId(destination.route)).toBe(sameRoute.length === 1 ? id : undefined);
    expect(destination.route).not.toMatch(/[?#]/);
  });

  test.each([
    "https://evil.example", "//evil.example", "javascript:alert(1)", "/auth",
    "/lifestyle/beverage-creator?generate=true", "pregnancy_coach", "wine_pairing_ai",
    "__proto__", "constructor", "made_up_feature",
  ])("rejects unknown, paused, or injected target %s", target => {
    expect(resolveCoachDestinationId(target)).toBeUndefined();
    expect(validateCoachNavigationItems([
      { kind: "use_feature", featureTarget: target, destinationId: "beverage_creator" },
    ], true)[0]).toEqual({ kind: "use_feature" });
  });

  test("clarification needs no navigation; changed preference replaces the action", () => {
    expect(validateCoachNavigationItems([{ kind: "other", text: "What kind of drink?" }], true))
      .toEqual([{ kind: "other", text: "What kind of drink?" }]);
    const regular = validateCoachNavigationItems([{ kind: "use_feature", featureTarget: "beverage_creator" }], true);
    const changed = validateCoachNavigationItems([{ kind: "use_feature", featureTarget: "athlete_beverage_creator" }], true);
    expect(regular[0]).toHaveProperty("destinationId", "beverage_creator");
    expect(changed[0]).toHaveProperty("destinationId", "athlete_beverage_creator");
  });

  test("safety escalation suppresses every navigation action", () => {
    const items = validateCoachNavigationItems([
      { kind: "contact_care" }, { kind: "use_feature", featureTarget: "hydration_center" },
    ], true);
    expect(items.every(item => !("destinationId" in item) && !("featureTarget" in item))).toBe(true);
  });

  test("non-feature items cannot carry navigation, and production never adds it", () => {
    expect(validateCoachNavigationItems([{ kind: "eat", featureTarget: "sushi_creator" }], true)[0])
      .not.toHaveProperty("destinationId");
    expect(validateCoachNavigationItems([{ kind: "use_feature", featureTarget: "sushi_creator", destinationId: "sushi_creator" }], false)[0])
      .not.toHaveProperty("destinationId");
  });

  test("registry provides clear destination distinctions without activating paused coaches", () => {
    const caps = getCornerCapabilities(["all"]);
    for (const id of Object.keys(COACH_DESTINATIONS)) expect(caps.some(cap => cap.id === id)).toBe(true);
    expect(caps.find(cap => cap.id === "restaurant_guide")?.description).toContain("already chosen");
    expect(caps.find(cap => cap.id === "find_meals_near_me")?.description).toContain("has not chosen one");
    expect(COACH_DESTINATIONS).not.toHaveProperty("pregnancy_coach");
    expect(COACH_DESTINATIONS).not.toHaveProperty("wine_pairing_ai");
    for (const cap of caps) {
      expect(cap.description).toContain("Required inputs and handoff:");
      expect(cap.description).toContain(`Verified destination: ${cap.route}`);
      expect(cap.description).toContain("destination guards still apply");
    }
    const dishDescription = caps.find(cap => cap.id === "create_a_dish")?.description;
    expect(dishDescription).toContain("specific dish selected for preparation help in context");
    expect(dishDescription).toContain("Mere dish discussion");
    expect(dishDescription).not.toContain("chicken Caesar salad");
    expect(caps.find(cap => cap.id === "beverage_creator")?.description).toContain("not manufacture/reuse");
    expect(caps.some(cap => cap.id === "meal_planning" || cap.id === "clinical_hubs")).toBe(false);
  });

  test("current access guards are reused, not replaced with model eligibility", async () => {
    const user = { accessTier: "PAID_FULL", planLookupKey: "mpm_premium_monthly" };
    const invoke = (guard: any) => {
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      guard({ authUser: user }, res, next);
      return { allowed: next.mock.calls.length > 0, status: res.status.mock.calls[0]?.[0] };
    };
    for (const [id, destination] of Object.entries(COACH_DESTINATIONS)) {
      const response = await request(app(user)).post("/api/coach/navigation").send({ destinationId: id });
      const guard = destination.access === "hydration" ? requirePurchasedPlanEntitlement("hydration_center")
        : destination.access === "essential" ? requireEssentialAccess
        : destination.access === "clinical" ? requireClinicalAccess
        : destination.access === "pro" ? requireProAccess : null;
      if (!guard || invoke(guard).allowed) {
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ destinationId: id, route: destination.route });
      } else expect(response.status).toBe(invoke(guard).status);
    }
  });

  test("unpaid hydration access is denied even in development", async () => {
    const response = await request(app({ accessTier: "FREE", planLookupKey: null }))
      .post("/api/coach/navigation").send({ destinationId: "hydration_center" });
    expect(response.status).toBe(403);
    expect(response.body).not.toHaveProperty("route");
  });

  test("enforced Pro/Clinical locks deny navigation and still honor existing temporary access", async () => {
    const previous = process.env.BILLING_ENFORCED;
    let strictRouter: any;
    try {
      process.env.BILLING_ENFORCED = "true";
      jest.isolateModules(() => { strictRouter = require("../routes/coachingNavigation").default; });
    } finally {
      if (previous === undefined) delete process.env.BILLING_ENFORCED;
      else process.env.BILLING_ENFORCED = previous;
    }
    const strictApp = (user: unknown) => {
      const instance = express();
      instance.use(express.json());
      instance.use((req: any, _res, next) => { req.authUser = user; next(); });
      instance.use("/api/coach", strictRouter);
      return instance;
    };
    for (const id of ["sushi_creator", "my_perfect_getaway"]) {
      const denied = await request(strictApp({ accessTier: "FREE", planLookupKey: null }))
        .post("/api/coach/navigation").send({ destinationId: id });
      expect(denied.status).toBe(403);
      expect(denied.body).not.toHaveProperty("route");
      const temporary = await request(strictApp({
        accessTier: "PAID_FULL", temporaryClinicalAccess: true, planLookupKey: null,
      })).post("/api/coach/navigation").send({ destinationId: id });
      expect(temporary.status).toBe(200);
    }
  });

  test("requires authentication, rejects unknown IDs, and supports the Production conversation", async () => {
    expect((await request(app(null)).post("/api/coach/navigation").send({ destinationId: "sushi_creator" })).status).toBe(401);
    expect((await request(app()).post("/api/coach/navigation").send({ destinationId: "https://evil.example" })).status).toBe(400);
    process.env.NODE_ENV = "production";
    expect((await request(app()).post("/api/coach/navigation").send({ destinationId: "sushi_creator" })).status).toBe(200);
    expect(getCornerCapabilities(["all"]).some(cap => cap.id === "athlete_beverage_creator")).toBe(true);
  });

  test("Create a Dish handoff returns only an encoded editable idea after authentication", async () => {
    const creatorRequest = { destinationId: "create_a_dish", idea: "Chicken soup & herbs? #1" };
    const response = await request(app()).post("/api/coach/navigation")
      .send({ destinationId: "create_a_dish", creatorRequest });
    expect(response.status).toBe(200);
    const route = new URL(response.body.route, "https://app.example");
    expect(route.pathname).toBe("/lifestyle/create-a-dish");
    expect([...route.searchParams.keys()]).toEqual(["idea"]);
    expect(route.searchParams.get("idea")).toBe(creatorRequest.idea);
    expect((await request(app(null)).post("/api/coach/navigation")
      .send({ destinationId: "create_a_dish", creatorRequest })).status).toBe(401);
  });

  test.each([
    { destinationId: "sushi_creator", creatorRequest: { destinationId: "create_a_dish", idea: "Soup" } },
    { destinationId: "create_a_dish", creatorRequest: { destinationId: "create_a_dish", idea: "" } },
    { destinationId: "create_a_dish", creatorRequest: { destinationId: "create_a_dish", idea: "x".repeat(601) } },
    { destinationId: "create_a_dish", creatorRequest: { destinationId: "create_a_dish", idea: "Soup\n" } },
    { destinationId: "create_a_dish", creatorRequest: { destinationId: "create_a_dish", idea: "Soup", generate: true } },
    { destinationId: "create_a_dish", creatorRequest: { destinationId: "create_a_dish", idea: "Soup", redirect: "https://evil.example" } },
  ])("rejects unsupported or unsafe request metadata %j", async body => {
    const response = await request(app()).post("/api/coach/navigation").send(body);
    expect(response.status).toBe(400);
    expect(response.body).not.toHaveProperty("route");
  });
});
