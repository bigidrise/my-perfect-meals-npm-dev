const ACTOR_ID = "onboarding-owner";
const OTHER_ID = "other-account";

const auth = { user: null as { id: string } | null };
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockMerge = jest.fn();

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: async (req: any, res: any, next: any) => {
    if (!auth.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    req.authUser = auth.user;
    next();
  },
}));

jest.mock("../db", () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

jest.mock("../services/onboardingMergeService", () => ({
  mergeStepIntoPreferences: (...args: any[]) => mockMerge(...args),
}));

import express from "express";
import request from "supertest";
import onboardingRouter from "../routes/onboardingProgress";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", onboardingRouter);
  return app;
}

beforeEach(() => {
  auth.user = null;
  for (const mock of [mockSelect, mockInsert, mockUpdate, mockDelete, mockMerge]) {
    mock.mockReset();
  }
});

describe("onboarding account and device identity isolation", () => {
  const attacks = [
    ["read progress", (app: express.Express) => request(app).get(`/api/onboarding/progress?userId=${OTHER_ID}`)],
    ["save step", (app: express.Express) => request(app).put("/api/onboarding/step/goals").send({ userId: OTHER_ID, data: {}, completed: true })],
    ["delete step", (app: express.Express) => request(app).delete(`/api/onboarding/step/goals?userId=${OTHER_ID}`)],
    ["reset progress", (app: express.Express) => request(app).post("/api/onboarding/reset-all").send({ userId: OTHER_ID })],
    ["claim device data", (app: express.Express) => request(app).post("/api/onboarding/claim").send({ userId: OTHER_ID })],
  ] as const;

  for (const [name, attack] of attacks) {
    it(`denies cross-user ${name} before database or preference work`, async () => {
      auth.user = { id: ACTOR_ID };

      const response = await attack(buildApp());

      expect(response.status).toBe(403);
      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockMerge).not.toHaveBeenCalled();
    });
  }

  it("allows anonymous progress reads to remain device-scoped", async () => {
    mockSelect.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    });

    const response = await request(buildApp()).get("/api/onboarding/progress");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ steps: {} });
  });

  it("allows an authenticated user to read their own progress", async () => {
    auth.user = { id: ACTOR_ID };
    mockSelect.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    });

    const response = await request(buildApp()).get(
      `/api/onboarding/progress?userId=${ACTOR_ID}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ steps: {} });
  });
});