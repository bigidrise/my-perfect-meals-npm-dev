/**
 * safeChefHandoff.ts
 *
 * Shared helper for all "Prepare with Chef" / "Guided Cooking" handoff paths.
 * Strips unsafe imageUrls before writing to localStorage so we never exceed
 * the 5 MB quota or hand Chef's Kitchen an expired DALL-E URL.
 */

/**
 * Returns the imageUrl if it is safe to store in localStorage, or null if it
 * should be dropped.  Unsafe = base64 data URI (huge) or a temporary DALL-E
 * CDN URL (expires within ~1 h and cannot be refreshed from the client).
 */
export function safeLocalStorageImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("data:")) return null;            // base64 — too large
  if (url.includes("oaidalleapiprodscus")) return null; // expired DALL-E URL
  return url;
}

/**
 * Write a meal payload to the Chef's Kitchen localStorage slot.
 * Automatically strips unsafe imageUrls and handles QuotaExceededError by
 * clearing stale Chef keys and retrying once before giving up gracefully.
 */
export function writeChefHandoffMeal<T extends { imageUrl?: string | null | undefined }>(meal: T): void {
  const safe = { ...meal, imageUrl: safeLocalStorageImageUrl(meal.imageUrl) };
  const json = JSON.stringify(safe);
  try {
    localStorage.setItem("mpm_chefs_kitchen_meal", json);
  } catch {
    // Storage full — clear stale Chef keys and retry once
    try {
      localStorage.removeItem("mpm_chefs_kitchen_meal");
      localStorage.removeItem("mpm_chefs_kitchen_external_prepare");
      localStorage.removeItem("mpm_chefs_kitchen_origin");
      localStorage.setItem("mpm_chefs_kitchen_meal", json);
    } catch {
      // Unavailable storage is non-blocking; Chef's Kitchen can open without a meal.
    }
  }
}

/**
 * Persist an external "Prepare with Chef" launch without letting unavailable
 * localStorage block navigation. The meal is always written first so its
 * quota-recovery path has a chance to clear stale Chef keys before launch state.
 */
export function writeChefPrepareHandoff<T extends { imageUrl?: string | null | undefined }>(
  meal: T,
  options: { origin?: string; clearPrep?: boolean } = {},
): void {
  writeChefHandoffMeal(meal);
  try {
    localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");
    if (options.origin) {
      localStorage.setItem("mpm_chefs_kitchen_origin", options.origin);
    }
    if (options.clearPrep) {
      localStorage.removeItem("mpm_chefs_kitchen_prep");
    }
  } catch {
    // Chef's Kitchen handles a missing handoff meal, so navigation must proceed.
  }
}
