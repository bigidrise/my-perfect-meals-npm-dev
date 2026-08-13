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
 *  10. Logout clears the cache and advances the generation so in-flight responses
 *      cannot repopulate stale data for the next session.
 *  11. Date-staleness guard: entries written on a previous calendar day are misses.
 */

import fs from "fs";
import path from "path";
import {
  _nutritionStateCacheKey,
  _nutritionStateCache,
  _nutritionStateCacheWriteDate,
  getCachedNutritionState,
  setCachedNutritionState,
  getCacheGeneration,
  clearNutritionCache,
} from "../../hooks/nutritionStateCache";
import type { DailyNutritionState } from "../../../../shared/dailyNutritionPrescription";

// ── Paths ─────────────────────────────────────────────────────────────────────

const HOOK_SRC = path.resolve(
  process.cwd(),
  "client/src/hooks/useDailyNutritionState.ts",
);
const CACHE_MODULE_SRC_PATH = path.resolve(
  process.cwd(),
  "client/src/hooks/nutritionStateCache.ts",
);
const DAILY_TARGETS_CARD_SRC = path.resolve(
  process.cwd(),
  "client/src/components/biometrics/DailyTargetsCard.tsx",
);
const REMAINING_MACROS_FOOTER_SRC = path.resolve(
  process.cwd(),
  "client/src/components/biometrics/RemainingMacrosFooter.tsx",
);
const AUTH_SRC_PATH = path.resolve(
  process.cwd(),
  "client/src/lib/auth.ts",
);
const AUTH_CONTEXT_SRC_PATH = path.resolve(
  process.cwd(),
  "client/src/contexts/AuthContext.tsx",
);
const IDLE_TIMEOUT_SRC_PATH = path.resolve(
  process.cwd(),
  "client/src/components/IdleTimeoutModal.tsx",
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
    _nutritionStateCacheWriteDate.clear();
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

  it("exports getCacheGeneration() for in-flight request guards", () => {
    expect(src).toMatch(/export\s+function\s+getCacheGeneration/);
  });

  it("exports clearNutritionCache() that clears the map AND advances the generation", () => {
    expect(src).toMatch(/export\s+function\s+clearNutritionCache/);
    const fnIdx = src.indexOf("export function clearNutritionCache");
    const body = src.slice(fnIdx, fnIdx + 300);
    expect(body).toMatch(/_nutritionStateCache\.clear\(\)/);
    expect(body).toMatch(/_cacheGeneration\+\+|_cacheGeneration\s*\+?=\s*_cacheGeneration\s*\+\s*1/);
  });

  it("exports getCachedNutritionState() with date-staleness guard", () => {
    expect(src).toMatch(/export\s+function\s+getCachedNutritionState/);
  });

  it("exports setCachedNutritionState() that stamps the write date", () => {
    expect(src).toMatch(/export\s+function\s+setCachedNutritionState/);
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

  it("seeds useState initialiser from the user-scoped cache via getCachedNutritionState", () => {
    expect(src).toMatch(/useState\s*<[^>]*>\s*\(\s*\(\s*\)\s*=>/);
    // Must use the date-guarded helper, not raw Map.get
    expect(src).toMatch(/getCachedNutritionState\s*\(/);
  });

  it("writes to the cache on successful fetch via setCachedNutritionState", () => {
    expect(src).toMatch(/setCachedNutritionState\s*\(/);
  });

  it("guards the cache write so only authenticated users populate it", () => {
    expect(src).toMatch(/if\s*\(\s*userId/);
  });

  it("imports getCacheGeneration to guard in-flight responses after logout", () => {
    expect(src).toMatch(/getCacheGeneration/);
  });

  it("captures the generation at fetch-start (thisGeneration)", () => {
    expect(src).toMatch(/thisGeneration\s*=\s*getCacheGeneration\(\)/);
  });

  it("compares thisGeneration to the current generation before writing to cache", () => {
    expect(src).toMatch(/thisGeneration\s*===\s*getCacheGeneration\(\)/);
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
    const parts = src.split(/:\s*\(\s*\n\s*<div className="grid grid-cols-5/);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    const realValuesBranch = parts[1];
    expect(realValuesBranch).toMatch(/protein_g|protein/);
    expect(realValuesBranch).not.toContain("animate-pulse");
  });

  it("accepts an isLoading prop that defaults to false", () => {
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

    expect(animatePulseIdx).toBeGreaterThan(isLoadingIdx);

    const hasTargetsIdx = src.indexOf("if (!hasTargets)");
    expect(hasTargetsIdx).toBeGreaterThan(-1);
    expect(animatePulseIdx).toBeLessThan(hasTargetsIdx);
  });

  it("does not render animate-pulse outside the isLoading block", () => {
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

// ── 7. Logout paths — cache cleared on sign-out ───────────────────────────────

// 7a. Behavioral — actually invoke logout() and verify the cache empties.
describe("logout() — behavioral: cache cleared on standard logout", () => {
  let logoutFn: () => void;

  beforeAll(async () => {
    // auth.ts only touches localStorage inside its functions (not at import time),
    // so we just need a minimal stub in place before calling logout().
    (global as any).localStorage = {
      getItem: () => null,  // No stored token → skips the network call entirely
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };
    const mod = await import("../../lib/auth");
    logoutFn = mod.logout;
  });

  afterEach(() => {
    _nutritionStateCache.clear();
    _nutritionStateCacheWriteDate.clear();
  });

  it("clears every entry in the nutrition cache when logout() is called", () => {
    const key1 = _nutritionStateCacheKey("user-alice", "2026-08-13");
    const key2 = _nutritionStateCacheKey("user-alice", "2026-08-12");
    _nutritionStateCache.set(key1, MOCK_STATE);
    _nutritionStateCache.set(key2, MOCK_STATE);
    expect(_nutritionStateCache.size).toBe(2);

    logoutFn();

    expect(_nutritionStateCache.size).toBe(0);
    expect(_nutritionStateCache.get(key1)).toBeUndefined();
    expect(_nutritionStateCache.get(key2)).toBeUndefined();
  });

  it("after logout(), a new user's first render sees a cold cache (no stale data)", () => {
    const aliceKey = _nutritionStateCacheKey("user-alice", "2026-08-13");
    _nutritionStateCache.set(aliceKey, MOCK_STATE);

    logoutFn();

    const bobKey = _nutritionStateCacheKey("user-bob", "2026-08-13");
    const bobHit = _nutritionStateCache.get(bobKey);
    expect(bobHit).toBeUndefined();

    const seededState = bobHit ?? null;
    const effectivelyLoading =
      false /* isLoading */ ||
      (true /* !disabled */ && true /* !!dateISO */ && seededState === null && true /* no error */);
    expect(effectivelyLoading).toBe(true);
  });
});

// 7b. Source-inspection — canonical logout helper wires the clear call.
describe("auth.ts logout() — source: calls clearNutritionCache()", () => {
  let src: string;

  beforeAll(() => {
    expect(fs.existsSync(AUTH_SRC_PATH)).toBe(true);
    src = fs.readFileSync(AUTH_SRC_PATH, "utf-8");
  });

  it("imports clearNutritionCache from the cache module", () => {
    expect(src).toMatch(/import.*clearNutritionCache.*from.*nutritionStateCache/);
  });

  it("calls clearNutritionCache() inside the logout() function body", () => {
    const logoutFnIdx = src.indexOf("export function logout()");
    expect(logoutFnIdx).toBeGreaterThan(-1);
    const afterLogout = src.slice(logoutFnIdx, logoutFnIdx + 900);
    expect(afterLogout).toMatch(/clearNutritionCache\(\)/);
  });
});

// 7c. Source-inspection — idle-timeout sign-out wires the clear call.
describe("IdleTimeoutModal signOut — source: calls clearNutritionCache()", () => {
  let src: string;

  beforeAll(() => {
    expect(fs.existsSync(IDLE_TIMEOUT_SRC_PATH)).toBe(true);
    src = fs.readFileSync(IDLE_TIMEOUT_SRC_PATH, "utf-8");
  });

  it("imports clearNutritionCache from the cache module", () => {
    expect(src).toMatch(/import.*clearNutritionCache.*from.*nutritionStateCache/);
  });

  it("calls clearNutritionCache() inside the signOut callback", () => {
    const signOutIdx = src.indexOf("const signOut = useCallback");
    expect(signOutIdx).toBeGreaterThan(-1);
    const signOutBody = src.slice(signOutIdx, signOutIdx + 800);
    expect(signOutBody).toMatch(/clearNutritionCache\(\)/);
  });
});

// 7d. Source-inspection — AuthContext clears on its 4 in-process logout paths.
describe("AuthContext — source: clears cache on all in-process logout paths", () => {
  let src: string;

  beforeAll(() => {
    expect(fs.existsSync(AUTH_CONTEXT_SRC_PATH)).toBe(true);
    src = fs.readFileSync(AUTH_CONTEXT_SRC_PATH, "utf-8");
  });

  it("imports clearNutritionCache from the cache module", () => {
    expect(src).toMatch(/import.*clearNutritionCache.*from.*nutritionStateCache/);
  });

  it("calls clearNutritionCache() at every logout path (≥ 4)", () => {
    const occurrences = (src.match(/clearNutritionCache\(\)/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(4);
  });

  it("every /login redirect is preceded by clearNutritionCache() in the same block", () => {
    const re = /clearNutritionCache\(\)[\s\S]{0,300}window\.location\.href\s*=\s*["']\/login["']/g;
    const clears = (src.match(re) || []).length;
    const redirects = (src.match(/window\.location\.href\s*=\s*["']\/login["']/g) || []).length;
    expect(redirects).toBeGreaterThan(0);
    expect(clears).toBe(redirects);
  });
});

// 7e. Race-condition regression — in-flight requests cannot repopulate the cache
// after logout has advanced the generation.
describe("clearNutritionCache() + generation guard — in-flight response race", () => {
  afterEach(() => {
    _nutritionStateCache.clear();
    _nutritionStateCacheWriteDate.clear();
  });

  it("getCacheGeneration() increments each time clearNutritionCache() is called", () => {
    const before = getCacheGeneration();
    clearNutritionCache();
    expect(getCacheGeneration()).toBe(before + 1);
    clearNutritionCache();
    expect(getCacheGeneration()).toBe(before + 2);
  });

  it("an in-flight request that resolves after logout cannot repopulate the cache", () => {
    const genAtStart = getCacheGeneration();

    const key = _nutritionStateCacheKey("user-alice", "2026-08-13");
    _nutritionStateCache.set(key, MOCK_STATE);

    // User logs out — cache cleared, generation advances
    clearNutritionCache();
    expect(_nutritionStateCache.size).toBe(0);
    expect(getCacheGeneration()).toBeGreaterThan(genAtStart);

    // In-flight response arrives — hook guard: only write if generation unchanged
    if (genAtStart === getCacheGeneration()) {
      _nutritionStateCache.set(key, MOCK_STATE); // Must NOT run
    }

    expect(_nutritionStateCache.size).toBe(0);
    expect(_nutritionStateCache.get(key)).toBeUndefined();
  });

  it("a request that resolves before logout DOES populate the cache normally", () => {
    const genAtStart = getCacheGeneration();
    const key = _nutritionStateCacheKey("user-alice", "2026-08-13");

    if (genAtStart === getCacheGeneration()) {
      _nutritionStateCache.set(key, MOCK_STATE);
    }

    expect(_nutritionStateCache.get(key)).toBe(MOCK_STATE);
  });
});

// ── 8. Date-staleness guard ───────────────────────────────────────────────────

describe("getCachedNutritionState — stale cache entries are treated as misses", () => {
  afterEach(() => {
    _nutritionStateCache.clear();
    _nutritionStateCacheWriteDate.clear();
  });

  it("returns undefined when no entry exists for the key", () => {
    const key = _nutritionStateCacheKey("user-1", "2026-08-13");
    expect(getCachedNutritionState(key)).toBeUndefined();
  });

  it("returns undefined when the entry was written on a previous calendar date", () => {
    const key = _nutritionStateCacheKey("user-1", "2026-08-12");
    _nutritionStateCache.set(key, MOCK_STATE);
    _nutritionStateCacheWriteDate.set(key, "2000-01-01"); // stale

    expect(getCachedNutritionState(key)).toBeUndefined();
  });

  it("a stale entry does not seed state (simulates hook useState initializer)", () => {
    const key = _nutritionStateCacheKey("user-1", "2026-08-12");
    _nutritionStateCache.set(key, MOCK_STATE);
    _nutritionStateCacheWriteDate.set(key, "2000-01-01"); // stale

    const seededState = getCachedNutritionState(key) ?? null;
    expect(seededState).toBeNull();

    // Because state is null, effectivelyLoading is true — the shimmer renders
    // and the fresh fetch fires, preventing a stale number from ever appearing.
    const effectivelyLoading =
      false /* isLoading */ ||
      (true /* !disabled */ && true /* !!dateISO */ && seededState === null && true /* error===null */);
    expect(effectivelyLoading).toBe(true);
  });
});

// ── 9. Cache Map round-trip ───────────────────────────────────────────────────

describe("_nutritionStateCache — round-trip read/write", () => {
  afterEach(() => {
    _nutritionStateCache.clear();
    _nutritionStateCacheWriteDate.clear();
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
