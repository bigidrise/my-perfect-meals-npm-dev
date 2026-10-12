import express, { type RequestHandler } from "express";
import request from "supertest";
import { createEmptyWeekStructure } from "../../shared/schema/weeklyBoard";
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

test("untrusted identity headers cannot select another account or board namespace", async () => {
  const f = fixture();
  const response = await request(f.app).get("/api/guided-journey/progress")
    .set("x-user-id", "other-account-private-id")
    .set("x-household-profile-id", "private-household-id")
    .set("x-board-namespace", "diabetic").expect(200);
  expect(f.readAccount).toHaveBeenCalledWith("signed-in-actor");
  expect(f.readSavedBoards).toHaveBeenCalledWith("signed-in-actor", "generalNutrition");
  expect(JSON.stringify(response.body)).not.toMatch(/other-account-private-id|private-household-id/);
});

test("unsupported household context exposes neither subject ID nor nutrition information", async () => {
  const f = fixture();
  f.readAccount.mockResolvedValue({
    onboardingCompletedAt: new Date("2026-10-01"),
    dailyCalorieTarget: 1837, dailyProteinTarget: 123, dailyCarbsTarget: 0, dailyFatTarget: 81,
    activeBoard: "general_nutrition", selectedMealBuilder: null,
    activeHouseholdProfileId: "private-household-id",
  } as any);
  const response = await request(f.app).get("/api/guided-journey/progress").expect(200);
  expect(response.body.status).toBe("not_applicable");
  expect(response.body.scope.subjectId).toBe("signed-in-actor");
  expect(f.readSavedBoards).not.toHaveBeenCalled();
  expect(JSON.stringify(response.body)).not.toMatch(/private-household-id|1837|dailyCalorieTarget/);
});

test("private recipes and profile values are not included in a completed snapshot", async () => {
  const f = fixture();
  f.readAccount.mockResolvedValue({
    onboardingCompletedAt: new Date("2026-10-01"),
    dailyCalorieTarget: 1837, dailyProteinTarget: 123, dailyCarbsTarget: 0, dailyFatTarget: 81,
    activeBoard: "general_nutrition", selectedMealBuilder: null, activeHouseholdProfileId: null,
  } as any);
  const { week } = createEmptyWeekStructure("2026-10-12");
  week.days!["2026-10-12"].lunch.push({
    id: "private-meal-id", title: "Private recipe canary",
    ingredients: [{ name: "Private ingredient canary" }],
  });
  f.readSavedBoards.mockResolvedValue({
    records: [{ weekStartISO: "2026-10-12", boardJSON: week }], hasMore: false,
  } as any);
  const response = await request(f.app).get("/api/guided-journey/progress").expect(200);
  expect(response.body.status).toBe("complete");
  expect(response.body.savedPlan).toEqual({ weekStartISO: "2026-10-12", namespace: "generalNutrition" });
  expect(JSON.stringify(response.body)).not.toMatch(/private-meal-id|Private recipe|Private ingredient|1837/);
});

test("ambiguous targets block advancement while zero-carb saved targets remain valid", async () => {
  const f = fixture();
  const configured = {
    onboardingCompletedAt: new Date("2026-10-01"),
    dailyCalorieTarget: 1800, dailyProteinTarget: 120, dailyCarbsTarget: 0, dailyFatTarget: 80,
    activeBoard: "general_nutrition", selectedMealBuilder: null, activeHouseholdProfileId: null,
  };
  f.readAccount.mockResolvedValue({ ...configured, dailyProteinTarget: null } as any);
  let response = await request(f.app).get("/api/guided-journey/progress").expect(200);
  expect(response.body.nextStep).toBe("nutrition_targets");
  expect(response.body.status).toBe("blocked");
  expect(response.body.nextAction).toBeNull();
  f.readAccount.mockResolvedValue(configured as any);
  response = await request(f.app).get("/api/guided-journey/progress").expect(200);
  expect(response.body.steps[1].evidence.state).toBe("complete");
});

test("a client cache hint cannot establish saved-plan completion", async () => {
  const f = fixture();
  f.readAccount.mockResolvedValue({
    onboardingCompletedAt: new Date("2026-10-01"),
    dailyCalorieTarget: 1800, dailyProteinTarget: 120, dailyCarbsTarget: 0, dailyFatTarget: 80,
    activeBoard: "general_nutrition", selectedMealBuilder: null, activeHouseholdProfileId: null,
  } as any);
  const response = await request(f.app).get("/api/guided-journey/progress")
    .set("x-guided-journey-plan-saved", "true")
    .set("x-guided-journey-board-source", "cache").expect(200);
  expect(response.body.steps[2].evidence.state).toBe("incomplete");
  expect(response.body.savedPlan).toBeNull();
});
