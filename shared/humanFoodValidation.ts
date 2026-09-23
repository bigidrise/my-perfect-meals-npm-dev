export const HUMAN_FOOD_VALIDATOR_VERSION = "human-food-final-validator.v1" as const;

export type HumanFoodValidationOutcome =
  | "pass"
  | "repairable"
  | "review_required"
  | "blocked";

export type HumanFoodValidationDimension =
  | "allergy"
  | "avoidance"
  | "dietary_identity"
  | "clinical"
  | "glucose_food_preference"
  | "nutrition"
  | "starch"
  | "whole_food"
  | "cuisine"
  | "dish_identity"
  | "food_category"
  | "flavor"
  | "provenance";

export type HumanFoodValidationAssurance =
  | "deterministic"
  | "structured_evidence"
  | "cannot_guarantee";

export interface HumanFoodValidationFinding {
  dimension: HumanFoodValidationDimension;
  outcome: Exclude<HumanFoodValidationOutcome, "pass">;
  code: string;
  message: string;
  assurance: HumanFoodValidationAssurance;
  matchedTerms?: string[];
  repairHint?: string;
}

/** Exact requirement keys prevent a result for one diet or protocol from proving another. */
export type HumanFoodRequirementKey =
  | `dietary_identity:${string}`
  | `clinical:${string}`
  | `program:${string}`;

export interface HumanFoodRequirementProof {
  status: "pass" | "fail" | "review_required";
  source:
    | "ingredient_classifier"
    | "diabetes_authority"
    | "glp1_authority"
    | "protocol_scan"
    | "program_rule_pack"
    | "nutrition_target_check"
    | "none";
  nutritionBasis?: "model_estimate" | "verified" | "not_applicable";
}

export interface HumanFoodCandidateEvidence {
  sourceType?: "generated_recipe" | "verified_label" | "restaurant" | "branded_product";
  ingredientEvidence?: "verified" | "structured_generation" | "unknown";
  preparationEvidence?: "verified" | "structured_generation" | "unknown";
  nutritionEvidence?: "verified" | "structured_generation" | "unknown";
  cuisine?: string;
  cuisineIntensity?: string;
  heat?: string;
  seasoningIntensity?: string;
  broadFlavor?: string;
  flavorStyle?: string;
  dishIdentityPreserved?: boolean;
  categoryIdentityPreserved?: boolean;
  dietaryIdentityCompliant?: boolean;
  clinicalDirectivesCompliant?: boolean;
  glp1Compliant?: boolean;
  diabetesCompliant?: boolean;
  /** Additive contract; legacy callers continue to use their existing fields. */
  requirementEvidence?: Partial<Record<HumanFoodRequirementKey, HumanFoodRequirementProof>>;
  halalCertification?: "verified" | "claimed" | "unknown";
  kosherCertification?: "verified" | "claimed" | "unknown";
}

export interface HumanFoodCandidate {
  name?: string;
  description?: string;
  category?: string;
  ingredients?: Array<string | { name?: string; item?: string; quantity?: string; unit?: string }>;
  instructions?: string | string[];
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    starchyCarbs?: number;
  };
  evidence?: HumanFoodCandidateEvidence;
  isPackagedProduct?: boolean;
  ingredientLabel?: string[];
}

export interface HumanFoodFinalValidationResult {
  validatorVersion: typeof HUMAN_FOOD_VALIDATOR_VERSION;
  outcome: HumanFoodValidationOutcome;
  findings: HumanFoodValidationFinding[];
  authoritativeContextFingerprint: string;
  candidateSignature: string;
  repairInstructions: string[];
}