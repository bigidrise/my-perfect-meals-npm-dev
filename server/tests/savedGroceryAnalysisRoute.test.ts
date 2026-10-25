import express from "express";
import request from "supertest";
import { readFileSync } from "node:fs";
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

test.each(["development", "production"])("%s attachment uses the authenticated owner and existing row with no paid access or AI", async mode => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = mode;
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

test.each(["development", "production"])("%s anonymous attachment requests never reach storage or AI", async mode => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = mode;
    expect((await request(app(null)).patch("/api/saved-groceries/saved-id/analysis-snapshot").send({})).status).toBe(401);
    expect(savedGroceryAnalysisStore.withItem).not.toHaveBeenCalled();
    expect(analyzeProductByName).not.toHaveBeenCalled();
  } finally { process.env.NODE_ENV = previous; }
});

test("Production mounts the existing Saved Groceries router behind requireAuth", () => {
  const production = readFileSync(`${__dirname}/../prod.ts`, "utf8");
  expect(production).toMatch(/app\.use\(\s*["']\/api\/saved-groceries["']\s*,\s*requireAuth\s*,\s*savedGroceriesRouter\s*\)/);
});

describe("Production snapshot attachment protections", () => {
  const previousMode = process.env.NODE_ENV;
  const analysis = { productName: "RXBAR Protein Bar", barcode: "known-upc", overallSummary: "Existing summary",
    verdict: "Existing Chef explanation", betterAlternatives: [], analysisMethod: "by_name", alignmentGrade: "B" };
  let row: any;
  let writes: number;
  const payload = () => ({ expectedAnalysisRevision: savedAnalysisRevision(row), analysis });

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    writes = 0;
    row = structuredClone({ ...item, barcode: "known-upc", productMeta: { ...item.productMeta,
      packageSize: "12 bars", ingredients: ["Original label"], evidenceStatus: "unverified" } });
    // Same short, serialized owner-scoped critical section as the existing store.
    // All state is local; no database is connected or written.
    let queue = Promise.resolve();
    (savedGroceryAnalysisStore.withItem as jest.Mock).mockImplementation((owner, id, change) => {
      const operation = queue.then(() => {
        const mutation = change(owner === row.userId && id === row.id ? row : null);
        if (mutation.productMeta) { row = { ...row, productMeta: mutation.productMeta }; writes++; }
        return mutation.value;
      });
      queue = operation.then(() => undefined, () => undefined);
      return operation;
    });
  });
  afterEach(() => {
    expect(analyzeProductByName).not.toHaveBeenCalled();
    process.env.NODE_ENV = previousMode;
  });

  test("another account cannot attach by claiming the owner's userId, and missing IDs are not recreated", async () => {
    const before = structuredClone(row);
    const wrongOwner = await request(app("owner-b")).patch("/api/saved-groceries/saved-id/analysis-snapshot")
      .send({ ...payload(), userId: "owner-a" });
    const missing = await request(app("owner-a")).patch("/api/saved-groceries/missing-id/analysis-snapshot").send(payload());
    expect([wrongOwner.status, missing.status]).toEqual([404, 404]);
    expect(row).toEqual(before); expect(writes).toBe(0);
  });

  test("a stale revision cannot overwrite changed product identity", async () => {
    const old = payload();
    row.productName = "Changed product";
    const before = structuredClone(row);
    const response = await request(app("owner-a")).patch("/api/saved-groceries/saved-id/analysis-snapshot").send(old);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("stale_record");
    expect(row).toEqual(before); expect(writes).toBe(0);
  });

  test.each([{ productName: "Another product" }, { barcode: "another-upc" }])("mismatched product or barcode is rejected: %j", async mismatch => {
    const before = structuredClone(row);
    const response = await request(app("owner-a")).patch("/api/saved-groceries/saved-id/analysis-snapshot")
      .send({ ...payload(), analysis: { ...analysis, ...mismatch } });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("identity_mismatch");
    expect(row).toEqual(before); expect(writes).toBe(0);
  });

  test("concurrent copies persist once, preserve original evidence, and reject the stale second copy without AI", async () => {
    const before = structuredClone(row), input = payload();
    const responses = await Promise.all([
      request(app("owner-a", false)).patch("/api/saved-groceries/saved-id/analysis-snapshot").send(input),
      request(app("owner-a", false)).patch("/api/saved-groceries/saved-id/analysis-snapshot").send(input),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(writes).toBe(1);
    expect(row).toMatchObject(before);
    expect(row.productMeta.analysisSnapshot).toEqual(analysis);
    expect(row.productMeta.evidenceStatus).toBe("unverified");
    expect(row.productMeta.ingredients).toEqual(["Original label"]);
    expect(row.productMeta.analysisRequest).toBeUndefined();
  });

  test.each(["analysis_already_saved", "analysis_in_progress"])("existing complete or running analyses remain protected: %s", async expected => {
    if (expected === "analysis_already_saved") row.productMeta.analysisSnapshot = analysis;
    else row.productMeta.analysisRequest = { state: "running", requestId: "existing-generation" };
    const before = structuredClone(row);
    const response = await request(app("owner-a")).patch("/api/saved-groceries/saved-id/analysis-snapshot").send(payload());
    expect(response.status).toBe(409);
    expect(response.body.code).toBe(expected);
    expect(row).toEqual(before); expect(writes).toBe(0);
  });

  test("an incomplete result is rejected before storage and never generates its missing analysis", async () => {
    const response = await request(app("owner-a")).patch("/api/saved-groceries/saved-id/analysis-snapshot")
      .send({ ...payload(), analysis: { ...analysis, fallbackUsed: true } });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("invalid_snapshot");
    expect(savedGroceryAnalysisStore.withItem).not.toHaveBeenCalled();
    expect(writes).toBe(0);
  });
});
