import express from "express";
import request from "supertest";
import { createStudioStarchPreferencesRouter, authorizeStudioStarchClient, StudioStarchAccessError } from "../routes/studioStarchPreferences";
import { writeStudioStarchPreferences } from "../services/studioStarchPreferenceWrite";
import { PgDialect } from "drizzle-orm/pg-core";
import type { StudioStarchState } from "../../shared/starchPreferences";

const change = { defaultStarchMealsPerDay: 3, starchDistributionStrategy: "even" };
function harness(role = "physician", enabled = true) {
  const states = new Map<string, StudioStarchState>(["client-a", "client-b", "professional"].map(id => [id, {
    clientUserId: id,
    savedPreferences: { defaultStarchMealsPerDay: null, starchDistributionStrategy: null, starchPlanDefined: false },
    currentPrescription: { starchyCarbsTarget: 84, starchMealsAllowed: 2, starchDistributionStrategy: "even" },
    workoutTimingAvailable: false,
  }]));
  const authority = {
    professionalRole: jest.fn(async () => role),
    businessStudioReady: jest.fn(async () => false),
    sameOrganization: jest.fn(async () => {}),
    activeRelationship: jest.fn(async (_actor: string, client: string) => client === "client-a"),
  };
  const read = jest.fn(async (id: string) => JSON.parse(JSON.stringify(states.get(id))));
  const save = jest.fn(async (_actor: string, id: string, prefs: any) => {
    const state = states.get(id)!;
    state.savedPreferences = { ...prefs, starchPlanDefined: true };
    state.currentPrescription.starchMealsAllowed = prefs.defaultStarchMealsPerDay;
    state.currentPrescription.starchDistributionStrategy = prefs.starchDistributionStrategy;
  });
  const audit = jest.fn();
  const app = express().use(express.json());
  app.use((req, _res, next) => { (req as any).authUser = req.headers["x-anonymous"] ? null : { id: "professional" }; next(); });
  app.use("/clients/:clientId/starch-preferences", createStudioStarchPreferencesRouter({
    developmentEnabled: () => enabled,
    authorize: (actor, client) => authorizeStudioStarchClient(authority, actor, client),
    read, save, audit,
  }));
  return { app, authority, states, save, read, audit };
}

test.each(["physician", "trainer"])("%s saves only the selected authorized client, and a reload retains it", async role => {
  const h = harness(role);
  const b = JSON.stringify(h.states.get("client-b"));
  const professional = JSON.stringify(h.states.get("professional"));
  const result = await request(h.app).patch("/clients/client-a/starch-preferences").send(change);
  expect(result.status).toBe(200);
  expect(result.body.savedPreferences.defaultStarchMealsPerDay).toBe(3);
  expect(result.body.currentPrescription.starchyCarbsTarget).toBe(84);
  expect(result.body.currentPrescription.starchMealsAllowed).toBe(3);
  expect((await request(h.app).get("/clients/client-a/starch-preferences")).body).toEqual(result.body);
  expect(JSON.stringify(h.states.get("client-b"))).toBe(b);
  expect(JSON.stringify(h.states.get("professional"))).toBe(professional);
  expect(h.save).toHaveBeenCalledWith("professional", "client-a", change);
});

test("anonymous, unrelated, self-target and business-only callers cannot read or write clients", async () => {
  for (const [role, target, anonymous, status] of [
    ["physician", "client-a", true, 401], ["physician", "client-b", false, 403],
    ["physician", "professional", false, 403], ["business", "client-a", false, 403],
    ["coach", "client-a", false, 403], ["doctor", "client-a", false, 403],
  ] as const) {
    const h = harness(role);
    for (const method of ["get", "patch"] as const) {
      const query = request(h.app)[method](`/clients/${target}/starch-preferences`);
      if (anonymous) query.set("x-anonymous", "1");
      expect((await query.send(method === "patch" ? change : undefined)).status).toBe(status);
    }
    expect(h.read).not.toHaveBeenCalled(); expect(h.save).not.toHaveBeenCalled();
  }
});

test("cross-organization and inactive client relationships fail closed", async () => {
  const org = harness();
  org.authority.sameOrganization.mockRejectedValueOnce(Object.assign(new Error("different org"), { code: "ORG_ISOLATION_VIOLATION" }));
  expect((await request(org.app).patch("/clients/client-a/starch-preferences").send(change)).status).toBe(403);
  expect(org.save).not.toHaveBeenCalled();
  const inactive = harness();
  inactive.authority.activeRelationship.mockResolvedValue(false);
  expect((await request(inactive.app).patch("/clients/client-a/starch-preferences").send(change)).status).toBe(403);
  expect(inactive.save).not.toHaveBeenCalled();
});

test("verified nonclinical Business Studio authority can manage only its selected active client without changing identity", async () => {
  const h = harness("business");
  h.authority.businessStudioReady.mockResolvedValue(true);
  const own = JSON.stringify(h.states.get("professional"));
  const other = JSON.stringify(h.states.get("client-b"));
  expect((await request(h.app).get("/clients/client-a/starch-preferences")).status).toBe(200);
  expect((await request(h.app).patch("/clients/client-a/starch-preferences").send(change)).status).toBe(200);
  expect((await request(h.app).get("/clients/client-a/starch-preferences")).body.savedPreferences).toMatchObject(change);
  for (const target of ["professional", "client-b"]) {
    expect((await request(h.app).patch(`/clients/${target}/starch-preferences`).send(change)).status).toBe(403);
  }
  expect(h.authority.businessStudioReady).toHaveBeenCalledWith("professional");
  expect(await h.authority.professionalRole("professional")).toBe("business");
  expect(JSON.stringify(h.states.get("professional"))).toBe(own);
  expect(JSON.stringify(h.states.get("client-b"))).toBe(other);
  expect(h.save).toHaveBeenCalledTimes(1);
});

test("verified Business Studio authority does not bypass organization or active-client checks", async () => {
  const h = harness("business");
  h.authority.businessStudioReady.mockResolvedValue(true);
  h.authority.sameOrganization.mockRejectedValueOnce(Object.assign(new Error("org mismatch"), { code: "ORG_ISOLATION_VIOLATION" }));
  expect((await request(h.app).patch("/clients/client-a/starch-preferences").send(change)).status).toBe(403);
  h.authority.activeRelationship.mockResolvedValue(false);
  expect((await request(h.app).patch("/clients/client-a/starch-preferences").send(change)).status).toBe(403);
  expect(h.save).not.toHaveBeenCalled();
  expect(h.read).not.toHaveBeenCalled();
});

test.each([
  { ...change, defaultStarchMealsPerDay: 0 }, { ...change, defaultStarchMealsPerDay: 7 },
  { ...change, defaultStarchMealsPerDay: 2.5 }, { ...change, starchDistributionStrategy: "unknown" },
  { ...change, clientUserId: "client-b" }, { ...change, calories: 999 },
])("invalid or extra fields never write: %j", async body => {
  const h = harness();
  expect((await request(h.app).patch("/clients/client-a/starch-preferences").send(body)).status).toBe(400);
  expect(h.save).not.toHaveBeenCalled();
});

test("workout timing follows the client's training availability, retaining an existing workout preference", async () => {
  const h = harness();
  expect((await request(h.app).patch("/clients/client-a/starch-preferences").send({ ...change, starchDistributionStrategy: "workout" })).status).toBe(400);
  h.states.get("client-a")!.savedPreferences.starchDistributionStrategy = "workout";
  expect((await request(h.app).patch("/clients/client-a/starch-preferences").send({ ...change, starchDistributionStrategy: "workout" })).status).toBe(200);
});

test("read does not migrate old preferences; failed save stays unconfirmed; Production is disabled", async () => {
  const h = harness();
  await request(h.app).get("/clients/client-a/starch-preferences");
  expect(h.states.get("client-a")!.savedPreferences.defaultStarchMealsPerDay).toBeNull();
  expect(h.save).not.toHaveBeenCalled();
  h.save.mockRejectedValueOnce(new Error("isolated write failure"));
  expect((await request(h.app).patch("/clients/client-a/starch-preferences").send(change)).status).toBe(500);
  expect(h.audit).not.toHaveBeenCalled();
  const production = harness("physician", false);
  expect((await request(production.app).patch("/clients/client-a/starch-preferences").send(change)).status).toBe(404);
  expect(production.read).not.toHaveBeenCalled(); expect(production.save).not.toHaveBeenCalled();
});

test("actual write adapter locks the exact active relationship and updates only three client fields", async () => {
  const dialect = new PgDialect();
  let whereRead: any, whereWrite: any, payload: any;
  const lock = jest.fn(async () => [{ id: "link-a" }]);
  const set = jest.fn((value: any) => { payload = value; return {
    where(condition: any) { whereWrite = condition; return { returning: async () => [{ id: "client-a" }] }; },
  }; });
  const tx: any = {
    select: () => ({ from: () => ({ where(condition: any) {
      whereRead = condition; return { limit: () => ({ for: lock }) };
    } }) }),
    update: () => ({ set }),
  };
  const database: any = { transaction: async (callback: any) => callback(tx) };
  await writeStudioStarchPreferences(database, "professional", "client-a", change as any);
  expect(lock).toHaveBeenCalledWith("update");
  expect(dialect.sqlToQuery(whereRead).params).toEqual(["professional", "client-a", true]);
  expect(dialect.sqlToQuery(whereWrite).params).toEqual(["client-a"]);
  expect(payload).toEqual({ ...change, starchPlanDefined: true });
  lock.mockResolvedValueOnce([]);
  await expect(writeStudioStarchPreferences(database, "professional", "client-b", change as any)).rejects.toBeInstanceOf(StudioStarchAccessError);
  expect(set).toHaveBeenCalledTimes(1);
});
