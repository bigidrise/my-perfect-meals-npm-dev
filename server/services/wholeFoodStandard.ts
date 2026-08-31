/**
 * My Perfect Meals Whole-Food Standard
 *
 * One shared, versioned nutrition-quality policy for every human-food
 * recommendation surface. NOVA-style processing concepts are an input, not a
 * verdict: useful processed foods remain appropriate, purposeful nutrition
 * products require context, and unknown composition remains uncertain.
 */

export const WHOLE_FOOD_STANDARD_VERSION = "wfs-v1";
export const WHOLE_FOOD_PROMPT_MARKER = "WHOLE-FOOD STANDARD — WFS-V1";

export type WholeFoodClassification =
  | "preferred"
  | "appropriate"
  | "substitute_when_practical"
  | "purposeful_exception"
  | "uncertain";

export type WholeFoodPurpose =
  | "clinical"
  | "hypoglycemia"
  | "performance"
  | "accessibility"
  | "inadequate_intake"
  | "clinician_directed";

export interface WholeFoodCandidate {
  name?: string;
  description?: string;
  ingredients?: Array<string | { name?: string; item?: string }>;
  instructions?: string | string[];
  /** Set by product/label surfaces when the candidate is a packaged product. */
  isPackagedProduct?: boolean;
  /** Verified label text, when available. */
  ingredientLabel?: string[];
  /** Restaurant recipes are uncertain unless ingredients/preparation are verified. */
  preparationEvidence?: "verified" | "unknown";
}

export interface WholeFoodPolicyContext {
  purposes?: WholeFoodPurpose[];
  recommendationSurface?: string;
  /** True only when a reasonable stronger substitute is known to be available. */
  practicalAlternativeAvailable?: boolean;
  /** Required before a processed nutrition product can use a purpose exception. */
  purposefulNeed?: string;
}

export type WholeFoodReasonCode =
  | "WHOLE_OR_MINIMALLY_PROCESSED"
  | "USEFUL_PROCESSED_FOOD"
  | "UPF_PRODUCT_PATTERN"
  | "UPF_ADDITIVE_PATTERN"
  | "PURPOSEFUL_NUTRITION_EXCEPTION"
  | "INSUFFICIENT_CLASSIFICATION_EVIDENCE";

export interface WholeFoodDecision {
  policyVersion: typeof WHOLE_FOOD_STANDARD_VERSION;
  classification: WholeFoodClassification;
  confidence: "high" | "medium" | "low";
  reasonCode: WholeFoodReasonCode;
  reason: string;
  matchedTerms: string[];
  shouldSubstitute: boolean;
  shouldBlock: boolean;
  exceptionPurpose?: WholeFoodPurpose;
}

const PREFERRED_TERMS = [
  "fresh fruit", "fresh berries", "apple", "banana", "orange", "berries",
  "vegetable", "broccoli", "spinach", "kale", "carrot", "tomato",
  "beans", "lentils", "chickpeas", "egg", "chicken", "turkey", "beef",
  "salmon", "tuna", "fish", "shrimp", "oats", "quinoa", "brown rice",
  "sweet potato", "potato", "nuts", "seeds", "avocado", "olive oil",
];

const APPROPRIATE_PROCESSED_TERMS = [
  "frozen vegetables", "frozen fruit", "canned beans", "canned chickpeas",
  "canned lentils", "canned tuna", "canned salmon", "plain yogurt",
  "greek yogurt", "tofu", "tempeh", "nut butter", "peanut butter",
  "whole grain bread", "whole-grain bread", "whole wheat bread",
  "rolled oats", "cheese", "tomato paste", "unsweetened plant milk",
];

const NON_EXEMPTABLE_UPF_PRODUCT_TERMS = [
  "packaged snack cake", "snack cakes", "candy bar", "cheese puffs",
  "sugary soda", "soft drink", "frozen pizza", "instant noodle cup",
  "instant noodles seasoning packet", "processed cheese sauce",
  "packaged frosted cookie", "frosted toaster pastry",
  "toaster pastry", "chicken nuggets", "hot dog", "bologna",
  "energy drink", "sweetened breakfast cereal", "sugary cereal",
  "packaged cookies", "packaged chips",
];

const CONTEXTUAL_UPF_PRODUCT_TERMS = [
  "potato chips", "tortilla chips", "corn chips", "instant noodles",
  "processed meat", "deli meat", "pepperoni", "salami",
  "meal replacement shake", "protein shake", "protein bar",
  "sports drink", "electrolyte drink", "glucose gel", "glucose tablets",
  "oral nutrition supplement",
];

const PURPOSEFUL_PRODUCT_TERMS: Array<{
  term: string;
  purposes: WholeFoodPurpose[];
}> = [
  { term: "glucose gel", purposes: ["hypoglycemia", "performance"] },
  { term: "glucose tablets", purposes: ["hypoglycemia"] },
  { term: "oral nutrition supplement", purposes: ["clinical", "inadequate_intake", "clinician_directed"] },
  { term: "meal replacement shake", purposes: ["clinical", "accessibility", "inadequate_intake", "clinician_directed"] },
  { term: "protein shake", purposes: ["performance", "accessibility", "inadequate_intake"] },
  { term: "protein bar", purposes: ["performance", "accessibility", "inadequate_intake"] },
  { term: "sports drink", purposes: ["performance", "hypoglycemia"] },
  { term: "electrolyte drink", purposes: ["performance", "clinical", "clinician_directed"] },
];

const UPF_ADDITIVE_TERMS = [
  "high fructose corn syrup", "hydrogenated oil", "partially hydrogenated",
  "artificial flavor", "artificial colour", "artificial color",
  "modified food starch", "polysorbate", "sodium benzoate",
  "potassium sorbate", "carboxymethylcellulose", "maltodextrin",
];

function normalizeCandidate(candidate: WholeFoodCandidate): string {
  const ingredients = (candidate.ingredients ?? []).map((ingredient) =>
    typeof ingredient === "string"
      ? ingredient
      : ingredient.name ?? ingredient.item ?? "",
  );
  const instructions = Array.isArray(candidate.instructions)
    ? candidate.instructions
    : [candidate.instructions ?? ""];
  return [
    candidate.name ?? "",
    candidate.description ?? "",
    ...(candidate.ingredientLabel ?? []),
    ...ingredients,
    ...instructions,
  ].join(" ").toLowerCase().replace(/\s+/g, " ").trim();
}

function matched(text: string, terms: string[]): string[] {
  return terms.filter((term) => text.includes(term));
}

export function evaluateWholeFoodCandidate(
  candidate: WholeFoodCandidate,
  context: WholeFoodPolicyContext = {},
): WholeFoodDecision {
  const text = normalizeCandidate(candidate);
  const purposes = new Set(context.purposes ?? []);

  const productMatches = matched(text, NON_EXEMPTABLE_UPF_PRODUCT_TERMS);
  if (productMatches.length > 0) {
    const shouldBlock = context.practicalAlternativeAvailable !== false;
    return {
      policyVersion: WHOLE_FOOD_STANDARD_VERSION,
      classification: "substitute_when_practical",
      confidence: "high",
      reasonCode: "UPF_PRODUCT_PATTERN",
      reason: "A clearly ultra-processed product pattern was identified and a stronger practical alternative should be used.",
      matchedTerms: productMatches,
      shouldSubstitute: shouldBlock,
      shouldBlock,
    };
  }

  const additiveMatches = matched(text, UPF_ADDITIVE_TERMS);
  const purposefulProduct = PURPOSEFUL_PRODUCT_TERMS.find((product) =>
    text.includes(product.term),
  );
  const exceptionPurpose = purposefulProduct?.purposes.find((purpose) =>
    purposes.has(purpose),
  );
  const hasDocumentedPurpose = Boolean(exceptionPurpose && context.purposefulNeed?.trim());

  if (additiveMatches.length >= 2 && !hasDocumentedPurpose) {
    const shouldBlock = context.practicalAlternativeAvailable !== false;
    return {
      policyVersion: WHOLE_FOOD_STANDARD_VERSION,
      classification: "substitute_when_practical",
      confidence: "medium",
      reasonCode: "UPF_ADDITIVE_PATTERN",
      reason: "Multiple industrial additive markers suggest an ultra-processed formulation.",
      matchedTerms: additiveMatches,
      shouldSubstitute: shouldBlock,
      shouldBlock,
    };
  }

  if (purposefulProduct && hasDocumentedPurpose && exceptionPurpose) {
    return {
      policyVersion: WHOLE_FOOD_STANDARD_VERSION,
      classification: "purposeful_exception",
      confidence: additiveMatches.length >= 2 ? "medium" : "high",
      reasonCode: "PURPOSEFUL_NUTRITION_EXCEPTION",
      reason: `This processed nutrition product is justified for ${exceptionPurpose.replaceAll("_", " ")} use: ${context.purposefulNeed}.`,
      matchedTerms: [purposefulProduct.term, ...additiveMatches],
      shouldSubstitute: false,
      shouldBlock: false,
      exceptionPurpose,
    };
  }

  const contextualProductMatches = matched(text, CONTEXTUAL_UPF_PRODUCT_TERMS);
  if (contextualProductMatches.length > 0 || (candidate.isPackagedProduct && additiveMatches.length > 0)) {
    const shouldBlock = context.practicalAlternativeAvailable !== false;
    return {
      policyVersion: WHOLE_FOOD_STANDARD_VERSION,
      classification: "substitute_when_practical",
      confidence: contextualProductMatches.length > 0 ? "high" : "medium",
      reasonCode: additiveMatches.length > 0 ? "UPF_ADDITIVE_PATTERN" : "UPF_PRODUCT_PATTERN",
      reason: purposefulProduct
        ? "A processed nutrition product was identified without a documented matching need."
        : "A packaged or ultra-processed product pattern was identified and a stronger practical alternative should be used.",
      matchedTerms: [...contextualProductMatches, ...additiveMatches],
      shouldSubstitute: shouldBlock,
      shouldBlock,
    };
  }

  const appropriateMatches = matched(text, APPROPRIATE_PROCESSED_TERMS);
  if (candidate.preparationEvidence === "unknown") {
    return {
      policyVersion: WHOLE_FOOD_STANDARD_VERSION,
      classification: "uncertain",
      confidence: "low",
      reasonCode: "INSUFFICIENT_CLASSIFICATION_EVIDENCE",
      reason: "Restaurant ingredients and preparation were not verified, so processing classification remains uncertain.",
      matchedTerms: [],
      shouldSubstitute: false,
      shouldBlock: false,
    };
  }
  if (appropriateMatches.length > 0) {
    return {
      policyVersion: WHOLE_FOOD_STANDARD_VERSION,
      classification: "appropriate",
      confidence: "high",
      reasonCode: "USEFUL_PROCESSED_FOOD",
      reason: "This is a nutritionally useful processed food, not a product that should be rejected merely because it was processed.",
      matchedTerms: appropriateMatches,
      shouldSubstitute: false,
      shouldBlock: false,
    };
  }

  if (candidate.isPackagedProduct && (candidate.ingredientLabel?.length ?? 0) === 0) {
    return {
      policyVersion: WHOLE_FOOD_STANDARD_VERSION,
      classification: "uncertain",
      confidence: "low",
      reasonCode: "INSUFFICIENT_CLASSIFICATION_EVIDENCE",
      reason: "This packaged product cannot be classified confidently without a verified ingredient label.",
      matchedTerms: [],
      shouldSubstitute: false,
      shouldBlock: false,
    };
  }

  const preferredMatches = matched(text, PREFERRED_TERMS);
  if (preferredMatches.length >= 2) {
    return {
      policyVersion: WHOLE_FOOD_STANDARD_VERSION,
      classification: "preferred",
      confidence: "medium",
      reasonCode: "WHOLE_OR_MINIMALLY_PROCESSED",
      reason: "The recommendation is anchored by recognizable whole or minimally processed foods.",
      matchedTerms: preferredMatches,
      shouldSubstitute: false,
      shouldBlock: false,
    };
  }

  return {
    policyVersion: WHOLE_FOOD_STANDARD_VERSION,
    classification: "uncertain",
    confidence: "low",
    reasonCode: "INSUFFICIENT_CLASSIFICATION_EVIDENCE",
    reason: "There is not enough reliable ingredient or preparation evidence to claim a processing classification.",
    matchedTerms: [],
    shouldSubstitute: false,
    shouldBlock: false,
  };
}

export function buildWholeFoodStandardPrompt(
  context: WholeFoodPolicyContext = {},
): string {
  const purposes = context.purposes?.length
    ? `Potentially relevant purposes: ${context.purposes.join(", ")}. A processed product is an exception only when it directly serves one of these purposes.`
    : "No purposeful processed-product exception has been established.";

  return `
${WHOLE_FOOD_PROMPT_MARKER} — ALWAYS-ON PLATFORM NUTRITION QUALITY POLICY:
- Prefer recognizable whole and minimally processed foods.
- Appropriate processed foods are allowed and must not be rejected merely for being processed: frozen produce, canned beans or fish, plain yogurt, tofu, minimally processed cheese, nut butter, and appropriate whole-grain products.
- When a clearly ultra-processed product has a practical, nutritionally stronger alternative that preserves the requested dish, culture, accessibility, and nutrition purpose, use the stronger alternative.
- Do not turn culturally authentic food into a generic Western health-food substitute. Preserve dish identity and culturally essential ingredients; improve product form only when practical.
- Clinical safety, allergies, authorized medical nutrition, dietary identity, GLP-1 tolerance, hypoglycemia treatment, and legitimate performance fueling always take precedence.
- Learned tastes and convenience preferences may choose among compliant options but cannot authorize an ultra-processed default.
- If product ingredients or restaurant preparation are unknown, label the classification uncertain internally; never invent processing certainty.
- Purposeful exceptions include clinically directed products, hypoglycemia treatment, performance fuel, accessibility support, and inadequate-intake support when genuinely required.
${purposes}`.trim();
}

export function appendWholeFoodStandardPrompt(
  prompt: string,
  context: WholeFoodPolicyContext = {},
): string {
  if (prompt.includes(WHOLE_FOOD_PROMPT_MARKER)) return prompt;
  return `${prompt}\n\n${buildWholeFoodStandardPrompt(context)}`;
}
