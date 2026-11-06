/** Synthetic HTTP checks: no application database, provider or storage calls. */
const mockAuth = { user: null as { id: string } | null };
let mockRows: any[] = [];
const mockFinalize = jest.fn();
const mockAuthority = jest.fn();
const mockUpdate = jest.fn(() => { throw new Error("A foreign-bucket display repair must not update the shared Board"); });
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockAuth.user) return res.status(401).json({ error: "Authentication required" });
    req.authUser = mockAuth.user; next();
  },
}));
jest.mock("../data/weekBoardsRepo", () => ({
  resolveUserId: jest.fn(), getWeekBoard: jest.fn(), upsertWeekBoard: jest.fn(),
  AuthenticationRequiredError: class extends Error {},
}));
jest.mock("../db", () => ({
  db: {
    select: () => ({ from: () => ({ where: async (condition: any) => {
      const params = mockDialect.sqlToQuery(condition).params;
      return mockRows.filter(row => row.userId === params[0] && row.weekStartISO === params[1]);
    } }) }),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));
jest.mock("../db/schema/procare", () => ({ clientLinks: {} }));
jest.mock("../services/imageLifecycle", () => ({ processMealImageForSave: jest.fn() }));
jest.mock("../services/mealImageAuthority", () => ({
  validateMealImageAuthority: (...args: unknown[]) => mockAuthority(...args),
}));
jest.mock("../services/mealFinalizer", () => ({
  finalizeMealImage: (...args: unknown[]) => mockFinalize(...args),
}));
jest.mock("../services/activityLog", () => ({ logActivityFireAndForget: jest.fn() }));
jest.mock("../services/pushNotify", () => ({ pushToCoachOfClient: jest.fn() }));
jest.mock("../services/canonicalWeeklyMealPlanning", () => ({
  rerollCanonicalWeeklyMeal: jest.fn(), regenerateCanonicalWeeklyDay: jest.fn(), WeeklyMealGenerationError: class extends Error {},
}));
jest.mock("../utils/carbClassifier", () => ({ enforceCarbs: (meal: any) => meal }));
import express from "express";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";
const mockDialect = new PgDialect();
const foreign = "/public-objects/replit-objstore-production-fixture/meal-images/dinner.jpg";
const local = "/public-objects/replit-objstore-development-fixture/meal-images/dinner.jpg";
const assetId = "11111111-1111-4111-8111-111111111111";
const target = {
  weekStartISO: "2026-11-02", dateISO: "2026-11-06", slot: "dinner", mealId: "synthetic-meal",
  imageUrl: foreign, mediaAssetId: assetId,
};
let app: express.Express;
beforeAll(async () => {
  app = express(); app.use(express.json());
  (await import("../routes/weekBoard")).default(app);
});
beforeEach(() => {
  mockAuth.user = { id: "owner-a" };
  mockRows = [{
    id: "board-a", userId: "owner-a", weekStartISO: target.weekStartISO,
    boardJSON: { days: { [target.dateISO]: { dinner: [{
      id: target.mealId, name: "Synthetic dinner", imageUrl: foreign, mediaAssetId: assetId,
      ingredients: [{ name: "chicken breast" }],
    }] } } },
  }];
  mockFinalize.mockReset().mockResolvedValue({ imageUrl: local, mediaAssetId: "22222222-2222-4222-8222-222222222222" });
  mockAuthority.mockReset().mockResolvedValue({ status: "missing", reason: "inactive" });
  mockUpdate.mockClear();
});
test("anonymous recovery never reads or generates a meal image", async () => {
  mockAuth.user = null;
  expect((await request(app).post("/api/weekly-board/image-recovery").send(target)).status).toBe(401);
  expect(mockFinalize).not.toHaveBeenCalled();
});
test("a different authenticated owner cannot recover this Board or override ownership", async () => {
  mockAuth.user = { id: "owner-b" };
  expect((await request(app).post("/api/weekly-board/image-recovery").send({ ...target, userId: "owner-a" })).status).toBe(404);
  expect(mockFinalize).not.toHaveBeenCalled();
});
test("inactive-bucket recovery returns a local variant without changing canonical media or Favorites", async () => {
  const before = structuredClone(mockRows);
  const response = await request(app).post("/api/weekly-board/image-recovery").send(target);
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ status: "recovered", imageUrl: local });
  expect(mockFinalize).toHaveBeenCalledTimes(1);
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockRows).toEqual(before);
});
test.each([
  { ...target, imageUrl: "/public-objects/changed.jpg" },
  { ...target, mediaAssetId: "33333333-3333-4333-8333-333333333333" },
])("a stale image or media identity is rejected before any generation", async stale => {
  expect((await request(app).post("/api/weekly-board/image-recovery").send(stale)).status).toBe(409);
  expect(mockFinalize).not.toHaveBeenCalled();
});
test("an unavailable active store retries rather than starting another generation", async () => {
  mockAuthority.mockResolvedValue({ status: "unavailable", reason: "storage_unavailable" });
  const response = await request(app).post("/api/weekly-board/image-recovery").send(target);
  expect(response.body).toEqual({ status: "retry", imageUrl: foreign });
  expect(mockFinalize).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});
test("an already available stored image is reused without generation", async () => {
  mockAuthority.mockResolvedValue({ status: "available", canonicalUrl: local });
  const response = await request(app).post("/api/weekly-board/image-recovery").send(target);
  expect(response.body).toEqual({ status: "retry", imageUrl: local });
  expect(mockFinalize).not.toHaveBeenCalled();
});
