import { hasGenuineRecipeInstructions, normalizeRecipeInstructions } from "./recipeInstructions";
/** Structural/privacy boundary only; never nutrition or dietary clearance. */
export const SAFE_RECIPE_FAILURE = "We couldn't prepare a complete recipe. Please try again.";
export const CLINICAL_RECIPE_WITHHELD = "This course needs reliable nutrition before it can be checked against your medical requirements. Please try again.";
export type RecipeFailureReason =
  | "provider_error" | "provider_refusal" | "empty_response" | "invalid_format"
  | "missing_name" | "missing_description" | "invalid_ingredients"
  | "missing_instructions" | "protocol_rejected";
export class SafeRecipeGenerationError extends Error {
  readonly code = "MEAL_GENERATION_FAILED";
  constructor(readonly reason: RecipeFailureReason) {
    super(SAFE_RECIPE_FAILURE);
    this.name = "SafeRecipeGenerationError";
  }
}
const REFUSAL = /\b(?:I (?:cannot|can't|am unable to)|I'm sorry|I am sorry|as an AI|I (?:must|have to) (?:decline|refuse)|unable to (?:comply|fulfill|generate|provide))\b/i;
const INTERNAL = /(?:^|\n)\s*(?:COURSE POSITION|FLAVOR PROFILE SEED|COURSE ROLE|FOODS TO AVOID|MEDICAL HARD LIMITS|SYSTEM PROMPT|USER PROFILE|PROFILE DATA|INTERNAL INSTRUCTIONS)\s*[:—-]|<\|(?:system|user|assistant|developer)[^>]*>/i;
const PLACEHOLDER = /^(?:\[.*\]|null|undefined|none|n\/a|\.{3})$/i;
export const cleanRecipeText = (value: unknown): value is string =>
  typeof value === "string" && !!value.trim() && !PLACEHOLDER.test(value.trim());
export const safeRecipeText = (value: string): boolean => !REFUSAL.test(value) && !INTERNAL.test(value);
function validIngredient(value: unknown): value is string {
  if (!cleanRecipeText(value) || !safeRecipeText(value) || !/\p{L}/u.test(value) || /^[{[]/.test(value.trim())) return false;
  return !/^\s*[\d./\s½¼¾⅓⅔]+\s*(?:g|kg|mg|oz|lb|lbs|pounds?|cups?|tbsp|tsp|ml|l|fl oz)\s*$/i.test(value);
}
export interface RecipeDraft {
  name?: unknown;
  description?: unknown;
  ingredients?: unknown;
  instructions?: unknown;
  cookingInstructions?: unknown;
}
export function recipeInstructions(draft: RecipeDraft): string[] {
  const primary = draft?.instructions;
  const missing = primary == null || (typeof primary === "string" && !primary.trim()) ||
    (Array.isArray(primary) && !primary.length);
  return normalizeRecipeInstructions(missing ? draft?.cookingInstructions : primary);
}
export function assertRecipeDraft(draft: RecipeDraft): void {
  if (!cleanRecipeText(draft?.name)) throw new SafeRecipeGenerationError("missing_name");
  if (!cleanRecipeText(draft?.description)) throw new SafeRecipeGenerationError("missing_description");
  if (!safeRecipeText(draft.name) || !safeRecipeText(draft.description)) throw new SafeRecipeGenerationError("provider_refusal");
  if (!Array.isArray(draft.ingredients) || !draft.ingredients.length ||
    !draft.ingredients.every(row => row && typeof row === "object" && validIngredient(row.name))) {
    throw new SafeRecipeGenerationError("invalid_ingredients");
  }
  const instructions = recipeInstructions(draft);
  if (!hasGenuineRecipeInstructions(instructions) ||
    !instructions.every(step => cleanRecipeText(step) && safeRecipeText(step))) {
    throw new SafeRecipeGenerationError("missing_instructions");
  }
}
