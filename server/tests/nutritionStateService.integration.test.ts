/**
 * nutritionStateService.integration.test.ts
 *
 * Integration test for resolveDailyNutritionState() in nutritionStateService.ts.
 *
 * Goal: confirm that when a prescription changes between two calls (e.g. mid-day
 * target drops from 210g carbs to 130g carbs) and the user has already consumed
 * 120g, the service correctly returns remaining.carbs = 10 — NOT 80 (based on
 * the old prescription) and NOT negative.
 *
 * Strategy:
 * - Mock resolveDailyNutritionPrescription to control the prescription.
 * - Mock db.execute with a queue: first call → consumed (macro_logs aggregate),
 *   second call → planned (meal_board_items aggregate, always zeros unless the
 *   test overrides plannedExecuteQueue[1]).
 * - Assert clamping is applied correctly end-to-end through the real service code.
 */

// ── db.execute queue ───────────────────────────────────────────────────────────
// Must be declared before imports so Jest hoists it above module imports.
//
// resolveDailyNutritionState calls db.execute twice per invocation:
//   1st call → macro_logs aggregate (consumed)
//   2nd call → meal_board_items aggregate (planned)
//
// executeQueue holds the rows arrays for each call in order.
// Use resetExecuteQueue() before each test to start fresh.

let executeQueue: Array<Record<string, unknown>> = [];
let executeCallCount = 0;

function resetExecuteQueue(
  consumedRow: Record<string, unknown>,
  plannedRow: Record<string, unknown> = zeroPlanRow(),
) {
  executeQueue = [consumedRow, plannedRow];
  executeCallCount = 0;
  // Reset the select-call counter so the next service invocation always routes
  // callIndex=0 to the user row, even when the same test calls the service twice.
  selectCallCount = 0;
  // Reset stored-prescription stub; override per-test to exercise source-change detection.
  mockStoredPrescriptionRows = [];
}

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

// ── db.select call counter + stored-prescription stub ─────────────────────────
// resolveDailyNutritionState calls db.select twice per invocation (inside
// Promise.all, so the calls are synchronously ordered):
//   1st call → users table                   → always returns [mockUserRow]
//   2nd call → dailyNutritionPrescriptions   → returns mockStoredPrescriptionRows
//
// Default: mockStoredPrescriptionRows = [] (no prior snapshot = no detection).
// Override per-test to exercise mid-day source-change detection.
// selectCallCount is reset in resetExecuteQueue() so tests that call the
// service more than once continue to route correctly.

let selectCallCount = 0;
// Override in tests that need a stored prescription snapshot for detection tests.
let mockStoredPrescriptionRows: Record<string, unknown>[] = [];

jest.mock("../db", () => ({
  db: {
    select: jest.fn(() => {
      // Capture call index synchronously at chain-creation time.
      const callIndex = selectCallCount++;
      const chain: any = {
        from:  () => chain,
        where: () => chain,
        limit: () =>
          Promise.resolve(callIndex === 0 ? [mockUserRow] : mockStoredPrescriptionRows),
        then:  (res: any, rej: any) =>
          Promise.resolve(callIndex === 0 ? [mockUserRow] : mockStoredPrescriptionRows).then(res, rej),
        catch: (rej: any) => Promise.resolve([]).catch(rej),
      };
      return chain;
    }),
    execute: jest.fn(async () => {
      // Return rows for the current call position, then advance.
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

// ── User row returned by db.select ─────────────────────────────────────────────
let mockUserRow: Record<string, unknown> = {};

// ── Schema / ORM stubs ─────────────────────────────────────────────────────────
jest.mock("../../shared/schema", () => ({
  users: { id: "id" },
}));

jest.mock("drizzle-orm", () => ({
  eq:  jest.fn(() => "eq-stub"),
  and: jest.fn((...args: unknown[]) => ({ and: args })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({
      sql: strings.join("?"),
      params: vals,
    }),
    { raw: (s: string) => s },
  ),
}));

// ── Control the prescription returned by the inner resolver ───────────────────
let mockPrescription: Record<string, unknown> = {};

jest.mock("../services/prescriptionResolver", () => ({
  resolveDailyNutritionPrescription: jest.fn(async () => mockPrescription),
}));

// ── Timezone stub ─────────────────────────────────────────────────────────────
jest.mock("../services/nutritionDayService", () => ({
  getUserTimezone: jest.fn(async () => "UTC"),
}));

// ── dailyNutritionPrescriptions schema stub (fire-and-forget upsert + select) ──
jest.mock("../db/schema/dailyNutritionPrescriptions", () => ({
  dailyNutritionPrescriptions: { userId: "userId", date: "date", source: "source" },
}));

// ── NOW import the module under test (after all mocks are registered) ─────────
import { resolveDailyNutritionState } from "../services/nutritionStateService";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makePrescription(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date:                        "2026-08-13",
    source:                      "user_default",
    caloriesTarget:              2000,
    proteinTarget:               150,
    carbsTarget:                 210,
    fatTarget:                   67,
    starchyCarbsTarget:          130,
    fibrousCarbsTarget:          80,
    starchMealsAllowed:          2,
    starchMealsUsed:             0,
    starchMealsRemaining:        2,
    starchyCarbsConsumed:        0,
    starchyCarbsRemaining:       130,
    gramsPerRemainingStarchMeal: 65,
    starchDistributionStrategy:  "even",
    isZeroStarchDay:             false,
    trainingDayType:             null,
    clinicalPrecisionStatus:     "not_applicable",
    rationaleCodes:              ["user_default_targets"],
    ...overrides,
  };
}

function makeUserRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id:                       "test-user-001",
    macroMealsPerDay:         4,
    defaultStarchMealsPerDay: 2,
    specialtyConditions:      [],
    medicalConditions:        [],
    performanceModeEnabled:   false,
    ...overrides,
  };
}

function makeConsumedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    calories:          0,
    protein:           0,
    carbs:             0,
    fat:               0,
    starchy_carbs:     0,
    fibrous_carbs:     0,
    starch_meal_count: 0,
    meal_count:        0,
    ...overrides,
  };
}

const DATE    = "2026-08-13";
const USER_ID = "test-user-001";

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1 — Core clamp: prescription changed mid-day, consumed < new target
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveDailyNutritionState — prescription change clamp", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow();
  });

  test("remaining.carbs = 10 when carbsTarget=130 and consumed=120 (not 80 from old 210g target)", async () => {
    // Old prescription had carbsTarget=210; it has since dropped to 130.
    // The service must use the fresh value from resolveDailyNutritionPrescription (130).
    mockPrescription = makePrescription({ carbsTarget: 130 });
    resetExecuteQueue(
      makeConsumedRow({ calories: 500, protein: 40, carbs: 120, fat: 15,
                        starchy_carbs: 80, fibrous_carbs: 40,
                        starch_meal_count: 1, meal_count: 1 }),
      // No uncommitted board reservations
      zeroPlanRow(),
    );

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    // Core assertion: 130 − 120 = 10, not 90 (old 210g target) or negative
    expect(state.remaining.carbs).toBe(10);
    expect(state.remaining.carbs).not.toBe(90);
    expect(state.remaining.carbs).toBeGreaterThanOrEqual(0);

    // Sanity-check that consumed and prescription fields are wired correctly
    expect(state.consumed.carbs).toBe(120);
    expect(state.prescription.carbsTarget).toBe(130);
  });

  test("remaining.carbs is clamped to 0 when consumed exceeds new (lower) prescription", async () => {
    // Prescription dropped to 100g but user consumed 120g before the change.
    mockPrescription = makePrescription({ carbsTarget: 100 });
    resetExecuteQueue(makeConsumedRow({ carbs: 120 }));

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    // 100 − 120 = −20 → clamped to 0
    expect(state.remaining.carbs).toBe(0);
    expect(state.remaining.carbs).toBeGreaterThanOrEqual(0);
  });

  test("remaining.carbs = full prescription when nothing consumed", async () => {
    mockPrescription = makePrescription({ carbsTarget: 130 });
    resetExecuteQueue(makeConsumedRow()); // all zeros

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.remaining.carbs).toBe(130);
    expect(state.consumed.carbs).toBe(0);
  });

  test("all remaining macros are 0 when consumed exactly equals targets", async () => {
    mockPrescription = makePrescription({
      caloriesTarget: 2000,
      proteinTarget:  150,
      carbsTarget:    130,
      fatTarget:      67,
    });
    resetExecuteQueue(
      makeConsumedRow({ calories: 2000, protein: 150, carbs: 130, fat: 67,
                        starchy_carbs: 80, fibrous_carbs: 50,
                        starch_meal_count: 2, meal_count: 4 }),
    );

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.remaining.calories).toBe(0);
    expect(state.remaining.protein).toBe(0);
    expect(state.remaining.carbs).toBe(0);
    expect(state.remaining.fat).toBe(0);
  });

  test("no remaining value goes negative even when consumed far exceeds every target", async () => {
    mockPrescription = makePrescription({
      caloriesTarget:     1500,
      proteinTarget:      100,
      carbsTarget:        130,
      fatTarget:          50,
      starchyCarbsTarget: 80,
      fibrousCarbsTarget: 50,
      starchMealsAllowed: 2,
    });
    resetExecuteQueue(
      makeConsumedRow({ calories: 2500, protein: 200, carbs: 300, fat: 100,
                        starchy_carbs: 200, fibrous_carbs: 100,
                        starch_meal_count: 5, meal_count: 6 }),
    );

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.remaining.calories).toBeGreaterThanOrEqual(0);
    expect(state.remaining.protein).toBeGreaterThanOrEqual(0);
    expect(state.remaining.carbs).toBeGreaterThanOrEqual(0);
    expect(state.remaining.fat).toBeGreaterThanOrEqual(0);
    expect(state.remaining.starchyCarbs).toBeGreaterThanOrEqual(0);
    expect(state.remaining.fibrousCarbs).toBeGreaterThanOrEqual(0);
    expect(state.remaining.starchMealsRemaining).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2 — Prescription re-derived fresh on every call (same consumption)
// Proves the service picks up a changed target without any caching layer
// between the first and second call.
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveDailyNutritionState — prescription re-derived on every call", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow();
  });

  test("sequential calls: old target=210 gives remaining=90, then new target=130 gives remaining=10", async () => {
    // Same consumption across both calls: 120g carbs already logged.
    const consumed = makeConsumedRow({ carbs: 120, starchy_carbs: 80, fibrous_carbs: 40 });

    // ── First call: old prescription ────────────────────────────────────────
    mockPrescription = makePrescription({ carbsTarget: 210 });
    resetExecuteQueue(consumed);

    const firstState = await resolveDailyNutritionState(USER_ID, DATE);
    expect(firstState.remaining.carbs).toBe(90); // 210 − 120 = 90

    // ── Prescription changes mid-day ────────────────────────────────────────
    mockPrescription = makePrescription({ carbsTarget: 130 });
    resetExecuteQueue(consumed);

    const secondState = await resolveDailyNutritionState(USER_ID, DATE);

    // Must pick up the NEW target, not the stale 210g value
    expect(secondState.remaining.carbs).toBe(10); // 130 − 120 = 10
    expect(secondState.remaining.carbs).not.toBe(90);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3 — Board reservations (planned) are subtracted before clamping
// Confirms the planned path does not double-count consumed macros.
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveDailyNutritionState — planned board reservations", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow();
  });

  test("remaining.carbs accounts for both consumed and uncommitted board reservations", async () => {
    // carbsTarget=200; consumed=80g; planned (board)=60g → remaining = 200−80−60 = 60
    mockPrescription = makePrescription({ carbsTarget: 200 });
    resetExecuteQueue(
      makeConsumedRow({ carbs: 80 }),
      { calories: 400, protein: 30, carbs: 60, fat: 12,
        starchy_carbs: 40, starch_meal_count: 1, reservation_count: 1 },
    );

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.consumed.carbs).toBe(80);
    expect(state.planned.carbs).toBe(60);
    expect(state.remaining.carbs).toBe(60); // 200 − 80 − 60
  });

  test("zero planned rows → remaining equals prescription minus consumed only", async () => {
    mockPrescription = makePrescription({ carbsTarget: 130 });
    resetExecuteQueue(
      makeConsumedRow({ carbs: 50 }),
      zeroPlanRow(), // explicit zero plan
    );

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.planned.carbs).toBe(0);
    expect(state.remaining.carbs).toBe(80); // 130 − 50
  });

  test("remaining is still clamped to 0 when consumed + planned exceeds prescription", async () => {
    // carbsTarget=100; consumed=70; planned=50 → 100−70−50 = −20 → 0
    mockPrescription = makePrescription({ carbsTarget: 100 });
    resetExecuteQueue(
      makeConsumedRow({ carbs: 70 }),
      { calories: 200, protein: 15, carbs: 50, fat: 8,
        starchy_carbs: 30, starch_meal_count: 1, reservation_count: 1 },
    );

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.remaining.carbs).toBe(0);
    expect(state.remaining.carbs).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 4 — activeConstraints reflect post-clamp state correctly
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveDailyNutritionState — activeConstraints update with new prescription", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow();
  });

  test("calorieBudgetExhausted is true when prescription drop brings remaining to 0", async () => {
    mockPrescription = makePrescription({ caloriesTarget: 800 });
    resetExecuteQueue(makeConsumedRow({ calories: 800 }));

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.remaining.calories).toBe(0);
    expect(state.activeConstraints.calorieBudgetExhausted).toBe(true);
  });

  test("calorieBudgetExhausted is false when calories remain after prescription change", async () => {
    mockPrescription = makePrescription({ caloriesTarget: 2000 });
    resetExecuteQueue(makeConsumedRow({ calories: 500 }));

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.remaining.calories).toBe(1500);
    expect(state.activeConstraints.calorieBudgetExhausted).toBe(false);
  });

  test("starchSlotsExhausted is true when all starch slots are consumed", async () => {
    mockPrescription = makePrescription({
      starchMealsAllowed:  2,
      starchyCarbsTarget: 80,
    });
    resetExecuteQueue(makeConsumedRow({ starch_meal_count: 2, starchy_carbs: 80 }));

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.remaining.starchMealsRemaining).toBe(0);
    expect(state.activeConstraints.starchSlotsExhausted).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 5 — starchyCarbs and starchMealsRemaining clamp correctly after a
// mid-day prescription change
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveDailyNutritionState — starchyCarbs and starchMealsRemaining mid-day clamp", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow();
  });

  test("remaining.starchyCarbs is clamped to 0 when consumed exceeds new (lower) prescription", async () => {
    // Prescription changed mid-day: starchyCarbsTarget dropped to 80g.
    // User already consumed 90g before the change → 80 − 90 = −10 → clamped to 0.
    mockPrescription = makePrescription({ starchyCarbsTarget: 80 });
    resetExecuteQueue(makeConsumedRow({ starchy_carbs: 90 }));

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.remaining.starchyCarbs).toBe(0);
    expect(state.remaining.starchyCarbs).toBeGreaterThanOrEqual(0);
    expect(state.consumed.starchyCarbs).toBe(90);
    expect(state.prescription.starchyCarbsTarget).toBe(80);
  });

  test("starchMealsRemaining is clamped to 0 when logged meals exceed new (lower) allowance", async () => {
    // Prescription changed mid-day: starchMealsAllowed dropped to 1.
    // User already logged 2 starch meals before the change → 1 − 2 = −1 → clamped to 0.
    mockPrescription = makePrescription({ starchMealsAllowed: 1 });
    resetExecuteQueue(makeConsumedRow({ starch_meal_count: 2 }));

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.remaining.starchMealsRemaining).toBe(0);
    expect(state.remaining.starchMealsRemaining).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 6 — prescriptionChangedMidDay source-change detection
// Verifies the detection uses the correct persisted source vocabulary so that
// unchanged-source users (including clinical/GLP-1) never see a false-positive
// banner, while real source transitions are correctly flagged.
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveDailyNutritionState — prescriptionChangedMidDay source-change detection", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow();
    // mockStoredPrescriptionRows defaults to [] (no stored snapshot) via
    // resetExecuteQueue(); individual tests override it where needed.
  });

  test("GLP-1 user does not see false-positive banner when clinical prescription is unchanged", async () => {
    // prescriptionResolver now persists source="clinical" for GLP-1.
    // storedSourceToResolverSource maps "clinical" → "clinical".
    // So stored="clinical" vs current="clinical" → no change → banner MUST NOT fire.
    mockPrescription = makePrescription({ source: "clinical" });
    // resetExecuteQueue must come first — it resets mockStoredPrescriptionRows to [].
    resetExecuteQueue(makeConsumedRow({ meal_count: 2, calories: 600 }));
    mockStoredPrescriptionRows = [{ source: "clinical" }];

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.prescriptionChangedMidDay).toBeUndefined();
  });

  test("prescriptionChangedMidDay fires when performance overlay activates mid-day", async () => {
    // User had a standard (macro_calculator) prescription this morning and
    // activates Performance Mode after logging a meal.
    mockPrescription = makePrescription({ source: "performance" });
    mockStoredPrescriptionRows = [{ source: "performance_overlay" }];
    // Reset after setting the stored rows so selectCallCount is 0 but
    // mockStoredPrescriptionRows is NOT cleared (resetExecuteQueue clears it, so
    // we set it after the reset).
    resetExecuteQueue(makeConsumedRow({ meal_count: 1 }));
    mockStoredPrescriptionRows = [{ source: "macro_calculator" }];

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.prescriptionChangedMidDay).toBe(true);
    expect(state.prescriptionChangeReason).toBe("Performance Mode");
  });

  test("prescriptionChangedMidDay is absent when no stored snapshot exists yet", async () => {
    // First resolution of the day — nothing in dailyNutritionPrescriptions yet.
    mockPrescription = makePrescription({ source: "user_default" });
    resetExecuteQueue(makeConsumedRow({ meal_count: 1 }));
    // mockStoredPrescriptionRows already reset to [] by resetExecuteQueue

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.prescriptionChangedMidDay).toBeUndefined();
  });

  test("prescriptionChangedMidDay is absent when no meals logged even if source changed", async () => {
    // Source changed but user hasn't logged anything yet — nothing to flag.
    mockPrescription = makePrescription({ source: "clinical" });
    resetExecuteQueue(makeConsumedRow({ meal_count: 0 }));
    mockStoredPrescriptionRows = [{ source: "macro_calculator" }];

    const state = await resolveDailyNutritionState(USER_ID, DATE);

    expect(state.prescriptionChangedMidDay).toBeUndefined();
  });
});

