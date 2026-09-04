/**
 * Attacker-oriented coverage for the U5-C legacy routes.  The test auth
 * middleware models an authenticated principal without requiring a database
 * session, so each router's ownership checks are exercised directly.
 */
import express from "express";
import fs from "fs";
import request from "supertest";

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const id = req.header("x-test-user");
    if (!id) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.authUser = { id };
    next();
  },
}));

const mockNotificationRows = [{ id: "job-1", status: "ate" }];
jest.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(mockNotificationRows),
      }),
    }),
  },
}));

jest.mock("../middleware/rateLimit", () => ({
  createApiRateLimit: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock("../services/wmc2Adapter", () => ({
  wmc2Generate: jest.fn(),
  wmc2Regenerate: jest.fn(async (userId: string) => ({ userId })),
}));
jest.mock("../services/costGuard", () => ({ costGuardCheck: jest.fn() }));
jest.mock("../services/errorLog", () => ({ pushError: jest.fn() }));
jest.mock("../routes/wmc2Telemetry", () => ({ bumpPlan: jest.fn(), bumpError: jest.fn() }));
jest.mock("../conciergeService", () => ({
  conciergeService: {
    getPersonalizedReminders: jest.fn(async (userId: string) => [{ userId }]),
    getConciergeVoicePrompts: jest.fn(async (userId: string) => [{ userId }]),
  },
}));

async function appFor(route: "adherence" | "wmc2" | "concierge") {
  const app = express();
  app.use(express.json());
  if (route === "adherence") app.use("/api", (await import("../routes/adherence")).default);
  if (route === "wmc2") app.use("/api", (await import("../routes/wmc2Enhanced")).default);
  if (route === "concierge") app.use("/api", (await import("../routes/concierge")).default);
  return app;
}

describe("U5-C legacy identity isolation", () => {
  it("keeps every production-effective meal-log registration authenticated", () => {
    const source = fs.readFileSync("server/routes.ts", "utf8");
    const registrations = source
      .split("\n")
      .filter((line) =>
        /app\.(?:get|post)\("\/api\/meal-logs(?:-enhanced|\/:userId)?"/.test(line),
      );

    expect(registrations).toHaveLength(7);
    for (const registration of registrations) {
      expect(registration).toContain("requireAuth");
    }
  });

  it("binds production-effective meal-log reads and writes to the authenticated actor", () => {
    const source = fs.readFileSync("server/routes.ts", "utf8");

    expect(source).toContain(
      "insertMealLogSchema.parse({ ...req.body, userId: authUserId })",
    );
    expect(source).toContain(
      "storage.getMealLogs(authUserId, startDate, endDate)",
    );
    expect(source).toContain(
      "if (req.params.userId !== authUserId)",
    );
    expect(source).toContain(
      "if (userId !== authUserId)",
    );
  });

  it("denies an unauthenticated adherence read", async () => {
    const response = await request(await appFor("adherence")).get("/api/adherence/account-a");
    expect(response.status).toBe(401);
  });

  it("denies a cross-user adherence read and permits the account owner", async () => {
    const app = await appFor("adherence");
    expect((await request(app).get("/api/adherence/account-b").set("x-test-user", "account-a")).status).toBe(403);
    const own = await request(app).get("/api/adherence/account-a").set("x-test-user", "account-a");
    expect(own.status).toBe(200);
    expect(own.body).toEqual({ percent: 100, ate: 1, total: 1 });
  });

  it("denies a cross-user WMC2 regenerate and permits self regeneration", async () => {
    const app = await appFor("wmc2");
    expect((await request(app).post("/api/api/wmc2/account-b/regenerate").set("x-test-user", "account-a")).status).toBe(403);
    const own = await request(app).post("/api/api/wmc2/account-a/regenerate").set("x-test-user", "account-a");
    expect(own.status).toBe(200);
    expect(own.body).toEqual({ userId: "account-a" });
  });

  it("denies cross-user concierge reads while allowing the owner", async () => {
    const app = await appFor("concierge");
    expect((await request(app).get("/api/reminders/account-b").set("x-test-user", "account-a")).status).toBe(403);
    expect((await request(app).get("/api/voice-prompts/account-a").set("x-test-user", "account-a")).status).toBe(200);
  });
});