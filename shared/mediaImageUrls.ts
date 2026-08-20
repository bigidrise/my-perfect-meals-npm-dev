/** URL forms owned by this application and intended to remain permanently usable. */
export const DEFAULT_MEAL_IMAGE_S3_BUCKET = "my-perfect-meals-images";
export const LOCAL_PERMANENT_IMAGE_PREFIXES = ["/public-objects/", "/images/", "/assets/"] as const;

/**
 * This is deliberately a URL-classification helper, not an authorization
 * decision. Server callers must still bind the URL to an owned media asset.
 */
export function isFirstPartyPermanentImageUrl(
  url: string | undefined | null,
  s3Bucket?: string,
): boolean {
  if (!url) return false;
  if (LOCAL_PERMANENT_IMAGE_PREFIXES.some((prefix) => url.startsWith(prefix))) return true;

  if (s3Bucket) return url.startsWith(`https://${s3Bucket}.s3.`);

  // Browser bundles do not receive server-only S3 configuration. They may
  // nominate an AWS S3 URL for recovery, but the server re-checks the exact
  // URL against the owned media asset and its configured bucket before work is
  // queued. This keeps client classification broad without broadening trust.
  return /^https:\/\/[^/]+\.s3(?:\.[^/]+)?\.amazonaws\.com(?:\/|$)/.test(url);
}