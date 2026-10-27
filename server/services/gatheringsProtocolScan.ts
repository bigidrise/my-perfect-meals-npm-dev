import { scanGeneratedOutput, type UserProtocolEnvelope } from "./protocolEnvelope";
import { buildForbiddenIngredients, scanForViolations } from "./allergyGuardrails";
import { gatheringsProtocolScanInput } from "./gatheringsValidationEvidence";

/** Gatherings-only application of existing rules; no new dietary definitions.
 * The protocol scan checks derivative/procedural rules, but its direct animal
 * food wall covers vegan/vegetarian, not obvious kosher/halal pork ingredients.
 * Reuse the canonical restriction expansion and safety scanner for religious
 * identities; the primary-diet helper intentionally excludes those identities.
 * Do not turn softer dietary guidance or clinical thresholds into new gates. */
export function scanGatheringsCourse(
  meal: Parameters<typeof gatheringsProtocolScanInput>[0],
  envelope: UserProtocolEnvelope,
  context?: Parameters<typeof scanGeneratedOutput>[2],
) {
  const scanMeal = gatheringsProtocolScanInput(meal);
  const protocol = scanGeneratedOutput(scanMeal, envelope, context);
  if (!protocol.passed) return protocol;
  const identities = envelope.dietaryIdentity.flatMap(raw => {
    const key = raw.trim().toLowerCase();
    return key === "kosher-halal" ? ["kosher", "halal"] : [key];
  }).filter(key => ["kosher", "halal"].includes(key));
  if (!identities.length) return protocol;
  const forbidden = buildForbiddenIngredients({ allergies: [], dietaryRestrictions: identities, avoidIngredients: [] });
  const violations = scanForViolations({
    ingredients: scanMeal.ingredients.map(row => ({
      name: typeof row === "string" ? row : row.name ?? row.item ?? "",
    })),
  }, forbidden);
  if (!violations.length) return protocol;
  return {
    ...protocol, passed: false,
    violations: [...(protocol.violations ?? []), ...violations.map(term => ({
      term, category: "dietary", reason: "Existing dietary identity constraint",
    }))],
    message: "Gatherings recipe did not pass the applicable dietary checks.",
  };
}
