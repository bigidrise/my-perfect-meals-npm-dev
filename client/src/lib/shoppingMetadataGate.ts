/** Persistence foundation only; does not activate recommendations. */
/**
 * Structured shopping metadata.
 *
 * Development remains enabled. Production requires an explicit release flag.
 * Do not enable until server capability and legacy-store compatibility pass.
 */
export const shoppingMetadataEnabled =
  import.meta.env.DEV ||
  import.meta.env.VITE_SHOPPING_METADATA_PRODUCTION_ENABLED === "true";
