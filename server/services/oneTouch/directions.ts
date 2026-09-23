import {
  type CulinaryFingerprint,
} from "@shared/culinaryIdentity";
import type { MyPerfectMenuCategory } from "@shared/myPerfectMenuCategory";
import {
  directionToFingerprint,
  type OneTouchDirection,
  type OneTouchRequest,
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
  system: string;
  user: string;
  temperature: number;
}

export interface GenerateOneTouchDirectionsInput {
  occasion: MyPerfectMenuCategory;
  menuShape?: "dish" | "craving";
  cravingType?: OneTouchRequest["cravingType"];
  cravingFeel?: OneTouchRequest["cravingFeel"];
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
  const direction = [
    input.cravingType && input.cravingType !== "surprise"
      ? `Craving Type: ${input.cravingType}. Food means a non-dessert food; Dessert means a dessert.`
      : "",
    input.cravingFeel && input.cravingFeel !== "surprise"
      ? `Craving Feel: ${input.cravingFeel}. This describes culinary character only; light/hearty impose no calorie or portion target. Sweet does not imply Dessert; salty does not imply Food.`
      : "",
  ].filter(Boolean);
  const result = await generateCulinaryConcepts({
    occasion: input.occasion,
    menuShape: input.menuShape,
    subjectLabel: "the person being fed",
    userContext: input.userContext ?? [],
    extraInstructions: [...direction, ...(input.extraInstructions ?? [])],
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
        ...(input.menuShape === "dish" ? validateDishConcept(direction) : []),
        ...(input.menuShape === "craving" ? validateCravingConcept(direction, input.cravingType, input.cravingFeel) : []),
        ...(input.humanFoodContext
          ? validateOneTouchDirectionSafety(direction, input.humanFoodContext, input.userProtocolEnvelope, input.requiredCuisine)
          : []),
      ];
    },
    generate: input.generate ? (request) => input.generate!(request) : undefined,
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

/** A DISH is a coherent preparation, not a bare ingredient or a composed plate. */
export function validateDishConcept(direction: OneTouchDirection): string[] {
  const form = direction.culinaryIdentity.dishForm.toLowerCase().trim();
  const title = direction.title.toLowerCase().trim();
  if (/^(plate|platter|composed plate|protein plate|meal plate|protein with sides)$/.test(form) ||
      /^(plate|platter|composed plate)$/.test(title) ||
      direction.primaryIngredients.some((ingredient) => title === ingredient.toLowerCase().trim())) {
    return ["culinary_shape:not_a_dish"];
  }
  return [];
}

export function validateCravingConcept(
  direction: OneTouchDirection,
  type: GenerateOneTouchDirectionsInput["cravingType"],
  feel: GenerateOneTouchDirectionsInput["cravingFeel"],
): string[] {
  const identity = direction.foodIdentity;
  if (type && type !== "surprise" && !identity) return ["craving_type:unverified"];
  if (type === "dessert" && identity?.foodRole !== "dessert") return ["craving_type:dessert"];
  if (type === "food" && identity?.foodRole === "dessert") return ["craving_type:food"];
  if (feel === "salty" && identity?.polarity !== "savory") return ["craving_feel:salty"];
  if (feel === "sweet" && identity?.polarity !== "sweet") return ["craving_feel:sweet"];
  return [];
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