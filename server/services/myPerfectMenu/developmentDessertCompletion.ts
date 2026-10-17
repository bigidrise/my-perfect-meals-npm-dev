import { buildCulinaryFingerprint, type CulinaryFingerprint, type CulinaryIdentity } from "@shared/culinaryIdentity";
import type { FoodIdentity } from "@shared/foodIdentity";
import type { GeneratedMenuConcept } from "./generationContract";

export interface DessertReference {
  title?: string;
  signature?: string;
  primaryIngredients?: string[];
  primaryProtein?: string | null;
  cuisine?: string;
  preparationMethod?: string;
  culinaryIdentity?: Partial<CulinaryIdentity>;
  foodIdentity?: FoodIdentity;
  // Existing history records have fingerprints, not full concepts.
  dishForm?: string;
  preparationStyle?: string;
  ingredients?: string[];
  fingerprint?: string;
  primaryProteinBase?: string | null;
  majorStarchBase?: string | null;
}

const words = (value: string | undefined) =>
  (value ?? "").toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();

/** Structural vocabulary, not a food-safety classifier. Unknown forms stay unknown. */
function dessertForm(value: string | undefined): string | undefined {
  const text = words(value);
  const patterns: [string, RegExp][] = [
    ["cheesecake", /\bcheese\s?cakes?\b/], ["parfait", /\bparfaits?\b/],
    ["cupcake", /\bcupcakes?\b/], ["brownie", /\bbrownies?\b/],
    ["cookie", /\b(cookies?|biscuits?)\b/], ["cake", /\bcakes?\b/],
    ["pudding_custard", /\b(pudding|custard|mousse)\b/],
    ["frozen_dessert", /\b(frozen dessert|ice cream|sorbet|gelato|popsicle|frozen.*bark)\b/],
    ["bar", /\bbars?\b/], ["muffin", /\bmuffins?\b/],
    ["pie", /\b(pie|tart)\b/], ["pastry", /\b(pastry|strudel)\b/],
    ["confection", /\b(confection|truffle|fudge)\b/],
  ];
  return patterns.find(([, pattern]) => pattern.test(text))?.[0];
}

function structure(reference: DessertReference): { form?: string; conflicting: boolean } {
  const rawDishForm = reference.culinaryIdentity?.dishForm ?? reference.dishForm;
  const dishForm = dessertForm(rawDishForm);
  const titleForm = dessertForm(reference.title);
  const label = reference.foodIdentity?.formatFamily;
  const labelForm = label && !["general_sweet", "general_snack", "no_bake_dessert"].includes(label)
    ? dessertForm(label) : undefined;
  const conflicting = Boolean(
    (dishForm && titleForm && dishForm !== titleForm) ||
    (dishForm && labelForm && dishForm !== labelForm) ||
    (titleForm && labelForm && titleForm !== labelForm),
  );
  // A title alone is not a substitute for missing historical structural evidence.
  const explicitStructure = rawDishForm && !/^(dessert|sweet|snack|general sweet|general snack|no bake dessert)$/.test(words(rawDishForm)) &&
    Boolean(reference.culinaryIdentity?.preparationStyle ?? reference.preparationStyle ?? reference.preparationMethod);
  return {
    form: dishForm ?? (explicitStructure ? titleForm : undefined) ??
      (labelForm && (titleForm === labelForm || explicitStructure) ? labelForm : undefined) ??
      (label === "no_bake_dessert" && explicitStructure ? "no_bake_dessert" : undefined),
    conflicting,
  };
}

function ingredients(reference: DessertReference): Set<string> {
  return new Set((reference.primaryIngredients ?? reference.ingredients ?? []).map(words).filter(Boolean));
}

function fingerprint(reference: DessertReference): string | undefined {
  if (reference.fingerprint) return reference.fingerprint;
  if (!reference.title || !reference.primaryIngredients || !reference.cuisine ||
    !reference.preparationMethod || !reference.culinaryIdentity) return undefined;
  try {
    return buildCulinaryFingerprint(reference as GeneratedMenuConcept, "snack").fingerprint;
  } catch {
    // Invalid/incomplete legacy evidence cannot establish exact identity.
    return undefined;
  }
}

function preparation(reference: DessertReference): string {
  const value = words(reference.culinaryIdentity?.preparationStyle ??
    reference.preparationStyle ?? reference.preparationMethod);
  if (/\b(chilled|no bake|set|assembled)\b/.test(value)) return "set";
  if (/\b(baked|baking|oven)\b/.test(value)) return "baked";
  if (/\b(frozen|freezing)\b/.test(value)) return "frozen";
  return value;
}

function coreBases(reference: DessertReference): string[] {
  return [
    reference.culinaryIdentity?.primaryProteinBase ?? reference.primaryProteinBase ?? reference.primaryProtein,
    reference.culinaryIdentity?.majorStarchBase ?? reference.majorStarchBase,
  ].map(value => words(value ?? undefined)).filter(Boolean);
}

export function compareDessertStructures(
  left: DessertReference,
  right: DessertReference,
  options?: { scope: "batch" | "history" },
) {
  const a = structure(left), b = structure(right);
  const ai = ingredients(left), bi = ingredients(right);
  const overlap = ai.size && bi.size
    ? [...ai].filter(item => bi.has(item)).length / Math.max(ai.size, bi.size) : 0;
  const leftPreparation = preparation(left), rightPreparation = preparation(right);
  const samePreparation = Boolean(leftPreparation && leftPreparation === rightPreparation);
  const leftBases = coreBases(left), rightBases = coreBases(right);
  const sameCoreBase = leftBases.some(base => rightBases.includes(base));
  const evidence = {
    leftStructure: Boolean(a.form && !a.conflicting),
    rightStructure: Boolean(b.form && !b.conflicting),
    ingredientOverlap: Math.round(overlap * 100) / 100,
    samePreparation,
    sameCoreBase,
  };
  if (a.conflicting || b.conflicting) {
    return { decision: "uncertain" as const, branch: "conflicting_structure", evidence };
  }
  const af = fingerprint(left), bf = fingerprint(right);
  if (af && bf && af === bf) {
    return { decision: "duplicate" as const, branch: "exact_fingerprint", evidence };
  }
  if (!a.form || !b.form) {
    return { decision: "uncertain" as const, branch: "incomplete_structure", evidence };
  }
  if (a.form === b.form && options?.scope === "history") {
    // History must reject a repeated recipe, not permanently ban a whole dessert
    // category. Flavor/protein relabeling of the same preparation still repeats.
    if (samePreparation && (overlap >= 0.75 || (sameCoreBase && overlap >= 0.5))) {
      return { decision: "duplicate" as const, branch: "historical_recipe_repeat", evidence };
    }
    if (ai.size < 2 || bi.size < 2 || !leftPreparation || !rightPreparation) {
      return { decision: "uncertain" as const, branch: "incomplete_historical_recipe", evidence };
    }
    return { decision: "distinct" as const, branch: "same_format_different_recipe", evidence };
  }
  return a.form === b.form
    ? { decision: "duplicate" as const, branch: "same_dessert_structure", evidence }
    : { decision: "distinct" as const, branch: "different_dessert_structures", evidence };
}

export function isRelevantDessertHistory(reference: CulinaryFingerprint, candidate: GeneratedMenuConcept): boolean {
  if (dessertForm(reference.dishForm) || /\b(dessert|sweet)\b/.test(words(reference.dishForm))) return true;
  // Unclassified legacy snack history matters when its ingredients suggest a
  // possible repeat; do not manufacture a dessert identity for unrelated meals.
  return compareDessertStructures(candidate, reference).evidence.ingredientOverlap >= 0.75;
}

/** Unknown structural evidence is not silently approved as meaningful variety. */
export function areDessertDuplicates(left: GeneratedMenuConcept, right: GeneratedMenuConcept): boolean {
  return compareDessertStructures(left, right).decision !== "distinct";
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
