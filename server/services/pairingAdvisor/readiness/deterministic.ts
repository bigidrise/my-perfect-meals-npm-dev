import type { AdvisorRequest, AdvisorResponse } from "../../../../shared/pairingAdvisor/contracts";
import type { ExistingDeterministicChecks } from "../deterministicSafetyBridge";
import type { OwnerAuthority } from "./authority";
import { CheckEnvelope } from "./authority";

export type DeterministicValidation = ReturnType<typeof createDeterministicValidation>;

/** Uses supplied unchanged scanner functions; no synthetic-mode adapter or runtime imports. */
export function createDeterministicValidation(checks: ExistingDeterministicChecks) {
  return {
    checkInput(request: AdvisorRequest, authority: OwnerAuthority): "pass" | "restricted" | "unavailable" {
      try {
        const envelope = CheckEnvelope.parse(authority.envelope);
        if (checks.requiresVerifiedIngredientEvidence(envelope)) return "restricted";
        const result = checks.enforceSafetyProfileSync({
          userId: envelope.userId, allergies: envelope.allergies,
          dietaryRestrictions: envelope.dietaryIdentity, healthConditions: envelope.medicalHardLimits,
          avoidIngredients: envelope.avoidances,
        }, request.message);
        return ["SAFE", "ADVISORY"].includes(result.result) ? "pass" : "restricted";
      } catch { return "unavailable"; }
    },
    scanFinal(response: AdvisorResponse, authority: OwnerAuthority): boolean {
      try {
        if (response.outcome !== "recommendation") return false;
        const envelope = CheckEnvelope.parse(authority.envelope);
        if (checks.requiresVerifiedIngredientEvidence(envelope)) return false;
        const fields: string[] = [];
        const collect = (value: unknown): void => {
          if (typeof value === "string") fields.push(value);
          else if (Array.isArray(value)) value.forEach(collect);
          else if (value && typeof value === "object") {
            for (const [key, part] of Object.entries(value)) {
              if (!["id", "listEntryId", "claims", "alternativeIds", "recommendationIds", "bestChoiceId"].includes(key)) collect(part);
            }
          }
        };
        collect({
          recommendations: response.recommendations, narrative: response.narrative,
          followUps: response.followUps,
        });
        if (!fields.length) return false;
        const halal = envelope.dietaryIdentity.some(item => item.trim().toLowerCase() === "halal");
        return [fields, ...fields.map(field => [field])].every(parts => {
          const ingredients = parts.map(name => ({ name }));
          return checks.scanGeneratedOutput({
            name: "Pairing advisor recommendation", description: parts.join("\n"), ingredients, instructions: parts,
          }, envelope, { generatorName: "pairings_ai" }).passed === true
            && (!halal || !checks.containsAlcoholContent({ ingredients }));
        });
      } catch { return false; }
    },
  };
}
