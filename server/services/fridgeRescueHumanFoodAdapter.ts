import type { HumanFoodContext } from "../../shared/humanFoodContext";
import type {
  HumanFoodCandidate,
  HumanFoodFinalValidationResult,
} from "../../shared/humanFoodValidation";
import { validateHumanFoodCandidate } from "./humanFoodContext/finalValidation";

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
}

function existingFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function toFridgeRescueHumanFoodCandidate(
  meal: FridgeRescueGeneratedMeal,
  evidence: {
    protocolValidated: boolean;
    glp1Validated: boolean;
  },
): HumanFoodCandidate {
  const nutrition = {
    calories: existingFiniteNumber(meal.calories),
    protein: existingFiniteNumber(meal.protein),
    carbs: existingFiniteNumber(meal.carbs),
    fat: existingFiniteNumber(meal.fat),
    starchyCarbs: existingFiniteNumber(meal.starchyCarbs),
  };
  const hasRequiredNutrition =
    nutrition.calories !== undefined &&
    nutrition.carbs !== undefined &&
    nutrition.fat !== undefined;

  return {
    name: meal.name,
    description: meal.description,
    ingredients: meal.ingredients ?? [],
    instructions: meal.instructions ?? [],
    nutrition,
    evidence: {
      sourceType: "generated_recipe",
      ingredientEvidence: "structured_generation",
      preparationEvidence: "structured_generation",
      nutritionEvidence: hasRequiredNutrition ? "structured_generation" : "unknown",
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
    const validation = validateHumanFoodCandidate(
      toFridgeRescueHumanFoodCandidate(meal, evidence),
      context,
    );
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