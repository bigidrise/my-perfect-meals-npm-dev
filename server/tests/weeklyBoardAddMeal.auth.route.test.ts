/**
 * The add-meal endpoint is a write: authentication must happen before the
 * request can select or create a board, and board state is keyed by the
 * authenticated subject rather than a client supplied owner id.
 */
const auth = { user: null as { id: string } | null };
const boards = new Map<string, any>();

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!auth.user) return res.status(401).json({ error: "Authentication required" });
    req.authUser = auth.user;
    next();
  },
}));

jest.mock("../data/weekBoardsRepo", () => ({
  resolveUserId: jest.fn(async () => auth.user!.id),
  getWeekBoard: jest.fn(async (userId: string, week: string, builder: string) =>
    boards.get(`${userId}:${week}:${builder}`) ?? null
  ),
  upsertWeekBoard: jest.fn(async (userId: string, week: string, board: any, builder: string) => {
    boards.set(`${userId}:${week}:${builder}`, board);
  }),
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
}));

jest.mock("../services/imageLifecycle", () => ({ processMealImageForSave: jest.fn() }));
jest.mock("../services/activityLog", () => ({ logActivityFireAndForget: jest.fn() }));
jest.mock("../services/pushNotify", () => ({ pushToCoachOfClient: jest.fn() }));
jest.mock("../services/canonicalWeeklyMealPlanning", () => ({
  rerollCanonicalWeeklyMeal: jest.fn(),
  regenerateCanonicalWeeklyDay: jest.fn(),
  WeeklyMealGenerationError: class WeeklyMealGenerationError extends Error {},
}));
jest.mock("../utils/carbClassifier", () => ({
  enforceCarbs: (meal: any) => meal,
}));
jest.mock("../db", () => ({ db: {} }));
jest.mock("../db/schema/procare", () => ({ clientLinks: {} }));

import express from "express";
import request from "supertest";

async function buildApp() {
  const app = express();
  app.use(express.json());
  const { default: weekBoardRoutes } = await import("../routes/weekBoard");
  weekBoardRoutes(app);
  return app;
}

const payload = {
  dateISO: "2026-02-18",
  slot: "dinner",
  meal: {
    id: "meal-source",
    name: "Test Dinner",
    nutrition: { calories: 500, protein: 30, carbs: 40, fat: 20 },
    ingredients: [],
  },
};

const builderMatrix = [
  ["general_nutrition", "generalNutrition"],
  ["diabetic", "diabetic"],
  ["glp1", "glp1"],
  ["anti_inflammatory", "antiInflammatory"],
] as const;

beforeEach(() => {
  auth.user = null;
  boards.clear();
});

describe("weekly board add-meal authorization", () => {
  it("rejects unauthenticated writes before board access", async () => {
    const res = await request(await buildApp())
      .post("/api/weekly-board/add-meal")
      .send(payload);

    expect(res.status).toBe(401);
    expect(boards.size).toBe(0);
  });

  it("writes only to the authenticated owner's board", async () => {
    auth.user = { id: "owner-a" };
    const res = await request(await buildApp())
      .post("/api/weekly-board/add-meal")
      .send({ ...payload, userId: "owner-b" });

    expect(res.status).toBe(200);
    expect([...boards.keys()].every((key) => key.startsWith("owner-a:"))).toBe(true);
    expect([...boards.keys()].some((key) => key.startsWith("owner-b:"))).toBe(false);
    expect(res.body.meal.name).toBe("Test Dinner");
  });

  it("keeps board namespaces isolated between authenticated users", async () => {
    auth.user = { id: "owner-a" };
    await request(await buildApp()).post("/api/weekly-board/add-meal").send(payload);

    auth.user = { id: "owner-b" };
    await request(await buildApp()).post("/api/weekly-board/add-meal").send(payload);

    expect(boards.size).toBe(2);
    const ownerABoard = [...boards.entries()].find(([key]) => key.startsWith("owner-a:"))?.[1];
    const ownerBBoard = [...boards.entries()].find(([key]) => key.startsWith("owner-b:"))?.[1];
    expect(ownerABoard.days["2026-02-18"].dinner).toHaveLength(1);
    expect(ownerBBoard.days["2026-02-18"].dinner).toHaveLength(1);
  });

  it.each(builderMatrix)(
    "reads canonical Builder key %s from board namespace %s",
    async (builderKey, namespace) => {
      auth.user = { id: "owner-a" };
      const res = await request(await buildApp())
        .get("/api/weekly-board")
        .query({ week: "2026-02-16", mpmBuilderKey: builderKey });

      expect(res.status).toBe(200);
      expect(res.body.boardNamespace).toBe(namespace);
      expect([...boards.keys()]).toContain(`owner-a:2026-02-16:${namespace}`);
    },
  );

  it.each(builderMatrix)(
    "persists canonical Builder key %s into board namespace %s",
    async (builderKey, namespace) => {
      auth.user = { id: "owner-a" };
      const res = await request(await buildApp())
        .post("/api/weekly-board/add-meal")
        .send({ ...payload, mpmBuilderKey: builderKey });

      expect(res.status).toBe(200);
      expect(res.body.boardNamespace).toBe(namespace);
      expect([...boards.keys()]).toContain(`owner-a:2026-02-16:${namespace}`);
    },
  );

  it.each(["unknown_builder", "generalNutrition", "antiInflammatory"])(
    "rejects unsupported or storage-namespace mpmBuilderKey %s",
    async (mpmBuilderKey) => {
      auth.user = { id: "owner-a" };
      const read = await request(await buildApp())
        .get("/api/weekly-board")
        .query({ week: "2026-02-16", mpmBuilderKey });
      const write = await request(await buildApp())
        .post("/api/weekly-board/add-meal")
        .send({ ...payload, mpmBuilderKey });

      expect(read.status).toBe(400);
      expect(write.status).toBe(400);
      expect(boards.size).toBe(0);
    },
  );
});