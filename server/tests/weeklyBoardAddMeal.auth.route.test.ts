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
jest.mock("../services/mealImageAuthority", () => ({
  validateMealImageAuthority: jest.fn(async (url: string) => ({
    status: "available",
    canonicalUrl: url,
  })),
}));
jest.mock("../services/activityLog", () => ({ logActivityFireAndForget: jest.fn() }));
jest.mock("../services/pushNotify", () => ({ pushToCoachOfClient: jest.fn() }));
jest.mock("../services/canonicalWeeklyMealPlanning", () => ({
  rerollCanonicalWeeklyMeal: jest.fn(),
  regenerateCanonicalWeeklyDay: jest.fn(),
  WeeklyMealGenerationError: class WeeklyMealGenerationError extends Error {},
}));
jest.mock("../utils/carbClassifier", () => ({
  enforceCarbs: jest.fn((meal: any) => meal),
}));
jest.mock("../db", () => ({ db: {} }));
jest.mock("../db/schema/procare", () => ({ clientLinks: {} }));

import express from "express";
import request from "supertest";
import { enforceCarbs } from "../utils/carbClassifier";

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
    imageUrl: "/public-objects/replit-objstore-test/meal-images/test-dinner.jpg",
    mediaAssetId: "11111111-1111-4111-8111-111111111111",
    nutrition: { calories: 500, protein: 30, carbs: 40, fat: 20 },
    ingredients: [],
  },
};

const builderMatrix = [
  ["general_nutrition", "generalNutrition"],
  ["diabetic", "diabetic"],
  ["glp1", "glp1"],
  ["anti_inflammatory", "antiInflammatory"],
  ["performance_competition", "performanceCompetition"],
] as const;

beforeEach(() => {
  auth.user = null;
  boards.clear();
});

describe("weekly board add-meal authorization", () => {
  it.each([
    { starchyCarbs: 15, fibrousCarbs: 5, status: "validated" },
    { starchyCarbs: null, fibrousCarbs: null, status: "unresolved" },
    { starchyCarbs: 0, fibrousCarbs: 0, status: "validated" },
  ])("preserves Development Grocery Coach categories without keyword repair: %j", async split => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      auth.user = { id: "owner-a" };
      jest.mocked(enforceCarbs).mockClear();
      const meal = {
        ...payload.meal, sourceType: "grocery-coach", groceryCoachNutritionHandoff: true,
        servings: 1, recipeServings: 4, nutritionBasis: "per-serving",
        carbohydrateReview: { version: 1, status: split.status, reason: "fixture" },
        nutrition: { calories: 200, protein: 10, carbs: 20, fat: 5,
          starchyCarbs: split.starchyCarbs, fibrousCarbs: split.fibrousCarbs },
        starchyCarbs: split.starchyCarbs, fibrousCarbs: split.fibrousCarbs,
      };
      const res = await request(await buildApp()).post("/api/weekly-board/add-meal").send({ ...payload, meal });
      expect(res.status).toBe(200);
      expect(res.body.meal.nutrition).toEqual(meal.nutrition);
      expect(res.body.meal.carbohydrateReview).toEqual(meal.carbohydrateReview);
      expect(res.body.meal.recipeServings).toBe(4);
      expect(enforceCarbs).not.toHaveBeenCalled();
      const stored = [...boards.values()][0].days[payload.dateISO].dinner[0];
      expect(stored.nutrition).toEqual(meal.nutrition);
      expect(stored.carbohydrateReview).toEqual(meal.carbohydrateReview);
    } finally { process.env.NODE_ENV = previous; }
  });

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
    expect(res.body.meal.imageUrl).toBe(payload.meal.imageUrl);
    expect(res.body.meal.mediaAssetId).toBe(payload.meal.mediaAssetId);
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