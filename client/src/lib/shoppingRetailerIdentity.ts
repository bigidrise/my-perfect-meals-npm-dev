import type { ShoppingProductSelection } from "@shared/shoppingProductSelection";
import { groceryProductLabel } from "./savedGroceryRecommendation";

/** Use stored product identity verbatim; recipe/retail quantities stay separate. */
export function shoppingRetailerIdentity(product: ShoppingProductSelection["product"]): string {
  const label = groceryProductLabel({ productName: product.name, brand: product.brand });
  return product.variant && !label.toLowerCase().includes(product.variant.toLowerCase())
    ? `${label} ${product.variant}` : label;
}
