const mockAuth = { user: null as { id: string } | null };
const mockAiCreate = jest.fn();
const mockDbExecute = jest.fn();
const mockProcessMealImageForSave = jest.fn();
const mockLoadOwnedActiveChildProfile = jest.fn();

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockAuth.user) return res.status(401).json({ error: "Authentication required" });
    req.authUser = mockAuth.user;
    next();
  },
}));

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockAiCreate } },
  })),
}));

jest.mock("../db", () => ({
  db: { execute: mockDbExecute },
}));

jest.mock("../services/imageLifecycle", () => ({
  processMealImageForSave: mockProcessMealImageForSave,
}));

jest.mock("../services/pediatric/authoritativeChildAccess", () => ({
  loadOwnedActiveChildProfile: mockLoadOwnedActiveChildProfile,
}));

import express from "express";
import request from "supertest";
import router from "../routes/myPerfectBeginning";
import createDishRouter from "../routes/my-perfect-beginning";
import { signPediatricSubject } from "../services/pediatric/subjectAttribution";

const childA = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "parent-a",
  name: "Authoritative Ava",
  age_stage: "preschool",
  date_of_birth: "2021-01-01",
  sex: "female",
  allergies: [],
  allergy_details: [{ allergenId: "milk", severity: "confirmed_allergy" }],
  dietary_preferences: ["vegetarian"],
  medical_conditions: [],
  feeding_concerns: ["picky eater"],
  feeding_ability: {},
  sensory_issues: ["texture"],
  dislikes: ["peas"],
  cultural_preferences: null,
  birth_history: {},
  growth_context: {},
  height_cm: null,
  weight_kg: null,
  school_safe_required: false,
  medication_affects_appetite: false,
  is_archived: false,
};

const childB = {
  ...childA,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Authoritative Ben",
  age_stage: "toddler",
  allergy_details: [{ allergenId: "egg", severity: "confirmed_allergy" }],
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/my-perfect-beginning", createDishRouter);
  app.use("/api/my-perfect-beginning", router);
  return app;
}

function attributedRecipe(childId: string, userId = "parent-a") {
  return {
    recipeName: "Safe Pasta",
    ingredients: [{ name: "pasta", quantity: "1 cup" }],
    instructions: ["Cook until age appropriate."],
    rulesFireLog: [],
    allergenAlerts: [],
    _subjectAttribution: {
      childProfileId: childId,
      token: signPediatricSubject(userId, childId),
    },
  };
}

beforeAll(() => {
  process.env.SESSION_SECRET = "mpb-subject-integrity-test-secret";
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = { id: "parent-a" };
  mockAiCreate.mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          options: [{ id: "1", name: "Option", description: "Description" }],
        }),
      },
    }],
  });
  mockProcessMealImageForSave.mockResolvedValue({ imageUrl: "https://example.test/meal.jpg" });
  mockDbExecute.mockResolvedValue({ rows: [{ id: "saved-meal" }] });
});

describe("My Perfect Beginnings subject integrity routes", () => {
  it("rejects unauthenticated pediatric requests", async () => {
    mockAuth.user = null;
    const response = await request(buildApp())
      .post("/api/my-perfect-beginning/meal-options")
      .send({ childProfileId: childA.id, foodRequest: "pasta" });
    expect(response.status).toBe(401);
    expect(mockLoadOwnedActiveChildProfile).not.toHaveBeenCalled();
  });

  it("fails Parent's Corner closed when authoritative lookup fails and never calls AI", async () => {
    mockLoadOwnedActiveChildProfile.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await request(buildApp())
      .post("/api/my-perfect-beginning/parents-corner")
      .send({
        message: "What should I serve?",
        childContext: {
          id: childA.id,
          developmentalStage: "growing_child",
          allergyProfile: { entries: [] },
        },
      });
    expect(response.status).toBe(503);
    expect(mockAiCreate).not.toHaveBeenCalled();
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  it("uses authoritative meal-option context instead of raw client child fields", async () => {
    mockLoadOwnedActiveChildProfile.mockResolvedValueOnce(childA);
    const response = await request(buildApp())
      .post("/api/my-perfect-beginning/meal-options")
      .send({
        childProfileId: childA.id,
        foodRequest: "pasta",
        childName: "Spoofed Name",
        ageStage: "growing_child",
        allergies: [{ allergenId: "peanut", severity: "confirmed_allergy" }],
      });
    expect(response.status).toBe(200);
    expect(response.body.subject).toEqual({
      childProfileId: childA.id,
      name: childA.name,
    });
    const systemPrompt = mockAiCreate.mock.calls[0][0].messages[0].content;
    expect(systemPrompt).toContain("Authoritative Ava");
    expect(systemPrompt).toContain("Preschool");
    expect(systemPrompt).toContain("milk");
    expect(systemPrompt).not.toContain("Spoofed Name");
    expect(systemPrompt).not.toContain("peanut");
  });

  it("makes no AI request for an inaccessible meal-options child", async () => {
    mockLoadOwnedActiveChildProfile.mockResolvedValueOnce(null);
    const response = await request(buildApp())
      .post("/api/my-perfect-beginning/meal-options")
      .send({ childProfileId: childA.id, foodRequest: "pasta" });
    expect(response.status).toBe(404);
    expect(mockAiCreate).not.toHaveBeenCalled();
  });

  it("rejects an inaccessible stored child before create-dish generation", async () => {
    mockDbExecute.mockResolvedValueOnce({ rows: [] });
    const response = await request(buildApp())
      .post("/api/my-perfect-beginning/create-dish")
      .send({
        childProfileId: childA.id,
        ageStage: "growing_child",
        allergies: [],
        foodRequest: "pasta",
      });
    expect(response.status).toBe(404);
    expect(mockAiCreate).not.toHaveBeenCalled();
  });

  it("rejects the complete multi-child create-dish request when no requested child can be authorized", async () => {
    mockDbExecute.mockResolvedValue({ rows: [] });
    const response = await request(buildApp())
      .post("/api/my-perfect-beginning/create-dish")
      .send({
        childProfileIds: [childA.id, childB.id],
        ageStage: "preschool",
        allergies: [],
        foodRequest: "family pasta",
      });
    expect(response.status).toBe(404);
    expect(mockAiCreate).not.toHaveBeenCalled();
  });

  it("verifies ownership before saving a recipe with no completePlate sides", async () => {
    mockLoadOwnedActiveChildProfile.mockResolvedValueOnce(childA);
    const response = await request(buildApp())
      .post("/api/my-perfect-beginning/generated-meals")
      .send({
        childProfileId: childA.id,
        recipeData: attributedRecipe(childA.id),
        imageUrl: "https://example.test/source.jpg",
      });
    expect(response.status).toBe(200);
    expect(mockLoadOwnedActiveChildProfile).toHaveBeenCalledWith("parent-a", childA.id);
    expect(mockProcessMealImageForSave).toHaveBeenCalledTimes(1);
    expect(mockDbExecute).toHaveBeenCalledTimes(1);
  });

  it("performs no image work or insert for an inaccessible save subject", async () => {
    mockLoadOwnedActiveChildProfile.mockResolvedValueOnce(null);
    const response = await request(buildApp())
      .post("/api/my-perfect-beginning/generated-meals")
      .send({
        childProfileId: childA.id,
        recipeData: attributedRecipe(childA.id),
        imageUrl: "https://example.test/source.jpg",
      });
    expect(response.status).toBe(404);
    expect(mockProcessMealImageForSave).not.toHaveBeenCalled();
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  it("cannot save a Child A recipe under Child B", async () => {
    mockLoadOwnedActiveChildProfile.mockResolvedValueOnce(childB);
    const response = await request(buildApp())
      .post("/api/my-perfect-beginning/generated-meals")
      .send({
        childProfileId: childB.id,
        recipeData: attributedRecipe(childA.id),
        imageUrl: "https://example.test/source.jpg",
      });
    expect(response.status).toBe(409);
    expect(mockProcessMealImageForSave).not.toHaveBeenCalled();
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  it("refreshes verified subject attribution when restoring a saved meal", async () => {
    mockDbExecute.mockResolvedValueOnce({
      rows: [{
        id: "saved-meal",
        child_profile_id: childA.id,
        recipe_data: { recipeName: "Stored Meal" },
        image_url: null,
        selected_option_name: null,
        created_at: new Date("2026-09-20T12:00:00Z"),
      }],
    });
    const response = await request(buildApp())
      .get(`/api/my-perfect-beginning/generated-meals?childProfileId=${childA.id}`);
    expect(response.status).toBe(200);
    expect(response.body.meal.subject).toEqual({ childProfileId: childA.id });
    expect(response.body.meal.recipeData._subjectAttribution.childProfileId).toBe(childA.id);
    expect(
      response.body.meal.recipeData._subjectAttribution.token,
    ).toBe(signPediatricSubject("parent-a", childA.id));
  });
});