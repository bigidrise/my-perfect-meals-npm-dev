import type { ProtocolScanResult } from "./protocolEnvelope";

export const GETAWAY_INGREDIENT_CAUTION =
  "Full restaurant ingredients are unverified. These are practical dining suggestions, not confirmation of Anti-Inflammatory compliance. Ask about preparation, sauces and substitutions.";

/** Only the lack of recipe evidence for OPTIONAL support becomes a caution.
 * Known conflicts and every other dietary/clinical finding remain blocking. */
export function getawayDiningScan(scan: ProtocolScanResult, optionalSupport: boolean) {
  const isEvidenceOnly = (finding: ProtocolScanResult["violations"][number]) =>
    optionalSupport && finding.category === "anti-inflammatory-support" &&
    finding.reason === "Ingredient details are required to verify optional Anti-Inflammatory support.";
  const waived = (scan.violations ?? []).filter(isEvidenceOnly);
  if (!waived.length) return { scan, cautions: [] as string[] };
  const violations = scan.violations.filter(finding => !isEvidenceOnly(finding));
  return {
    scan: { ...scan, violations, passed: violations.length === 0 && !(scan.instructionViolations ?? []).length },
    cautions: [GETAWAY_INGREDIENT_CAUTION],
  };
}
