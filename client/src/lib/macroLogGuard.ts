/**
 * macroLogGuard.ts
 *
 * Single source of truth for "has this meal already been logged to macros today?"
 *
 * Business rule:  A meal may be logged at most once per user, per meal, per day.
 *
 * Storage key format (matches the original LogToMacrosButton convention so that
 * meals logged before this centralisation are still recognised):
 *   macros.logged.<userId>.<mealId>.<YYYY-MM-DD>
 *
 * All meal-card components that POST to /api/macros/log should call these
 * helpers instead of rolling their own localStorage logic.
 */

import { localYYYYMMDD } from "@/utils/dates";

function buildKey(userId: string, mealId: string): string {
  const day = localYYYYMMDD(new Date());
  return `macros.logged.${userId}.${mealId}.${day}`;
}

/**
 * Returns true when the meal has NOT yet been logged today — i.e. logging is allowed.
 * Fails open (returns true) when userId or mealId are missing, so the button
 * stays usable in edge-case states rather than silently blocking the user.
 */
export function canLogMealToMacros(userId: string, mealId: string): boolean {
  if (!userId || !mealId) return true;
  return localStorage.getItem(buildKey(userId, mealId)) !== "1";
}

/**
 * Persists the "logged" state for the current day.
 * Call this immediately after a successful POST to /api/macros/log.
 */
export function markMealLogged(userId: string, mealId: string): void {
  if (!userId || !mealId) return;
  localStorage.setItem(buildKey(userId, mealId), "1");
}

/**
 * Returns "logged" | "idle" — useful for initialising component state on mount.
 */
export function getMealLogStatus(
  userId: string,
  mealId: string
): "idle" | "logged" {
  return canLogMealToMacros(userId, mealId) ? "idle" : "logged";
}

/**
 * Produces a deterministic fingerprint for generated meals that may not have a
 * stable database ID.  Use this as the mealId argument when meal.id is absent.
 *
 * The fingerprint encodes name + rounded calories + rounded protein so that two
 * different generated meals are unlikely to collide within the same day.
 */
export function fingerprintMeal(
  name: string,
  calories: number,
  protein: number
): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 40);
  return `fp_${slug}_${Math.round(calories)}cal_${Math.round(protein)}p`;
}
