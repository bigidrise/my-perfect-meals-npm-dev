/**
 * allergyOverrideCorrelationId.test.ts
 *
 * Integration tests that confirm allergy override audit rows for
 * dessert-creator and beverage-creator carry a non-null correlation_id
 * matching the request's req.id when a Safety PIN override is used.
 *
 * Strategy
 * --------
 * - The safety enforcement path (enforceSafetyProfile, claimOverrideToken,
 *   logSafetyOverride, commitOverrideToken) runs against the REAL database —
 *   nothing in that chain is mocked.
 * - A real test user with a peanut allergy and a known Safety PIN is seeded
 *   before the suite and torn down after.
 * - verifyPinAndIssueOverrideToken is called to produce a live override token,
 *   exactly as the client would do before submitting the generation request.
 * - Middleware injects req.id = TEST_CORRELATION_ID and req.authUser so the
 *   routes can read the correlation ID they must thread into the audit call.
 * - Only the generation-side dependencies (OpenAI, protocol envelope, GLP-1,
 *   ACE, image generator, etc.) are mocked — they are irrelevant to the
 *   audit-row assertion and would add network latency / require API keys.
 * - After each route call the test queries safety_override_audit_logs directly
 *   and asserts correlation_id === TEST_CORRELATION_ID.
 *
 * Run: npx jest server/tests/allergyOverrideCorrelationId.test.ts --runInBand
 */

// ── Generation-side mocks (must be declared before imports) ───────────────────

// Auth middleware — bypass access checks, inject authUser
jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.authUser = { id: (req as any).__testUserId ?? "", planLookupKey: "mpm_ultimate" };
    next();
  },
  AuthenticatedRequest: {},
}));

jest.mock("../middleware/requireActiveAccess", () => ({
  requireActiveAccess: (_req: any, _res: any, next: any) => next(),
}));

// Protocol envelope — return a minimal guest envelope; not under test here
const GUEST_ENVELOPE = {
  userId: null,
  dietaryIdentity: [],
  allergies: [],
  medicalHardLimits: [],
  medicalOptimization: [],
  avoidances: [],
  preferences: [],
  procedural: {},
  cuisinePreference: null,
  cuisineIntensity: "balanced",
  diabeticGuidance: null,
  hasDiabetes: false,
  diabeticGlucoseState: null,
  conditionGuidanceBlocks: [],
  glp1DailyTolerance: null,
  thyroidSupport: false,
  thyroidMedication: null,
  thyroidType: null,
  hormoneOptimization: false,
  measurementSystem: "imperial",
  fitnessGoal: null,
  goalType: null,
  goalTarget: null,
  performanceOverlay: "standard",
  performanceControlMode: "self_guided",
  pregnancySupport: false,
  pregnancySupportContext: null,
  carbCycleContext: null,
  performanceNutrition: false,
  performanceContext: null,
  performanceLayer: null,
  dailyNutritionState: null,
  therapeuticSupport: false,
  therapeuticSupportContext: null,
  selectedMealBuilder: null,
  preferredLanguage: null,
  flavorPreference: null,
  heatPreference: null,
  palateSpiceTolerance: null,
  palateSeasoningIntensity: null,
  palateFlavorStyle: null,
  providerInterventions: [],
  interventionPatientSummary: [],
};

jest.mock("../services/protocolEnvelope", () => ({
  buildGuestEnvelope: jest.fn(() => ({ ...GUEST_ENVELOPE })),
  loadUserProtocolEnvelope: jest.fn().mockResolvedValue({ ...GUEST_ENVELOPE }),
  enforceBeforeGenerate: jest.fn(() => ({ combined: "", blocks: [] })),
  scanGeneratedOutput: jest.fn(() => ({
    passed: true,
    message: "",
    violations: [],
    instructionViolations: [],
  })),
  buildMealComplianceBundle: jest.fn(() => ({
    complianceSection: null,
    dietClassification: "standard",
  })),
}));

jest.mock("../services/nutritionContext/getActiveNutritionContext", () => ({
  getActiveNutritionContext: jest.fn().mockResolvedValue({
    envelope: { ...GUEST_ENVELOPE },
    combinedBlock: "",
    diet: [],
    medical: [],
    builder: null,
  }),
}));

jest.mock("../services/glp1/resolveGLP1GlobalContext", () => ({
  resolveGLP1GlobalContext: jest.fn().mockResolvedValue({
    isActive: false,
    resolvedTargets: null,
  }),
}));

jest.mock("../services/ace/buildAcePromptBlock", () => ({
  buildAcePromptBlock: jest.fn().mockResolvedValue(null),
}));

jest.mock("../services/guardrails/beverageMedicalRules", () => ({
  buildBeveragePromptBlocks: jest.fn(() => ""),
  validateBeverageOutput: jest.fn(() => ({
    passed: true,
    violations: [],
    retryHint: "",
  })),
  attemptBeverageAutoFix: jest.fn(() => null),
}));

jest.mock("../utils/languageInstruction", () => ({
  getLanguageInstruction: jest.fn(() => ""),
}));

jest.mock("../services/behavioralMemoryService", () => ({
  derivePreferenceProfile: jest.fn().mockResolvedValue(null),
  buildBehavioralMemoryPromptSection: jest.fn(() => ""),
}));

jest.mock("../services/creatorSystems/resolveCreatorSystemForUser", () => ({
  resolveCreatorSystemForUser: jest.fn().mockResolvedValue({ system: "standard" }),
}));

jest.mock("../services/creatorSystems/applyCreatorTransformation", () => ({
  applyCreatorTransformation: jest.fn(async (meal: any) => meal),
}));

jest.mock("../services/coaching/activityEvents", () => ({
  emitActivityEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../services/mealImageGenerator", () => ({
  generateMealImageUnified: jest.fn().mockResolvedValue(null),
}));

jest.mock("../services/medicalBadges", () => ({
  computeMedicalBadges: jest.fn(() => []),
  computeAlphaGalBadge: jest.fn(() => null),
}));

jest.mock("../services/ingredientNormalizer", () => ({
  normalizeIngredients: jest.fn((ingredients: any[]) => ingredients),
}));

jest.mock("../services/allergyGuardrails", () => {
  const real = jest.requireActual("../services/allergyGuardrails");
  return {
    ...real,
    resolveDietCategoryStrategy: jest.fn(() => ({
      conflictLevel: "none",
      effectiveCategory: "smoothie",
      requestedCategory: "smoothie",
      coachingBlock: "",
    })),
  };
});

jest.mock("../services/promptBuilder", () => ({
  buildPalateSection: jest.fn(() => ""),
  buildStrictModeBlock: jest.fn(() => ""),
  buildSweetenerAllowlistBlock: jest.fn(() => ""),
  resolveSweetenerAllowlist: jest.fn(() => ({ preferred: [], avoidAll: false })),
}));

jest.mock("../utils/chefAdaptationBlock", () => ({
  buildChefAdaptationBlock: jest.fn(() => ""),
}));

jest.mock("../services/guardrails", () => ({
  validateMealForDiet: jest.fn(() => ({ isValid: true, violations: [] })),
}));

// OpenAI — return a minimal valid beverage/dessert JSON
const MOCK_MEAL_JSON = JSON.stringify({
  name: "Test Peanut Smoothie",
  description: "A test smoothie.",
  ingredients: [{ name: "banana", amount: "1", unit: "each" }],
  instructions: "Blend everything.",
  nutrition: { calories: 250, protein: 8, carbs: 35, fat: 6 },
  servingSize: "1 drink",
  reasoning: "Test.",
  imageUrl: "",
});

jest.mock("openai", () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: MOCK_MEAL_JSON } }],
        }),
      },
    },
  }));
  return { __esModule: true, default: MockOpenAI };
});

// ── Imports ───────────────────────────────────────────────────────────────────

import { randomUUID } from "crypto";
import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { users, safetyOverrideAuditLogs } from "../../shared/schema";
import {
  setUserPin,
  verifyPinAndIssueOverrideToken,
} from "../services/safetyPinService";

// ── Constants ─────────────────────────────────────────────────────────────────

const TEST_CORRELATION_ID = "corr-test-dessert-beverage-audit-01";
const TEST_PIN = "4219";

// ── DB test user fixtures ─────────────────────────────────────────────────────

let testUserId: string;

async function seedTestUser(): Promise<string> {
  const uid = randomUUID();
  await db.insert(users).values({
    id: uid,
    username: `test-allergy-override-${uid.slice(0, 8)}`,
    email: `allergy-override-${uid.slice(0, 8)}@test.invalid`,
    password: "hashed-placeholder",
    plan: "basic",
    allergies: ["peanut"],
  });
  await setUserPin(uid, TEST_PIN);
  return uid;
}

async function teardownTestUser(uid: string): Promise<void> {
  await db
    .delete(safetyOverrideAuditLogs)
    .where(eq(safetyOverrideAuditLogs.userId, uid));
  await db.delete(users).where(eq(users.id, uid));
}

// ── App factories ─────────────────────────────────────────────────────────────

/**
 * Injects req.id (the correlation ID) and req.__testUserId so the auth
 * middleware shim can set req.authUser.id to the correct test user.
 */
function makeCorrelationMiddleware(userId: string) {
  return (req: any, _res: any, next: any) => {
    req.id = TEST_CORRELATION_ID;
    req.__testUserId = userId;
    req.authUser = { id: userId, planLookupKey: "mpm_ultimate" };
    next();
  };
}

async function buildDessertApp(userId: string) {
  const app = express();
  app.use(express.json());
  app.use(makeCorrelationMiddleware(userId));
  const router = (await import("../routes/dessert-creator")).default;
  app.use("/api/dessert-creator", router);
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });
  return app;
}

async function buildBeverageApp(userId: string) {
  const app = express();
  app.use(express.json());
  app.use(makeCorrelationMiddleware(userId));
  const router = (await import("../routes/beverage-creator")).default;
  app.use("/api/beverage-creator", router);
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) res.status(500).json({ error: "internal" });
  });
  return app;
}

// ── Helper: fetch the most-recent audit row for a user ────────────────────────

async function getLatestAuditRow(userId: string) {
  const rows = await db
    .select()
    .from(safetyOverrideAuditLogs)
    .where(eq(safetyOverrideAuditLogs.userId, userId))
    .orderBy(desc(safetyOverrideAuditLogs.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("Allergy override audit — correlationId end-to-end (real DB)", () => {
  beforeAll(async () => {
    testUserId = await seedTestUser();
  });

  afterAll(async () => {
    await teardownTestUser(testUserId);
  });

  // ── dessert-creator ─────────────────────────────────────────────────────────

  describe("POST /api/dessert-creator — Safety PIN override", () => {
    it("writes an audit row with a non-null correlation_id matching req.id", async () => {
      // Issue a real override token — exactly as the client does after PIN entry
      const tokenResult = await verifyPinAndIssueOverrideToken(
        testUserId,
        TEST_PIN,
        "peanut",
        "peanut butter pie",
      );
      expect(tokenResult.success).toBe(true);
      const overrideToken = tokenResult.overrideToken!;

      const app = await buildDessertApp(testUserId);

      const res = await request(app)
        .post("/api/dessert-creator")
        .send({
          userId: testUserId,
          dessertCategory: "pie",
          flavorFamily: "peanut-butter",
          specificDessert: "peanut butter pie",
          servingSize: "single",
          safetyMode: "CUSTOM_AUTHENTICATED",
          overrideToken,
        });

      // Route must succeed — override token is valid, audit insert should pass
      expect(res.status).toBe(200);

      // Query the real DB for the audit row
      const auditRow = await getLatestAuditRow(testUserId);
      expect(auditRow).not.toBeNull();
      expect(auditRow!.correlationId).toBe(TEST_CORRELATION_ID);
      expect(auditRow!.builderId).toBe("dessert-creator");
      expect(auditRow!.allergenTriggered).toBe("peanut");
    });
  });

  // ── beverage-creator ────────────────────────────────────────────────────────

  describe("POST /api/beverage-creator — Safety PIN override", () => {
    it("writes an audit row with a non-null correlation_id matching req.id", async () => {
      const tokenResult = await verifyPinAndIssueOverrideToken(
        testUserId,
        TEST_PIN,
        "peanut",
        "peanut butter smoothie",
      );
      expect(tokenResult.success).toBe(true);
      const overrideToken = tokenResult.overrideToken!;

      const app = await buildBeverageApp(testUserId);

      const res = await request(app)
        .post("/api/beverage-creator")
        .send({
          beverageCategory: "smoothie",
          flavorFamily: "berry",
          specificDrink: "peanut butter smoothie",
          servingSize: "single",
          safetyMode: "CUSTOM_AUTHENTICATED",
          overrideToken,
        });

      expect(res.status).toBe(200);

      const auditRow = await getLatestAuditRow(testUserId);
      expect(auditRow).not.toBeNull();
      expect(auditRow!.correlationId).toBe(TEST_CORRELATION_ID);
      expect(auditRow!.builderId).toBe("beverage-creator");
      expect(auditRow!.allergenTriggered).toBe("peanut");
    });
  });

  // ── Both routes: correlationId is non-null and a string ────────────────────

  describe("correlationId shape contract", () => {
    it("dessert-creator audit row has a string correlationId, not null or undefined", async () => {
      const tokenResult = await verifyPinAndIssueOverrideToken(
        testUserId,
        TEST_PIN,
        "peanut",
        "peanut cake",
      );
      expect(tokenResult.success).toBe(true);

      const app = await buildDessertApp(testUserId);
      await request(app)
        .post("/api/dessert-creator")
        .send({
          userId: testUserId,
          dessertCategory: "cake",
          flavorFamily: "peanut-butter",
          specificDessert: "peanut butter cake",
          servingSize: "single",
          safetyMode: "CUSTOM_AUTHENTICATED",
          overrideToken: tokenResult.overrideToken,
        });

      const auditRow = await getLatestAuditRow(testUserId);
      expect(auditRow).not.toBeNull();
      expect(typeof auditRow!.correlationId).toBe("string");
      expect(auditRow!.correlationId).not.toBeNull();
      expect(auditRow!.correlationId).not.toBe("");
    });

    it("beverage-creator audit row has a string correlationId, not null or undefined", async () => {
      const tokenResult = await verifyPinAndIssueOverrideToken(
        testUserId,
        TEST_PIN,
        "peanut",
        "peanut milkshake",
      );
      expect(tokenResult.success).toBe(true);

      const app = await buildBeverageApp(testUserId);
      await request(app)
        .post("/api/beverage-creator")
        .send({
          beverageCategory: "milkshake",
          flavorFamily: "chocolate",
          specificDrink: "peanut butter milkshake",
          servingSize: "single",
          safetyMode: "CUSTOM_AUTHENTICATED",
          overrideToken: tokenResult.overrideToken,
        });

      const auditRow = await getLatestAuditRow(testUserId);
      expect(auditRow).not.toBeNull();
      expect(typeof auditRow!.correlationId).toBe("string");
      expect(auditRow!.correlationId).not.toBeNull();
      expect(auditRow!.correlationId).not.toBe("");
    });
  });
});
