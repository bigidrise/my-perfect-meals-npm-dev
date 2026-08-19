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
 *  2. Strip temporary/base64 imageUrls and other large optional fields if near the limit
 *  3. Evict stale builder caches (> 24 h) before attempting a write
 *  4. If still over quota, clear ALL other builder caches and retry once
 *  5. Inject generatedAtISO timestamp so entries can be TTL-evicted later
 */


import { isTemporaryImageUrl } from "./imageUrlUtils";

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
 * Strip temporary image URLs and other oversized optional fields from a value
 * before it is serialized to localStorage.
 *
 * Rules:
 *  - temporary imageUrl (data URI or expiring first-party CDN URL) → undefined
 *    (re-fetched on mount)
 *  - Applied recursively to nested generatedMeal / generatedMeals arrays
 */
function stripLargeFields(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;

  if (Array.isArray(value)) {
    return value.map(stripLargeFields);
  }

  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = { ...obj };

  // Never persist temporary image URLs. DALL-E CDN URLs expire after roughly
  // an hour; permanent Object Storage paths are intentionally kept.
  if (typeof result.imageUrl === "string" && isTemporaryImageUrl(result.imageUrl)) {
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
 * One-time boot migration: remove builder cache entries that are missing a
 * `generatedAtISO` timestamp.
 *
 * Entries written before `safeLocalStorageSet` began injecting timestamps
 * (either raw objects or raw arrays) have no `generatedAtISO` and cannot be
 * TTL-evicted by `evictStaleBuilderCaches`. This function removes them so they
 * don't linger indefinitely.
 *
 * Safe to call on every boot:
 *  - Post-fix object entries already have `generatedAtISO` → kept.
 *  - Post-fix array entries are stored as `{ data, generatedAtISO }` → kept.
 *  - Legacy entries (raw objects or raw arrays without the field) → removed.
 */
export function migrateLegacyBuilderCaches(): void {
  for (const key of BUILDER_CACHE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      // Any entry written by safeLocalStorageSet after the fix will be a plain
      // object with a generatedAtISO field (arrays are wrapped in an envelope).
      // Anything else — raw arrays, legacy objects without the field — is stale.
      const hasTimestamp =
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        !!parsed.generatedAtISO;
      if (!hasTimestamp) {
        localStorage.removeItem(key);
      }
    } catch {
      // Corrupt entry — remove it
      try { localStorage.removeItem(key); } catch {}
    }
  }
}

/**
 * Read an array-valued builder cache written by `safeLocalStorageSet`.
 *
 * `safeLocalStorageSet` wraps raw arrays in `{ data: [...], generatedAtISO }`
 * so they receive a TTL timestamp. This helper transparently unwraps that
 * envelope. It also accepts the legacy raw-array format so that any entry that
 * survived before `migrateLegacyBuilderCaches` ran is still readable.
 *
 * Returns an empty array on any error or cache miss.
 */
export function safeLocalStorageGetArray<T = unknown>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // New envelope format: { data: [...], generatedAtISO: "..." }
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as Record<string, unknown>).data)
    ) {
      return (parsed as { data: T[] }).data;
    }
    // Legacy fallback: raw array written before the envelope was introduced
    if (Array.isArray(parsed)) return parsed as T[];
    return [];
  } catch {
    return [];
  }
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
 * - Strips temporary/base64 imageUrls (and other large fields) before serializing.
 * - Evicts stale builder caches (>24 h) before each write.
 * - If a QuotaExceededError is thrown, clears all OTHER builder caches and
 *   retries once.
 * - Never throws — falls back silently to protect app stability.
 */
export function safeLocalStorageSet(key: string, value: unknown): void {
  try {
    // 1. Ensure a timestamp exists for future TTL eviction.
    //    - Plain objects: inject generatedAtISO directly if not already present.
    //    - Arrays: wrap in { data: [...], generatedAtISO } so they are also
    //      timestamped. Readers must unwrap via safeLocalStorageGetArray().
    let toWrite: unknown = value;
    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        toWrite = { data: value, generatedAtISO: new Date().toISOString() };
      } else {
        const obj = value as Record<string, unknown>;
        if (!obj.generatedAtISO) {
          toWrite = { ...obj, generatedAtISO: new Date().toISOString() };
        }
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
    // Use process.env (works in Node/Jest and in Vite browser builds) instead
    // of import.meta.env so this module stays test-compilable.
    if (process.env.NODE_ENV === "development") {
      console.warn("[safeLocalStorageSet] Write failed for key:", key, err);
    } else {
      try {
        // Dynamic import keeps sentry.ts (which uses import.meta) out of the
        // module's static dependency graph — tests never evaluate it.
        import("./sentry").then(({ Sentry }) => {
          Sentry.addBreadcrumb({
            category: "storage",
            message: `safeLocalStorageSet failed for key: ${key}`,
            level: "warning",
            data: { key, error: err instanceof Error ? err.message : String(err) },
          });
        }).catch(() => {
          // Sentry unavailable — remain non-throwing
        });
      } catch {
        // Non-browser environment (e.g. SSR/tests) — ignore
      }
    }
  }
}
