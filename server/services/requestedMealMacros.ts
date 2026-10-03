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