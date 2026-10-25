import express from "express";
import request from "supertest";
jest.mock("../db", () => ({ db: {} }));
jest.mock("../services/savedGroceryRevalidation", () => ({ revalidateSavedGroceriesForUser: jest.fn() }));
jest.mock("../services/savedGroceryAnalysisStore", () => ({ savedGroceryAnalysisStore: { withItem: jest.fn() } }));
jest.mock("../services/ingredientScanService", () => ({ analyzeProductByName: jest.fn() }));
import router from "../routes/savedGroceries";
import { savedGroceryAnalysisStore } from "../services/savedGroceryAnalysisStore";
import { analyzeProductByName } from "../services/ingredientScanService";
import { savedEvidenceRevision } from "../services/savedGroceryEvidence";
import { savedAnalysisRevision } from "../services/savedGroceryAnalysis";

function app(owner: string | null, paid = true) {
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => {
    if (owner) (req as any).authUser = { id: owner, accessTier: paid ? "PAID_FULL" : "FREE" };
    next();
  });
  server.use("/api/saved-groceries", router);
  return server;
}
const item = { id: "saved-id", userId: "owner-a", productName: "Protein Bar", brand: "RXBAR", productKey: "bar",
  source: "grocery-coach", productMeta: { recommendationWhyBetter: ["Own recommendation"] } };
const body = () => ({ requestId: "explicit-operation-001", expectedRevision: savedEvidenceRevision(item) });

beforeEach(() => jest.clearAllMocks());

test("anonymous and unpaid requests cannot reach product lookup or AI", async () => {
  expect((await request(app(null)).post("/api/saved-groceries/saved-id/analyze").send(body())).status).toBe(401);
  expect((await request(app("owner-a", false)).post("/api/saved-groceries/saved-id/analyze").send(body())).status).toBe(403);
  expect(savedGroceryAnalysisStore.withItem).not.toHaveBeenCalled();
  expect(analyzeProductByName).not.toHaveBeenCalled();
});

test("route scopes by authenticated owner and saved ID, ignoring client-supplied product, user and analysis", async () => {
  let row = structuredClone(item) as any;
  (savedGroceryAnalysisStore.withItem as jest.Mock).mockImplementation(async (owner, id, change) => {
    expect(owner).toBe("owner-a"); expect(id).toBe("saved-id");
    const mutation = change(row);
    if (mutation.productMeta) row.productMeta = mutation.productMeta;
    return mutation.value;
  });
  (analyzeProductByName as jest.Mock).mockResolvedValue({ productName: "RXBAR Protein Bar", overallSummary: "Independent summary",
    verdict: "Independent Chef explanation", alignmentGrade: "B", betterAlternatives: [], analysisMethod: "by_name", fallbackUsed: false });
  const response = await request(app("owner-a")).post("/api/saved-groceries/saved-id/analyze")
    .send({ ...body(), userId: "owner-b", productName: "Other product", analysis: { alignmentGrade: "A" } });
  expect(response.status).toBe(200);
  expect(analyzeProductByName).toHaveBeenCalledWith("RXBAR Protein Bar", "owner-a");
  expect(response.body.item.id).toBe("saved-id");
  expect(response.body.item.productMeta.analysisSnapshot.alignmentGrade).toBe("B");
  expect(response.body.item.evidenceRevision).toBe(savedEvidenceRevision(row));
});

test("another account's missing record returns 404 without calling AI", async () => {
  (savedGroceryAnalysisStore.withItem as jest.Mock).mockImplementation(async (owner, _id, change) => {
    expect(owner).toBe("owner-b"); return change(null).value;
  });
  const response = await request(app("owner-b")).post("/api/saved-groceries/saved-id/analyze").send(body());
  expect(response.status).toBe(404);
  expect(analyzeProductByName).not.toHaveBeenCalled();
});

test("Development attachment uses the authenticated owner and existing row with no paid access or AI", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    let row = structuredClone(item) as any;
    (savedGroceryAnalysisStore.withItem as jest.Mock).mockImplementation(async (owner, id, change) => {
      expect(owner).toBe("owner-a"); expect(id).toBe("saved-id");
      const mutation = change(row);
      if (mutation.productMeta) row.productMeta = mutation.productMeta;
      return mutation.value;
    });
    const analysis = { productName: "RXBAR Protein Bar", overallSummary: "Already generated summary",
      verdict: "Existing Chef explanation", betterAlternatives: [], analysisMethod: "by_name", alignmentGrade: "B" };
    const response = await request(app("owner-a", false)).patch("/api/saved-groceries/saved-id/analysis-snapshot")
      .send({ expectedAnalysisRevision: savedAnalysisRevision(row), analysis, userId: "owner-b",
        productMeta: { evidenceStatus: "verified", ingredients: ["Invented"] } });
    expect(response.status).toBe(200);
    expect(response.body.item.id).toBe("saved-id");
    expect(response.body.item.productMeta).toMatchObject({ ...item.productMeta, analysisSnapshot: analysis });
    expect(row.productMeta.evidenceStatus).toBeUndefined();
    expect(row.productMeta.ingredients).toBeUndefined();
    expect(response.body.item.analysisRevision).toBe(savedAnalysisRevision(row));
    expect(analyzeProductByName).not.toHaveBeenCalled();
  } finally { process.env.NODE_ENV = previous; }
});

test("snapshot attachment is unavailable outside Development and anonymous requests never reach storage", async () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    expect((await request(app("owner-a")).patch("/api/saved-groceries/saved-id/analysis-snapshot").send({})).status).toBe(404);
    process.env.NODE_ENV = "development";
    expect((await request(app(null)).patch("/api/saved-groceries/saved-id/analysis-snapshot").send({})).status).toBe(401);
    expect(savedGroceryAnalysisStore.withItem).not.toHaveBeenCalled();
    expect(analyzeProductByName).not.toHaveBeenCalled();
  } finally { process.env.NODE_ENV = previous; }
});
