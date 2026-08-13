/**
 * nutritionStateIdentityGuard.test.ts
 *
 * Guards the PHI isolation requirement in useDailyNutritionState:
 * no render must ever commit a prior account's or prior client's nutrition
 * data to the DOM, even for the single render between a key change and the
 * corresponding useEffect fetch resolving.
 *
 * Implementation under test
 * ─────────────────────────
 * The hook stores fetched data as a paired `{ data, key }` state unit, then
 * synchronously derives the exposed `state` at every render:
 *
 *   const state =
 *     fetched.key === currentKey
 *       ? fetched.data
 *       : getCachedNutritionState(currentKey) ?? null;
 *
 * This means:
 *   • fetchedKey === currentKey  → return fetched data (normal case)
 *   • fetchedKey !== currentKey  → return cache for NEW key or null (isolation guard)
 *
 * These tests verify that derivation logic directly (no React runtime needed),
 * plus structural checks that the hook source implements it correctly.
 *
 * For rendered-component behaviour the existing shimmerCacheGuard.test.ts suite
 * already exercises the hook source wiring. Tests 3–9 below focus on transitions.
 */

import fs from "fs";
import path from "path";
import {
  _nutritionStateCache,
  _nutritionStateCacheKey,
  getCachedNutritionState,
  setCachedNutritionState,
  _nutritionStateCacheWriteDate,
} from "../../hooks/nutritionStateCache";
import type { DailyNutritionState } from "../../../../shared/dailyNutritionPrescription";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeState(calories: number): DailyNutritionState {
  return {
    date: "2026-08-13",
    resolvedAt: "2026-08-13T00:00:00.000Z",
    prescription: {
      caloriesTarget: calories,
      proteinTarget: 150,
      carbsTarget: 200,
      fatTarget: 67,
      starchyCarbsTarget: 100,
      fibrousCarbsTarget: 100,
      starchMealsAllowed: 2,
      starchMealsUsed: 0,
      starchMealsRemaining: 2,
      starchyCarbsConsumed: 0,
      starchyCarbsRemaining: 100,
      gramsPerRemainingStarchMeal: 50,
      source: "user_default",
      date: "2026-08-13",
    },
    consumed: { calories: 0, protein: 0, carbs: 0, fat: 0, starchyCarbs: 0, fibrousCarbs: 0, starchMealsLogged: 0, mealCount: 0 },
    planned: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    remaining: { calories, protein: 150, carbs: 200, fat: 67, starchyCarbs: 100, fibrousCarbs: 100, starchMealsRemaining: 2 },
    mealPlan: { mealsPerDay: 4, starchMealsPerDay: 2, starchDistributionStrategy: "balanced" },
    activeConstraints: [],
    generationContext: "standard",
    isPerformanceDay: false,
    performanceDayType: null,
  } as unknown as DailyNutritionState;
}

/** Simulate today's date as the write date so getCachedNutritionState hits. */
function writeToday(key: string, state: DailyNutritionState): void {
  _nutritionStateCache.set(key, state);
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  _nutritionStateCacheWriteDate.set(key, today);
}

/** The synchronous derivation logic extracted from useDailyNutritionState. */
function deriveState(
  fetchedKey: string,
  fetchedData: DailyNutritionState | null,
  currentKey: string,
): DailyNutritionState | null {
  return fetchedKey === currentKey
    ? fetchedData
    : (currentKey ? getCachedNutritionState(currentKey) ?? null : null);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _nutritionStateCache.clear();
  _nutritionStateCacheWriteDate.clear();
});

describe("identity-keyed derivation — fetchedKey matches currentKey", () => {
  it("returns fetched data when keys match (normal steady-state)", () => {
    const key = _nutritionStateCacheKey("user-A", "2026-08-13", null);
    const data = makeState(2000);
    expect(deriveState(key, data, key)).toBe(data);
  });

  it("returns null when keys match but fetched data is null (error state)", () => {
    const key = _nutritionStateCacheKey("user-A", "2026-08-13", null);
    expect(deriveState(key, null, key)).toBeNull();
  });
});

describe("PHI isolation guard — account switch (userId changes)", () => {
  it("returns null on the first render after account switch (no cache for new user)", () => {
    const stateUserA = makeState(2000);
    const keyA = _nutritionStateCacheKey("user-A", "2026-08-13", null);
    const keyB = _nutritionStateCacheKey("user-B", "2026-08-13", null);

    // Simulate: hook last fetched for user-A
    // Current render is for user-B (no cache entry for B)
    expect(deriveState(keyA, stateUserA, keyB)).toBeNull();
  });

  it("returns user-B cached data (not user-A data) on first render after switch when B has a cache hit", () => {
    const stateUserA = makeState(2000);
    const stateUserB = makeState(1800);
    const keyA = _nutritionStateCacheKey("user-A", "2026-08-13", null);
    const keyB = _nutritionStateCacheKey("user-B", "2026-08-13", null);

    // User B already has a cache entry from a previous visit
    writeToday(keyB, stateUserB);

    const derived = deriveState(keyA, stateUserA, keyB);
    expect(derived).toBe(stateUserB);
    expect(derived).not.toBe(stateUserA);
  });

  it("never exposes user-A calories when rendering for user-B", () => {
    const stateUserA = makeState(2000);
    const keyA = _nutritionStateCacheKey("user-A", "2026-08-13", null);
    const keyB = _nutritionStateCacheKey("user-B", "2026-08-13", null);

    const derived = deriveState(keyA, stateUserA, keyB);
    // Whatever is returned, it must not carry user-A's 2000-calorie prescription
    expect(derived?.prescription?.caloriesTarget).not.toBe(2000);
  });
});

describe("PHI isolation guard — physician client switch (clientId changes)", () => {
  it("returns null on first render after delegated client switches (no cache for new client)", () => {
    const stateClient1 = makeState(2200);
    const keyPhysClient1 = _nutritionStateCacheKey("physician-1", "2026-08-13", "client-1");
    const keyPhysClient2 = _nutritionStateCacheKey("physician-1", "2026-08-13", "client-2");

    expect(deriveState(keyPhysClient1, stateClient1, keyPhysClient2)).toBeNull();
  });

  it("returns client-2 cached state (not client-1 state) when client-2 has a cache hit", () => {
    const stateClient1 = makeState(2200);
    const stateClient2 = makeState(1600);
    const keyPhysClient1 = _nutritionStateCacheKey("physician-1", "2026-08-13", "client-1");
    const keyPhysClient2 = _nutritionStateCacheKey("physician-1", "2026-08-13", "client-2");

    writeToday(keyPhysClient2, stateClient2);

    const derived = deriveState(keyPhysClient1, stateClient1, keyPhysClient2);
    expect(derived).toBe(stateClient2);
    expect(derived?.prescription?.caloriesTarget).toBe(1600);
  });

  it("never exposes client-1 PHI when rendering for client-2", () => {
    const stateClient1 = makeState(2200);
    const keyPhysClient1 = _nutritionStateCacheKey("physician-1", "2026-08-13", "client-1");
    const keyPhysClient2 = _nutritionStateCacheKey("physician-1", "2026-08-13", "client-2");

    const derived = deriveState(keyPhysClient1, stateClient1, keyPhysClient2);
    expect(derived?.prescription?.caloriesTarget).not.toBe(2200);
  });
});

describe("PHI isolation guard — date change", () => {
  it("returns null on first render when date changes and new date has no cache", () => {
    const stateOldDate = makeState(2000);
    const keyOld = _nutritionStateCacheKey("user-A", "2026-08-12", null);
    const keyNew = _nutritionStateCacheKey("user-A", "2026-08-13", null);

    expect(deriveState(keyOld, stateOldDate, keyNew)).toBeNull();
  });

  it("returns new-date cached state when the new date has a cache hit", () => {
    const stateOldDate = makeState(2000);
    const stateNewDate = makeState(1900);
    const keyOld = _nutritionStateCacheKey("user-A", "2026-08-12", null);
    const keyNew = _nutritionStateCacheKey("user-A", "2026-08-13", null);

    writeToday(keyNew, stateNewDate);

    const derived = deriveState(keyOld, stateOldDate, keyNew);
    expect(derived?.prescription?.caloriesTarget).toBe(1900);
  });
});

describe("hook source — structural verification of synchronous derivation", () => {
  const hookSrc = fs.readFileSync(
    path.resolve(__dirname, "../../hooks/useDailyNutritionState.ts"),
    "utf-8",
  );

  it("stores fetched data as a paired { data, key } unit (atomic update)", () => {
    expect(hookSrc).toMatch(/setFetched\(\s*\{\s*data[\s\S]*?key/);
  });

  it("derives state synchronously: fetchedKey === currentKey → fetched.data else cache lookup", () => {
    expect(hookSrc).toMatch(/fetched\.key\s*===\s*currentKey/);
    expect(hookSrc).toMatch(/getCachedNutritionState\(currentKey\)/);
  });

  it("uses getCachedNutritionState exclusively — never _nutritionStateCache.get directly for state derivation", () => {
    // The _nutritionStateCache.get bypass is only allowed in test helpers; hook
    // must always go through getCachedNutritionState so the date-staleness guard
    // (write-date validation) is applied on every cache read.
    const directGetCalls = (hookSrc.match(/_nutritionStateCache\.get/g) ?? []).length;
    expect(directGetCalls).toBe(0);
  });

  it("includes userId in both fetch effect dependency arrays", () => {
    // userId in effect deps ensures an account switch triggers a fresh fetch.
    const matches = hookSrc.match(/\[userId,\s*dateISO,\s*clientId,\s*disabled\]/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
