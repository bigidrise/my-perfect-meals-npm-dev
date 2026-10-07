import express from "express";
import request from "supertest";
jest.mock("../services/professionalOnboardingRepository", () => ({ professionalOnboardingRepository: {} }));
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const id = req.get("x-test-session-account");
    if (!id) return res.status(401).json({ code: "AUTH_REQUIRED" });
    req.authUser = { id }; next();
  },
}));
import { createProfessionalOnboardingRouter } from "../routes/professionalOnboardingRoutes";
import { professionalRequestMemory } from "./helpers/professionalRequestMemory";

describe("Stage 1 own-account HTTP boundary — mocked session and repository", () => {
  let memory: ReturnType<typeof professionalRequestMemory>;
  let app: express.Express;
  beforeEach(() => {
    memory = professionalRequestMemory();
    app = express(); app.use(express.json());
    app.use("/api/professional-onboarding", createProfessionalOnboardingRouter(memory.repository));
  });
  const base = "/api/professional-onboarding";
  test.each(["get", "post", "patch"] as const)("anonymous %s cannot reach own-account request storage", async verb => {
    const response = await request(app)[verb](verb === "get" ? base : base + "/draft").send({});
    expect(response.status).toBe(401); expect(memory.requests.size).toBe(0);
  });
  test("caller-supplied user header cannot authenticate", async () => {
    expect((await request(app).get(base).set("x-user-id", "account-a")).status).toBe(401);
  });
  test("create/save/get/submit/replay use the authenticated actor only", async () => {
    const before = structuredClone(memory.accounts);
    const resumed = await request(app).post(base + "/draft").set("x-test-session-account", "account-a").send({});
    expect(resumed.status).toBe(200);
    const saved = await request(app).patch(base + "/draft").set("x-test-session-account", "account-a").send({ revision: 0, requestedRole: "trainer", professionalCategory: "experienced" });
    expect(saved.status).toBe(200);
    const body = { revision: saved.body.request.revision, requestId: saved.body.request.id };
    const submitted = await request(app).post(base + "/submit").set("x-test-session-account", "account-a").send(body);
    const replay = await request(app).post(base + "/submit").set("x-test-session-account", "account-a").send(body);
    expect(submitted.status).toBe(200); expect(replay.body).toEqual(submitted.body);
    expect((await request(app).get(base).set("x-test-session-account", "account-a")).body).toEqual(submitted.body);
    expect(JSON.stringify([...memory.accounts])).toBe(JSON.stringify([...before]));
  });
  test("query account selection is rejected rather than returning somebody else's request", async () => {
    expect((await request(app).get(base + "?userId=account-b").set("x-test-session-account", "account-a")).status).toBe(400);
  });
  test.each(["ownerUserId", "userId", "targetUserId", "professionalRole", "isProCare", "verificationStatus", "trainingCompleted", "legalAccepted", "organizationId", "planLookupKey", "demoGrant"])("request rejects authority/identity field %s", async key => {
    await request(app).post(base + "/draft").set("x-test-session-account", "account-a").send({});
    const response = await request(app).patch(base + "/draft").set("x-test-session-account", "account-a").send({ revision: 0, [key]: "forged" });
    expect(response.status).toBe(400);
    expect(memory.events).toHaveLength(1);
  });
  test("resume rejects submitted draft metadata in its empty create body", async () => {
    expect((await request(app).post(base + "/draft").set("x-test-session-account", "account-a").send({ requestedRole: "physician" })).status).toBe(400);
  });
  test("storage failure is a retryable 503, never empty-success status", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    memory.failNextEvent();
    const response = await request(app).post(base + "/draft").set("x-test-session-account", "account-a").send({});
    expect(response.status).toBe(503); expect(response.body.code).toBe("REQUEST_STORAGE_UNAVAILABLE");
    expect(memory.requests.size).toBe(0); spy.mockRestore();
  });
  test("production runtime rejects Stage 1 endpoints before authentication", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try { expect((await request(app).post(base + "/draft").set("x-test-session-account", "account-a").send({})).status).toBe(404); }
    finally { process.env.NODE_ENV = previous; }
    expect(memory.requests.size).toBe(0);
  });
});
