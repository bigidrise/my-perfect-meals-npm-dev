/**
 * nutritionStateCache.ts
 *
 * Module-level cache for DailyNutritionState, isolated from React so it can
 * be imported in tests without pulling in AuthContext or any other React context.
 *
 * Cache keys are scoped to the authenticated viewer's user ID so two accounts
 * sharing a browser tab never see each other's health data.
 */

import type { DailyNutritionState } from "../../../shared/dailyNutritionPrescription";

/**
 * Module-level cache keyed by "userId:dateISO:clientId".
 *
 * Exported for tests only; application code should never write to this directly.
 */
export const _nutritionStateCache = new Map<string, DailyNutritionState>();

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
