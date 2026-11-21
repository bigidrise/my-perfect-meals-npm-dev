// Isolated from portable helpers so Jest can mock Vite's compile-time gate.
/**
 * Grocery Coach catalog release gate.
 * Development is enabled; Production requires explicit approval.
 */
export const groceryCoachCatalogEnabled =
  import.meta.env.DEV ||
  import.meta.env.VITE_GROCERY_CATALOG_PRODUCTION_ENABLED === "true";
