import type {
  HumanFoodValidationFinding,
  HumanFoodValidationOutcome,
} from "../../../shared/humanFoodValidation";

export type CreateDishOutcomeType =
  | "REQUEST_FULFILLED"
  | "REQUEST_ADAPTED"
  | "REQUEST_BLOCKED_WITH_REASON"
  | "REVIEW_REQUIRED_WITH_REASON"
  | "TECHNICAL_FAILURE";

export interface CreateDishOutcome {
  type: CreateDishOutcomeType;
  governingReasonCode: string | null;
  explanation: string | null;
  requestedDishPreserved: boolean;
  ingredientsOrPreparationAdapted: boolean;
  alternativesAvailable: boolean;
}

export function buildCreateDishValidationOutcome(
  outcome: HumanFoodValidationOutcome,
  findings: HumanFoodValidationFinding[],
): CreateDishOutcome {
  const governingFinding =
    findings.find((finding) => finding.outcome === "blocked") ??
    findings.find((finding) => finding.outcome === "review_required") ??
    findings[0];

  return {
    type:
      outcome === "review_required"
        ? "REVIEW_REQUIRED_WITH_REASON"
        : "REQUEST_BLOCKED_WITH_REASON",
    governingReasonCode: governingFinding?.code ?? null,
    explanation:
      governingFinding?.message ??
      (outcome === "review_required"
        ? "We couldn't verify enough evidence to return this food safely."
        : "We couldn't produce a version that passed your final food protections."),
    requestedDishPreserved: !findings.some(
      (finding) => finding.code === "dish_identity_lost",
    ),
    ingredientsOrPreparationAdapted: false,
    alternativesAvailable: false,
  };
}