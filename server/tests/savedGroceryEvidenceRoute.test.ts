import express from "express";
import request from "supertest";
const mockState: { row: any; actor: string | null; fail: boolean } = { row: null, actor: "a", fail: false };
jest.mock("../services/savedGroceryRevalidation", () => ({ revalidateSavedGroceriesForUser: jest.fn(async () => []) }));
jest.mock("../db", () => {
  const { PgDialect } = jest.requireActual("drizzle-orm/pg-core");
  const matches = (condition: any) => {
    const { params } = new PgDialect().sqlToQuery(condition);
    return mockState.row && params.includes(mockState.row.id) && params.includes(mockState.row.userId);
  };
  const tx = {
    select: () => ({ from: () => ({ where: (condition: any) => ({
      for: async () => matches(condition) ? [structuredClone(mockState.row)] : [],
    }) }) }),
    update: () => ({ set: (changes: any) => ({ where: (condition: any) => ({
      returning: async () => {
        if (mockState.fail) throw Error("Simulated failure");
        if (!matches(condition)) throw Error("Missing ownership predicate");
        mockState.row = { ...mockState.row, ...changes };
        return [mockState.row];
      },
    }) }) }),
  };
  return { db: { transaction: async (callback: any) => callback(tx) } };
});
import router from "../routes/savedGroceries";
import { savedEvidenceRevision } from "../services/savedGroceryEvidence";

const app = express();
app.use(express.json());
app.use((req, _, next) => { (req as any).authUser = mockState.actor ? { id: mockState.actor } : null; next(); });
app.use("/api/saved-groceries", router);
const path = "/api/saved-groceries/one/evidence";
const analysis = { productName: "Simply Orange", analysisMethod: "by_label", extractedIngredients: ["orange juice"] };
beforeEach(() => {
  mockState.actor = "a"; mockState.fail = false;
  mockState.row = { id: "one", userId: "a", productKey: "name::simply::orange", productName: "Orange", brand: "Simply",
    productMeta: { reason: "Original" }, nutritionJson: null };
});
const payload = () => ({ confirmedCurrentLabel: true, expectedRevision: savedEvidenceRevision(mockState.row), analysis });
test("only the authenticated owner can update the exact saved record", async () => {
  const body = payload();
  mockState.actor = null;
  await request(app).patch(path).send(body).expect(401);
  mockState.actor = "b";
  await request(app).patch(path).send(body).expect(404);
  expect(mockState.row.productMeta).toEqual({ reason: "Original" });
  mockState.actor = "a";
  const updated = await request(app).patch(path).send(body).expect(200);
  expect(updated.body.item.productName).toBe("Orange");
  expect(updated.body.item.brand).toBe("Simply");
  expect(updated.body.item.productMeta.evidenceHistory).toHaveLength(1);
  expect(updated.body.item.evidenceRevision).not.toBe(body.expectedRevision);
});
test("stale and failed writes leave previous evidence unchanged", async () => {
  const body = payload();
  mockState.fail = true;
  await request(app).patch(path).send(body).expect(500);
  expect(mockState.row.productMeta.reason).toBe("Original");
  mockState.fail = false;
  await request(app).patch(path).send(body).expect(200);
  const current = structuredClone(mockState.row);
  await request(app).patch(path).send(body).expect(409);
  expect(mockState.row).toEqual(current);
});
