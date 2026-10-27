import { gatheringsCourseOutcome } from "./gatheringsCourseOutcome";
import { recipeInstructions } from "./recipeDraftSafety";

export const GATHERINGS_VALIDATION_VERSION = "gatherings-protocol-scan-v1";
export const GATHERINGS_DIET_KEYS = ["kosher", "halal", "vegan", "vegetarian"] as const;
export type GatheringsDietKey = typeof GATHERINGS_DIET_KEYS[number];
export interface GatheringsValidationEvidence {
  version: typeof GATHERINGS_VALIDATION_VERSION;
  scope: "ingredient_and_instruction_protocol_scan";
  status: "passed";
  recipeIdentity: string;
  dietaryBadges: GatheringsDietKey[];
  medicalSuitability: "not_established";
}
export interface GatheringsEvidenceCourse {
  name?: unknown; description?: unknown; ingredients?: unknown;
  instructions?: unknown; cookingInstructions?: unknown;
  outcome?: unknown; _fallback?: unknown; servings?: unknown;
  nutrition?: unknown; nutritionResult?: unknown;
  medicalBadges?: unknown; validationEvidence?: unknown;
}
/** Exact snapshot identity, not a signature or an authorization token.
 * Binds cached evidence to the displayed recipe without hashing collisions.
 * Includes no user profile, protocol details or provider diagnostics. */
export function gatheringsRecipeIdentity(course: GatheringsEvidenceCourse): string {
  const ingredients = Array.isArray(course.ingredients) ? course.ingredients.map(row => ({
    name: row?.name ?? row?.item ?? null,
    amount: row?.amount ?? null, quantity: row?.quantity ?? null,
    unit: row?.unit ?? null, notes: row?.notes ?? null,
  })) : null;
  return JSON.stringify({
    name: course.name, description: course.description, ingredients,
    instructions: recipeInstructions(course), servings: course.servings ?? null,
    nutrition: course.nutrition ?? null, nutritionResult: course.nutritionResult ?? null,
  });
}
export function readGatheringsValidationEvidence(course: GatheringsEvidenceCourse): GatheringsValidationEvidence | null {
  if (gatheringsCourseOutcome(course) !== "success") return null;
  const evidence = course.validationEvidence as Partial<GatheringsValidationEvidence> | null;
  if (!evidence || evidence.version !== GATHERINGS_VALIDATION_VERSION ||
    evidence.status !== "passed" || evidence.scope !== "ingredient_and_instruction_protocol_scan" ||
    evidence.medicalSuitability !== "not_established" ||
    !Array.isArray(evidence.dietaryBadges) ||
    !evidence.dietaryBadges.every(key => GATHERINGS_DIET_KEYS.includes(key)) ||
    new Set(evidence.dietaryBadges).size !== evidence.dietaryBadges.length ||
    !Array.isArray(course.medicalBadges) ||
    course.medicalBadges.length !== evidence.dietaryBadges.length ||
    !course.medicalBadges.every((key, i) => key === evidence.dietaryBadges![i]) ||
    evidence.recipeIdentity !== gatheringsRecipeIdentity(course)) return null;
  return evidence as GatheringsValidationEvidence;
}
