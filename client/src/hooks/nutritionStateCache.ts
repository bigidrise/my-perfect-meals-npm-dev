/**
 * nutritionStateCache.ts
 *
 * Module-level cache for DailyNutritionState, isolated from React so it can
 * be imported in tests without pulling in AuthContext or any other React context.
 *
 * Cache keys are scoped to the authenticated viewer's user ID so two accounts
 * sharing a browser tab never see each other's health data.
 *
 * Date-staleness guard
 * --------------------
 * Each entry is tagged with the local calendar date (YYYY-MM-DD) on which it
 * was written.  When the cache is read, the write date is compared against
 * today's local date; if they differ the entry is treated as a miss.
 * This prevents a user who leaves a builder open overnight from briefly seeing
 * yesterday's macro targets before the fresh fetch resolves.
 */

import type { DailyNutritionState } from "../../../shared/dailyNutritionPrescription";

/**
 * Module-level cache keyed by "userId:dateISO:clientId".
 *
 * Exported for tests only; application code should use getCachedNutritionState
 * and setCachedNutritionState so the date-staleness guard is always applied.
 */
export const _nutritionStateCache = new Map<string, DailyNutritionState>();

/**
 * Tracks the local calendar date (YYYY-MM-DD) on which each cache entry was
 * written.  Exported for tests that need to inject a past date to verify the
 * staleness guard.
 */
export const _nutritionStateCacheWriteDate = new Map<string, string>();

/** Returns today's date in YYYY-MM-DD local time. */
function localDateISO(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, "0")}-` +
    `${String(d.getDate()).padStart(2, "0")}`
  );
}

/**
 * Stable cache key used by the hook and its tests.
 *
 * @param userId   - The authenticated viewer's own user ID. Must be non-empty.
 * @param dateISO  - Calendar date (YYYY-MM-DD).
 * @param clientId - Optional ProCare target client ID.
 */
export function _nutritionStateCacheKey(
  userId: string,
  dateISO: string,
  clientId?: string | null,
): string {
  return `${userId}:${dateISO}:${clientId ?? ""}`;
}

/**
 * Reads from the cache only when the entry was written on today's local
 * calendar date.  An entry written on a previous day returns undefined so the
 * hook falls through to a fresh network fetch.
 */
export function getCachedNutritionState(
  key: string,
): DailyNutritionState | undefined {
  const entry = _nutritionStateCache.get(key);
  if (!entry) return undefined;
  const writeDate = _nutritionStateCacheWriteDate.get(key);
  if (!writeDate || writeDate !== localDateISO()) return undefined;
  return entry;
}

/**
 * Writes to the cache and tags the entry with today's local calendar date so
 * the staleness guard can invalidate it after midnight.
 */
export function setCachedNutritionState(
  key: string,
  value: DailyNutritionState,
): void {
  _nutritionStateCache.set(key, value);
  _nutritionStateCacheWriteDate.set(key, localDateISO());
}
