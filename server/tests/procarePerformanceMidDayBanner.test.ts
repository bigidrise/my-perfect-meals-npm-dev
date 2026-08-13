/**
 * procarePerformanceMidDayBanner.test.ts
 *
 * Verifies the mid-day prescription change banner logic in
 * resolveDailyNutritionState() for users who are both:
 *   (a) ProCare clients (stored source = "procare")
 *   (b) Performance Mode active (prescriptionResolver returns source = "performance")
 *
 * Covered scenarios
 * ─────────────────
 * 1. ProCare client + Performance Mode on + meals logged
 *    → prescriptionChangedMidDay must be UNDEFINED (banner suppressed).
 *    The overlap between stored="procare" and current="performance" is a
 *    known false-positive that must never trigger the banner.
 *
 * 2. ProCare prescription added mid-day (no Performance Mode) + meals logged
 *    → prescriptionChangedMidDay must be TRUE (banner fires).
 *    Stored = "procare" (→ "professional_override"), resolver returns
 *    "user_default" (ProCare targets displaced the user's own defaults),
 *    which is a genuine mid-day change and the banner is warranted.
 *
 * 3. Inverse overlap: stored="performance_overlay", resolver returns
 *    "professional_override" + meals logged
 *    → prescriptionChangedMidDay must be UNDEFINED (symmetric suppression).
 *
 * 4. Sanity controls: no stored row, no meals → banner never fires.
 *
 * Mock strategy
 * ─────────────
 * resolveDailyNutritionState reads the stored prescription source SEQUENTIALLY
 * before Promise.all (to avoid the upsert race), then reads the user row inside
 * Promise.all:
 *   call 0 → daily_nutrition_prescriptions (stored source)
 *   call 1 → users table (user row)
 *
 * db.execute is called twice per invocation (consumed + planned aggregates).
 * An executeQueue drives the consumed row; planned always returns zeros.
 */

// ── db.select queue ────────────────────────────────────────────────────────────
// Call 0 → stored prescription row, Call 1 → user row.
let selectCallCount = 0;
let mockUserRow:   Record<string, unknown> = {};
let mockStoredRow: Record<string, unknown> | null = null; // null → no stored row

// ── db.execute queue ───────────────────────────────────────────────────────────
let executeQueue: Array<Record<string, unknown>> = [];
let executeCallCount = 0;

function zeroPlanRow(): Record<string, unknown> {
  return {
    calories:          0,
    protein:           0,
    carbs:             0,
    fat:               0,
    starchy_carbs:     0,
    starch_meal_count: 0,
    reservation_count: 0,
  };
}

function resetQueues(
  consumedRow: Record<string, unknown>,
  storedRow: Record<string, unknown> | null = null,
) {
  selectCallCount  = 0;
  executeCallCount = 0;
  executeQueue     = [consumedRow, zeroPlanRow()];
  mockStoredRow    = storedRow;
}

jest.mock("../db", () => ({
  db: {
    select: jest.fn(() => {
      // Drizzle fluent chain returned for every .select() call.
      // The limit() terminal decides what to resolve based on call order.
      const callIndex = selectCallCount++;
      const chain: any = {
        from:  () => chain,
        where: () => chain,
        limit: () => {
          if (callIndex === 0) {
            // First call: dailyNutritionPrescriptions → stored source row
            return Promise.resolve(mockStoredRow ? [mockStoredRow] : []);
          }
          // Subsequent calls: users table → user row
          return Promise.resolve([mockUserRow]);
        },
        then:  (res: any, rej: any) => {
          const val = callIndex === 0
            ? (mockStoredRow ? [mockStoredRow] : [])
            : [mockUserRow];
          return Promise.resolve(val).then(res, rej);
        },
        catch: (rej: any) => Promise.resolve([]).catch(rej),
      };
      return chain;
    }),

    execute: jest.fn(async () => {
      const row = executeQueue[executeCallCount] ?? zeroPlanRow();
      executeCallCount++;
      return { rows: [row] };
    }),

    insert: jest.fn(() => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          catch: () => Promise.resolve(),
        }),
      }),
    })),
  },
}));

// ── Schema stubs ───────────────────────────────────────────────────────────────
jest.mock("../../shared/schema", () => ({
  users: { id: "id" },
}));

jest.mock("drizzle-orm", () => ({
  eq:  jest.fn(() => "eq-stub"),
  and: jest.fn(() => "and-stub"),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({
      sql: strings.join("?"),
      params: vals,
    }),
    { raw: (s: string) => s },
  ),
}));

// ── Prescription resolver stub — source is controlled per test ─────────────────
let mockPrescriptionSource: string = "user_default";

jest.mock("../services/prescriptionResolver", () => ({
  resolveDailyNutritionPrescription: jest.fn(async () => ({
    date:                        DATE,
    source:                      mockPrescriptionSource,
    caloriesTarget:              2000,
    proteinTarget:               150,
    carbsTarget:                 210,
    fatTarget:                   67,
    starchyCarbsTarget:          136,
    fibrousCarbsTarget:          74,
    starchMealsAllowed:          2,
    starchMealsUsed:             0,
    starchMealsRemaining:        2,
    starchyCarbsConsumed:        0,
    starchyCarbsRemaining:       136,
    gramsPerRemainingStarchMeal: 68,
    starchDistributionStrategy:  "even",
    isZeroStarchDay:             false,
    trainingDayType:             null,
    clinicalPrecisionStatus:     "not_applicable",
    rationaleCodes:              [],
  })),
}));

// ── Timezone stub ──────────────────────────────────────────────────────────────
jest.mock("../services/nutritionDayService", () => ({
  getUserTimezone: jest.fn(async () => "UTC"),
}));

// ── dailyNutritionPrescriptions schema stub ────────────────────────────────────
jest.mock("../db/schema/dailyNutritionPrescriptions", () => ({
  dailyNutritionPrescriptions: { userId: "userId", date: "date", source: "source" },
}));

// ── Module under test (imported after all mocks) ───────────────────────────────
import { resolveDailyNutritionState } from "../services/nutritionStateService";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

const DATE    = "2026-08-13";
const USER_ID = "test-procare-perf-001";

function makeUserRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id:                       USER_ID,
    macroMealsPerDay:         4,
    defaultStarchMealsPerDay: 2,
    specialtyConditions:      [],
    medicalConditions:        [],
    performanceModeEnabled:   false,
    ...overrides,
  };
}

/** A consumed row with at least one meal logged */
function makeConsumedRowWithMeal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    calories:          600,
    protein:           45,
    carbs:             80,
    fat:               18,
    starchy_carbs:     50,
    fibrous_carbs:     30,
    starch_meal_count: 1,
    meal_count:        1,      // ← key: at least one meal logged
    ...overrides,
  };
}

function makeConsumedRowNoMeals(): Record<string, unknown> {
  return {
    calories:          0,
    protein:           0,
    carbs:             0,
    fat:               0,
    starchy_carbs:     0,
    fibrous_carbs:     0,
    starch_meal_count: 0,
    meal_count:        0,      // ← no meals logged yet
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1 — ProCare client + Performance Mode ON → banner SUPPRESSED
//
// Setup:
//   stored row source = "procare"    → storedSource = "professional_override"
//   resolver returns   source = "performance"  (Performance Mode active)
//   meal_count = 1  (at least one meal logged)
//
// Expected: prescriptionChangedMidDay is UNDEFINED (no banner).
// The "professional_override" ↔ "performance" pair is the known false-positive
// and must always be suppressed.
// ─────────────────────────────────────────────────────────────────────────────

describe("ProCare client + Performance Mode ON — banner suppressed", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow({ performanceModeEnabled: true });
    mockPrescriptionSource = "performance";
    resetQueues(
      makeConsumedRowWithMeal(),
      { source: "procare" },     // stored row: user was a ProCare client at day start
    );
  });

  test("prescriptionChangedMidDay is undefined (no banner) when stored=procare and resolver returns performance", async () => {
    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.prescriptionChangedMidDay).toBeUndefined();
  });

  test("prescriptionChangeReason is also absent when banner is suppressed", async () => {
    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.prescriptionChangeReason).toBeUndefined();
  });

  test("resolved prescription and consumed macros are still correct when banner suppressed", async () => {
    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.prescription.caloriesTarget).toBe(2000);
    expect(state.consumed.mealCount).toBe(1);
    expect(state.consumed.calories).toBe(600);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2 — Genuine mid-day ProCare addition (no Performance Mode) → banner FIRES
//
// Setup:
//   stored row source = "procare"   → storedSource = "professional_override"
//   resolver returns   source = "user_default"  (Performance Mode off)
//   meal_count = 1
//
// "professional_override" ↔ "user_default" is NOT the overlap pair, so the
// mid-day change detection should fire and set prescriptionChangedMidDay=true.
// This covers the case where ProCare targets were displaced (ProCare removed
// the user mid-day, reverting them to their own Macro Calculator defaults).
// ─────────────────────────────────────────────────────────────────────────────

describe("ProCare prescription removed mid-day (no Performance Mode) — banner fires", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow({ performanceModeEnabled: false });
    mockPrescriptionSource = "user_default";
    resetQueues(
      makeConsumedRowWithMeal(),
      { source: "procare" },     // stored row: ProCare was set at day start
    );
  });

  test("prescriptionChangedMidDay is true when ProCare stored but resolver now returns user_default", async () => {
    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.prescriptionChangedMidDay).toBe(true);
  });

  test("prescriptionChangeReason is set when banner fires", async () => {
    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(typeof state.prescriptionChangeReason).toBe("string");
    expect((state.prescriptionChangeReason ?? "").length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3 — Symmetric overlap: stored=performance_overlay, resolver=professional_override
//
// The isProcarePerformanceOverlap check covers both orderings:
//   (professional_override, performance) AND (performance, professional_override)
//
// This scenario exercises the second ordering: user started day with a
// Performance prescription but ProCare connected them later. The two sources
// can coexist, so no banner should fire.
// ─────────────────────────────────────────────────────────────────────────────

describe("Symmetric overlap: stored=performance_overlay, resolver=professional_override — banner suppressed", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow({ performanceModeEnabled: false });
    mockPrescriptionSource = "professional_override";
    resetQueues(
      makeConsumedRowWithMeal(),
      { source: "performance_overlay" },
    );
  });

  test("prescriptionChangedMidDay is undefined for the reverse overlap order", async () => {
    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.prescriptionChangedMidDay).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 4 — No stored row: mid-day detection never runs
//
// When no prescription has been persisted for the day yet, the stored row is
// absent and prescriptionChangedMidDay must remain undefined regardless of
// how many meals have been logged.
// ─────────────────────────────────────────────────────────────────────────────

describe("No stored prescription row — mid-day detection skipped", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow({ performanceModeEnabled: true });
    mockPrescriptionSource = "performance";
    resetQueues(
      makeConsumedRowWithMeal({ meal_count: 3 }), // meals logged, but no stored row
      null,                                        // ← no stored row
    );
  });

  test("prescriptionChangedMidDay is undefined when no stored row exists", async () => {
    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.prescriptionChangedMidDay).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 5 — No meals logged: mid-day detection never fires even with mismatch
//
// The banner only makes sense if the user has already eaten. When meal_count=0
// the service must never set prescriptionChangedMidDay, even if stored and
// current sources differ.
// ─────────────────────────────────────────────────────────────────────────────

describe("Source mismatch but no meals logged — banner suppressed", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow({ performanceModeEnabled: false });
    mockPrescriptionSource = "user_default";
    resetQueues(
      makeConsumedRowNoMeals(),  // meal_count = 0
      { source: "procare" },
    );
  });

  test("prescriptionChangedMidDay is undefined when meal_count is 0", async () => {
    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.prescriptionChangedMidDay).toBeUndefined();
  });
});
