/**
 * Unit tests for evictStaleBuilderCaches (client/src/lib/safeLocalStorage.ts)
 *
 * Covers the four builder-specific cache keys that were added alongside the
 * stale-eviction feature:
 *   - ai-meal-creator-cached-meals          (GeneralNutritionBuilder)
 *   - ai-athlete-meal-creator-cached-meals  (PerformanceCompetitionBuilder)
 *   - diabetic-ai-meal-creator-cached-meals (DiabeticMenuBuilder)
 *   - anti-inflammatory-ai-meal-creator-cached-meals (AntiInflammatoryMenuBuilder)
 *
 * Each test verifies that a cache entry whose generatedAtISO is older than
 * 24 hours is removed from localStorage on the next eviction cycle, and that
 * fresh entries (< 24 h) are left untouched.
 *
 * localStorage is not available in the Node test environment, so a minimal
 * in-memory implementation is installed on globalThis before each test and
 * torn down afterwards.
 */

import { evictStaleBuilderCaches, BUILDER_CACHE_KEYS } from "../../client/src/lib/safeLocalStorage";

// ── localStorage mock ─────────────────────────────────────────────────────────

class InMemoryLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

let mockStorage: InMemoryLocalStorage;

beforeEach(() => {
  mockStorage = new InMemoryLocalStorage();
  // Install on globalThis so the imported module's localStorage references resolve
  Object.defineProperty(globalThis, "localStorage", {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  // Remove the mock to avoid leaking into subsequent test files
  // (jest clears modules between suites when --clearMocks is set)
  try {
    // @ts-ignore
    delete globalThis.localStorage;
  } catch {
    /* environment may not allow deletion — leave as-is */
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const TWENTY_FIVE_HOURS_MS = 25 * 60 * 60 * 1000;
const ONE_HOUR_MS = 1 * 60 * 60 * 1000;

function staleISO(): string {
  return new Date(Date.now() - TWENTY_FIVE_HOURS_MS).toISOString();
}

function freshISO(): string {
  return new Date(Date.now() - ONE_HOUR_MS).toISOString();
}

function putEntry(key: string, generatedAtISO: string, extraFields: Record<string, unknown> = {}): void {
  mockStorage.setItem(key, JSON.stringify({ meals: [{ name: "Test Meal" }], generatedAtISO, ...extraFields }));
}

// ── Suite 1: BUILDER_CACHE_KEYS includes all four builder keys ────────────────

describe("BUILDER_CACHE_KEYS coverage", () => {
  const EXPECTED_KEYS = [
    "ai-meal-creator-cached-meals",
    "ai-athlete-meal-creator-cached-meals",
    "diabetic-ai-meal-creator-cached-meals",
    "anti-inflammatory-ai-meal-creator-cached-meals",
  ];

  it.each(EXPECTED_KEYS)(
    "BUILDER_CACHE_KEYS includes '%s'",
    (key) => {
      expect(BUILDER_CACHE_KEYS).toContain(key);
    },
  );
});

// ── Suite 2: GeneralNutritionBuilder cache key ────────────────────────────────

describe("evictStaleBuilderCaches — ai-meal-creator-cached-meals (GeneralNutritionBuilder)", () => {
  const KEY = "ai-meal-creator-cached-meals";

  it("removes a stale entry (>24 h) on eviction", () => {
    putEntry(KEY, staleISO());
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("leaves a fresh entry (<24 h) untouched", () => {
    putEntry(KEY, freshISO());
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).not.toBeNull();
  });

  it("removes the entry when generatedAtISO is exactly 25 hours ago", () => {
    const iso = new Date(Date.now() - TWENTY_FIVE_HOURS_MS).toISOString();
    putEntry(KEY, iso);
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("does not crash when the key is absent", () => {
    expect(() => evictStaleBuilderCaches()).not.toThrow();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("does not crash when the stored value is corrupt JSON", () => {
    mockStorage.setItem(KEY, "{ not valid json }}}");
    expect(() => evictStaleBuilderCaches()).not.toThrow();
    // Corrupt entries are removed as a fail-safe
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("does not remove an entry that has no generatedAtISO field", () => {
    // Entries without a timestamp are treated as safe (no TTL info available)
    mockStorage.setItem(KEY, JSON.stringify({ meals: [{ name: "Untimed meal" }] }));
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).not.toBeNull();
  });
});

// ── Suite 3: PerformanceCompetitionBuilder cache key ─────────────────────────

describe("evictStaleBuilderCaches — ai-athlete-meal-creator-cached-meals (PerformanceCompetitionBuilder)", () => {
  const KEY = "ai-athlete-meal-creator-cached-meals";

  it("removes a stale entry (>24 h) on eviction", () => {
    putEntry(KEY, staleISO());
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("leaves a fresh entry (<24 h) untouched", () => {
    putEntry(KEY, freshISO());
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).not.toBeNull();
  });

  it("removes the entry when generatedAtISO is exactly 25 hours ago", () => {
    const iso = new Date(Date.now() - TWENTY_FIVE_HOURS_MS).toISOString();
    putEntry(KEY, iso);
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("does not crash when the key is absent", () => {
    expect(() => evictStaleBuilderCaches()).not.toThrow();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("does not crash when the stored value is corrupt JSON", () => {
    mockStorage.setItem(KEY, "!!not-json!!");
    expect(() => evictStaleBuilderCaches()).not.toThrow();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });
});

// ── Suite 4: DiabeticMenuBuilder cache key ────────────────────────────────────

describe("evictStaleBuilderCaches — diabetic-ai-meal-creator-cached-meals (DiabeticMenuBuilder)", () => {
  const KEY = "diabetic-ai-meal-creator-cached-meals";

  it("removes a stale entry (>24 h) on eviction", () => {
    putEntry(KEY, staleISO());
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("leaves a fresh entry (<24 h) untouched", () => {
    putEntry(KEY, freshISO());
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).not.toBeNull();
  });

  it("removes the entry when generatedAtISO is exactly 25 hours ago", () => {
    const iso = new Date(Date.now() - TWENTY_FIVE_HOURS_MS).toISOString();
    putEntry(KEY, iso);
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("does not crash when the key is absent", () => {
    expect(() => evictStaleBuilderCaches()).not.toThrow();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("does not crash when the stored value is corrupt JSON", () => {
    mockStorage.setItem(KEY, "undefined");
    expect(() => evictStaleBuilderCaches()).not.toThrow();
    // corrupt entries are removed
    expect(mockStorage.getItem(KEY)).toBeNull();
  });
});

// ── Suite 5: AntiInflammatoryMenuBuilder cache key ───────────────────────────

describe("evictStaleBuilderCaches — anti-inflammatory-ai-meal-creator-cached-meals (AntiInflammatoryMenuBuilder)", () => {
  const KEY = "anti-inflammatory-ai-meal-creator-cached-meals";

  it("removes a stale entry (>24 h) on eviction", () => {
    putEntry(KEY, staleISO());
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("leaves a fresh entry (<24 h) untouched", () => {
    putEntry(KEY, freshISO());
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).not.toBeNull();
  });

  it("removes the entry when generatedAtISO is exactly 25 hours ago", () => {
    const iso = new Date(Date.now() - TWENTY_FIVE_HOURS_MS).toISOString();
    putEntry(KEY, iso);
    evictStaleBuilderCaches();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("does not crash when the key is absent", () => {
    expect(() => evictStaleBuilderCaches()).not.toThrow();
    expect(mockStorage.getItem(KEY)).toBeNull();
  });

  it("does not crash when the stored value is an empty string (treated as absent)", () => {
    // An empty string is falsy — evictStaleBuilderCaches skips it via `if (!raw) continue`
    // so the entry is left untouched rather than removed.
    mockStorage.setItem(KEY, "");
    expect(() => evictStaleBuilderCaches()).not.toThrow();
    expect(mockStorage.getItem(KEY)).toBe("");
  });
});

// ── Suite 6: Multi-key isolation — evicting one key does not affect others ────

describe("evictStaleBuilderCaches — cross-key isolation", () => {
  it("evicts only the stale key when some keys are fresh and some are stale", () => {
    const stale = "ai-meal-creator-cached-meals";
    const fresh = "ai-athlete-meal-creator-cached-meals";
    const alsoFresh = "diabetic-ai-meal-creator-cached-meals";

    putEntry(stale, staleISO());
    putEntry(fresh, freshISO());
    putEntry(alsoFresh, freshISO());

    evictStaleBuilderCaches();

    expect(mockStorage.getItem(stale)).toBeNull();           // evicted
    expect(mockStorage.getItem(fresh)).not.toBeNull();       // kept
    expect(mockStorage.getItem(alsoFresh)).not.toBeNull();   // kept
  });

  it("evicts all four builder keys when all are stale", () => {
    const keys = [
      "ai-meal-creator-cached-meals",
      "ai-athlete-meal-creator-cached-meals",
      "diabetic-ai-meal-creator-cached-meals",
      "anti-inflammatory-ai-meal-creator-cached-meals",
    ];

    for (const key of keys) {
      putEntry(key, staleISO());
    }

    evictStaleBuilderCaches();

    for (const key of keys) {
      expect(mockStorage.getItem(key)).toBeNull();
    }
  });

  it("preserves all four builder keys when all are fresh", () => {
    const keys = [
      "ai-meal-creator-cached-meals",
      "ai-athlete-meal-creator-cached-meals",
      "diabetic-ai-meal-creator-cached-meals",
      "anti-inflammatory-ai-meal-creator-cached-meals",
    ];

    for (const key of keys) {
      putEntry(key, freshISO());
    }

    evictStaleBuilderCaches();

    for (const key of keys) {
      expect(mockStorage.getItem(key)).not.toBeNull();
    }
  });
});

// ── Suite 7: safeLocalStorageSet writes trigger eviction first ────────────────
// Verify that evictStaleBuilderCaches is called (and stale entries are gone)
// before a new value is stored, which is the contract promised in the code.

describe("stale entries are gone after safeLocalStorageSet triggers eviction", () => {
  it("a stale entry is no longer readable after a safeLocalStorageSet call on any builder key", async () => {
    // Dynamically import here so the localStorage mock is already in place
    const { safeLocalStorageSet } = await import("../../client/src/lib/safeLocalStorage");

    const staleKey = "ai-meal-creator-cached-meals";
    const writeKey = "diabetic-ai-meal-creator-cached-meals";

    // Seed a stale entry for the first key
    putEntry(staleKey, staleISO());

    // Write to a different key — this must call evictStaleBuilderCaches() first
    safeLocalStorageSet(writeKey, { meals: [{ name: "New Meal" }] });

    // The stale entry in staleKey must have been removed as a side-effect
    expect(mockStorage.getItem(staleKey)).toBeNull();

    // The written key must be present
    const stored = mockStorage.getItem(writeKey);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.meals[0].name).toBe("New Meal");
    expect(parsed.generatedAtISO).toBeDefined();
  });
});
