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
