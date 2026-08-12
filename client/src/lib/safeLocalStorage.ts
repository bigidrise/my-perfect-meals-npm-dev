/**
 * safeLocalStorage.ts
 *
 * Safe localStorage utilities for builder meal caches.
 *
 * Problems solved:
 *  - 5 MB mobile quota fills up when many builders accumulate full meal objects
 *  - No size cap means one large payload can trigger QuotaExceededError silently
 *  - Stale entries (yesterday's craving) persist indefinitely without TTL
 *
 * Strategy:
 *  1. Estimate payload size before writing
 *  2. Strip base64 imageUrls and other large optional fields if near the limit
 *  3. Evict stale builder caches (> 24 h) before attempting a write
 *  4. If still over quota, clear ALL other builder caches and retry once
 *  5. Inject generatedAtISO timestamp so entries can be TTL-evicted later
 */

import { Sentry } from "./sentry";

/** All known builder cache keys — used for cross-eviction when one is over quota. */
export const BUILDER_CACHE_KEYS: readonly string[] = [
  "fridge-rescue-cached-state",
  "cravingCreator.cache.v1",
  "cravingCreator.options.v1",
  "sushiCreator.cache.v1",
  "mpm_beverage_creator_result",
  "mpm_athlete_beverage_result",
  "mpm_dessert_creator_result",
  "ai-meal-creator-cached-meals",
  "ai-athlete-meal-creator-cached-meals",
  "diabetic-ai-meal-creator-cached-meals",
  "anti-inflammatory-ai-meal-creator-cached-meals",
];

/** Max age before a cache entry is considered stale and eligible for eviction. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Strip base64 data URIs and other oversized optional fields from a value
 * before it is serialized to localStorage.
 *
 * Rules:
 *  - imageUrl that starts with "data:" → undefined (too large, re-fetched on mount)
 *  - Applied recursively to nested generatedMeal / generatedMeals arrays
 */
function stripLargeFields(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;

  if (Array.isArray(value)) {
    return value.map(stripLargeFields);
  }

  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = { ...obj };

  // Strip base64 imageUrls — DALL-E/S3 URLs are fine and should be kept
  if (typeof result.imageUrl === "string" && result.imageUrl.startsWith("data:")) {
    result.imageUrl = undefined;
  }

  // Recurse into nested meal structures
  if (result.generatedMeal && typeof result.generatedMeal === "object") {
    result.generatedMeal = stripLargeFields(result.generatedMeal);
  }
  if (Array.isArray(result.generatedMeals)) {
    result.generatedMeals = result.generatedMeals.map(stripLargeFields);
  }

  return result;
}

/**
 * Remove all stale builder cache entries (those older than MAX_AGE_MS).
 * Called automatically by safeLocalStorageSet before each write.
 */
export function evictStaleBuilderCaches(): void {
  const now = Date.now();
  for (const key of BUILDER_CACHE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.generatedAtISO) {
        const ageMs = now - new Date(parsed.generatedAtISO).getTime();
        if (ageMs > MAX_AGE_MS) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Corrupt entry — remove it
      try { localStorage.removeItem(key); } catch {}
    }
  }
}

/**
 * Clear all builder caches except the one currently being written.
 * Last resort before giving up on a write.
 */
function clearOtherBuilderCaches(exceptKey: string): void {
  for (const key of BUILDER_CACHE_KEYS) {
    if (key !== exceptKey) {
      try { localStorage.removeItem(key); } catch {}
    }
  }
}

/**
 * Drop-in replacement for `localStorage.setItem` for builder meal caches.
 *
 * Usage:
 *   safeLocalStorageSet("fridge-rescue-cached-state", stateObject);
 *
 * - Automatically injects `generatedAtISO` (ISO timestamp) if not already present
 *   so that entries can be TTL-evicted on the next visit.
 * - Strips base64 imageUrls (and other large fields) before serializing.
 * - Evicts stale builder caches (>24 h) before each write.
 * - If a QuotaExceededError is thrown, clears all OTHER builder caches and
 *   retries once.
 * - Never throws — falls back silently to protect app stability.
 */
export function safeLocalStorageSet(key: string, value: unknown): void {
  try {
    // 1. Ensure a timestamp exists for future TTL eviction
    let toWrite: unknown = value;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if (!obj.generatedAtISO) {
        toWrite = { ...obj, generatedAtISO: new Date().toISOString() };
      }
    }

    // 2. Strip base64 and other oversized optional fields
    toWrite = stripLargeFields(toWrite);

    // 3. Evict stale entries from other builders first (frees space proactively)
    evictStaleBuilderCaches();

    // 4. Try writing
    const serialized = JSON.stringify(toWrite);
    try {
      localStorage.setItem(key, serialized);
    } catch {
      // 5. Quota hit — clear other builder caches and retry once
      clearOtherBuilderCaches(key);
      localStorage.setItem(key, serialized);
    }
  } catch (err) {
    // Final fallback: give up silently — don't crash the app.
    // Emit observability so unexpected storage failures are surfaced.
    if (import.meta.env.DEV) {
      console.warn("[safeLocalStorageSet] Write failed for key:", key, err);
    } else {
      try {
        Sentry.addBreadcrumb({
          category: "storage",
          message: `safeLocalStorageSet failed for key: ${key}`,
          level: "warning",
          data: { key, error: err instanceof Error ? err.message : String(err) },
        });
      } catch {
        // Sentry itself failed — remain non-throwing
      }
    }
  }
}
