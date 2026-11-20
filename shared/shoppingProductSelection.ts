import { z } from "zod";
import {
  explicitIngredientRequirements, ingredientMatchingName, shoppingIngredientMetadataSchema,
  type ShoppingIngredientMetadata,
} from "./shoppingIngredientMetadata";

const metadataShape = shoppingIngredientMetadataSchema.innerType().shape;
export const shoppingIngredientRequestSchema = metadataShape.ingredient
  .pick({ originalName: true, requirements: true }).strict();
export type ShoppingIngredientRequest = z.infer<typeof shoppingIngredientRequestSchema>;
export interface ShoppingProductSelection {
  ingredient: ShoppingIngredientRequest;
  product: NonNullable<ShoppingIngredientMetadata["selectedProduct"]>;
}
/** A customer's intended exact product. This is NOT an eligibility decision. */
export interface ShoppingProductReference extends ShoppingProductSelection {
  product: ShoppingProductSelection["product"] & { selectionKind: "unverified_shopping_reference" };
}
export interface ShoppingCatalogDecision {
  eligible: boolean;
  reason?: string;
  selection?: ShoppingProductSelection;
}

/** Original qualifiers are additive: request metadata can never erase the name. */
export function canonicalShoppingIngredient(input: unknown): ShoppingIngredientRequest {
  const parsed = shoppingIngredientRequestSchema.parse(input);
  const requirements = [...parsed.requirements];
  for (const required of explicitIngredientRequirements(parsed.originalName)) {
    if (!requirements.some(r => r.origin === required.origin &&
      ingredientMatchingName(r.value) === required.value)) requirements.push(required);
  }
  return { ...parsed, requirements };
}

export function shoppingIngredientSignature(input: ShoppingIngredientRequest): string {
  const ingredient = canonicalShoppingIngredient(input);
  return JSON.stringify([
    ingredientMatchingName(ingredient.originalName),
    ingredient.requirements.map(r => JSON.stringify([
      r.origin, ingredientMatchingName(r.value), r.authorityReference || "",
    ])).sort(),
  ]);
}

const selectionSchema = z.object({
  ingredient: shoppingIngredientRequestSchema,
  product: metadataShape.selectedProduct.unwrap().unwrap(),
}).strict();

/** Defense in depth for the picker; historical persistence is not clinical approval. */
export function parseShoppingProductSelection(input: unknown): ShoppingProductSelection {
  const parsed = selectionSchema.parse(input);
  const ingredient = canonicalShoppingIngredient(parsed.ingredient);
  if (ingredient.requirements.some(r => r.origin !== "profile_guidance")) {
    throw new Error("An explicit ingredient requirement still needs reviewed product evidence.");
  }
  if (parsed.product.selectionKind === "unverified_shopping_reference" ||
      parsed.product.assessment.status !== "eligible_at_evaluation" ||
      parsed.product.assessment.unresolvedRequirements.length ||
      !parsed.product.assessment.contextReference || !parsed.product.assessment.subjectReference ||
      !parsed.product.assessment.policyVersion || !parsed.product.assessment.evaluatedAt ||
      !parsed.product.evidence.some(f => f.kind === "ingredients") ||
      !parsed.product.evidence.some(f => f.kind === "nutrition")) {
    throw new Error("This product does not have a complete evidence-supported shopping decision.");
  }
  // Name the required field explicitly: the server's non-strict-null Zod
  // inference marks object keys optional even though parsing requires product.
  return { ingredient, product: parsed.product };
}

/** Separate parser: never relax or reuse the verified-selection validator. */
export function parseShoppingProductReference(input: unknown): ShoppingProductReference {
  const parsed = selectionSchema.parse(input);
  const product = parsed.product;
  if (product.selectionKind !== "unverified_shopping_reference" ||
    product.assessment.status !== "review_required" ||
    !product.assessment.unresolvedRequirements.length ||
    !product.assessment.subjectReference || !product.assessment.contextReference ||
    !product.assessment.policyVersion || !product.assessment.evaluatedAt ||
    !product.source.sourceRecordId || !product.brand || !product.variant || !product.sourcePayloadJson) {
    throw new Error("A shopping reference needs exact source identity and its unresolved warnings.");
  }
  const snapshot = JSON.parse(product.sourcePayloadJson);
  const identity = snapshot?.identity;
  if (identity?.match !== "exact_variant" || identity.key !== product.productKey ||
    identity.name !== product.name || identity.brand !== product.brand || identity.variant !== product.variant ||
    identity.provenance?.sourceRecordId !== product.source.sourceRecordId ||
    identity.provenance?.source !== product.source.source ||
    identity.barcode !== product.upc || identity.packageSize !== product.packageDescription ||
    identity.servingDescription !== product.servingDescription ||
    !["eligible", "needs_verification"].includes(snapshot.decision?.status) ||
    snapshot.decision?.productKey !== product.productKey ||
    snapshot.decision?.subjectId !== product.assessment.subjectReference ||
    snapshot.decision?.contextFingerprint !== product.assessment.contextReference ||
    !Array.isArray(snapshot.decision?.reasons) ||
    snapshot.decision.reasons.some((reason: { code: string; detail: string }) =>
      reason.code === "hard_conflict" || reason.code === "identity_unverified" ||
      !product.assessment.unresolvedRequirements.includes(reason.detail))) {
    throw new Error("The exact product identity cannot be used as a shopping reference.");
  }
  return { ingredient: canonicalShoppingIngredient(parsed.ingredient),
    product: { ...product, selectionKind: "unverified_shopping_reference" } };
}
