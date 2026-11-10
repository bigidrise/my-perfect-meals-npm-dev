const mockExecute = jest.fn();
const mockChild = jest.fn();
const mockGenerate = jest.fn();
const mockPersist = jest.fn();
jest.mock("../db", () => ({ db: { execute: mockExecute } }));
jest.mock("../services/pediatric/authoritativeChildAccess", () => ({ loadOwnedActiveChildProfile: mockChild }));
jest.mock("../services/pediatric/recipeImage", () => ({ generatePediatricRecipeImage: mockGenerate }));
jest.mock("../services/imageLifecycle", () => ({ processMealImageForSave: mockPersist }));

import express from "express";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";
import { regenerateSavedPediatricImage } from "../services/pediatric/savedImageRecovery";
import { buildPediatricImageContext } from "../../shared/pediatricMealImage";

const mealId = "10000000-0000-4000-8000-000000000001";
const childId = "20000000-0000-4000-8000-000000000001";
const operationId = "30000000-0000-4000-8000-000000000001";
const context = buildPediatricImageContext({
  stageKey: "preschool", textureClass: "puree_only",
  textureAndChokingPreparation: "Smooth with no chunks.",
});
const metadata = { pediatricContext: context, status: "fallback", sourceType: "dessert", attemptedWithPediatricContext: true };
const row = { id: mealId, image_url: null, recipe_data: {
  recipeName: "Fruit and Yogurt Parfait", ingredients: [{ name: "yogurt" }],
  textureAndChokingPreparation: "Smooth with no chunks.", _imageGeneration: metadata,
} };
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => { req.authUser = { id: "parent" }; next(); });
app.post("/saved/:mealId/retry", regenerateSavedPediatricImage);

it("executes the owned saved-recipe recovery wiring, preserving exact visual context and updating only image metadata", async () => {
  const old = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    mockChild.mockResolvedValue({ id: childId, age_stage: "preschool" });
    mockExecute.mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [{ id: mealId }] })
      .mockResolvedValueOnce({ rows: [{ id: mealId }] });
    mockGenerate.mockResolvedValue({ imageUrl: "/public-objects/test/parfait.png", imageGeneration: { ...metadata, status: "generated" } });
    mockPersist.mockResolvedValue({ imageUrl: "/public-objects/test/parfait.png" });
    const r = await request(app).post(`/saved/${mealId}/retry`).send({ childProfileId: childId, requestId: operationId });
    expect(r.status).toBe(200);
    expect(r.body.imagePersisted).toBe(true);
    expect(mockChild).toHaveBeenCalledWith("parent", childId);
    expect(mockGenerate).toHaveBeenCalledWith(row.recipe_data, expect.any(Object), "dessert", true, context);
    const queries = mockExecute.mock.calls.map(([q]) => new PgDialect().sqlToQuery(q));
    expect(queries[0].sql).toContain("c.id::text = m.child_profile_id");
    expect(queries[0].params).toContain("parent");
    expect(queries[0].params).toContain(childId);
    for (const q of queries.slice(1)) {
      expect(q.sql).toContain("c.is_archived = false");
      expect(q.sql).toContain("c.updated_at <= mpb_generated_meals.created_at");
      expect(q.sql).toContain("jsonb_set(recipe_data, '{_imageGeneration}'");
      expect(q.params).toContain("parent");
    }
    expect(queries[1].sql).toContain("AND recipe_data =");
    expect(queries[2].sql).toContain("->>'requestId'");
  } finally { process.env.NODE_ENV = old; }
});
