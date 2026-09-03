import type { HumanFoodContext } from "../../../shared/humanFoodContext";
import {
  HUMAN_FOOD_VALIDATOR_VERSION,
  type HumanFoodCandidate,
  type HumanFoodFinalValidationResult,
  type HumanFoodValidationFinding,
  type HumanFoodValidationOutcome,
} from "../../../shared/humanFoodValidation";
import { validateDishIdentity } from "../dishAdaptation/dishIdentityValidator";
import type { DishAdaptationDirective } from "../dishAdaptation/types";
import {
  buildForbiddenTermsFromAllergens,
  canonicalAllergenKey,
  getRequestedDishExemptTerms,
} from "../allergyGuardrails";
import { evaluateWholeFoodCandidate } from "../wholeFoodStandard";
import {
  buildHumanFoodRepairInstructions,
  humanFoodCandidateSignature,
  recordRejectedHumanFoodCandidate,
  type HumanFoodRequestExecutionState,
} from "./requestExecutionState";

export interface HumanFoodFinalValidationOptions {
  requestedDish?: string;
  requestedCategory?: string;
  dishDirective?: DishAdaptationDirective | null;
  executionState?: HumanFoodRequestExecutionState;
  practicalWholeFoodAlternativeAvailable?: boolean;
}

const OUTCOME_RANK: Record<HumanFoodValidationOutcome, number> = {
  pass: 0,
  repairable: 1,
  review_required: 2,
  blocked: 3,
};

const DIET_BLOCKS: Record<string, string[]> = {
  vegan: ["beef", "pork", "chicken", "turkey", "fish", "shrimp", "shellfish", "egg", "milk", "cheese", "butter", "cream", "honey"],
  vegetarian: ["beef", "pork", "chicken", "turkey", "fish", "shrimp", "shellfish"],
  pescatarian: ["beef", "pork", "chicken", "turkey"],
  "dairy free": ["milk", "cheese", "butter", "cream", "ghee", "whey", "casein"],
  "gluten free": ["wheat", "barley", "rye", "malt", "regular soy sauce"],
};

const DIETS_REQUIRING_STRUCTURED_EVIDENCE = new Set([
  "balanced",
  "keto",
  "low carb",
  "low fat",
  "mediterranean",
  "paleo",
  "carnivore",
]);

const ALLERGY_ALIASES: Record<string, string[]> = {
  dairy: ["milk", "cheese", "butter", "cream", "ghee", "whey", "casein"],
  lactose: ["milk", "cream", "ghee", "whey", "lactose"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "crayfish", "shellfish stock"],
  gluten: ["wheat", "barley", "rye", "malt", "regular soy sauce"],
  peanut: ["peanut", "groundnut"],
  tree_nut: ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut"],
};

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
}

function candidateText(candidate: HumanFoodCandidate): string {
  const ingredients = candidate.ingredients ?? [];
  const instructions = Array.isArray(candidate.instructions)
    ? candidate.instructions
    : [candidate.instructions ?? ""];
  return normalize([
    candidate.name,
    candidate.description,
    ...ingredients.flatMap((item) =>
      typeof item === "string" ? [item] : [item.name, item.item].filter(Boolean),
    ),
    ...instructions,
    ...(candidate.ingredientLabel ?? []),
  ].join(" | "));
}

function hasTerm(text: string, term: string): boolean {
  const normalized = normalize(term);
  if (normalized.length < 3) return false;
  return new RegExp(`(^|[^a-z0-9])${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(text);
}

function aliasesFor(term: string): string[] {
  const normalized = normalize(term);
  const canonical = canonicalAllergenKey(term);
  return Array.from(new Set([
    normalized,
    ...buildForbiddenTermsFromAllergens([canonical]),
    ...(ALLERGY_ALIASES[normalized.replace(/ /g, "_")] ?? []),
  ]));
}

function add(
  findings: HumanFoodValidationFinding[],
  finding: HumanFoodValidationFinding,
): void {
  if (!findings.some((item) => item.code === finding.code)) findings.push(finding);
}

function preferenceMismatch(
  findings: HumanFoodValidationFinding[],
  dimension: "cuisine" | "flavor",
  code: string,
  expected: { available: boolean; value: string | null },
  actual: string | undefined,
  label: string,
): void {
  if (!expected.available || !expected.value) return;
  if (!actual) {
    add(findings, {
      dimension,
      outcome: "review_required",
      code: `${code}_evidence_missing`,
      message: `${label} alignment cannot be verified from structured evidence.`,
      assurance: "structured_evidence",
    });
  } else if (normalize(actual) !== normalize(expected.value)) {
    add(findings, {
      dimension,
      outcome: "repairable",
      code: `${code}_mismatch`,
      message: `${label} does not match the authoritative request.`,
      assurance: "structured_evidence",
      repairHint: `Keep ${label.toLowerCase()} aligned to "${expected.value}".`,
    });
  }
}

export function validateHumanFoodCandidate(
  candidate: HumanFoodCandidate,
  context: HumanFoodContext,
  options: HumanFoodFinalValidationOptions = {},
): HumanFoodFinalValidationResult {
  const findings: HumanFoodValidationFinding[] = [];
  const text = candidateText(candidate);
  const evidence = candidate.evidence ?? {};

  if (!candidate.ingredients?.length) {
    add(findings, {
      dimension: "provenance", outcome: "review_required", code: "ingredients_missing",
      message: "Ingredients are required for final validation.", assurance: "structured_evidence",
    });
  }

  for (const allergy of context.safety.allergies) {
    const exemptTerms = new Set(
      getRequestedDishExemptTerms(options.requestedDish ?? "", [canonicalAllergenKey(allergy)])
        .map(normalize),
    );
    const matched = aliasesFor(allergy).filter(
      (term) => !exemptTerms.has(normalize(term)) && hasTerm(text, term),
    );
    if (matched.length) add(findings, {
      dimension: "allergy", outcome: "blocked", code: `allergy:${normalize(allergy)}`,
      message: `The candidate contains a confirmed allergy or intolerance conflict: ${allergy}.`,
      assurance: "deterministic", matchedTerms: matched,
    });
  }
  for (const avoided of context.safety.avoidedFoods) {
    if (hasTerm(text, avoided)) add(findings, {
      dimension: "avoidance", outcome: "repairable", code: `avoidance:${normalize(avoided)}`,
      message: `The candidate contains an avoided food: ${avoided}.`, assurance: "deterministic",
      repairHint: `Replace ${avoided} without changing the requested dish or cuisine.`,
    });
  }
  for (const disliked of context.safety.dislikedFoods) {
    if (hasTerm(text, disliked)) add(findings, {
      dimension: "avoidance", outcome: "repairable", code: `dislike:${normalize(disliked)}`,
      message: `The candidate contains a disliked food: ${disliked}.`, assurance: "deterministic",
      repairHint: `Replace ${disliked} with a flavor-compatible ingredient.`,
    });
  }

  for (const diet of context.diet.effective) {
    const key = normalize(diet);
    const matched = (DIET_BLOCKS[key] ?? []).filter((term) => hasTerm(text, term));
    if (matched.length) add(findings, {
      dimension: "dietary_identity", outcome: "blocked", code: `dietary_identity:${key}`,
      message: `The candidate conflicts with the effective ${diet} identity.`,
      assurance: "deterministic", matchedTerms: matched,
    });
    if (DIETS_REQUIRING_STRUCTURED_EVIDENCE.has(key)) {
      add(findings, {
        dimension: "dietary_identity",
        outcome: "review_required",
        code: `dietary_identity_evidence_required:${key}`,
        message: `${diet} compatibility requires structured composition evidence that this contract cannot infer from ingredient terms alone.`,
        assurance: "structured_evidence",
      });
    } else if (!DIET_BLOCKS[key] && key !== "halal" && key !== "kosher") {
      add(findings, {
        dimension: "dietary_identity",
        outcome: "review_required",
        code: `dietary_identity_unsupported:${key}`,
        message: `The effective ${diet} identity has no deterministic validator and cannot be treated as passing.`,
        assurance: "cannot_guarantee",
      });
    }
    if ((key === "halal" || key === "kosher") &&
        evidence[`${key}Certification` as "halalCertification" | "kosherCertification"] !== "verified") {
      add(findings, {
        dimension: "provenance", outcome: "review_required", code: `${key}_certification_unverified`,
        message: `${diet} certification or preparation provenance cannot be guaranteed.`,
        assurance: "cannot_guarantee",
      });
    }
  }

  const nutrition = candidate.nutrition;
  const remaining = context.nutrition?.projectedRemaining ?? context.nutrition?.remaining;
  if (context.nutrition) {
    if (evidence.nutritionEvidence === "unknown") add(findings, {
      dimension: "nutrition", outcome: "review_required", code: "nutrition_evidence_unknown",
      message: "Canonical nutrition limits cannot be checked against unknown nutrition evidence.",
      assurance: "structured_evidence",
    });
    for (const macro of ["calories", "carbs", "fat"] as const) {
      if (nutrition?.[macro] == null) add(findings, {
        dimension: "nutrition",
        outcome: "review_required",
        code: `verified_${macro}_missing`,
        message: `Canonical nutrition validation requires ${macro} data.`,
        assurance: "structured_evidence",
      });
    }
  }
  for (const macro of ["calories", "carbs", "fat"] as const) {
    if (remaining && nutrition?.[macro] != null && nutrition[macro]! > remaining[macro]) add(findings, {
      dimension: "nutrition", outcome: "blocked", code: `projected_${macro}_budget_exceeded`,
      message: `The candidate exceeds the canonical remaining ${macro} budget.`,
      assurance: "deterministic",
    });
  }
  if (context.nutrition?.activeConstraints.consumedStarchExhausted) {
    if (nutrition?.starchyCarbs == null) add(findings, {
      dimension: "starch", outcome: "review_required", code: "starch_evidence_missing",
      message: "Starch is exhausted and verified starchy-carbohydrate evidence is missing.",
      assurance: "structured_evidence",
    });
    else if (nutrition.starchyCarbs > 0) add(findings, {
      dimension: "starch", outcome: "blocked", code: "consumed_starch_budget_exhausted",
      message: "The candidate uses starch after the canonical starch budget is exhausted.",
      assurance: "deterministic",
    });
  }

  const conditions = context.safety.healthConditions.map(normalize);
  const glp1Active = conditions.some((condition) => condition.includes("glp 1") || condition.includes("semaglutide") || condition.includes("tirzepatide"));
  const diabetesActive = conditions.some((condition) => condition.includes("diabet"));
  if (glp1Active) {
    if (evidence.glp1Compliant === false) add(findings, {
      dimension: "clinical", outcome: "blocked", code: "glp1_noncompliant",
      message: "Structured clinical evidence marks the candidate GLP-1 noncompliant.",
      assurance: "structured_evidence",
    });
    else if (evidence.glp1Compliant !== true) add(findings, {
      dimension: "clinical", outcome: "review_required", code: "glp1_evidence_missing",
      message: "GLP-1 tolerance and portion compliance cannot be guaranteed without structured evidence.",
      assurance: "structured_evidence",
    });
  }
  if (diabetesActive) {
    if (evidence.diabetesCompliant === false) add(findings, {
      dimension: "clinical", outcome: "blocked", code: "diabetes_noncompliant",
      message: "Structured clinical evidence marks the candidate diabetes-noncompliant.",
      assurance: "structured_evidence",
    });
    else if (evidence.diabetesCompliant !== true) add(findings, {
      dimension: "clinical", outcome: "review_required", code: "diabetes_evidence_missing",
      message: "Diabetes compliance cannot be guaranteed without structured evidence.",
      assurance: "structured_evidence",
    });
  }

  const wholeFood = evaluateWholeFoodCandidate({
    ...candidate,
    preparationEvidence:
      evidence.preparationEvidence === "verified"
        ? "verified"
        : evidence.preparationEvidence === "unknown"
          ? "unknown"
          : undefined,
  }, {
    recommendationSurface: "human_food_final_validation",
    practicalAlternativeAvailable: options.practicalWholeFoodAlternativeAvailable,
  });
  if (wholeFood.classification === "uncertain") add(findings, {
    dimension: "whole_food", outcome: "review_required", code: "whole_food_evidence_insufficient",
    message: wholeFood.reason, assurance: "structured_evidence",
  });
  else if (wholeFood.shouldSubstitute) add(findings, {
    dimension: "whole_food", outcome: "repairable", code: wholeFood.reasonCode.toLowerCase(),
    message: wholeFood.reason, assurance: "deterministic",
    repairHint: "Use the strongest practical whole-food substitute while preserving the dish.",
  });

  preferenceMismatch(findings, "cuisine", "cuisine", context.flavor.cuisine, evidence.cuisine, "Cuisine");
  preferenceMismatch(findings, "cuisine", "cuisine_intensity", context.flavor.cuisineIntensity, evidence.cuisineIntensity, "Cuisine intensity");
  preferenceMismatch(findings, "flavor", "heat", context.flavor.heat, evidence.heat, "Heat");
  preferenceMismatch(findings, "flavor", "seasoning_intensity", context.flavor.seasoningIntensity, evidence.seasoningIntensity, "Seasoning intensity");
  preferenceMismatch(findings, "flavor", "broad_flavor", context.flavor.broadFlavor, evidence.broadFlavor, "Broad flavor");
  preferenceMismatch(findings, "flavor", "flavor_style", context.flavor.flavorStyle, evidence.flavorStyle, "Flavor style");

  if (options.requestedDish) {
    const identity = validateDishIdentity(options.requestedDish, candidate, options.dishDirective);
    if (identity.catastrophicDeviation || evidence.dishIdentityPreserved === false) add(findings, {
      dimension: "dish_identity", outcome: "blocked", code: "dish_identity_lost",
      message: `The result is not recognizably "${options.requestedDish}".`,
      assurance: "deterministic",
    });
  }
  if (options.requestedCategory && normalize(candidate.category) !== normalize(options.requestedCategory)) add(findings, {
    dimension: "food_category", outcome: "blocked", code: "food_category_changed",
    message: `The result changed the requested ${options.requestedCategory} category.`,
    assurance: "deterministic",
  });

  if ((evidence.sourceType === "restaurant" || evidence.sourceType === "branded_product") &&
      (evidence.ingredientEvidence !== "verified" || evidence.preparationEvidence !== "verified")) {
    add(findings, {
      dimension: "provenance", outcome: "review_required", code: "commercial_food_facts_unverified",
      message: "Restaurant preparation or branded-product facts cannot be guaranteed from unverified evidence.",
      assurance: "cannot_guarantee",
    });
  }

  const outcome = findings.reduce<HumanFoodValidationOutcome>(
    (current, finding) => OUTCOME_RANK[finding.outcome] > OUTCOME_RANK[current] ? finding.outcome : current,
    "pass",
  );
  if (outcome === "repairable" && options.executionState) {
    recordRejectedHumanFoodCandidate(options.executionState, candidate);
  }
  const repairInstructions = outcome === "repairable" && options.executionState
    ? buildHumanFoodRepairInstructions({
        state: options.executionState,
        contextFingerprint: context.internalFingerprint,
        repairHints: findings.flatMap((finding) => finding.repairHint ? [finding.repairHint] : []),
      })
    : [];
  return {
    validatorVersion: HUMAN_FOOD_VALIDATOR_VERSION,
    outcome,
    findings,
    authoritativeContextFingerprint: context.internalFingerprint,
    candidateSignature: humanFoodCandidateSignature(candidate),
    repairInstructions,
  };
}