/**
 * procare-midday-banner.test.ts
 *
 * Verifies the ProCare mid-day banner detection in resolveDailyNutritionState():
 *
 *   Step 1 — Professional writes macro targets via POST /api/users/:id/macro-targets.
 *             The route stamps daily_nutrition_prescriptions.source = 'procare'.
 *
 *   Step 2 — Client logs their first meal via POST /api/macros/log.
 *             This does NOT call resolveDailyNutritionState; it only writes macro_logs.
 *             consumed.mealCount becomes 1 on the next nutrition-state call.
 *
 *   Step 3 — Client hits GET /api/nutrition-state.
 *             resolveDailyNutritionState() is called for the first time today.
 *
 *   Step 4 — Response must include:
 *             prescriptionChangedMidDay: true
 *             prescriptionChangeReason:  "ProCare override"
 *
 * The key insight: prescriptionResolver.source is "user_default" for a standard
 * user (no performance mode, no clinical conditions). The stored row source is
 * "procare" (→ mapped to "professional_override"). Since they differ and
 * mealCount > 0, the banner fires.
 *
 * A secondary scenario confirms that with no prior stored row (client never opened
 * the tracker and the professional never wrote targets) no banner fires — absence
 * of a stored row is the correct baseline state.
 */

// ── db mock (call-count-aware) ─────────────────────────────────────────────────
// resolveDailyNutritionState calls db.select() twice in the same Promise.all():
//   call 0 → users table (user row)
//   call 1 → daily_nutrition_prescriptions table (stored prescription row)
//
// We track the call count so each select can return independent data.

let selectCallCount = 0;
let mockUserRow: Record<string, unknown> = {};
let mockStoredPrescRow: Record<string, unknown> | null = null; // null = row not found

// executeQueue: index 0 = consumed aggregate, index 1 = planned aggregate
let executeQueue: Array<Record<string, unknown>> = [];
let executeCallCount = 0;

function zeroPlanRow(): Record<string, unknown> {
  return {
    calories: 0, protein: 0, carbs: 0, fat: 0,
    starchy_carbs: 0, starch_meal_count: 0, reservation_count: 0,
  };
}

function resetMocks(opts: {
  consumedRow: Record<string, unknown>;
  plannedRow?: Record<string, unknown>;
  storedPrescRow: Record<string, unknown> | null;
}) {
  selectCallCount  = 0;
  executeQueue     = [opts.consumedRow, opts.plannedRow ?? zeroPlanRow()];
  executeCallCount = 0;
  mockStoredPrescRow = opts.storedPrescRow;
}

jest.mock("../db", () => ({
  db: {
    select: jest.fn(() => {
      const callIndex = selectCallCount++;
      const chain: any = {
        from:  () => chain,
        where: () => chain,
        limit: () => {
          if (callIndex === 0) {
            // users table → always return a user row
            return Promise.resolve([mockUserRow]);
          }
          // daily_nutrition_prescriptions → return stored row or empty array
          return Promise.resolve(
            mockStoredPrescRow !== null ? [mockStoredPrescRow] : [],
          );
        },
      };
      return chain;
    }),
    execute: jest.fn(async () => {
      const row = executeQueue[executeCallCount] ?? zeroPlanRow();
      executeCallCount++;
      return { rows: [row] };
    }),
  },
}));

// ── schema stubs ───────────────────────────────────────────────────────────────
jest.mock("../../shared/schema", () => ({
  users: { id: "id" },
}));

jest.mock("../db/schema/dailyNutritionPrescriptions", () => ({
  dailyNutritionPrescriptions: { userId: "userId", date: "date", source: "source" },
}));

// ── drizzle-orm stub ───────────────────────────────────────────────────────────
jest.mock("drizzle-orm", () => ({
  eq:  jest.fn(() => "eq-stub"),
  and: jest.fn(() => "and-stub"),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({ sql: strings.join("?"), params: vals }),
    { raw: (s: string) => s },
  ),
}));

// ── prescription resolver mock ─────────────────────────────────────────────────
// Returns a standard "user_default" prescription. The ProCare route writes to
// the DB (daily_nutrition_prescriptions.source = 'procare') but the resolver
// only looks at user columns — it has no concept of "ProCare override" as a
// computed source. The mismatch between the DB stamp and the resolver output is
// exactly what triggers the banner.
let mockPrescriptionSource: string = "user_default";

jest.mock("../services/prescriptionResolver", () => ({
  resolveDailyNutritionPrescription: jest.fn(async () => makePrescription()),
}));

jest.mock("../services/nutritionDayService", () => ({
  getUserTimezone: jest.fn(async () => "UTC"),
}));

// ── NOW import (after all mocks) ───────────────────────────────────────────────
import { resolveDailyNutritionState } from "../services/nutritionStateService";

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

function makePrescription(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date:                       "2026-08-13",
    source:                     mockPrescriptionSource,  // e.g. "user_default"
    caloriesTarget:             2000,
    proteinTarget:              150,
    carbsTarget:                200,
    fatTarget:                  65,
    starchyCarbsTarget:         130,
    fibrousCarbsTarget:         70,
    starchMealsAllowed:         2,
    starchMealsUsed:            0,
    starchMealsRemaining:       2,
    starchyCarbsConsumed:       0,
    starchyCarbsRemaining:      130,
    gramsPerRemainingStarchMeal: 65,
    starchDistributionStrategy: "even",
    isZeroStarchDay:            false,
    trainingDayType:            null,
    clinicalPrecisionStatus:    "not_applicable",
    rationaleCodes:             ["user_default_targets"],
    ...overrides,
  };
}

function makeUserRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id:                       "client-001",
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
const USER_ID = "client-001";

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO A — Happy path: ProCare banner fires after first logged meal
//
// Timeline:
//   1. Professional writes targets → daily_nutrition_prescriptions.source='procare'
//   2. Client logs first meal via /api/macros/log (mealCount → 1)
//   3. Client hits /api/nutrition-state for the first time today
//   4. prescriptionChangedMidDay=true, prescriptionChangeReason="ProCare override"
// ─────────────────────────────────────────────────────────────────────────────

describe("ProCare mid-day banner — standard client (no tracker opened before pro write)", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow();
    mockPrescriptionSource = "user_default";
  });

  test(
    "banner fires: storedRow.source='procare' + mealCount=1 → prescriptionChangedMidDay=true",
    async () => {
      resetMocks({
        // Step 2: client logged 1 meal via /api/macros/log
        consumedRow: makeConsumedRow({
          calories: 480, protein: 38, carbs: 52, fat: 14,
          starchy_carbs: 35, fibrous_carbs: 17,
          starch_meal_count: 1, meal_count: 1,
        }),
        // Step 1: professional wrote targets — stored row has source='procare'
        storedPrescRow: { source: "procare" },
      });

      const state = await resolveDailyNutritionState(USER_ID, DATE);

      // Primary assertion: banner is triggered
      expect(state.prescriptionChangedMidDay).toBe(true);
      expect(state.prescriptionChangeReason).toBe("ProCare override");
    },
  );

  test(
    "banner fires even when client logged multiple meals before hitting nutrition-state",
    async () => {
      resetMocks({
        consumedRow: makeConsumedRow({
          calories: 1200, protein: 95, carbs: 140, fat: 36,
          starchy_carbs: 90, fibrous_carbs: 50,
          starch_meal_count: 2, meal_count: 3,
        }),
        storedPrescRow: { source: "procare" },
      });

      const state = await resolveDailyNutritionState(USER_ID, DATE);

      expect(state.prescriptionChangedMidDay).toBe(true);
      expect(state.prescriptionChangeReason).toBe("ProCare override");
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO B — No banner when no meals have been logged yet
//
// The ProCare write happened, stored row is 'procare', but mealCount=0.
// The client hasn't eaten anything logged yet — the banner must not fire
// because there is nothing for the client to re-plan.
// ─────────────────────────────────────────────────────────────────────────────

describe("ProCare mid-day banner — suppressed when no meals logged yet", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow();
    mockPrescriptionSource = "user_default";
  });

  test(
    "no banner: storedRow.source='procare' but mealCount=0 → prescriptionChangedMidDay absent",
    async () => {
      resetMocks({
        consumedRow: makeConsumedRow(), // mealCount = 0
        storedPrescRow: { source: "procare" },
      });

      const state = await resolveDailyNutritionState(USER_ID, DATE);

      // Banner must NOT fire — no meals consumed, nothing to re-plan
      expect(state.prescriptionChangedMidDay).toBeUndefined();
      expect(state.prescriptionChangeReason).toBeUndefined();
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO C — No banner when no stored row exists
//
// Client opened the tracker but the macro calculator was never run and no
// professional has written targets. No stored prescription row → no mid-day
// change can be detected.
// ─────────────────────────────────────────────────────────────────────────────

describe("ProCare mid-day banner — suppressed when no stored prescription row", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow();
    mockPrescriptionSource = "user_default";
  });

  test(
    "no banner: storedRow absent + mealCount=2 → prescriptionChangedMidDay absent",
    async () => {
      resetMocks({
        consumedRow: makeConsumedRow({
          calories: 800, protein: 60, carbs: 90, fat: 22,
          starch_meal_count: 1, meal_count: 2,
        }),
        storedPrescRow: null, // no stored row
      });

      const state = await resolveDailyNutritionState(USER_ID, DATE);

      expect(state.prescriptionChangedMidDay).toBeUndefined();
      expect(state.prescriptionChangeReason).toBeUndefined();
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO D — No banner when stored row already matches resolver source
//
// The stored row was written as 'procare' by a previous pro write, and the
// resolver also returns 'professional_override' (both sides agree). This would
// happen if the client called nutrition-state after the pro wrote targets but
// before logging any meals — then the row would stay 'procare' and the next
// call with meals should still fire (covered by Scenario A). But if the resolver
// returned 'professional_override' natively, no mismatch occurs.
//
// This test documents the no-op case using 'macro_calculator' stored source
// against a 'user_default' resolver output — they map to the same resolver
// value so no banner fires.
// ─────────────────────────────────────────────────────────────────────────────

describe("ProCare mid-day banner — suppressed when stored source matches resolver source", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow();
    mockPrescriptionSource = "user_default";
  });

  test(
    "no banner: storedRow.source='macro_calculator' → maps to user_default = resolver source",
    async () => {
      resetMocks({
        consumedRow: makeConsumedRow({
          calories: 600, protein: 48, carbs: 70, fat: 18,
          starch_meal_count: 1, meal_count: 2,
        }),
        storedPrescRow: { source: "macro_calculator" }, // → user_default
      });

      const state = await resolveDailyNutritionState(USER_ID, DATE);

      // resolver also returns user_default → no mismatch → no banner
      expect(state.prescriptionChangedMidDay).toBeUndefined();
      expect(state.prescriptionChangeReason).toBeUndefined();
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO E — Remaining macros are correct after a ProCare override
//
// Confirms that the remaining.* values use the fresh resolver prescription,
// not any stale cached value — so the tracker UI reflects the pro's targets.
// ─────────────────────────────────────────────────────────────────────────────

describe("ProCare mid-day banner — remaining macros use new prescription targets", () => {
  beforeEach(() => {
    mockUserRow = makeUserRow();
    mockPrescriptionSource = "user_default";
  });

  test(
    "remaining.protein = prescriptionTarget - consumed.protein after ProCare override",
    async () => {
      // Pro set protein target to 180g (encoded in the mock prescription via
      // the default makePrescription(), which has proteinTarget=150 unless
      // overridden). We override it here to simulate a higher pro-set target.
      const { resolveDailyNutritionPrescription } = jest.requireMock(
        "../services/prescriptionResolver",
      ) as { resolveDailyNutritionPrescription: jest.Mock };

      resolveDailyNutritionPrescription.mockResolvedValueOnce(
        makePrescription({ proteinTarget: 180, caloriesTarget: 2200 }),
      );

      resetMocks({
        consumedRow: makeConsumedRow({
          calories: 700, protein: 55, carbs: 80, fat: 20,
          starch_meal_count: 1, meal_count: 2,
        }),
        storedPrescRow: { source: "procare" },
      });

      const state = await resolveDailyNutritionState(USER_ID, DATE);

      // Banner fires
      expect(state.prescriptionChangedMidDay).toBe(true);
      expect(state.prescriptionChangeReason).toBe("ProCare override");

      // Remaining uses the new 180g protein target (not any stale value)
      // 180 - 55 = 125
      expect(state.remaining.protein).toBe(125);
      expect(state.prescription.proteinTarget).toBe(180);
      expect(state.consumed.protein).toBe(55);
    },
  );
});
