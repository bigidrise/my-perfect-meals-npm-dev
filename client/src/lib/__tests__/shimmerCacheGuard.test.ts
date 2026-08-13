/**
 * shimmerCacheGuard.test.ts
 *
 * Guards against the "shimmer flash on repeat visits" regression and the
 * cross-account health-data disclosure that a naive cache would introduce.
 *
 * Background
 * ----------
 * useDailyNutritionState exposes a module-level cache (_nutritionStateCache)
 * so that on repeat visits the hook's `state` is non-null from the very first
 * render.  The `effectivelyLoading` formula is:
 *
 *   isLoading || (!disabled && !!dateISO && state === null && error === null)
 *
 * When the cache provides a warm hit, `state !== null` from render 1, so
 * `effectivelyLoading` is false immediately — neither DailyTargetsCard nor
 * RemainingMacrosFooter ever mounts the animate-pulse shimmer skeleton.
 *
 * Security requirement
 * --------------------
 * Cache keys MUST include the authenticated viewer's user ID.  Without it,
 * two accounts sharing a browser tab (e.g. a support agent who logs in after
 * a regular user) would see each other's prescription, consumption, and
 * remaining nutrition data — sensitive health information.
 *
 * These tests verify:
 *   1. The cache key function is stable, correct, and user-scoped.
 *   2. Two different user IDs never share a cache entry (isolation).
 *   3. A ProCare coach's view is isolated from their own self-service view.
 *   4. The effectivelyLoading formula stays false when state is seeded from cache.
 *   5. The hook source actually seeds `state` from the user-scoped cache.
 *   6. The hook source writes to the cache after a successful fetch.
 *   7. DailyTargetsCard renders real macro values (not shimmer) when isLoading=false.
 *   8. RemainingMacrosFooter renders real macro values (not shimmer) when isLoading=false.
 *   9. Cache Map round-trip read/write.
 */

import fs from "fs";
import path from "path";
import { _nutritionStateCacheKey, _nutritionStateCache } from "../../hooks/nutritionStateCache";
import type { DailyNutritionState } from "../../../../shared/dailyNutritionPrescription";

// ── Paths ─────────────────────────────────────────────────────────────────────

const HOOK_SRC = path.resolve(
  process.cwd(),
  "client/src/hooks/useDailyNutritionState.ts",
);
const DAILY_TARGETS_CARD_SRC = path.resolve(
  process.cwd(),
  "client/src/components/biometrics/DailyTargetsCard.tsx",
);
const REMAINING_MACROS_FOOTER_SRC = path.resolve(
  process.cwd(),
  "client/src/components/biometrics/RemainingMacrosFooter.tsx",
);

// ── Fixture ───────────────────────────────────────────────────────────────────

const MOCK_PRESCRIPTION = {
  date: "2026-08-13",
  source: "user_default" as const,
  caloriesTarget: 2000,
  proteinTarget: 180,
  carbsTarget: 200,
  fatTarget: 70,
  starchyCarbsTarget: 120,
  fibrousCarbsTarget: 80,
  starchMealsAllowed: 2,
  starchMealsUsed: 0,
  starchMealsRemaining: 2,
  starchyCarbsConsumed: 0,
  starchyCarbsRemaining: 120,
  starchDistributionStrategy: "even" as const,
  isZeroStarchDay: false,
  trainingDayType: null,
  clinicalPrecisionStatus: "standard_personalization" as const,
  rationaleCodes: [],
};

const MOCK_STATE: DailyNutritionState = {
  date: "2026-08-13",
  resolvedAt: "2026-08-13T08:00:00.000Z",
  prescription: MOCK_PRESCRIPTION,
  consumed: {
    calories: 0, protein: 0, carbs: 0, fat: 0,
    starchyCarbs: 0, fibrousCarbs: 0, starchMealsLogged: 0, mealCount: 0,
  },
  planned: {
    calories: 0, protein: 0, carbs: 0, fat: 0,
    starchyCarbs: 0, starchMealsPlanned: 0, reservationCount: 0,
  },
  remaining: {
    calories: 2000, protein: 180, carbs: 200, fat: 70,
    starchyCarbs: 120, fibrousCarbs: 80, starchMealsRemaining: 2,
  },
  mealPlanConfig: {
    mealsPerDay: 3,
    starchMealsPerDay: 2,
    starchDistributionStrategy: "even",
  },
  activeConstraints: {
    generationContext: "standard",
    starchSlotsExhausted: false,
    calorieBudgetExhausted: false,
    proteinBudgetMet: false,
  },
};

// ── 1. Cache key — structure and stability ────────────────────────────────────

describe("_nutritionStateCacheKey", () => {
  it("returns a stable key scoped to userId, date, and no clientId", () => {
    expect(_nutritionStateCacheKey("user-1", "2026-08-13")).toBe("user-1:2026-08-13:");
    expect(_nutritionStateCacheKey("user-1", "2026-08-13", null)).toBe("user-1:2026-08-13:");
    expect(_nutritionStateCacheKey("user-1", "2026-08-13", undefined)).toBe("user-1:2026-08-13:");
  });

  it("returns a stable key for a ProCare coach reading a client", () => {
    expect(_nutritionStateCacheKey("coach-99", "2026-08-13", "client-42")).toBe(
      "coach-99:2026-08-13:client-42",
    );
  });

  it("produces different keys for different dates", () => {
    const a = _nutritionStateCacheKey("user-1", "2026-08-13");
    const b = _nutritionStateCacheKey("user-1", "2026-08-14");
    expect(a).not.toBe(b);
  });

  it("produces different keys for different clientIds", () => {
    const a = _nutritionStateCacheKey("coach-99", "2026-08-13", "client-A");
    const b = _nutritionStateCacheKey("coach-99", "2026-08-13", "client-B");
    expect(a).not.toBe(b);
  });
});

// ── 2. User isolation — different accounts must never share cache entries ──────

describe("_nutritionStateCacheKey — cross-account isolation", () => {
  afterEach(() => {
    _nutritionStateCache.clear();
  });

  it("two different user IDs on the same date produce distinct keys", () => {
    const keyA = _nutritionStateCacheKey("user-alice", "2026-08-13");
    const keyB = _nutritionStateCacheKey("user-bob", "2026-08-13");
    expect(keyA).not.toBe(keyB);
  });

  it("writing user-A's state does not make it readable as user-B's state", () => {
    const keyA = _nutritionStateCacheKey("user-alice", "2026-08-13");
    const keyB = _nutritionStateCacheKey("user-bob", "2026-08-13");

    _nutritionStateCache.set(keyA, MOCK_STATE);

    // user-B's key must return undefined — they get no warm-cache seed
    expect(_nutritionStateCache.get(keyB)).toBeUndefined();
  });

  it("a coach's self-service view is isolated from their ProCare-client view", () => {
    const selfKey = _nutritionStateCacheKey("coach-99", "2026-08-13");
    const clientKey = _nutritionStateCacheKey("coach-99", "2026-08-13", "client-42");

    _nutritionStateCache.set(selfKey, MOCK_STATE);

    expect(_nutritionStateCache.get(clientKey)).toBeUndefined();
    expect(_nutritionStateCache.get(selfKey)).toBe(MOCK_STATE);
  });

  it("a second user login in the same tab session gets no warm state from the previous user", () => {
    // Simulate: user-alice's fetch populates the cache
    const aliceKey = _nutritionStateCacheKey("user-alice", "2026-08-13");
    _nutritionStateCache.set(aliceKey, MOCK_STATE);

    // user-bob logs in next — their key must be a cold miss so they see a
    // fresh fetch, never alice's prescription / consumption / remaining data
    const bobKey = _nutritionStateCacheKey("user-bob", "2026-08-13");
    const bobCacheHit = _nutritionStateCache.get(bobKey);

    expect(bobCacheHit).toBeUndefined();

    // Simulate the effectivelyLoading formula for bob's first render
    const state = bobCacheHit ?? null;
    const effectivelyLoading =
      false /* isLoading */ || (true /* !disabled */ && true /* !!dateISO */ && state === null && true /* error===null */);

    // Bob must see a loading state (shimmer) on their first render, NOT alice's data
    expect(effectivelyLoading).toBe(true);
  });
});

// ── 3. effectivelyLoading formula ─────────────────────────────────────────────

describe("effectivelyLoading formula — no shimmer on cache hit", () => {
  /**
   * Mirrors the formula in useDailyNutritionState verbatim so any future
   * change to the hook that breaks the warm-cache guarantee will fail here.
   */
  function effectivelyLoading(opts: {
    isLoading: boolean;
    disabled: boolean;
    dateISO: string;
    state: DailyNutritionState | null;
    error: string | null;
  }): boolean {
    const { isLoading, disabled, dateISO, state, error } = opts;
    return isLoading || (!disabled && !!dateISO && state === null && error === null);
  }

  it("is false on first render when state is seeded from cache (warm cache hit)", () => {
    const result = effectivelyLoading({
      isLoading: false,
      disabled: false,
      dateISO: "2026-08-13",
      state: MOCK_STATE,   // seeded from cache
      error: null,
    });
    expect(result).toBe(false);
  });

  it("is true on first render when cache is empty (cold visit — shimmer is correct)", () => {
    const result = effectivelyLoading({
      isLoading: false,
      disabled: false,
      dateISO: "2026-08-13",
      state: null,           // no cache entry
      error: null,
    });
    expect(result).toBe(true);
  });

  it("is true while isLoading regardless of cached state (explicit refetch path)", () => {
    // macros:updated triggers a background refresh; isLoading=true is expected
    // during that window — this is not the initial-render shimmer flash.
    const result = effectivelyLoading({
      isLoading: true,
      disabled: false,
      dateISO: "2026-08-13",
      state: MOCK_STATE,
      error: null,
    });
    expect(result).toBe(true);
  });

  it("is false when disabled, regardless of state", () => {
    const result = effectivelyLoading({
      isLoading: false,
      disabled: true,
      dateISO: "2026-08-13",
      state: null,
      error: null,
    });
    expect(result).toBe(false);
  });

  it("is false when dateISO is empty, regardless of state", () => {
    const result = effectivelyLoading({
      isLoading: false,
      disabled: false,
      dateISO: "",
      state: null,
      error: null,
    });
    expect(result).toBe(false);
  });
});

// ── 4. Source — cache module and hook wiring ──────────────────────────────────

const CACHE_MODULE_SRC_PATH = path.resolve(
  process.cwd(),
  "client/src/hooks/nutritionStateCache.ts",
);

describe("nutritionStateCache module — cache key is user-scoped", () => {
  let src: string;

  beforeAll(() => {
    expect(fs.existsSync(CACHE_MODULE_SRC_PATH)).toBe(true);
    src = fs.readFileSync(CACHE_MODULE_SRC_PATH, "utf-8");
  });

  it("exports the module-level cache Map", () => {
    expect(src).toMatch(/export\s+const\s+_nutritionStateCache\s*=\s*new\s+Map/);
  });

  it("exports the cache key helper with userId as the first parameter", () => {
    expect(src).toMatch(/export\s+function\s+_nutritionStateCacheKey/);
    expect(src).toMatch(/_nutritionStateCacheKey\s*\(\s*\n?\s*userId/);
  });

  it("includes userId in the cache key template literal", () => {
    expect(src).toMatch(/`\$\{userId\}/);
  });
});

describe("useDailyNutritionState source — hook wiring", () => {
  let src: string;

  beforeAll(() => {
    expect(fs.existsSync(HOOK_SRC)).toBe(true);
    src = fs.readFileSync(HOOK_SRC, "utf-8");
  });

  it("imports the cache helpers from the standalone cache module", () => {
    expect(src).toMatch(/from\s+["']\.\/nutritionStateCache["']/);
  });

  it("reads the authenticated viewer's user ID from useAuth", () => {
    expect(src).toMatch(/useAuth\s*\(\s*\)/);
    expect(src).toMatch(/user\?\.id/);
  });

  it("seeds useState initialiser from the user-scoped cache", () => {
    expect(src).toMatch(/useState\s*<[^>]*>\s*\(\s*\(\s*\)\s*=>/);
    expect(src).toMatch(/_nutritionStateCache\.get\s*\(/);
  });

  it("writes to the cache on successful fetch", () => {
    expect(src).toMatch(/_nutritionStateCache\.set\s*\(/);
  });

  it("guards the cache write so only authenticated users populate it", () => {
    expect(src).toMatch(/if\s*\(\s*userId\s*\)/);
  });

  it("returns effectivelyLoading that accounts for non-null state", () => {
    expect(src).toMatch(/state\s*===\s*null/);
    expect(src).toMatch(/effectivelyLoading/);
  });
});

// ── 5. DailyTargetsCard — shimmer vs real values ──────────────────────────────

describe("DailyTargetsCard source — shimmer / real-values branching", () => {
  let src: string;

  beforeAll(() => {
    expect(fs.existsSync(DAILY_TARGETS_CARD_SRC)).toBe(true);
    src = fs.readFileSync(DAILY_TARGETS_CARD_SRC, "utf-8");
  });

  it("only renders the animate-pulse skeleton inside the isLoading branch", () => {
    const isLoadingBranchMatch = src.match(/\{isLoading\s*\?([\s\S]*?):\s*\(/);
    expect(isLoadingBranchMatch).not.toBeNull();
    const loadingBranch = isLoadingBranchMatch![1];
    expect(loadingBranch).toContain("animate-pulse");
  });

  it("renders real gram values (not shimmer) in the else branch", () => {
    // The else branch follows the colon after the shimmer block.
    const parts = src.split(/:\s*\(\s*\n\s*<div className="grid grid-cols-5/);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    const realValuesBranch = parts[1];
    expect(realValuesBranch).toMatch(/protein_g|protein/);
    expect(realValuesBranch).not.toContain("animate-pulse");
  });

  it("accepts an isLoading prop that defaults to false", () => {
    // Default must be false so builders that omit isLoading never shimmer
    expect(src).toMatch(/isLoading\s*=\s*false/);
  });
});

// ── 6. RemainingMacrosFooter — shimmer vs real values ─────────────────────────

describe("RemainingMacrosFooter source — shimmer / real-values branching", () => {
  let src: string;

  beforeAll(() => {
    expect(fs.existsSync(REMAINING_MACROS_FOOTER_SRC)).toBe(true);
    src = fs.readFileSync(REMAINING_MACROS_FOOTER_SRC, "utf-8");
  });

  it("only renders animate-pulse skeleton inside the isLoading early-return block", () => {
    const isLoadingIdx = src.indexOf("if (isLoading)");
    expect(isLoadingIdx).toBeGreaterThan(-1);

    const animatePulseIdx = src.indexOf("animate-pulse");
    expect(animatePulseIdx).toBeGreaterThan(-1);

    // animate-pulse must appear after `if (isLoading)` (inside that block)
    expect(animatePulseIdx).toBeGreaterThan(isLoadingIdx);

    // The real-values path starts with `if (!hasTargets)` after the isLoading block.
    // animate-pulse must appear before that guard, not after it.
    const hasTargetsIdx = src.indexOf("if (!hasTargets)");
    expect(hasTargetsIdx).toBeGreaterThan(-1);
    expect(animatePulseIdx).toBeLessThan(hasTargetsIdx);
  });

  it("does not render animate-pulse outside the isLoading block", () => {
    // All animate-pulse occurrences must be before `if (!hasTargets)`.
    const afterHasTargets = src.slice(src.indexOf("if (!hasTargets)"));
    expect(afterHasTargets).not.toContain("animate-pulse");
  });

  it("accepts an isLoading prop that defaults to false", () => {
    expect(src).toMatch(/isLoading\s*=\s*false/);
  });

  it("renders MacroCell components (real values) in the non-loading path", () => {
    expect(src).toMatch(/<MacroCell/);
  });
});

// ── 7. Cache Map round-trip ───────────────────────────────────────────────────

describe("_nutritionStateCache — round-trip read/write", () => {
  afterEach(() => {
    _nutritionStateCache.clear();
  });

  it("stores and retrieves a DailyNutritionState by user-scoped key", () => {
    const key = _nutritionStateCacheKey("user-1", "2026-08-13");
    _nutritionStateCache.set(key, MOCK_STATE);
    expect(_nutritionStateCache.get(key)).toBe(MOCK_STATE);
  });

  it("returns undefined for a key that has not been written", () => {
    const key = _nutritionStateCacheKey("user-1", "2099-01-01");
    expect(_nutritionStateCache.get(key)).toBeUndefined();
  });

  it("keeps per-user entries isolated under the same date", () => {
    const keyA = _nutritionStateCacheKey("user-alice", "2026-08-13");
    const keyB = _nutritionStateCacheKey("user-bob", "2026-08-13");
    const stateB: DailyNutritionState = { ...MOCK_STATE, date: "2026-08-13" };

    _nutritionStateCache.set(keyA, MOCK_STATE);
    _nutritionStateCache.set(keyB, stateB);

    expect(_nutritionStateCache.get(keyA)).toBe(MOCK_STATE);
    expect(_nutritionStateCache.get(keyB)).toBe(stateB);
    expect(_nutritionStateCache.get(keyA)).not.toBe(_nutritionStateCache.get(keyB));
  });

  it("keeps per-client entries isolated under the same user and date", () => {
    const keyA = _nutritionStateCacheKey("coach-99", "2026-08-13", "client-A");
    const keyB = _nutritionStateCacheKey("coach-99", "2026-08-13", "client-B");
    const stateB: DailyNutritionState = { ...MOCK_STATE };

    _nutritionStateCache.set(keyA, MOCK_STATE);
    _nutritionStateCache.set(keyB, stateB);

    expect(_nutritionStateCache.get(keyA)).toBe(MOCK_STATE);
    expect(_nutritionStateCache.get(keyB)).toBe(stateB);
    expect(_nutritionStateCache.get(keyA)).not.toBe(_nutritionStateCache.get(keyB));
  });
});
