/**
 * Unit tests for resolveDailyNutritionPrescription()
 *
 * Covers the two bugs fixed in this changeset:
 *   1. glp1_profile guardrail lookup uses the string userId, not parseInt(userId).
 *      For UUID user IDs parseInt returns NaN; a NaN-parameterised query fails and
 *      the catch silently falls back to default guardrails, meaning provider-
 *      configured clamps are never applied.  We assert the SQL execute call
 *      receives the raw string ID and that custom guardrails take effect.
 *
 *   2. After Performance modifiers run, the post-Performance GLP-1 re-enforcement
 *      block clamps protein/fat but previously left carbs unrebalanced.  The
 *      returned prescription could therefore have P*4 + C*4 + F*9 ≠ caloriesTarget.
 *      We assert the returned macros are calorically consistent after the clamp.
 */

// ── DB mock ───────────────────────────────────────────────────────────────────
// Must be declared before any import so Jest hoists it above the module imports.

// Drizzle's fluent query builder: .select().from().where().limit()
// Each link in the chain must be a thenable so it can be awaited at any depth.
function makeChain(resolveWith: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    from:  () => chain,
    where: () => chain,
    limit: () => Promise.resolve(resolveWith),
    // Make the chain itself awaitable (for calls without .limit())
    then:  (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(resolveWith).then(res, rej),
    catch: (rej: (e: unknown) => unknown) =>
      Promise.resolve(resolveWith).catch(rej),
  };
  return chain;
}

// Capture the SQL text that db.execute() is called with so we can assert on it.
let lastExecutedSql = "";

// Three sequential select() calls in the resolver:
//   1st → user row
//   2nd → lab count        (inside Promise.all)
//   3rd → companion profile (inside Promise.all)
//   4th → weight-only user row (second select in the resolver — only weight)
// We configure them via selectQueue and swap values per test with mockSelectQueue().
let selectQueue: unknown[] = [];

function mockSelectQueue(values: unknown[]) {
  selectQueue = [...values];
}

jest.mock("../db", () => ({
  db: {
    select: jest.fn(() => {
      const val = selectQueue.shift() ?? [];
      return makeChain(val);
    }),
    execute: jest.fn(async (sqlExpr: { queryChunks?: unknown[]; sql?: string }) => {
      // Capture the raw SQL string so tests can assert the userId was NOT parsed.
      // drizzle's sql template tag stores its chunks; we serialize to inspect.
      try {
        lastExecutedSql = JSON.stringify(sqlExpr);
      } catch {
        lastExecutedSql = String(sqlExpr);
      }
      // Return the configured GLP-1 guardrails row (overrideable per test).
      return { rows: [glp1GuardrailsRow] };
    }),
  },
}));

// Mutable so individual tests can override it.
let glp1GuardrailsRow: { guardrails?: unknown } = {};

// ── Shared-schema / clinical-schema imports that the resolver references ──────
// We only need to prevent the actual DB connection from opening.
jest.mock("../../shared/schema", () => ({
  users: { id: "id" },
}));
jest.mock("../db/schema/clinicalLabs", () => ({
  clinicalLabs: { userId: "userId" },
}));
jest.mock("../db/schema/companionProfiles", () => ({
  companionProfiles: { userId: "userId" },
}));

// drizzle operators used inside the resolver — no-op stubs are fine.
jest.mock("drizzle-orm", () => ({
  eq:    jest.fn((_col: unknown, _val: unknown) => "eq-stub"),
  count: jest.fn(() => "count-stub"),
  sql:   Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({
      sql: strings.join("?"),
      params: vals,
      // expose params so tests can inspect the userId argument
      _params: vals,
    }),
    { raw: (s: string) => s },
  ),
}));

// ── planFeatures — getTierForLookupKey must return a non-Clinical tier ────────
jest.mock("../../shared/planFeatures", () => ({
  getTierForLookupKey: jest.fn(() => "pro"),
  PLAN_FEATURES: {},
}));

// ── Performance protocol resolver — only used in Test 3 ──────────────────────
// Default: not called (performanceModeEnabled is false in most tests).
// Override resolveTodayTargets per-test if needed.
let perfResolveResult: unknown = null;
jest.mock("../services/protocol/performanceProtocolResolver", () => ({
  resolveTodayTargets:              jest.fn((_s: unknown, _c: unknown, baseline: unknown) => perfResolveResult ?? baseline),
  sessionTypeToTrainingDayType:     jest.fn(() => "strength"),
  buildDefaultModifiers:            jest.fn(() => ({})),
}));

// ── GLP-1 schema default guardrails ──────────────────────────────────────────
jest.mock("../../shared/glp1-schema", () => ({
  DEFAULT_GLP1_GUARDRAILS: {
    mealsPerDay: 4,
    proteinMinG: 25,
    fatMaxG: 15,
    maxMealVolumeMl: 300,
  },
}));

// ── dailyNutritionPrescription shared module ──────────────────────────────────
jest.mock("../../shared/dailyNutritionPrescription", () => ({
  buildFallbackPrescription: jest.fn((dateISO: string) => ({
    date: dateISO,
    source: "fallback",
    caloriesTarget: 0,
    proteinTarget: 0,
    carbsTarget: 0,
    fatTarget: 0,
    starchyCarbsTarget: 0,
    fibrousCarbsTarget: 0,
    starchMealsAllowed: 2,
    starchMealsUsed: 0,
    starchMealsRemaining: 2,
    starchyCarbsConsumed: 0,
    starchyCarbsRemaining: 0,
    gramsPerRemainingStarchMeal: 0,
    starchDistributionStrategy: "even",
    isZeroStarchDay: false,
    trainingDayType: null,
    clinicalPrecisionStatus: "not_applicable",
    rationaleCodes: ["fallback_no_targets"],
  })),
  computeGramsPerRemainingMeal: jest.fn(
    (remaining: number, meals: number) => (meals > 0 ? Math.round(remaining / meals) : 0),
  ),
  deriveStarchMealsAllowed: jest.fn((_type: unknown, _: unknown, isZero: boolean) => (isZero ? 0 : 2)),
  sessionTypeToTrainingDayType: jest.fn(() => "strength"),
  deriveClinicalStatus: jest.fn(() => "not_applicable"),
  PrescriptionSource:           {},
  TrainingDayType:              {},
  ClinicalPrecisionStatus:      {},
  StarchDistributionStrategy:   {},
}));

// ── NOW import the module under test (after mocks are registered) ─────────────
import { resolveDailyNutritionPrescription } from "../services/prescriptionResolver";

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

const UUID_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const DATE_ISO     = "2026-08-12";

/** A GLP-1 user with baseline macros. */
function makeGlp1User(overrides: Record<string, unknown> = {}) {
  return {
    id:                       UUID_USER_ID,
    dailyCalorieTarget:       2000,
    dailyProteinTarget:       120,
    dailyCarbsTarget:         220,
    dailyFatTarget:           70,
    dailyStarchyCarbsTarget:  143,  // 65% of 220
    dailyFibrousCarbsTarget:  77,   // 35% of 220
    specialtyConditions:      ["glp1"],
    medicalConditions:        [],
    weeklyTrainingSchedule:   null,
    performanceProtocolConfig: null,
    performanceModeEnabled:   false,
    clinicalContextCategories: [],
    clinicalContextResponse:  null,
    planLookupKey:            "pro_monthly",
    defaultStarchMealsPerDay: 2,
    starchPlanDefined:        true,
    starchDistributionStrategy: "even",
    weight:                   175,
    ...overrides,
  };
}

/** Convenience: reset select queue and guardrails row before each test. */
function setupGlp1Test(guardrails: unknown = {}) {
  glp1GuardrailsRow = guardrails ? { guardrails } : {};
  mockSelectQueue([
    [makeGlp1User()],      // 1st select → user
    [{ count: 0 }],        // 2nd select → lab count (Promise.all)
    [],                    // 3rd select → companion profiles (Promise.all)
    [{ weight: 175 }],     // 4th select → weight-only user row
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveDailyNutritionPrescription", () => {

  // ── Test 1: UUID userId reaches glp1_profile as a string ─────────────────

  describe("Bug fix: UUID userId passed to glp1_profile query as string, not parseInt", () => {
    beforeEach(() => {
      // Custom guardrails — if parseInt(userId) were used, the query would fail
      // (NaN parameter) and the catch block would substitute DEFAULT_GLP1_GUARDRAILS.
      // We set a recognisably non-default proteinMinG so we can detect which
      // guardrails are actually applied.
      setupGlp1Test({
        mealsPerDay: 3,
        proteinMinG: 50,   // much higher than default 25
        fatMaxG: 10,
        maxMealVolumeMl: 300,
      });
    });

    it("calls db.execute and the SQL parameter list contains the raw UUID string", async () => {
      await resolveDailyNutritionPrescription({ userId: UUID_USER_ID, dateISO: DATE_ISO });

      // The execute mock captures its argument; verify the UUID appears as a value,
      // not as NaN (what parseInt would produce for a UUID).
      expect(lastExecutedSql).toContain(UUID_USER_ID);
      expect(lastExecutedSql).not.toContain("NaN");
    });

    it("applies custom guardrails (50g protein floor) not the default 25g floor", async () => {
      const prescription = await resolveDailyNutritionPrescription({
        userId: UUID_USER_ID,
        dateISO: DATE_ISO,
      });

      // Custom guardrails: proteinMinG = 50, mealsPerDay = 3 → daily floor = 150g.
      // Baseline proteinTarget = 120g < 150g, so the resolver must bump it to 150g.
      // If parseInt were still used, the query would fail silently and the default
      // floor (25g/meal × 4 meals = 100g) would be applied instead, leaving
      // proteinTarget at the baseline 120g.
      expect(prescription.proteinTarget).toBeGreaterThanOrEqual(150);
    });

    it("source is 'clinical' for a GLP-1 user", async () => {
      const prescription = await resolveDailyNutritionPrescription({
        userId: UUID_USER_ID,
        dateISO: DATE_ISO,
      });
      expect(prescription.source).toBe("clinical");
    });
  });

  // ── Test 2: GLP-1 alone — P+C+F calories are consistent ─────────────────

  describe("GLP-1 only — macro caloric balance", () => {
    beforeEach(() => {
      // Maintenance-phase guardrails (fatMaxG > 10, proteinMinG < 40)
      setupGlp1Test({
        mealsPerDay: 4,
        proteinMinG: 30,
        fatMaxG: 12,
        maxMealVolumeMl: 300,
      });
    });

    it("P*4 + C*4 + F*9 equals caloriesTarget (within 10 kcal rounding tolerance)", async () => {
      const p = await resolveDailyNutritionPrescription({
        userId: UUID_USER_ID,
        dateISO: DATE_ISO,
      });

      const macroKcal = p.proteinTarget * 4 + p.carbsTarget * 4 + p.fatTarget * 9;
      expect(Math.abs(macroKcal - p.caloriesTarget)).toBeLessThanOrEqual(10);
    });

    it("starchyCarbsTarget + fibrousCarbsTarget equals carbsTarget", async () => {
      const p = await resolveDailyNutritionPrescription({
        userId: UUID_USER_ID,
        dateISO: DATE_ISO,
      });
      expect(p.starchyCarbsTarget + p.fibrousCarbsTarget).toBe(p.carbsTarget);
    });
  });

  // ── Test 3: GLP-1 + Performance — post-Performance clamp rebalances carbs ─

  describe("GLP-1 + Performance combined — carb rebalance after post-Performance clamp", () => {
    beforeEach(() => {
      // Strict fat ceiling (fatMaxG = 8 per meal × 4 meals = 32g daily ceiling).
      // Performance will attempt to raise fat above the ceiling; the re-enforcement
      // block must clamp it and rebalance carbs.
      setupGlp1Test({
        mealsPerDay: 4,
        proteinMinG: 35,   // daily floor = 140g
        fatMaxG: 8,        // daily ceiling = 32g
        maxMealVolumeMl: 300,
      });

      // Replace select queue with a Performance-enabled user
      const perfUser = makeGlp1User({
        performanceModeEnabled: true,
        weeklyTrainingSchedule: {
          monday: "strength",
          tuesday: "off",
          wednesday: "strength",
          thursday: "off",
          friday: "strength",
          saturday: "off",
          sunday: "off",
        },
        performanceProtocolConfig: {
          sessionModifiers: {},
          generatedAt: "2026-01-01T00:00:00Z",
        },
      });
      mockSelectQueue([
        [perfUser],
        [{ count: 0 }],
        [],
        [{ weight: 175 }],
      ]);

      // Simulate Performance raising fat above the GLP-1 ceiling.
      // Baseline after GLP-1: calories ~1640 (2000 * 1.0 maintenance), protein clamped
      // to 140g, fat clamped to 32g, carbs rebalanced.
      // Performance adds fat: return fat = 80g (well above the 32g ceiling).
      perfResolveResult = {
        calories:      2100,
        proteinG:      130,  // below the 140g floor → clamp will raise it
        carbsG:        250,
        fatG:          80,   // above the 32g ceiling → clamp will lower it
        starchyCarbsG: 160,
        fibrousCarbsG: 90,
        sessionType:   "strength",
      };
    });

    afterEach(() => {
      perfResolveResult = null;
    });

    it("fat does not exceed GLP-1 daily ceiling after Performance", async () => {
      const p = await resolveDailyNutritionPrescription({
        userId: UUID_USER_ID,
        dateISO: DATE_ISO,
      });
      // 8g/meal × 4 meals = 32g ceiling
      expect(p.fatTarget).toBeLessThanOrEqual(32);
    });

    it("protein is at least the GLP-1 daily floor after Performance", async () => {
      const p = await resolveDailyNutritionPrescription({
        userId: UUID_USER_ID,
        dateISO: DATE_ISO,
      });
      // 35g/meal × 4 meals = 140g floor
      expect(p.proteinTarget).toBeGreaterThanOrEqual(140);
    });

    it("P*4 + C*4 + F*9 equals caloriesTarget after both clamps (within 10 kcal)", async () => {
      const p = await resolveDailyNutritionPrescription({
        userId: UUID_USER_ID,
        dateISO: DATE_ISO,
      });
      const macroKcal = p.proteinTarget * 4 + p.carbsTarget * 4 + p.fatTarget * 9;
      expect(Math.abs(macroKcal - p.caloriesTarget)).toBeLessThanOrEqual(10);
    });

    it("starchyCarbsTarget + fibrousCarbsTarget equals carbsTarget after clamp rebalance", async () => {
      const p = await resolveDailyNutritionPrescription({
        userId: UUID_USER_ID,
        dateISO: DATE_ISO,
      });
      expect(p.starchyCarbsTarget + p.fibrousCarbsTarget).toBe(p.carbsTarget);
    });
  });

});
