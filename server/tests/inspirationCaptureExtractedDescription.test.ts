/**
 * inspirationCaptureExtractedDescription.test.ts
 *
 * Confirms that POST /api/inspiration/capture always includes a non-empty
 * `extractedDescription` field in the response body, for both the text input
 * path and the image (camera/upload) input path.
 *
 * This matters because the client-side "Try 3 More" fallback reads
 * `result.extractedDescription` to re-enter the request. If the field is
 * accidentally dropped from the server response, every restored session fails
 * silently with the "re-enter your request" guard and no server-side error.
 *
 * Tests:
 *   1. Text input path   — extractedDescription equals the submitted content string.
 *   2. Image input path  — extractedDescription equals the vision model's extracted text.
 *   3. Structural check  — the source file emits extractedDescription on the
 *                          same res.json() call that emits mealData and options.
 *
 * Run: npx jest server/tests/inspirationCaptureExtractedDescription.test.ts
 */

// ── Constants shared across suites ────────────────────────────────────────────

const TEXT_CONTENT         = "Spicy Thai Basil Chicken";
const IMAGE_EXTRACTED_TEXT = "A plate of pad kra pao with jasmine rice and a fried egg on top";

// Minimal meal shape returned by the mocked craving-creator
const MOCK_MEAL = {
  name:        "Thai Basil Chicken",
  description: "A fragrant stir-fry",
  category:    "dinner",
  calories:    520,
  protein:     38,
  fat:         16,
  starchyCarbs: 12,
  fibrousCarbs: 8,
  cookingTime: "20 minutes",
  difficulty:  "Easy",
  ingredients: [
    { name: "chicken breast", quantity: "6 oz", unit: "" },
    { name: "thai basil",     quantity: "1 cup", unit: "" },
  ],
  instructions: "Stir-fry and serve.",
  macros: { calories: 520, protein: 38, fat: 16, carbs: 20 },
};

// ── Environment: set a harmless dummy key so the OPENAI_API_KEY guard passes ───
// The route returns 500 early when this variable is absent, even though the
// OpenAI client itself is fully mocked.  Setting a non-empty sentinel here
// ensures the test suite is self-contained and does not require deployment
// credentials.  The original value (if any) is restored after the suite.
const _origOpenAIKey = process.env.OPENAI_API_KEY;
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "test-dummy-key-not-used-by-mock";
}
afterAll(() => {
  if (_origOpenAIKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = _origOpenAIKey;
  }
});

// ── Mock: openai (hoisted) ─────────────────────────────────────────────────────
const mockOpenAICreate = jest.fn();

jest.mock("openai", () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAICreate } },
  }));
  return { __esModule: true, default: MockOpenAI };
});

// ── Mock: requireAuth / requireActiveAccess middleware ─────────────────────────
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.authUser = { id: "test-user-inspiration-001", planLookupKey: "mpm_ultimate" };
    next();
  },
  AuthenticatedRequest: {},
}));

jest.mock("../middleware/requireActiveAccess", () => ({
  requireActiveAccess: (_req: any, _res: any, next: any) => next(),
}));

// ── Mock: protocolEnvelope ─────────────────────────────────────────────────────
jest.mock("../services/protocolEnvelope", () => ({
  loadUserProtocolEnvelope: jest.fn().mockResolvedValue({
    dietaryIdentity:    [],
    allergies:          [],
    avoidances:         [],
    procedural:         [],
    specialty:          null,
    dailyNutritionState: null,
    alphaGalContext:    null,
  }),
}));

// ── Mock: mealImageGenerator ───────────────────────────────────────────────────
jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn().mockResolvedValue(null),
}));

// ── Mock: imageLifecycle (pulls in @replit/object-storage ESM) ─────────────────
jest.mock("../services/imageLifecycle", () => ({
  processMealImageForSave:     jest.fn().mockResolvedValue({ imageUrl: null }),
  ingestImageToPermanentStorage: jest.fn().mockResolvedValue(null),
}));

// ── Mock: @replit/object-storage (ESM module, not transformable by Jest) ────────
jest.mock("@replit/object-storage", () => ({ Client: class {} }));

// ── Mock: db (not used in capture, but imported transitively) ──────────────────
jest.mock("../db", () => {
  const chain: any = {
    from:   jest.fn().mockReturnThis(),
    where:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockResolvedValue([]),
    select: jest.fn().mockReturnThis(),
  };
  return { db: { select: jest.fn().mockReturnValue(chain) } };
});

// ── Imports (after mocks) ──────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, beforeAll } from "@jest/globals";
import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import { csrfProtection } from "../lib/csrfProtection";

// ── Global fetch mock ──────────────────────────────────────────────────────────
// The route calls fetch() to hit the internal craving-creator. We mock it at
// the global level so Jest captures it before the route handler runs.
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

function makeCravingResponse(meals: unknown[] = [MOCK_MEAL]) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue({ meals }),
  } as unknown as Response;
}

// ── App factory ────────────────────────────────────────────────────────────────
let app: express.Express;

beforeAll(async () => {
  app = express();
  app.use(express.json({ limit: "10mb" }));

  // Dynamically import after mocks are in place
  const router = (await import("../routes/inspiration")).default;
  app.use("/api", router);

  // Error boundary so supertest sees 500 instead of an uncaught exception
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });
});

// Reset per-test state
beforeEach(() => {
  mockFetch.mockReset();
  mockOpenAICreate.mockReset();
  mockOpenAICreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({
      dishName: "Thai Basil Chicken", foodCategory: "dinner", confidence: "high",
    }) } }],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 — Text input path
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/inspiration/capture — text input path", () => {
  it("returns 200 with a non-empty extractedDescription equal to the submitted content", async () => {
    // Text now uses a schema-bound culinary-occasion check, but no vision call.

    // Internal craving-creator returns a valid meal
    mockFetch.mockResolvedValue(makeCravingResponse([MOCK_MEAL]));

    const res = await request(app)
      .post("/api/inspiration/capture")
      .set("x-auth-token", "mock-token")
      .send({
        inputType: "text",
        content:   TEXT_CONTENT,
        servings:  2,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Primary assertion: extractedDescription must be present and non-empty
    expect(typeof res.body.extractedDescription).toBe("string");
    expect(res.body.extractedDescription.trim().length).toBeGreaterThan(0);

    // For the text path it must equal the submitted content
    expect(res.body.extractedDescription).toBe(TEXT_CONTENT);
  });

  it("includes extractedDescription alongside mealData and options in the same response", async () => {
    mockFetch.mockResolvedValue(makeCravingResponse([MOCK_MEAL]));

    const res = await request(app)
      .post("/api/inspiration/capture")
      .send({ inputType: "text", content: TEXT_CONTENT });

    expect(res.status).toBe(200);
    // All three fields required by the client must co-exist in the response
    expect(res.body).toHaveProperty("extractedDescription");
    expect(res.body).toHaveProperty("mealData");
    expect(res.body).toHaveProperty("options");
  });

  it("preserves extractedDescription when healthMode / proteinPriority / prepStyle are enriched", async () => {
    // Enrichment modifies the cravingInput sent to craving-creator, but
    // extractedDescription must still reflect the original submitted content.
    mockFetch.mockResolvedValue(makeCravingResponse([MOCK_MEAL]));

    const res = await request(app)
      .post("/api/inspiration/capture")
      .send({
        inputType:       "text",
        content:         TEXT_CONTENT,
        healthMode:      "healthier",
        proteinPriority: "athlete",
        prepStyle:       "easy",
      });

    expect(res.status).toBe(200);
    expect(res.body.extractedDescription).toBe(TEXT_CONTENT);
  });
});

describe("Recipe Maker authenticated internal generation", () => {
  const SESSION_COOKIE = "recipe-session=valid";
  const CSRF_TOKEN = "csrf-for-authenticated-recipe-session";
  const EXPECTED_ORIGIN = "http://localhost:5000";
  let protectedApp: express.Express;
  let generatorReached: jest.Mock;

  beforeAll(async () => {
    protectedApp = express();
    protectedApp.use(express.json());
    protectedApp.use((req, _res, next) => {
      if (req.get("cookie") === SESSION_COOKIE) {
        (req as any).session = { userId: "test-user-inspiration-001", csrfToken: CSRF_TOKEN };
      }
      next();
    });
    protectedApp.use(csrfProtection);
    protectedApp.use("/api", (await import("../routes/inspiration")).default);
    generatorReached = jest.fn((_req, res) => res.json({ meals: [MOCK_MEAL] }));
    protectedApp.post("/api/meals/craving-creator", (req, res) => {
      if (!(req as any).session?.userId) return res.sendStatus(401);
      generatorReached(req, res);
    });
  });

  function routeInternalFetchThroughSecurity() {
    mockFetch.mockImplementation(async (_url, init) => {
      const inner = await request(protectedApp)
        .post("/api/meals/craving-creator")
        .set(init.headers)
        .send(JSON.parse(init.body));
      return { ok: inner.ok, status: inner.status, json: async () => inner.body };
    });
  }

  beforeEach(() => {
    generatorReached?.mockClear();
  });

  it.each([
    ["trusted browser Origin", { Origin: EXPECTED_ORIGIN }],
    ["originless API marker", { "x-requested-with": "XMLHttpRequest" }],
  ])("reaches generation with valid session, CSRF token, and %s", async (_label, entryHeaders) => {
    routeInternalFetchThroughSecurity();
    const response = await request(protectedApp)
      .post("/api/inspiration/capture")
      .set({
        Cookie: SESSION_COOKIE,
        "x-csrf-token": CSRF_TOKEN,
        ...entryHeaders,
      })
      .send({ inputType: "text", content: TEXT_CONTENT, servings: 2 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.options).toHaveLength(1);
    expect(generatorReached).toHaveBeenCalledTimes(1);
    expect(generatorReached.mock.calls[0][0].body.cravingInput).toContain(TEXT_CONTENT);
  });

  it("rejects an untrusted external origin before Recipe Maker can call generation", async () => {
    routeInternalFetchThroughSecurity();
    const response = await request(protectedApp)
      .post("/api/inspiration/capture")
      .set({
        Cookie: SESSION_COOKIE,
        "x-csrf-token": CSRF_TOKEN,
        Origin: "https://attacker.example",
      })
      .send({ inputType: "text", content: TEXT_CONTENT });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("CSRF_ORIGIN_REJECTED");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(generatorReached).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — Image (camera / upload) input path
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/inspiration/capture — image input path", () => {
  // Minimal valid base64 PNG data-URI (1×1 transparent pixel)
  const DUMMY_BASE64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  it("returns 200 with a non-empty extractedDescription equal to the vision model output", async () => {
    // OpenAI vision returns the extracted text
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: IMAGE_EXTRACTED_TEXT } }],
    });

    // Internal craving-creator returns a valid meal
    mockFetch.mockResolvedValue(makeCravingResponse([MOCK_MEAL]));

    const res = await request(app)
      .post("/api/inspiration/capture")
      .send({
        inputType:   "camera",
        imageBase64: DUMMY_BASE64,
        servings:    2,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Primary assertion: extractedDescription must be present and non-empty
    expect(typeof res.body.extractedDescription).toBe("string");
    expect(res.body.extractedDescription.trim().length).toBeGreaterThan(0);

    // For the image path it must equal what the vision model returned
    expect(res.body.extractedDescription).toBe(IMAGE_EXTRACTED_TEXT);
  });

  it("uses inputType 'upload' as well as 'camera' for the image path", async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: IMAGE_EXTRACTED_TEXT } }],
    });
    mockFetch.mockResolvedValue(makeCravingResponse([MOCK_MEAL]));

    const res = await request(app)
      .post("/api/inspiration/capture")
      .send({
        inputType:   "upload",
        imageBase64: DUMMY_BASE64,
      });

    expect(res.status).toBe(200);
    expect(res.body.extractedDescription).toBe(IMAGE_EXTRACTED_TEXT);
  });

  it("includes extractedDescription alongside mealData and options for the image path", async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: IMAGE_EXTRACTED_TEXT } }],
    });
    mockFetch.mockResolvedValue(makeCravingResponse([MOCK_MEAL]));

    const res = await request(app)
      .post("/api/inspiration/capture")
      .send({ inputType: "camera", imageBase64: DUMMY_BASE64 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("extractedDescription");
    expect(res.body).toHaveProperty("mealData");
    expect(res.body).toHaveProperty("options");
  });

  it("falls back to the content field when vision model returns empty string", async () => {
    // Vision model returns blank — server falls back to req.body.content
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: "" } }],
    });
    mockFetch.mockResolvedValue(makeCravingResponse([MOCK_MEAL]));

    const FALLBACK_CONTENT = "pad kra pao";
    const res = await request(app)
      .post("/api/inspiration/capture")
      .send({
        inputType:   "camera",
        imageBase64: DUMMY_BASE64,
        content:     FALLBACK_CONTENT,
      });

    expect(res.status).toBe(200);
    // The server falls back to the submitted content string when vision is blank
    expect(res.body.extractedDescription).toBe(FALLBACK_CONTENT);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — Structural source check (regression guard)
// ─────────────────────────────────────────────────────────────────────────────

describe("Recipe Maker category and failure handoff", () => {
  it("hands a photographed Napoleon to the snack/recipe path and keeps its source", async () => {
    const source = "Mille-feuille (Napoleon), a French layered pastry with cream filling.";
    mockOpenAICreate
      .mockResolvedValueOnce({ choices: [{ message: { content: source } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
        dishName: "Mille-feuille (Napoleon)", foodCategory: "dessert", confidence: "high",
      }) } }] });
    mockFetch.mockResolvedValue(makeCravingResponse([MOCK_MEAL]));
    const response = await request(app).post("/api/inspiration/capture").send({
      inputType: "upload", imageBase64: "data:image/png;base64,test", servings: 2,
    });
    expect(response.status).toBe(200);
    const innerRequest = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(innerRequest).toMatchObject({
      targetMealType: "snack", generationMode: "recipe", servings: 2,
    });
    expect(innerRequest.cravingInput).toContain("Preserve this dish and format");
    expect(response.body.extractedDescription).toBe(source);
    expect(response.body.foodCategory).toBe("dessert");
  });

  it("preserves validation status and concise actual findings", async () => {
    mockFetch.mockResolvedValue({
      ok: false, status: 409,
      json: async () => ({
        code: "HUMAN_FOOD_FINAL_REVIEW_REQUIRED",
        findings: [{ code: "starch_evidence_missing" }],
        message: "The final formatted food did not pass universal validation.",
      }),
    });
    const response = await request(app).post("/api/inspiration/capture")
      .send({ inputType: "text", content: "Oat breakfast" });
    expect(response.status).toBe(409);
    expect(response.body.reasonCodes).toEqual(["starch_evidence_missing"]);
    expect(response.body.error).toContain("verified starch information");
  });

  it("does not generate food when category interpretation is unavailable", async () => {
    mockOpenAICreate.mockRejectedValue(new Error("model unavailable"));
    const response = await request(app).post("/api/inspiration/capture")
      .send({ inputType: "text", content: "Napoleon pastry" });
    expect(response.status).toBe(503);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("inspiration.ts structural — extractedDescription always emitted", () => {
  const fs   = require("fs");
  const path = require("path");
  const src: string = fs.readFileSync(
    path.join(__dirname, "../routes/inspiration.ts"),
    "utf8"
  );

  it("the res.json() call that returns mealData also includes extractedDescription", () => {
    // Both fields must appear on the same JSON response object
    expect(src).toContain("extractedDescription");
    expect(src).toContain("mealData");
    // Confirm they are in the same res.json() block (both present in the return statement)
    const returnBlock = src.match(/return res\.json\(\{[\s\S]*?\}\s*\)/)?.[0] ?? "";
    expect(returnBlock).toContain("extractedDescription");
    expect(returnBlock).toContain("mealData");
  });

  it("extractedDescription is set to mealDescription (the extracted string, not the enriched input)", () => {
    // Must be `extractedDescription: mealDescription` — not enrichedInput or cravingInput
    expect(src).toMatch(/extractedDescription\s*:\s*mealDescription/);
  });

  it("mealDescription is assigned before the res.json() call on both input paths", () => {
    // Both paths (image and text) must set mealDescription before the final return
    // Text path: `mealDescription = (content || "").trim()`
    expect(src).toMatch(/mealDescription\s*=\s*\(content\s*\|\|\s*["']["']\s*\)\.trim\(\)/);
    // Image path: mealDescription set from vision response
    expect(src).toMatch(/mealDescription\s*=[\s\S]*?visionResponse\.choices/);
  });

  it("does NOT emit extractedDescription inside the 422 error path (error responses are not affected)", () => {
    // The 422 craving-creator-failure response must not accidentally include
    // extractedDescription (it would be undefined/empty and mislead the client)
    const errorBlock422 = src.match(/return res\.status\(422\)[\s\S]*?;/)?.[0] ?? "";
    expect(errorBlock422).not.toContain("extractedDescription");
  });
});
