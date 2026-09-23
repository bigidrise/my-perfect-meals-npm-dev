import {
  buildCulinaryFingerprint,
  hasMeaningfulCulinaryRepetition,
  selectCulinarilyBroadConcepts,
  type CulinaryFingerprint,
} from "@shared/culinaryIdentity";
import type { MyPerfectMenuCategory } from "@shared/myPerfectMenuCategory";
import {
  directionToFingerprint,
  type OneTouchDirection,
} from "@shared/oneTouch";
import { conceptCompletionFailure } from "../myPerfectMenu/candidateCompletion";
import {
  cuisineLabelsCompatible,
  parseGeneratedMenuCandidates,
} from "../myPerfectMenu/generationContract";
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
  generate: (attempt: DirectionGenerationAttempt) => Promise<unknown>;
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
  const targetCount = input.targetCount ?? 3;
  if (targetCount < 1 || targetCount > 3) throw new Error("ONE_TOUCH_INVALID_TARGET_COUNT");
  const candidates: OneTouchDirection[] = [...(input.existingDirections ?? [])].slice(0, targetCount);
  const rejectionCodes: string[] = [];
  let attemptsCompleted = 0;
  let metadataRepairCount = 0;
  let providerFailures = 0;

  while (
    candidates.length < targetCount &&
    (attemptsCompleted < 3 || (candidates.length > 0 && attemptsCompleted < 5))
  ) {
    const attempt = attemptsCompleted;
    attemptsCompleted += 1;
    const requestedCount = Math.max(0, targetCount - candidates.length);
    let raw: unknown;
    try {
      raw = await input.generate({ attempt, requestedCount });
    } catch {
      providerFailures += 1;
      continue;
    }
    const parsed = parseGeneratedMenuCandidates(raw, input.occasion);
    metadataRepairCount += parsed.metadataRepairCount;
    rejectionCodes.push(...parsed.rejectionCodes);
    for (const candidate of parsed.candidates) {
      const direction = { ...candidate, occasion: input.occasion } as OneTouchDirection;
      const violations = [
        ...input.validate(direction),
        ...(input.humanFoodContext
          ? validateOneTouchDirectionSafety(direction, input.humanFoodContext, input.userProtocolEnvelope, input.requiredCuisine)
          : []),
      ];
      if (violations.length) {
        rejectionCodes.push(...violations);
        continue;
      }
      const fingerprint = buildCulinaryFingerprint(direction, input.occasion);
      if (
        input.history.some((prior) => prior.fingerprint === fingerprint.fingerprint) ||
        candidates.some((prior) => buildCulinaryFingerprint(prior, input.occasion).fingerprint === fingerprint.fingerprint)
      ) {
        rejectionCodes.push("repetition:signature");
        continue;
      }
      candidates.push(direction);
    }
    const broad = selectCulinarilyBroadConcepts(candidates, input.occasion, input.history, targetCount);
    candidates.splice(0, candidates.length, ...broad);
    if (candidates.length === targetCount && !hasMeaningfulCulinaryRepetition(candidates, input.occasion)) break;
  }

  if (candidates.length !== targetCount) {
    const categories = rejectionCodes.reduce<Record<string, number>>((result, code) => {
      const category = code.includes(":") ? code.split(":")[0] : code;
      result[category] = (result[category] ?? 0) + 1;
      return result;
    }, {});
    const failure = conceptCompletionFailure(categories, providerFailures);
    throw Object.assign(new Error(failure.error), {
      code: failure.code,
      status: failure.status,
      missingCount: Math.max(0, targetCount - candidates.length),
      attemptsCompleted,
      metadataRepairCount,
    });
  }

  return {
    directions: candidates,
    history: candidates.map((direction) => directionToFingerprint(direction)),
    attemptsCompleted,
    metadataRepairCount,
    rejectionCodes,
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