jest.mock("../services/imageLifecycle", () => ({ processMealImageForSave: jest.fn() }));
jest.mock("../services/mealImageAuthority", () => ({
  validateMealImageAuthority: jest.fn(),
}));
jest.mock("../services/activityLog", () => ({ logActivityFireAndForget: jest.fn() }));
jest.mock("../services/pushNotify", () => ({ pushToCoachOfClient: jest.fn() }));
jest.mock("../services/canonicalWeeklyMealPlanning", () => ({
  rerollCanonicalWeeklyMeal: jest.fn(),
  regenerateCanonicalWeeklyDay: jest.fn(),
  WeeklyMealGenerationError: class WeeklyMealGenerationError extends Error {},
}));
jest.mock("../db", () => ({ db: {} }));
jest.mock("../db/schema/procare", () => ({ clientLinks: {} }));

import weekBoardRoutes, {
  deriveBoardScope,
  InaccessibleHouseholdProfileError,
  resolveRequestedBoardNamespace,
  sanitizeDietClassification,
} from "../routes/weekBoard";
import express from "express";
import request from "supertest";

const actor = "11111111-1111-4111-8111-111111111111";
const profile = "22222222-2222-4222-8222-222222222222";

describe("weekly board household contracts", () => {
  it("derives a stable household namespace only for the active owned profile", () => {
    expect(deriveBoardScope(actor, profile, profile, actor)).toEqual({
      builderType: `household:${profile}`,
      boardNamespace: `household:${profile}`,
      subjectId: profile,
    });
    expect(() => deriveBoardScope(actor, profile, null, actor))
      .toThrow(InaccessibleHouseholdProfileError);
    expect(() => deriveBoardScope(actor, profile, profile, "33333333-3333-4333-8333-333333333333"))
      .toThrow(InaccessibleHouseholdProfileError);
  });

  it("leaves the default user namespace unchanged", () => {
    expect(deriveBoardScope(actor, undefined)).toEqual({
      builderType: "",
      boardNamespace: "user",
      subjectId: actor,
    });
    expect(resolveRequestedBoardNamespace(undefined, "", "household:ignored")).toBe("");
  });

  it("rejects household IDs combined with arbitrary builder namespaces", () => {
    expect(() => resolveRequestedBoardNamespace(profile, "diabetic", `household:${profile}`))
      .toThrow("householdProfileId cannot be combined with bt/ns");
    expect(resolveRequestedBoardNamespace(profile, "", `household:${profile}`))
      .toBe(`household:${profile}`);
  });

  it("preserves the recognized classification shape and drops unsupported labels", () => {
    expect(sanitizeDietClassification({
      kosherCategory: "pareve",
      halalFlags: { alcoholFree: true, porkFree: false },
      veganFlags: { plantBased: true },
      label: "client-forged",
    })).toEqual({
      kosherCategory: "pareve",
      halalFlags: { alcoholFree: true, porkFree: false },
      veganFlags: { plantBased: true },
    });
    expect(sanitizeDietClassification({
      kosherCategory: "not-a-kosher-category",
      halalFlags: { alcoholFree: "yes", porkFree: true },
      veganFlags: { plantBased: 1 },
    })).toBeUndefined();
  });

  it("preserves diabetic memory through board normalization and add-item persistence", async () => {
    const app = express();
    app.use(express.json());
    weekBoardRoutes(app);
    const diabeticMemory = {
      generatedBglMgdl: 100,
      glucoseState: "IN_RANGE",
      bglBucket: "in-range",
      readingRecordedAt: "2026-10-01T21:42:00.000Z",
      generatedAt: "2026-10-01T21:43:00.000Z",
    };

    const normalized = await request(app)
      .put("/api/week-board")
      .send({
        version: 1,
        lists: { breakfast: [], lunch: [], dinner: [], snacks: [] },
        meta: {},
      });
    expect(normalized.status).toBe(200);

    const added = await request(app)
      .post("/api/week-board/add")
      .send({
        list: "lunch",
        meal: {
          id: "diabetic-meal",
          title: "Chicken and Broccoli Bowl",
          ingredients: [{ item: "chicken breast", amount: "5", unit: "oz" }],
          instructions: ["Cook and serve."],
          nutrition: { calories: 320, protein: 36, carbs: 6, fat: 10 },
          diabeticMemory,
        },
      });

    expect(added.status).toBe(200);
    expect(added.body.lists.lunch[0].diabeticMemory).toEqual(diabeticMemory);

    const readBack = await request(app).get("/api/week-board");
    expect(readBack.body.lists.lunch[0].diabeticMemory).toEqual(diabeticMemory);
  });
});
