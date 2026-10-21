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
  if (parsed.product.assessment.status !== "eligible_at_evaluation" ||
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
