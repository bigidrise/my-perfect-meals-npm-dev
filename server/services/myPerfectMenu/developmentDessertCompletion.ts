import { buildCulinaryFingerprint, compareCulinaryFingerprints } from "@shared/culinaryIdentity";
import type { GeneratedMenuConcept } from "./generationContract";

/** Shared ingredients alone do not make two recognizable desserts duplicates. */
export function areDessertDuplicates(left: GeneratedMenuConcept, right: GeneratedMenuConcept): boolean {
  const a = buildCulinaryFingerprint(left, "snack");
  const b = buildCulinaryFingerprint(right, "snack");
  const leftFormat = left.foodIdentity?.formatFamily;
  const rightFormat = right.foodIdentity?.formatFamily;
  const specific = (format: string | undefined) =>
    !!format && !["general_sweet", "general_snack"].includes(format);
  if (specific(leftFormat) && specific(rightFormat) && leftFormat !== rightFormat) return false;
  if (a.preparationStyle && b.preparationStyle && a.preparationStyle !== b.preparationStyle &&
    ((a.texture && b.texture && a.texture !== b.texture) ||
      (a.temperature && b.temperature && a.temperature !== b.temperature))) return false;
  return compareCulinaryFingerprints(a, b).nearDuplicate;
}

export function dessertCompletionFeedback(retained: GeneratedMenuConcept[]): string {
  return "Retained, fully governed desserts (do not regenerate these): " +
    JSON.stringify(retained.map(concept => ({
      title: concept.title,
      signature: concept.signature,
      primaryIngredients: concept.primaryIngredients,
      culinaryIdentity: concept.culinaryIdentity,
      foodIdentity: concept.foodIdentity,
    }))) +
    ". Fill only the missing position with a genuinely different compatible dessert. " +
    "Shared safe ingredients are allowed; a renamed version or protein swap is not variety. " +
    "Use a different recognizable dessert structure or a meaningfully different preparation/texture. " +
    "Use compatible substitutions within the same authoritative dietary, allergy and clinical context.";
}
