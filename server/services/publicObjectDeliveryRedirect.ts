/**
 * Emergency image-delivery bypass for the custom production domain.
 *
 * Replit's generated deployment host can serve public Object Storage objects
 * directly while the custom-domain request path currently reaches the app's
 * storage reader, which is returning retryable 503s. This is intentionally
 * limited to public object URLs and is safe to remove once that reader is
 * healthy again.
 */
export const CUSTOM_PRODUCTION_HOST = "app.myperfectmeals.ai";
export const GENERATED_DEPLOYMENT_ORIGIN = "https://my-perfect-meals-npm-dev-1.replit.app";

export function getPublicObjectDeliveryRedirect(
  hostname: string,
  originalUrl: string,
): string | null {
  const normalizedHost = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (
    normalizedHost !== CUSTOM_PRODUCTION_HOST ||
    !originalUrl.startsWith("/public-objects/")
  ) {
    return null;
  }

  return `${GENERATED_DEPLOYMENT_ORIGIN}${originalUrl}`;
}