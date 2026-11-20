/**
 * Explicit release gate for structured shopping product selections.
 *
 * Development remains enabled.
 * Production requires an independently approved server-side flag.
 *
 * This does not enable unrelated Development shopping-list behavior.
 */
export function shoppingProductOptionsServerEnabled(): boolean {
  return process.env.NODE_ENV === "development" ||
    process.env.SHOPPING_PRODUCT_OPTIONS_ENABLED === "true";
}
