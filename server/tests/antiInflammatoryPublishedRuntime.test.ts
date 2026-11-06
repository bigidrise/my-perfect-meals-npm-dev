import express from "express";
import request from "supertest";
import fs from "node:fs";
import { createProductionSupportStore } from "../../scripts/anti-inflammatory-review/productionStore";
import { csrfProtection } from "../lib/csrfProtection";

let mockStore: ReturnType<typeof createProductionSupportStore>;
jest.mock("../db", () => ({ pool: {
  query: (...args: Parameters<typeof mockStore.query>) => mockStore.query(...args),
  connect: () => mockStore.connect(),
} }));
jest.mock("../services/healthProtocols/resolveHealthProtocolState", () => ({
  resolveHealthProtocolState: () => { throw new Error("Released preference must not run experimental clinical resolution"); },
}));
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const id = req.get("x-fixture-user");
    if (!id) return res.status(401).json({ error: "Authentication required" });
    req.authUser = { id }; next();
  },
}));
import router from "../routes/antiInflammatorySupport";
import { setPersonalAntiInflammatorySupport, setUserNutritionSupport, setProviderProtocol, devOnly } from "../services/healthProtocols/persistence";
import { readDevelopmentPersonalFoodSupports } from "../services/healthProtocols/developmentFoodSupports";
import { optionalAntiInflammatoryViolations } from "../services/healthProtocols/antiInflammatorySupportValidation";
import { PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED } from "../../shared/personalFoodSupportFreeze";

const endpoint = "/api/health-context/support/anti_inflammatory";
const oldEnv = process.env.NODE_ENV;
const oldDeployment = process.env.REPLIT_DEPLOYMENT;
let app: express.Express;
const write = (body: unknown, user = "synthetic-a") => request(app).put(endpoint)
  .set("Host", "fixture.test").set("x-fixture-user", user).set("Origin", "http://fixture.test")
  .set("x-csrf-token", "fixture-csrf").send(body);
beforeEach(() => {
  process.env.NODE_ENV = "production"; process.env.REPLIT_DEPLOYMENT = "1";
  mockStore = createProductionSupportStore();
  app = express(); app.use(express.json());
  app.use((req: any, _res, next) => {
    const id = req.get("x-fixture-user");
    if (id) req.session = { userId: id, csrfToken: "fixture-csrf" };
    next();
  });
  app.use(csrfProtection);
  app.use(endpoint, router());
});
afterAll(() => {
  process.env.NODE_ENV = oldEnv;
  if (oldDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT; else process.env.REPLIT_DEPLOYMENT = oldDeployment;
});

test("production server mounts only the released route, with the same exact mount in preview", () => {
  for (const file of ["server/index.ts", "server/prod.ts"]) {
    expect(fs.readFileSync(file, "utf8")).toContain('app.use("/api/health-context/support/anti_inflammatory", antiInflammatorySupportRouter());');
  }
  expect(fs.readFileSync("server/prod.ts", "utf8")).not.toContain('import("./routes/healthContextControl")');
});
test.each(["general_nutrition", "diabetic", "glp1"])(
  "%s persists on/off through real handlers, transactions and reads in a published runtime", async () => {
    for (const enabled of [true, false, true]) {
      const response = await write({ enabled });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ enabled, legacyPreferenceSaved: enabled });
      expect((await request(app).get(endpoint).set("x-fixture-user", "synthetic-a")).body.enabled).toBe(enabled);
      const supports = await readDevelopmentPersonalFoodSupports("synthetic-a");
      expect(supports.has("anti_inflammatory")).toBe(enabled);
      expect(supports.has("glp1")).toBe(false);
      const violations = optionalAntiInflammatoryViolations({
        ingredients: [{ name: "canola oil" }], instructions: ["Bake."],
      }, supports.has("anti_inflammatory"));
      expect(violations.length > 0).toBe(enabled);
    }
    expect(mockStore.sources).toHaveLength(1);
    expect(mockStore.calls.filter(call => call.sql.startsWith("UPDATE users")).every(call =>
      !/selected_meal_builder|medical_conditions|specialty_conditions/.test(call.sql))).toBe(true);
  },
);
test("anonymous access and cross-origin or missing-CSRF writes never read or mutate preferences", async () => {
  expect((await request(app).get(endpoint)).status).toBe(401);
  expect((await request(app).put(endpoint).set("x-requested-with", "XMLHttpRequest").send({ enabled: true })).status).toBe(401);
  const missingCsrf = await request(app).put(endpoint).set("Host", "fixture.test")
    .set("Origin", "http://fixture.test").set("x-fixture-user", "synthetic-a").send({ enabled: true });
  expect(missingCsrf.status).toBe(403);
  expect(missingCsrf.body.code).toBe("CSRF_TOKEN_INVALID");
  expect((await write({ enabled: true }).set("Origin", "https://foreign.invalid")).status).toBe(403);
  expect(mockStore.calls).toHaveLength(0);
});
test.each(["subjectUserId", "userId", "actorUserId", "protocol"])("rejects identity/protocol injection through %s", async field => {
  expect((await write({ enabled: true, [field]: "synthetic-b" })).status).toBe(400);
  expect(mockStore.calls).toHaveLength(0);
});
test("account state stays isolated and direct cross-subject service calls are denied", async () => {
  await write({ enabled: true });
  expect((await request(app).get(endpoint).set("x-fixture-user", "synthetic-b")).body.enabled).toBe(false);
  await expect(setPersonalAntiInflammatorySupport({
    actorUserId: "synthetic-a", subjectUserId: "synthetic-b", enabled: true,
  })).rejects.toThrow("Only the subject");
  expect(mockStore.preferences.get("synthetic-b")).toBe(false);
});
test("off changes only the personal source; physician source and other account survive", async () => {
  mockStore.sources.push({
    id: "physician-source", subject_user_id: "synthetic-a", protocol_key: "anti_inflammatory",
    source_kind: "provider", evidence_ref: "membership:synthetic", status: "active", owner_user_id: "physician",
  });
  await write({ enabled: true }, "synthetic-b");
  await write({ enabled: true }); await write({ enabled: false });
  expect(mockStore.sources.find(row => row.id === "physician-source")?.status).toBe("active");
  expect((await readDevelopmentPersonalFoodSupports("synthetic-b")).has("anti_inflammatory")).toBe(true);
});
test("failed preference writes roll back source and event together, returning failure not fake success", async () => {
  mockStore.failPreferenceWrite = true;
  expect((await write({ enabled: true })).status).toBe(503);
  expect(mockStore.sources).toHaveLength(0); expect(mockStore.events).toHaveLength(0);
  expect(mockStore.preferences.get("synthetic-a")).toBe(false);
});
test("experimental storage and GLP-1 activation retain the deployment boundary", async () => {
  expect(PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED).toBe(false);
  expect(() => devOnly()).toThrow("DEV-only");
  await expect(setUserNutritionSupport({
    actorUserId: "synthetic-a", subjectUserId: "synthetic-a", protocol: "glp1", enabled: true,
  })).rejects.toThrow("DEV-only");
  await expect(setProviderProtocol({
    actorUserId: "physician", subjectUserId: "synthetic-a", membershipId: "synthetic",
    protocol: "kidney-disease", enabled: true,
  })).rejects.toThrow("DEV-only");
  expect((await request(app).get("/api/health-context")).status).toBe(404);
  expect((await request(app).put("/api/health-context/support/glp1")
    .set("x-requested-with", "XMLHttpRequest").send({ enabled: true })).status).toBe(404);
  expect(mockStore.calls).toHaveLength(0);
});
