import { groceryCoachCatalogEnabled } from "@/lib/groceryCoachCatalogGate";

/**
 * Product Options release gate.
 *
 * Independent of shoppingMetadataEnabled, which also controls
 * the shopping-list store implementation.
 *
 * Production remains disabled unless explicitly released.
 */
export const shoppingProductOptionsEnabled =
  import.meta.env.DEV ||
  (
    import.meta.env.VITE_SHOPPING_PRODUCT_OPTIONS_ENABLED === "true" &&
    groceryCoachCatalogEnabled
  );
