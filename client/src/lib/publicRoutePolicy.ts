const EXACT_PUBLIC_MARKETING_ROUTES = new Set([
  "/lifestyle",
  "/learn",
  "/creator-studio",
]);

/**
 * These marketing landing pages are public, but similarly prefixed feature
 * routes (for example /lifestyle/chefs-kitchen) retain their normal gates.
 */
export function isExactPublicMarketingRoute(pathname: string): boolean {
  const pathOnly = pathname.split(/[?#]/, 1)[0];
  return EXACT_PUBLIC_MARKETING_ROUTES.has(pathOnly);
}