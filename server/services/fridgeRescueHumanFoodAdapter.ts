import type { HumanFoodContext } from "../../shared/humanFoodContext";
import type {
  HumanFoodCandidate,
  HumanFoodFinalValidationResult,
} from "../../shared/humanFoodValidation";
import { validateHumanFoodCandidate } from "./humanFoodContext/finalValidation";
import { verifyGeneratedIngredients } from "./generatedIngredientAdapter";

export interface FridgeRescueGeneratedMeal {
  name?: string;
  description?: string;
  ingredients?: Array<
    string | { name?: string; item?: string; quantity?: string; unit?: string }
  >;
  instructions?: string | string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
}

function existingFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
    ? value
    : undefined;
}

export function toFridgeRescueHumanFoodCandidate(
  meal: FridgeRescueGeneratedMeal,
  evidence: {
    protocolValidated: boolean;
    glp1Validated: boolean;
  },
): HumanFoodCandidate {
  const explicitCarbs = existingFiniteNumber(meal.carbs);
  const starchyCarbs = existingFiniteNumber(meal.starchyCarbs);
  const fibrousCarbs = existingFiniteNumber(meal.fibrousCarbs);
  const derivedCarbs =
    starchyCarbs !== undefined && fibrousCarbs !== undefined
      ? starchyCarbs + fibrousCarbs
      : undefined;
  const nutrition = {
    calories: existingFiniteNumber(meal.calories),
    protein: existingFiniteNumber(meal.protein),
    carbs: explicitCarbs ?? derivedCarbs,
    fat: existingFiniteNumber(meal.fat),
    starchyCarbs,
  };
  const hasVerifiedMeasurements =
    verifyGeneratedIngredients(meal.ingredients) !== null;

  const hasRequiredNutrition =
    nutrition.calories !== undefined &&
    nutrition.protein !== undefined &&
    nutrition.carbs !== undefined &&
    nutrition.fat !== undefined &&
    starchyCarbs !== undefined &&
    fibrousCarbs !== undefined &&
    derivedCarbs !== undefined &&
    Number.isFinite(derivedCarbs) &&
    (meal.carbs === undefined || explicitCarbs !== undefined) &&
    Math.abs(nutrition.carbs - derivedCarbs) <= 0.1;

  return {
    name: meal.name,
    description: meal.description,
    ingredients: meal.ingredients ?? [],
    instructions: meal.instructions ?? [],
    nutrition,
    evidence: {
      sourceType: "generated_recipe",
      ingredientEvidence: hasVerifiedMeasurements
        ? "structured_generation"
        : "unknown",
      preparationEvidence: "structured_generation",
      nutritionEvidence: hasRequiredNutrition && hasVerifiedMeasurements
        ? "structured_generation"
        : "unknown",
      dietaryIdentityCompliant: evidence.protocolValidated || undefined,
      clinicalDirectivesCompliant: evidence.protocolValidated || undefined,
      diabetesCompliant: evidence.protocolValidated || undefined,
      glp1Compliant: evidence.glp1Validated || undefined,
    },
  };
}

export function validateFridgeRescueMealsWithHumanFood<
  T extends FridgeRescueGeneratedMeal,
>(
  meals: T[],
  context: HumanFoodContext,
  evidence: {
    protocolValidated: boolean;
    glp1Validated: boolean;
  },
): {
  accepted: T[];
  rejected: Array<{
    meal: T;
    validation: HumanFoodFinalValidationResult;
  }>;
} {
  const accepted: T[] = [];
  const rejected: Array<{
    meal: T;
    validation: HumanFoodFinalValidationResult;
  }> = [];

  for (const meal of meals) {
    const candidate = toFridgeRescueHumanFoodCandidate(meal, evidence);
    let validation = validateHumanFoodCandidate(candidate, context);

    // Recipe integrity is mandatory even without a nutrition prescription.
    // Preserve existing clinical blocks and review findings.
    if (
      candidate.evidence?.nutritionEvidence === "unknown" &&
      !validation.findings.some(
        finding => finding.code === "nutrition_evidence_unknown",
      )
    ) {
      validation = {
        ...validation,
        outcome: validation.outcome === "blocked"
          ? "blocked"
          : "review_required",
        findings: [
          ...validation.findings,
          {
            dimension: "nutrition",
            outcome: "review_required",
            code: "nutrition_evidence_unknown",
            message: "Recipe measurements or nutrition could not be verified.",
            assurance: "structured_evidence",
          },
        ],
        repairInstructions: [],
      };
    }

    if (validation.outcome === "pass") {
      accepted.push(meal);
    } else {
      rejected.push({ meal, validation });
    }
  }

  return { accepted, rejected };
}

export function getFridgeRescueReleaseStatus(input: {
  generatedCount: number;
  glp1ValidatedCount: number;
  humanFoodValidatedCount: number;
}): 200 | 422 {
  if (input.generatedCount === 0 || input.glp1ValidatedCount === 0) return 422;
  if (input.humanFoodValidatedCount > 0) return 200;
  return 422;
}