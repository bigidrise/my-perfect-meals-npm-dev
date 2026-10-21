import { makeIngredientMetadata, parseIngredientMetadata } from "@shared/shoppingIngredientMetadata";
import type { CatalogProductMatch } from "@/components/shopping/GroceryStoreCoachSheet";
import type { GroceryIngredient } from "./groceryCoachPackagedIngredients";

/**
 * Add All handoff only: retain a member's existing Coach choice as historical
 * evidence. This does not run or relax the Smart Grocery selection validator.
 */
export function groceryCoachSelectedProductMetadata(
  ingredient: GroceryIngredient,
  product: CatalogProductMatch,
  recipe: { id?: string; name: string },
) {
  const metadata = makeIngredientMetadata({
    name: ingredient.item, quantity: ingredient.quantity, unit: ingredient.unit,
    originalText: `${ingredient.quantity} ${ingredient.unit} ${ingredient.item}`.trim(),
    recipeId: recipe.id, recipeName: recipe.name, source: "grocery_coach",
  });
  const source = {
    source: product.source, sourceRecordId: product.sourceRecordId,
    ...(product.catalogDate ? { observedAt: product.catalogDate } : {}),
  };
  const matched = product.evidenceStatus === "eligible" &&
    product.recommendationStatus === "profile_matched_pick" &&
    !product.needsProfileReview && !product.policyUnresolved;
  return parseIngredientMetadata({
    ...metadata,
    selectedProduct: {
      productKey: product.productKey, name: product.name, brand: product.brand,
      ...(product.barcode ? { upc: product.barcode } : {}),
      ...(product.serving ? { servingDescription: product.serving } : {}),
      source, sourcePayloadJson: JSON.stringify(product),
      evidence: [
        ...(product.ingredients ? [{ kind: "ingredients", statement: product.ingredients, provenance: source }] : []),
        ...(product.nutrition || []).map(f => ({
          kind: "nutrition", statement: f.statement, provenance: { ...source, source: f.source },
        })),
        // The response combines declared and precautionary statements; do not
        // invent which kind they were. The unmodified payload is retained too.
        ...(product.allergenInformation || []).map(f => ({
          kind: "other", statement: f.statement, provenance: { ...source, source: f.source },
        })),
      ],
      assessment: {
        status: matched ? "profile_matched" : "review_required",
        unresolvedRequirements: [
          ...(!matched ? ["current_profile_and_label_review"] : []),
          ...(product.policyUnresolved ? ["product_policy_review"] : []),
        ],
        reasons: [product.verificationMessage],
      },
    },
  })!;
}
