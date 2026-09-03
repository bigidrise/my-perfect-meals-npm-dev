/**
 * barcodeScanContract.test.ts
 *
 * Contract test for POST /api/biometrics/ingredient-scan-by-barcode.
 *
 * The Playwright spec in client/e2e/barcode-camera-database-badge.spec.ts
 * mocks this route with a fixed response shape:
 *
 *   { ok, resolvedFromDb, resolvedName, result: { productName, … } }
 *
 * If the server ever changes that shape the Playwright mock will silently
 * diverge — tests keep passing while the real product breaks.  This suite
 * validates the live route handler directly so any shape change is caught
 * immediately.
 *
 * Auth and external dependencies (Open Food Facts, analyzeProductByName)
 * are mocked so the test runs without a database or network.
 */

// ── Mock declarations (hoisted before imports) ────────────────────────────────

// Mock the database module so the test truly runs without a database.
// biometricsRoutes imports db at module load time; without this mock the
// DB initialisation throws before any test code runs (no DATABASE_URL in CI).
jest.mock("../db", () => ({
  db: {
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.authUser = { id: "contract-test-user", planLookupKey: "mpm_premium" };
    next();
  },
  AuthenticatedRequest: {},
}));

jest.mock("../middleware/requireActiveAccess", () => ({
  requireActiveAccess: (_req: any, _res: any, next: any) => next(),
}));

jest.mock("../services/ingredientScanService", () => ({
  analyzeProductByName: jest.fn().mockResolvedValue({
    productName: "Organic Whole Milk",
    alignmentGrade: "B",
    verdictLevel: "buy",
    analysisMethod: "by_label",
    scoreCards: {
      kids:        { verdict: "thumbsUp", reason: "Good calcium source" },
      adults:      { verdict: "thumbsUp", reason: "Whole-food dairy" },
      diet:        { verdict: "neutral",  reason: "Fits most diets" },
      fitnessGoal: { verdict: "thumbsUp", reason: "Protein and fat balance" },
    },
    outcomeCards: [],
    goodThings: [],
    watchOut: [],
    profileInsights: [],
    ingredientDecoder: [],
    betterAlternatives: [],
    profileFactors: [],
    whatMattersMost: [],
  }),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import request from "supertest";
import express from "express";
import biometricsRouter from "../routes/biometricsRoutes";

// ── App factory ───────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/biometrics", biometricsRouter);
  return app;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stub global fetch to simulate an Open Food Facts hit. */
function stubFetchOFF(productName: string) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      status: 1,
      product: { product_name_en: productName },
    }),
  }) as unknown as typeof fetch;
}

/** Stub global fetch to simulate an Open Food Facts miss (no product). */
function stubFetchOFFMiss() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: 0, product: null }),
  }) as unknown as typeof fetch;
}

// ── Contract tests ────────────────────────────────────────────────────────────

describe("POST /api/biometrics/ingredient-scan-by-barcode — response-shape contract", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  // ── Shape assertions shared by all success cases ──────────────────────────

  function assertSuccessShape(body: Record<string, unknown>) {
    // Top-level envelope fields required by the Playwright mock
    expect(body).toHaveProperty("ok", true);
    expect(body).toHaveProperty("resolvedFromDb");
    expect(body).toHaveProperty("resolvedName");
    expect(body).toHaveProperty("result");

    // result must be an object that carries at least productName
    const result = body.result as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    expect(result).toHaveProperty("productName");
    expect(typeof result.productName).toBe("string");
    expect((result.productName as string).length).toBeGreaterThan(0);
  }

  // ── Case 1: barcode found in Open Food Facts → resolvedFromDb: true ────────

  test("resolvedFromDb is true when Open Food Facts returns a product name", async () => {
    stubFetchOFF("Organic Whole Milk");

    const app = buildApp();
    const res = await request(app)
      .post("/api/biometrics/ingredient-scan-by-barcode")
      .send({ barcode: "012000030901" });

    expect(res.status).toBe(200);
    assertSuccessShape(res.body);

    expect(res.body.resolvedFromDb).toBe(true);
    expect(typeof res.body.resolvedName).toBe("string");
    expect((res.body.resolvedName as string).length).toBeGreaterThan(0);
  });

  // ── Case 2: barcode not found in OFF → explicit unresolved response ──────

  test("resolvedFromDb is false when Open Food Facts has no record", async () => {
    stubFetchOFFMiss();

    const app = buildApp();
    const res = await request(app)
      .post("/api/biometrics/ingredient-scan-by-barcode")
      .send({ barcode: "099999999999" });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("ok", false);
    expect(res.body.resolvedFromDb).toBe(false);
    expect(res.body.unresolvedBarcode).toBe(true);
    expect(res.body).not.toHaveProperty("result");
  });

  // ── Case 3: OFF network error → explicit unresolved response ─────────────

  test("resolvedFromDb is false when Open Food Facts fetch throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network timeout")) as unknown as typeof fetch;

    const app = buildApp();
    const res = await request(app)
      .post("/api/biometrics/ingredient-scan-by-barcode")
      .send({ barcode: "012000030901" });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("ok", false);
    expect(res.body.resolvedFromDb).toBe(false);
    expect(res.body.unresolvedBarcode).toBe(true);
    expect(res.body).not.toHaveProperty("result");
  });

  // ── Input-validation cases (shape of error envelope) ──────────────────────

  test("returns ok:false with status 400 when barcode is missing", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/biometrics/ingredient-scan-by-barcode")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("ok", false);
    expect(res.body).toHaveProperty("error");
  });

  test("returns ok:false with status 400 when barcode contains no digits", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/biometrics/ingredient-scan-by-barcode")
      .send({ barcode: "---" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("ok", false);
    expect(res.body).toHaveProperty("error");
  });
});
