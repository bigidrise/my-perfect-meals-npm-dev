import type { ProductCandidate, ProductEligibilityDecision } from "../../../shared/productCandidateContract";
import { canonicalShoppingIngredient, type ShoppingCatalogDecision, type ShoppingIngredientRequest } from "../../../shared/shoppingProductSelection";
import type { ProductSubjectSnapshot } from "./subjectAuthority";

/** Presentation only: these flags never award eligibility or alter catalog ranking. */
export function shoppingCatalogPresentation(
  candidate: ProductCandidate,
  decision: ProductEligibilityDecision,
  selection: ShoppingCatalogDecision,
  input: ShoppingIngredientRequest,
): { shoppingDisplay: "selectable" | "label_review" | "hidden"; shoppingCaution: string } {
  if (decision.status === "rejected") return { shoppingDisplay: "hidden", shoppingCaution: "" };
  if (decision.status === "eligible" && selection.eligible) {
    return { shoppingDisplay: "selectable", shoppingCaution: "Check the current package for ingredient or allergen changes." };
  }
  // Reuse the existing catalog's minimum useful information, without inventing
  // a nutritional threshold or treating a marketing claim as compatibility.
  if (!candidate.identity.name.trim() || !candidate.identity.brand.trim() ||
      !["ingredients", "nutrition"].every(kind =>
        candidate.facts.some(fact => fact.kind === kind && fact.statement.trim()))) {
    return { shoppingDisplay: "hidden", shoppingCaution: "" };
  }
  const explicit = canonicalShoppingIngredient(input).requirements.filter(r => r.origin !== "profile_guidance");
  return {
    shoppingDisplay: "label_review",
    shoppingCaution: explicit.length
      ? `The requested ${explicit.map(r => r.value).join(", ")} requirement hasn't been verified. Check the current label.`
      : "Compatibility with your requirements isn't confirmed. Check the current label.",
  };
}

/** Read existing directions, not condition labels. Never derives a numeric limit. */
function hasReductionGuidance(guidance: readonly string[], nutrient: string): boolean {
  return guidance.some(block => block.split(/[.!?\n;]/).some(sentence => {
    const words = sentence.toLowerCase().replace(/[-_]/g, " ");
    if (!words.includes(nutrient)) return false;
    if (new RegExp(`(?:no|without)\\s+${nutrient}\\s+(?:limit|restriction)|${nutrient}\\s+(?:is\\s+)?unrestricted|(?:do not|don't)\\s+(?:reduce|restrict|limit)\\s+${nutrient}`).test(words)) return false;
    return new RegExp(`(?:lower|low|reduc\\w*|restrict\\w*|limit\\w*|minimi\\w*|moderate)\\b.{0,60}\\b${nutrient}\\b|\\b${nutrient}\\b.{0,60}\\b(?:reduc\\w*|restrict\\w*|limit\\w*|moderation)\\b`).test(words);
  }));
}

/** One generic shopping tip from the already-resolved profile or explicit request. */
export function shoppingCatalogTip(input: ShoppingIngredientRequest, subject: ProductSubjectSnapshot): string {
  const ingredient = canonicalShoppingIngredient(input);
  const explicit = ingredient.requirements.filter(r => r.origin !== "profile_guidance");
  const requestsLowerSodium = explicit.some(r =>
    /^(?:low sodium|reduced sodium|no added salt|sodium free|salt free)$/i.test(r.value.trim().replace(/[-_]/g, " ")));
  if (requestsLowerSodium) {
    return "Compare sodium across lower-sodium varieties using the same serving size; the front-label claim alone isn't enough.";
  }
  const guidance = subject.status === "resolved" ? subject.shoppingGuidance ?? [] : [];
  const sodium = hasReductionGuidance(guidance, "sodium");
  const saturatedFat = hasReductionGuidance(guidance, "saturated fat") ||
    explicit.some(r => /^(?:low|lower|reduced) saturated fat$/i.test(r.value.trim().replace(/[-_]/g, " ")));
  if (sodium && saturatedFat) return "Compare sodium and saturated fat using the same serving size.";
  if (sodium) return "Compare sodium using the same serving size.";
  if (saturatedFat) return "Compare saturated fat using the same serving size.";
  return `For ${ingredient.originalName}, compare ingredient lists and nutrition using the same serving size. Check the current allergen statement.`;
}
