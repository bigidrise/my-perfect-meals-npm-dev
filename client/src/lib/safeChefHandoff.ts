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
export function writeChefHandoffMeal(meal: Record<string, unknown>): void {
  const safe = { ...meal, imageUrl: safeLocalStorageImageUrl(meal.imageUrl as string | null | undefined) };
  const json = JSON.stringify(safe);
  try {
    localStorage.setItem("mpm_chefs_kitchen_meal", json);
  } catch {
    // Storage full — clear stale Chef keys and retry once
    localStorage.removeItem("mpm_chefs_kitchen_meal");
    localStorage.removeItem("mpm_chefs_kitchen_external_prepare");
    localStorage.removeItem("mpm_chefs_kitchen_origin");
    try { localStorage.setItem("mpm_chefs_kitchen_meal", json); } catch { /* give up */ }
  }
}
