import type { GatheringsIngredient } from "./gatheringsIngredientParser";

export interface NormalizedGatheringsIngredient {
  original: GatheringsIngredient;
  foodIdentity: string;
  searchName: string;
  preparation: string[];
  physicalForm?: string;
  formulation: string[];
  reviewReason?: string;
}

const CUT = /\b(?:(?:finely|coarsely|thinly|thickly)\s+)?(chopped|sliced|grated|diced|cubed|minced)\b/gi;
const MATERIAL = /\b(raw|fresh|cooked|boiled|steamed|fried|roasted|toasted|dried|rehydrated|peeled|unpeeled|salted|unsalted|sweetened|unsweetened|canned|light|whole|ground)\b/g;
export const ingredientIdentityKey = (value: string): string =>
  value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");

/** Only cutting language is removed from searches. Material descriptors survive.
 * This changes neither the source ingredient nor its measurement. */
export function normalizeGatheringsIngredient(
  ingredient: GatheringsIngredient,
): NormalizedGatheringsIngredient {
  const preparation: string[] = [];
  const forms: string[] = [];
  const searchName = ingredient.name.toLowerCase().replace(CUT, (text, form: string) => {
    preparation.push(text);
    forms.push(form);
    return " ";
  }).replace(/,\s*(?:and\s*)?(?=,|$)/g, " ")
    .replace(/\band\s*$/g, "").replace(/^[,\s]+|[,\s]+$/g, "").replace(/\s+/g, " ").trim();
  const text = ingredientIdentityKey(ingredient.name);
  let reviewReason: string | undefined;
  if (/\b(bone in|shell on|shells on)\b/.test(text)) reviewReason = "edible_weight_unspecified";
  else if (/\b(rehydrated|hydrated|reconstituted)\b/.test(text)) reviewReason = "hydrated_composition_unverified";
  else if (/\bsalmon\b/.test(text) &&
    !/\b(atlantic|sockeye|coho|chinook|pink|chum)\b/.test(text)) reviewReason = "salmon_identity_unspecified";
  else if (/\bcoconut milk\b/.test(text) &&
    !/\b(canned|beverage|powder|concentrate|raw)\b/.test(text)) reviewReason = "coconut_milk_formulation_unspecified";
  else if (new Set(forms).size > 1) reviewReason = "conflicting_physical_forms";
  const physicalForm = forms[0] ?? (/\bground\b/.test(text) ? "ground" : undefined);
  return {
    original: { ...ingredient },
    foodIdentity: searchName.replace(MATERIAL, " ").replace(/[,\s]+/g, " ").trim(),
    searchName, preparation, physicalForm,
    formulation: [...text.matchAll(MATERIAL)].map(match => match[0]).filter(word => word !== "ground"),
    ...(reviewReason ? { reviewReason } : {}),
  };
}

// Grammatical variants only, not equivalence between different foods.
const SINGULAR: Record<string, string> = {
  onions: "onion", cucumbers: "cucumber", potatoes: "potato",
  seeds: "seed", almonds: "almond", walnuts: "walnut", eggs: "egg",
};
function identityTokens(value: string): string {
  const withoutTaxonomy = value.replace(/^(nuts|spices|vegetables),\s*/i, "");
  return ingredientIdentityKey(withoutTaxonomy).split(" ")
    .map(word => SINGULAR[word] ?? word).sort().join(" ");
}

/** A search hit is not evidence of equivalence. Every remaining identity,
 * preparation-state and formulation token must agree, irrespective of order.
 * Extra USDA qualifiers (peel, species, hydration, roasting, etc.) are NOT
 * discarded. This deliberately leaves many real-world foods unresolved. */
export function verifiedGatheringsCandidate(
  ingredient: NormalizedGatheringsIngredient,
  description: string,
): boolean {
  const candidate = normalizeGatheringsIngredient({
    name: description, originalText: description, displayText: description,
  });
  if (candidate.physicalForm && candidate.physicalForm !== ingredient.physicalForm) return false;
  return !!ingredient.searchName &&
    identityTokens(ingredient.searchName) === identityTokens(candidate.searchName);
}
