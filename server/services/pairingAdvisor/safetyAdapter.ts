import type { AdvisorRequest, AdvisorResponse } from "../../../shared/pairingAdvisor/contracts";

export type InputSafety = "pass" | "restricted" | "unavailable";
export type SyntheticSafetyPorts = {
  mode: "synthetic_test_only";
  checkInput: (input: { request: AdvisorRequest; safetyContext: unknown }) => Promise<InputSafety>;
  scanGeneratedOutput: (input: { actionable: unknown; safetyContext: unknown }) => Promise<boolean>;
  scanAlcohol: (input: { actionable: unknown; safetyContext: unknown }) => Promise<boolean>;
};
export type SafetyAdapter = ReturnType<typeof createSafetyAdapter>;

/**
 * Injection seams for the existing pre-generation, protocol and alcohol checks.
 * No frozen scanner or runtime database module is imported or modified.
 */
export function createSafetyAdapter(ports?: SyntheticSafetyPorts) {
  return {
    async checkInput(request: AdvisorRequest, safetyContext: unknown): Promise<InputSafety> {
      if (ports?.mode !== "synthetic_test_only") return "unavailable";
      try {
        const result = await ports.checkInput({ request, safetyContext });
        return ["pass", "restricted", "unavailable"].includes(result) ? result : "unavailable";
      } catch {
        return "unavailable";
      }
    },
    async scanFinal(response: AdvisorResponse, safetyContext: unknown): Promise<boolean> {
      if (ports?.mode !== "synthetic_test_only") return false;
      if (response.outcome !== "recommendation") return false;
      // Educational paragraphs use the separate complete-response review, not ingredient scanning.
      const actionable = {
        recommendations: response.recommendations,
        bestChoiceId: response.bestChoiceId,
        narrative: response.narrative,
        followUps: response.followUps,
      };
      try {
        return await ports.scanGeneratedOutput({ actionable, safetyContext }) === true
          && await ports.scanAlcohol({ actionable, safetyContext }) === true;
      } catch {
        return false;
      }
    },
  };
}
