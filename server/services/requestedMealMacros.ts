// Request matching only: these values never replace a prescription or budget.
export type RequestedMacroField =
  | "protein_g" | "carbs_g" | "starchy_carbs_g" | "fibrous_carbs_g" | "fat_g";
export type RequestedMacroRelationship = "approximately" | "at_least" | "at_most";

export interface RequestedMealMacroTargets {
  protein_g?: number;
  /** Total carbohydrate, not starchy carbohydrate or dietary fiber. */
  carbs_g?: number;
  starchy_carbs_g?: number;
  fibrous_carbs_g?: number;
  fat_g?: number;
  /** Numeric targets without a relationship retain approximate semantics. */
  relationships?: Partial<Record<RequestedMacroField, RequestedMacroRelationship>>;
}

const MACRO_FIELDS = [
  { field: "protein_g", nutrition: "protein", label: "protein" },
  { field: "carbs_g", nutrition: "carbs", label: "TOTAL carbohydrates" },
  { field: "starchy_carbs_g", nutrition: "starchyCarbs", label: "starchy carbohydrates" },
  { field: "fibrous_carbs_g", nutrition: "fibrousCarbs", label: "fibrous carbohydrates (not dietary fiber)" },
  { field: "fat_g", nutrition: "fat", label: "fat" },
] as const;

export interface RequestedMealMacroConstraint {
  field: RequestedMacroField;
  nutrition: typeof MACRO_FIELDS[number]["nutrition"];
  label: string;
  grams: number;
  relationship: RequestedMacroRelationship;
}

// Reuse the existing requested-macro convention in fridgeRescueGenerator.ts.
// This tolerance applies ONLY to approximate requests, never one-sided limits.
export const REQUESTED_MACRO_APPROXIMATION_G = 5;

/** Only explicit nutrient amounts in the original user text; never profile data.
 * Ingredient weights and relative refinements are deliberately not inferred.
 */
export function extractRequestedMealMacroTargets(text: string): RequestedMealMacroTargets | undefined {
  const targets: RequestedMealMacroTargets = {};
  const names = [
    ["starchy_carbs_g", "starchy carbohydrates|starchy carbs|starch"],
    ["fibrous_carbs_g", "fibrous carbohydrates|fibrous carbs"],
    ["carbs_g", "total carbohydrates|total carbs"],
    ["protein_g", "protein"],
    ["fat_g", "fat"],
  ] as const;
  for (const [field, name] of names) {
    const after = new RegExp(`(?:(at most|no more than|at least|approximately|about)\\s+)?(\\d+(?:\\.\\d+)?)\\s*(?:grams?|g)\\s+(?:of\\s+)?(?:${name})\\b(?!\\s+(?:powder|flour|ingredient))`, "i");
    const before = new RegExp(`(?:keep|limit|target|aim for)\\s+(?:the\\s+)?(?:${name})\\s+(?:at|to|under|of)\\s+(\\d+(?:\\.\\d+)?)\\s*(?:grams?|g)\\b`, "i");
    // A daily-budget mention is not a recipe-design instruction. In "I have
    // 10g left, but make this with 20g starch", only the latter clause qualifies.
    const clause = text.split(/[,;!?]|\bbut\b/i).find(part =>
      !/\b(?:remaining|left|daily|budget|per day|for today)\b/i.test(part) &&
      (after.test(part) || before.test(part)),
    );
    if (!clause) continue;
    const a = clause.match(after);
    const b = clause.match(before);
    if (!a && !b) continue;
    const match = a ?? b!;
    // "Reduce starch by 10g" is a delta, not a 10g absolute target.
    if (/\b(?:reduce|decrease|increase|add|remove)\b.{0,30}\bby\s*$/i.test(clause.slice(0, match.index))) continue;
    const value = Number(a ? a[2] : b![1]);
    if (!Number.isFinite(value) || value < 0) continue;
    targets[field] = value;
    const relationship = a?.[1]?.toLowerCase();
    targets.relationships ??= {};
    targets.relationships[field] = relationship === "at least" ? "at_least"
      : relationship === "at most" || relationship === "no more than" || (b && /\bunder\b/i.test(b[0]))
        ? "at_most" : "approximately";
  }
  return Object.keys(targets).length ? targets : undefined;
}

export function resolveRequestedMealMacros(input?: RequestedMealMacroTargets): RequestedMealMacroConstraint[] {
  if (input == null) return [];
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Requested meal macroTargets must be an object.");
  }
  const fields = new Set<string>(MACRO_FIELDS.map(({ field }) => field));
  for (const key of Object.keys(input)) {
    if (key !== "relationships" && !fields.has(key)) {
      throw new Error(`Unsupported requested meal macro field: ${key}.`);
    }
  }
  const relationships = input.relationships;
  if (relationships !== undefined) {
    if (!relationships || typeof relationships !== "object" || Array.isArray(relationships)) {
      throw new Error("Requested macro relationships must be an object.");
    }
    for (const [field, relationship] of Object.entries(relationships)) {
      if (!fields.has(field) || input[field as RequestedMacroField] === undefined ||
          !["approximately", "at_least", "at_most"].includes(relationship as string)) {
        throw new Error("Each requested macro relationship needs a supported numeric target and relationship.");
      }
    }
  }
  return MACRO_FIELDS.flatMap(({ field, nutrition, label }) => {
    const grams = input[field];
    if (grams === undefined) return [];
    if (typeof grams !== "number" || !Number.isFinite(grams) || grams < 0) {
      throw new Error(`Requested ${label} must be a finite, nonnegative number of grams.`);
    }
    return [{ field, nutrition, label, grams, relationship: relationships?.[field] ?? "approximately" }];
  });
}

export function buildRequestedMealMacroPrompt(targets: RequestedMealMacroConstraint[]): string {
  if (!targets.length) return "";
  const instructions = targets.map(({ label, grams, relationship }) => {
    const request = relationship === "at_most" ? `at most ${grams}g (upper limit; never exceed)`
      : relationship === "at_least" ? `at least ${grams}g (minimum)`
      : `approximately ${grams}g (within ±${REQUESTED_MACRO_APPROXIMATION_G}g)`;
    return `- ${label}: ${request} PER SERVING.`;
  });
  return [
    "EXPLICIT REQUESTED PER-MEAL MACROS:",
    ...instructions,
    "These are meal requests, NOT replacements for the daily prescription or server-resolved remaining macros.",
    "Allergies, avoidances, dietary identity, authoritative MPM context and clinical/safety restrictions remain authoritative. Never bypass them to meet a request.",
    "Total carbohydrates include both starchy and fibrous carbohydrates. Neither category alone nor dietary fiber is total carbohydrate.",
    "Report honest nutrition estimates for the actual recipe; do not change reported values merely to pass these requests.",
    "Nutrient grams are NOT ingredient weight: 15g starchy carbohydrates does not mean 15g potatoes or rice. Calculate each ingredient's estimated nutrient contribution for the specified serving, adjust real portions, then recompute nutrition.",
    "Treat these as recipe-design instructions independent of daily targets. If reliable matching is not possible, explain the actual estimated result and uncertainty; never falsely claim exact compliance.",
  ].join("\n");
}

export function validateRequestedMealMacros(
  nutrition: Partial<Record<RequestedMealMacroConstraint["nutrition"], unknown>>,
  targets: RequestedMealMacroConstraint[],
): string[] {
  return targets.flatMap(({ nutrition: key, label, grams, relationship }) => {
    const actual = nutrition[key];
    if (typeof actual !== "number" || !Number.isFinite(actual) || actual < 0) {
      return [`Requested ${label} could not be checked against a valid returned nutrition value.`];
    }
    const matches = relationship === "at_most" ? actual <= grams
      : relationship === "at_least" ? actual >= grams
      : actual >= Math.max(0, grams - REQUESTED_MACRO_APPROXIMATION_G) &&
        actual <= grams + REQUESTED_MACRO_APPROXIMATION_G;
    return matches ? [] : [
      `Returned ${label} is ${actual}g per serving; the request is ${relationship.replace(/_/g, " ")} ${grams}g` +
      (relationship === "approximately" ? ` (±${REQUESTED_MACRO_APPROXIMATION_G}g).` : "."),
    ];
  });
}