import express, { type RequestHandler } from "express";
import request from "supertest";
// Keep route verification isolated from database imports, pools and auth workers.
jest.mock("../services/guidedJourney/repository", () => ({ guidedJourneyRepository: {} }));
jest.mock("../middleware/requireAuth", () => ({ requireAuth: jest.fn() }));
import { createGuidedJourneyRouter, guidedJourneyDevelopmentEnabled } from "../routes/guidedJourney";

function fixture(enabled = true, signedIn = true) {
  const readAccount = jest.fn(async () => ({
    onboardingCompletedAt: null, dailyCalorieTarget: null, dailyProteinTarget: null,
    dailyCarbsTarget: null, dailyFatTarget: null, activeBoard: "general_nutrition",
    selectedMealBuilder: null, activeHouseholdProfileId: null,
  }));
  const readSavedBoards = jest.fn(async () => ({ records: [], hasMore: false }));
  const authenticate: RequestHandler = jest.fn((req, res, next) => {
    if (!signedIn) { res.status(401).json({ error: "Authentication required" }); return; }
    (req as any).authUser = { id: "signed-in-actor", role: "client", professionalRole: null,
      isSandbox: false, accessTier: "PAID_FULL" };
    next();
  });
  const app = express();
  app.use("/api/guided-journey", createGuidedJourneyRouter(
    { readAccount, readSavedBoards }, authenticate, () => enabled,
  ));
  return { app, readAccount, readSavedBoards, authenticate };
}

test.each([
  [{ NODE_ENV: "development" }, true],
  [{ NODE_ENV: "development", VITE_IS_PRODUCTION_PROJECT: "true" }, true],
  [{ NODE_ENV: "production" }, false],
  [{ NODE_ENV: "test" }, false],
  [{}, false],
  [{ NODE_ENV: "development", REPLIT_DEPLOYMENT: "1" }, false],
  [{ NODE_ENV: "development", REPLIT_DEPLOYMENT: "true" }, false],
  [{ NODE_ENV: "development", REPLIT_DEPLOYMENT: "false" }, false],
])("Development gate is fail-closed for %j", (env, expected) => {
  expect(guidedJourneyDevelopmentEnabled(env)).toBe(expected);
});
test("disabled runtime returns 404 before authentication and reads", async () => {
  const f = fixture(false);
  await request(f.app).get("/api/guided-journey/progress").expect(404);
  expect(f.authenticate).not.toHaveBeenCalled();
  expect(f.readAccount).not.toHaveBeenCalled();
});
test("unsigned request is denied without inspecting records", async () => {
  const f = fixture(true, false);
  await request(f.app).get("/api/guided-journey/progress").expect(401);
  expect(f.readAccount).not.toHaveBeenCalled();
});
test("signed-in GET inspects only its authenticated actor, without browser caching", async () => {
  const f = fixture();
  const response = await request(f.app).get("/api/guided-journey/progress").expect(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(f.readAccount).toHaveBeenCalledWith("signed-in-actor");
  expect(f.readSavedBoards).toHaveBeenCalledWith("signed-in-actor", "generalNutrition");
  expect(response.body.nextAction.route).toBe("/onboarding");
  expect(JSON.stringify(response.body)).not.toContain("dailyCalorieTarget");
});
test.each(["userId=other", "subjectId=other", "workspace=organization", "namespace=diabetic", "builderKey=diabetic"])(
  "caller scope override %s is rejected before reads", async query => {
    const f = fixture();
    await request(f.app).get(`/api/guided-journey/progress?${query}`).expect(400);
    expect(f.readAccount).not.toHaveBeenCalled();
  },
);
test.each(["post", "put", "patch", "delete"] as const)("no %s mutation endpoint exists", async method => {
  const f = fixture();
  await request(f.app)[method]("/api/guided-journey/progress").expect(404);
  expect(f.readAccount).not.toHaveBeenCalled();
});
