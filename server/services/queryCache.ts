/**
 * Lightweight in-process TTL cache for polling endpoints.
 *
 * Purpose: reduce DB pressure on dashboard background polls
 * (pattern-alerts, user/profile, pro/tablet/unread-summary, client/tablet)
 * which fire every 30 s and each hold a DB connection for 500–900 ms.
 *
 * A 15–20 s TTL means polling clients get fresh data on every other poll at
 * worst, while the pool is never fully saturated by these background reads.
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

/** Return a cached value, or null if missing / expired. */
export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

/** Store a value with a TTL in milliseconds. */
export function setCached<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Delete all entries whose key starts with `prefix`.
 * Call this from write endpoints so the next read gets fresh data.
 */
export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/** Convenience: cache the result of an async function, or compute and store it. */
export async function getOrSet<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== null) return hit;
  const value = await fn();
  setCached(key, value, ttlMs);
  return value;
}

// Evict expired entries every 60 s to prevent unbounded growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) store.delete(key);
  }
}, 60_000);
