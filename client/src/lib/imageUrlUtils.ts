/**
 * imageUrlUtils — canonical image URL classification for My Perfect Meals
 *
 * All code that needs to decide whether a meal image URL is permanent,
 * temporary, or safe to persist must use these functions.
 *
 * DO NOT duplicate these checks inline.  Every builder, hook, and save
 * flow must import from here so the definition stays in one place.
 *
 * Architecture note (Phase 2 of Unified Meal Image Pipeline):
 *   generateMealImageUnified() already handles permanent storage before
 *   returning. The URL it gives back is always one of the permanent prefixes
 *   below, or null on failure.  Temporary / base64 URLs should never reach
 *   the client in normal operation, but we guard against them defensively.
 */

/** Relative path prefixes used by MPM-controlled permanent object storage */
const PERMANENT_PREFIXES = ['/public-objects/', '/images/', '/assets/'];

/** Hostname substrings that indicate MPM-controlled S3 storage */
const PERMANENT_HOST_PATTERNS = ['amazonaws.com'];

/**
 * Returns true when `url` is a permanent, MPM-controlled image URL.
 * These URLs are safe to persist in the database, localStorage, and board
 * state — they will not expire.
 */
export function isPermanentImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (PERMANENT_PREFIXES.some((p) => url.startsWith(p))) return true;
  if (PERMANENT_HOST_PATTERNS.some((p) => url.includes(p))) return true;
  return false;
}

/**
 * Returns true when `url` should NOT be persisted to localStorage or DB:
 *  - base64 data URIs  (~1–2 MB each — exhaust 5 MB localStorage quickly)
 *  - raw OpenAI CDN URLs (expire within ~1 hour)
 */
export function isTemporaryImageUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  if (url.startsWith('data:')) return true;
  const TEMP_HOST_PATTERNS = [
    'oaidalleapiprodscus',
    'blob.core.windows.net',
    'openai.com',
  ];
  return TEMP_HOST_PATTERNS.some((p) => url.includes(p));
}

/**
 * Guard for `onImageReady` callbacks and any hook that patches imageUrl into
 * existing state.  Returns true when the *existing* URL must be protected and
 * the incoming URL should be silently discarded.
 *
 * Rules:
 *   1. Same URL → no-op (avoid unnecessary re-renders).
 *   2. Current URL is already permanent → protect it; don't overwrite with a
 *      new fetch result (which is just the same image regenerated anyway).
 *
 * This is the function that replaced the duplicated inline condition:
 *   `if (cur === imageUrl) return prev;`
 *   `if (cur && (cur.startsWith('/public-objects/') || cur.includes('amazonaws.com'))) return prev;`
 */
export function shouldProtectExistingImage(
  current: string | null | undefined,
  incoming: string | null | undefined,
): boolean {
  if (!current) return false;          // no image yet — allow any incoming URL
  if (current === incoming) return true; // same URL — no-op
  return isPermanentImageUrl(current);  // permanent image — protect it
}
