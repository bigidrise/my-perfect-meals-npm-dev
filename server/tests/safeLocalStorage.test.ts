/**
 * safeLocalStorage.test.ts
 *
 * Unit tests for safeLocalStorage.ts — the safe localStorage write layer that
 * guards builder caches against QuotaExceededError and stale data.
 *
 * Tests run in the Node test environment, so we provide a minimal localStorage
 * mock (get/set/remove/clear + simulated quota enforcement).
 */

import {
  safeLocalStorageSet,
  safeLocalStorageGetArray,
  evictStaleBuilderCaches,
  migrateLegacyBuilderCaches,
  BUILDER_CACHE_KEYS,
} from "@/lib/safeLocalStorage";

// ---------------------------------------------------------------------------
// Minimal localStorage mock
// ---------------------------------------------------------------------------

class MockLocalStorage {
  private store: Record<string, string> = {};
  /** When true, the next setItem call throws QuotaExceededError. */
  public quotaExceeded = false;
  /** When > 0, only the first N setItem calls throw, then quota lifts. */
  public quotaFailsRemaining = 0;

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key)
      ? this.store[key]
      : null;
  }

  setItem(key: string, value: string): void {
    if (this.quotaExceeded || this.quotaFailsRemaining > 0) {
      if (this.quotaFailsRemaining > 0) this.quotaFailsRemaining--;
      const err = new DOMException("QuotaExceededError", "QuotaExceededError");
      throw err;
    }
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  _getAll(): Record<string, string> {
    return { ...this.store };
  }
}

let mockStorage: MockLocalStorage;

beforeEach(() => {
  mockStorage = new MockLocalStorage();
  // Attach to global so the module under test picks it up
  (global as unknown as { localStorage: MockLocalStorage }).localStorage =
    mockStorage;
});

afterEach(() => {
  delete (global as unknown as { localStorage?: MockLocalStorage }).localStorage;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// safeLocalStorageSet — basic write
// ---------------------------------------------------------------------------

describe("safeLocalStorageSet — basic write", () => {
  it("writes a serialized JSON string to localStorage", () => {
    safeLocalStorageSet("cravingCreator.cache.v1", { meal: "tacos" });
    const raw = mockStorage.getItem("cravingCreator.cache.v1");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.meal).toBe("tacos");
  });

  it("injects generatedAtISO when not already present", () => {
    const before = Date.now();
    safeLocalStorageSet("cravingCreator.cache.v1", { meal: "tacos" });
    const parsed = JSON.parse(
      mockStorage.getItem("cravingCreator.cache.v1")!
    );
    const written = new Date(parsed.generatedAtISO).getTime();
    expect(written).toBeGreaterThanOrEqual(before);
    expect(written).toBeLessThanOrEqual(Date.now());
  });

  it("preserves a caller-supplied generatedAtISO without overwriting it", () => {
    const ts = "2024-01-01T00:00:00.000Z";
    safeLocalStorageSet("cravingCreator.cache.v1", {
      meal: "tacos",
      generatedAtISO: ts,
    });
    const parsed = JSON.parse(
      mockStorage.getItem("cravingCreator.cache.v1")!
    );
    expect(parsed.generatedAtISO).toBe(ts);
  });

  it("wraps array values in a { data, generatedAtISO } envelope", () => {
    const before = Date.now();
    safeLocalStorageSet("cravingCreator.options.v1", [1, 2, 3]);
    const parsed = JSON.parse(
      mockStorage.getItem("cravingCreator.options.v1")!
    );
    expect(Array.isArray(parsed)).toBe(false);
    expect(parsed.data).toEqual([1, 2, 3]);
    expect(new Date(parsed.generatedAtISO).getTime()).toBeGreaterThanOrEqual(before);
  });
});

// ---------------------------------------------------------------------------
// safeLocalStorageSet — temporary imageUrl stripping
// ---------------------------------------------------------------------------

describe("safeLocalStorageSet — temporary imageUrl stripping", () => {
  it("strips a top-level base64 imageUrl before writing", () => {
    safeLocalStorageSet("cravingCreator.cache.v1", {
      meal: "tacos",
      imageUrl: "data:image/png;base64,AAAA",
    });
    const parsed = JSON.parse(
      mockStorage.getItem("cravingCreator.cache.v1")!
    );
    expect(parsed.imageUrl).toBeUndefined();
    expect(parsed.meal).toBe("tacos");
  });

  it("strips a temporary DALL-E CDN imageUrl before writing and rehydrates without it", () => {
    safeLocalStorageSet("cravingCreator.cache.v1", {
      meal: "tacos",
      imageUrl:
        "https://oaidalleapiprodscus.blob.core.windows.net/private/img-expiring.png",
    });

    const parsed = JSON.parse(
      mockStorage.getItem("cravingCreator.cache.v1")!
    );
    expect(parsed.imageUrl).toBeUndefined();
  });

  it("keeps a permanent Object Storage imageUrl intact", () => {
    safeLocalStorageSet("cravingCreator.cache.v1", {
      meal: "tacos",
      imageUrl: "/public-objects/meal-images/tacos.png",
    });
    const parsed = JSON.parse(
      mockStorage.getItem("cravingCreator.cache.v1")!
    );
    expect(parsed.imageUrl).toBe("/public-objects/meal-images/tacos.png");
  });

  it("keeps an unrelated https imageUrl intact", () => {
    safeLocalStorageSet("cravingCreator.cache.v1", {
      meal: "tacos",
      imageUrl: "https://cdn.example.com/img.png",
    });
    const parsed = JSON.parse(
      mockStorage.getItem("cravingCreator.cache.v1")!
    );
    expect(parsed.imageUrl).toBe("https://cdn.example.com/img.png");
  });

  it("strips temporary imageUrl nested inside generatedMeal", () => {
    safeLocalStorageSet("fridge-rescue-cached-state", {
      generatedMeal: {
        name: "Salad",
        imageUrl:
          "https://oaidalleapiprodscus.blob.core.windows.net/private/salad.png",
      },
    });
    const parsed = JSON.parse(
      mockStorage.getItem("fridge-rescue-cached-state")!
    );
    expect(parsed.generatedMeal.imageUrl).toBeUndefined();
    expect(parsed.generatedMeal.name).toBe("Salad");
  });

  it("strips base64 imageUrls inside generatedMeals array", () => {
    safeLocalStorageSet("sushiCreator.cache.v1", {
      generatedMeals: [
        { name: "Roll A", imageUrl: "data:image/png;base64,AAAA" },
        { name: "Roll B", imageUrl: "https://cdn.example.com/b.png" },
      ],
    });
    const parsed = JSON.parse(
      mockStorage.getItem("sushiCreator.cache.v1")!
    );
    expect(parsed.generatedMeals[0].imageUrl).toBeUndefined();
    expect(parsed.generatedMeals[1].imageUrl).toBe(
      "https://cdn.example.com/b.png"
    );
  });
});

// ---------------------------------------------------------------------------
// safeLocalStorageSet — QuotaExceededError path 1: clears & retries
// ---------------------------------------------------------------------------

describe("safeLocalStorageSet — quota exceeded, clear and retry succeeds", () => {
  it("clears OTHER builder caches when first write throws QuotaExceededError", () => {
    // Pre-populate sibling caches so we can confirm they get cleared
    mockStorage.setItem("fridge-rescue-cached-state", "existing1");
    mockStorage.setItem("sushiCreator.cache.v1", "existing2");

    // Only the first setItem call for our target key throws; retry succeeds
    mockStorage.quotaFailsRemaining = 1;

    safeLocalStorageSet("cravingCreator.cache.v1", { meal: "tacos" });

    // The target key should have been written on the retry
    const raw = mockStorage.getItem("cravingCreator.cache.v1");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).meal).toBe("tacos");

    // Sibling caches should have been evicted
    expect(mockStorage.getItem("fridge-rescue-cached-state")).toBeNull();
    expect(mockStorage.getItem("sushiCreator.cache.v1")).toBeNull();
  });

  it("does NOT remove the key being written when evicting siblings", () => {
    // Pre-populate the target key itself (old value)
    mockStorage.setItem("cravingCreator.cache.v1", "old-value");
    mockStorage.setItem("fridge-rescue-cached-state", "sibling");

    mockStorage.quotaFailsRemaining = 1;

    safeLocalStorageSet("cravingCreator.cache.v1", { meal: "pizza" });

    // New value should be written
    const parsed = JSON.parse(
      mockStorage.getItem("cravingCreator.cache.v1")!
    );
    expect(parsed.meal).toBe("pizza");
  });
});

// ---------------------------------------------------------------------------
// safeLocalStorageSet — QuotaExceededError path 2: silent failure
// ---------------------------------------------------------------------------

describe("safeLocalStorageSet — quota exceeded even after clearing, fails silently", () => {
  it("does not throw when both the first write and the retry throw QuotaExceededError", () => {
    // Every setItem call throws — permanent quota exhaustion
    mockStorage.quotaExceeded = true;

    expect(() => {
      safeLocalStorageSet("cravingCreator.cache.v1", { meal: "tacos" });
    }).not.toThrow();
  });

  it("leaves other pre-existing keys untouched on permanent quota failure", () => {
    // Populate a completely unrelated key (not a builder cache)
    const directStorage = mockStorage as unknown as {
      store: Record<string, string>;
    };
    directStorage.store["some-other-key"] = "preserved";

    mockStorage.quotaExceeded = true;

    safeLocalStorageSet("cravingCreator.cache.v1", { meal: "tacos" });

    expect(mockStorage.getItem("some-other-key")).toBe("preserved");
  });
});

// ---------------------------------------------------------------------------
// evictStaleBuilderCaches
// ---------------------------------------------------------------------------

describe("evictStaleBuilderCaches", () => {
  it("removes entries older than 24 hours", () => {
    mockStorage.setItem(
      "cravingCreator.cache.v1",
      JSON.stringify({ meal: "old", generatedAtISO: isoHoursAgo(25) })
    );

    evictStaleBuilderCaches();

    expect(mockStorage.getItem("cravingCreator.cache.v1")).toBeNull();
  });

  it("keeps entries younger than 24 hours", () => {
    mockStorage.setItem(
      "cravingCreator.cache.v1",
      JSON.stringify({ meal: "fresh", generatedAtISO: isoHoursAgo(1) })
    );

    evictStaleBuilderCaches();

    expect(mockStorage.getItem("cravingCreator.cache.v1")).not.toBeNull();
  });

  it("keeps entries exactly at 24 hours (boundary: not strictly greater)", () => {
    // 24 h exactly — MAX_AGE_MS is not exceeded
    mockStorage.setItem(
      "cravingCreator.cache.v1",
      JSON.stringify({ meal: "boundary", generatedAtISO: isoHoursAgo(24) })
    );

    evictStaleBuilderCaches();

    // Should still be present (age === MAX_AGE_MS, not > MAX_AGE_MS)
    expect(mockStorage.getItem("cravingCreator.cache.v1")).not.toBeNull();
  });

  it("removes entries older than 24 h on all known BUILDER_CACHE_KEYS", () => {
    for (const key of BUILDER_CACHE_KEYS) {
      mockStorage.setItem(
        key,
        JSON.stringify({ generatedAtISO: isoHoursAgo(48) })
      );
    }

    evictStaleBuilderCaches();

    for (const key of BUILDER_CACHE_KEYS) {
      expect(mockStorage.getItem(key)).toBeNull();
    }
  });

  it("silently removes corrupt (unparseable) entries", () => {
    mockStorage.setItem("fridge-rescue-cached-state", "not-valid-json{{{}");

    expect(() => evictStaleBuilderCaches()).not.toThrow();

    // Corrupt entry should be removed
    expect(mockStorage.getItem("fridge-rescue-cached-state")).toBeNull();
  });

  it("skips keys that have no value in localStorage", () => {
    // Nothing written — should not throw
    expect(() => evictStaleBuilderCaches()).not.toThrow();
  });

  it("keeps entries that have no generatedAtISO field (cannot determine age)", () => {
    mockStorage.setItem(
      "cravingCreator.cache.v1",
      JSON.stringify({ meal: "no-timestamp" })
    );

    evictStaleBuilderCaches();

    // Entry without generatedAtISO is left alone — can't determine if stale
    expect(mockStorage.getItem("cravingCreator.cache.v1")).not.toBeNull();
  });

  it("is called automatically by safeLocalStorageSet (stale sibling gets cleaned up)", () => {
    // Pre-populate a stale sibling cache
    mockStorage.setItem(
      "fridge-rescue-cached-state",
      JSON.stringify({ meal: "stale", generatedAtISO: isoHoursAgo(30) })
    );

    // Write to a different key — should trigger stale eviction as a side effect
    safeLocalStorageSet("cravingCreator.cache.v1", { meal: "fresh" });

    // Stale sibling should now be gone
    expect(mockStorage.getItem("fridge-rescue-cached-state")).toBeNull();
    // Target key should be written
    expect(mockStorage.getItem("cravingCreator.cache.v1")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// migrateLegacyBuilderCaches — boot-time cleanup of pre-fix entries
// ---------------------------------------------------------------------------

describe("migrateLegacyBuilderCaches", () => {
  it("removes object entries that have no generatedAtISO field", () => {
    mockStorage.setItem(
      "cravingCreator.cache.v1",
      JSON.stringify({ meal: "legacy-no-timestamp" })
    );

    migrateLegacyBuilderCaches();

    expect(mockStorage.getItem("cravingCreator.cache.v1")).toBeNull();
  });

  it("removes legacy entries across all known BUILDER_CACHE_KEYS", () => {
    for (const key of BUILDER_CACHE_KEYS) {
      mockStorage.setItem(key, JSON.stringify({ meal: "old" }));
    }

    migrateLegacyBuilderCaches();

    for (const key of BUILDER_CACHE_KEYS) {
      expect(mockStorage.getItem(key)).toBeNull();
    }
  });

  it("keeps entries that already have generatedAtISO", () => {
    mockStorage.setItem(
      "cravingCreator.cache.v1",
      JSON.stringify({ meal: "fresh", generatedAtISO: isoHoursAgo(1) })
    );

    migrateLegacyBuilderCaches();

    expect(mockStorage.getItem("cravingCreator.cache.v1")).not.toBeNull();
  });

  it("removes legacy raw array entries (written before the envelope fix)", () => {
    // Raw arrays were written before safeLocalStorageSet wrapped them in an envelope
    mockStorage.setItem(
      "cravingCreator.options.v1",
      JSON.stringify(["opt-a", "opt-b"])
    );

    migrateLegacyBuilderCaches();

    // Raw arrays have no generatedAtISO, so they are treated as pre-fix legacy entries
    expect(mockStorage.getItem("cravingCreator.options.v1")).toBeNull();
  });

  it("keeps array entries written via safeLocalStorageSet (envelope format survives migration)", () => {
    // safeLocalStorageSet wraps arrays as { data: [...], generatedAtISO }
    safeLocalStorageSet("cravingCreator.options.v1", ["opt-a", "opt-b"]);

    migrateLegacyBuilderCaches();

    // The envelope has generatedAtISO, so it is not treated as legacy
    const raw = mockStorage.getItem("cravingCreator.options.v1");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.data).toEqual(["opt-a", "opt-b"]);
  });

  it("skips keys with no value in localStorage", () => {
    expect(() => migrateLegacyBuilderCaches()).not.toThrow();
  });

  it("silently removes corrupt (unparseable) entries", () => {
    mockStorage.setItem("fridge-rescue-cached-state", "not-valid-json{{{}");

    expect(() => migrateLegacyBuilderCaches()).not.toThrow();

    expect(mockStorage.getItem("fridge-rescue-cached-state")).toBeNull();
  });

  it("does not disturb non-builder-cache keys in localStorage", () => {
    const directStorage = mockStorage as unknown as {
      store: Record<string, string>;
    };
    directStorage.store["some-unrelated-key"] = "preserved";

    mockStorage.setItem(
      "cravingCreator.cache.v1",
      JSON.stringify({ meal: "legacy" })
    );

    migrateLegacyBuilderCaches();

    expect(mockStorage.getItem("some-unrelated-key")).toBe("preserved");
  });

  it("is idempotent — running it twice does not throw or corrupt fresh entries", () => {
    mockStorage.setItem(
      "cravingCreator.cache.v1",
      JSON.stringify({ meal: "fresh", generatedAtISO: isoHoursAgo(2) })
    );

    migrateLegacyBuilderCaches();
    migrateLegacyBuilderCaches();

    // The fresh entry should still be present after both passes
    const raw = mockStorage.getItem("cravingCreator.cache.v1");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).meal).toBe("fresh");
  });
});

// ---------------------------------------------------------------------------
// safeLocalStorageGetArray — reads envelope or legacy raw array
// ---------------------------------------------------------------------------

describe("safeLocalStorageGetArray", () => {
  it("returns the data array from an envelope written by safeLocalStorageSet", () => {
    safeLocalStorageSet("cravingCreator.options.v1", ["opt-a", "opt-b"]);

    const result = safeLocalStorageGetArray("cravingCreator.options.v1");
    expect(result).toEqual(["opt-a", "opt-b"]);
  });

  it("returns a legacy raw array for backward compatibility", () => {
    // Simulate a pre-fix raw array still in storage
    mockStorage.setItem(
      "cravingCreator.options.v1",
      JSON.stringify(["legacy-a", "legacy-b"])
    );

    const result = safeLocalStorageGetArray("cravingCreator.options.v1");
    expect(result).toEqual(["legacy-a", "legacy-b"]);
  });

  it("returns an empty array when the key is absent", () => {
    expect(safeLocalStorageGetArray("cravingCreator.options.v1")).toEqual([]);
  });

  it("returns an empty array for corrupt entries", () => {
    mockStorage.setItem("cravingCreator.options.v1", "not-valid-json{{{}");
    expect(safeLocalStorageGetArray("cravingCreator.options.v1")).toEqual([]);
  });

  it("returns an empty array when the stored value is a plain object (not an array or envelope)", () => {
    mockStorage.setItem(
      "cravingCreator.options.v1",
      JSON.stringify({ notAnArray: true })
    );
    expect(safeLocalStorageGetArray("cravingCreator.options.v1")).toEqual([]);
  });
});
