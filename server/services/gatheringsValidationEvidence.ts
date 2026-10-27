import type { ProtocolScanResult, scanGeneratedOutput } from "./protocolEnvelope";
import { recipeInstructions } from "../../shared/recipeDraftSafety";
import { gatheringsCourseOutcome } from "../../shared/gatheringsCourseOutcome";
import {
  GATHERINGS_DIET_KEYS, GATHERINGS_VALIDATION_VERSION, gatheringsRecipeIdentity,
  type GatheringsEvidenceCourse, type GatheringsValidationEvidence,
} from "../../shared/gatheringsValidationEvidence";

/** Gatherings-only scan view; never used for recipe nutrition or persistence. */
export function gatheringsProtocolScanInput(meal: Parameters<typeof scanGeneratedOutput>[0] & { cookingInstructions?: unknown }) {
  const instructions = recipeInstructions(meal);
  const ingredients: Array<{ name?: string; item?: string } | string> = [
    ...(meal.ingredients ?? []), ...instructions.map(name => ({ name })),
  ];
  return {
    ...meal, instructions, ingredients,
  };
}

/** Only an actual completed scan can attest evidence. A profile, model flag,
 * classification object, or bare passed:true is not badge evidence.
 * Do not promote an explicit empty badge list into positive claims. */
export function buildGatheringsValidationEvidence(
  course: GatheringsEvidenceCourse, scan: ProtocolScanResult, activeDiets: string[],
): GatheringsValidationEvidence | null {
  if (gatheringsCourseOutcome(course) !== "success" ||
    !scan.passed || !Array.isArray(scan.violations) || scan.violations.length ||
    !Array.isArray(scan.instructionViolations) || scan.instructionViolations.length) return null;
  const active = new Set(activeDiets.map(key => key.trim().toLowerCase()));
  if (active.has("kosher-halal")) { active.add("kosher"); active.add("halal"); }
  const source = Array.isArray(course.medicalBadges) ? course.medicalBadges : [];
  const dietaryBadges = GATHERINGS_DIET_KEYS.filter(key => active.has(key) && source.includes(key));
  return {
    version: GATHERINGS_VALIDATION_VERSION, status: "passed",
    scope: "ingredient_and_instruction_protocol_scan",
    recipeIdentity: gatheringsRecipeIdentity(course), dietaryBadges,
    // A text protocol scan supplies no condition-specific nutrient clearance.
    medicalSuitability: "not_established",
  };
}
