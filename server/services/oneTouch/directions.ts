import {
  type CulinaryFingerprint,
} from "@shared/culinaryIdentity";
import type { MyPerfectMenuCategory } from "@shared/myPerfectMenuCategory";
import {
  directionToFingerprint,
  type OneTouchDirection,
} from "@shared/oneTouch";
import { cuisineLabelsCompatible } from "../myPerfectMenu/generationContract";
import { generateCulinaryConcepts } from "../myPerfectMenu/culinaryConceptEngine";
import { validateHumanFoodResult } from "../humanFoodContext/validateHumanFoodResult";
import type { HumanFoodContext } from "../../../shared/humanFoodContext";
import { validateDietaryRestriction, type DietaryMode } from "../guardrails/validators/dietaryRestrictionValidator";
import { scanGeneratedOutput, type UserProtocolEnvelope } from "../protocolEnvelope";

export interface DirectionGenerationAttempt {
  requestedCount: number;
  attempt: number;
}

export interface GenerateOneTouchDirectionsInput {
  occasion: MyPerfectMenuCategory;
  history: CulinaryFingerprint[];
  existingDirections?: OneTouchDirection[];
  generate?: (attempt: DirectionGenerationAttempt) => Promise<unknown>;
  userContext?: string[];
  extraInstructions?: string[];
  validate: (direction: OneTouchDirection) => string[];
  /** Authoritative, request-scoped safety inputs. When supplied they are always enforced. */
  humanFoodContext?: HumanFoodContext;
  userProtocolEnvelope?: UserProtocolEnvelope;
  requiredCuisine?: string | null;
  targetCount?: 1 | 2 | 3;
}

export interface GenerateOneTouchDirectionsResult {
  directions: OneTouchDirection[];
  history: CulinaryFingerprint[];
  attemptsCompleted: number;
  metadataRepairCount: number;
  rejectionCodes: string[];
}

export async function generateOneTouchDirections(
  input: GenerateOneTouchDirectionsInput,
): Promise<GenerateOneTouchDirectionsResult> {
  const result = await generateCulinaryConcepts({
    occasion: input.occasion,
    subjectLabel: "the person being fed",
    userContext: input.userContext ?? [],
    extraInstructions: input.extraInstructions,
    requiredCuisine: input.requiredCuisine ?? null,
    targetCount: input.targetCount,
    history: [
      ...input.history,
      ...(input.existingDirections ?? []).map(directionToFingerprint),
    ],
    rejectHistoryFingerprints: true,
    validate: (concept) => {
      const direction = { ...concept, occasion: input.occasion } as OneTouchDirection;
      return [
        ...input.validate(direction),
        ...(input.humanFoodContext
          ? validateOneTouchDirectionSafety(direction, input.humanFoodContext, input.userProtocolEnvelope, input.requiredCuisine)
          : []),
      ];
    },
    generate: input.generate
      ? ({ attempt, requestedCount }) => input.generate!({ attempt, requestedCount })
      : undefined,
  });
  const directions = result.concepts.map((concept) =>
    ({ ...concept, occasion: input.occasion }) as OneTouchDirection);
  return {
    directions,
    history: directions.map(directionToFingerprint),
    attemptsCompleted: result.attemptsCompleted,
    metadataRepairCount: result.metadataRepairCount,
    rejectionCodes: result.rejectionCodes,
  };
}

function directionMeal(direction: OneTouchDirection) {
  return {
    name: direction.title,
    description: direction.description,
    ingredients: direction.primaryIngredients.map((name) => ({ name })),
    instructions: [`Prepare using ${direction.preparationMethod}.`],
    preparationEvidence: "unknown" as const,
  };
}

/** Shared safety boundary for delegated directions; callers provide authoritative inputs. */
export function validateOneTouchDirectionSafety(
  direction: OneTouchDirection,
  context: HumanFoodContext,
  envelope?: UserProtocolEnvelope,
  requiredCuisine?: string | null,
): string[] {
  const meal = directionMeal(direction);
  const violations = validateHumanFoodResult(meal, context, { requireNutrition: false }).violations;
  const diet = context.diet.effective.find((value): value is DietaryMode =>
    ["vegan", "vegetarian", "pescatarian", "carnivore"].includes(value.toLowerCase()),
  )?.toLowerCase() as DietaryMode | undefined;
  if (diet) {
    const result = validateDietaryRestriction(meal, diet);
    if (!result.isValid) violations.push(...(result.blockedIngredients ?? []).map((item) => `dietary:${item}`));
  }
  if (requiredCuisine && !cuisineLabelsCompatible(direction.cuisine, requiredCuisine)) {
    violations.push(`cuisine_mismatch:${direction.cuisine}`);
  }
  if (envelope) {
    const scan = scanGeneratedOutput(meal, envelope, { generatorName: "one-touch-directions" });
    if (!scan.passed) violations.push(...scan.violations.map((item: any) => `protocol:${item.code ?? item.message ?? "violation"}`));
  }
  return violations;
}