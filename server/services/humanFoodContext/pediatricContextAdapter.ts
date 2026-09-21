import { createHmac, randomUUID } from "crypto";
import {
  HUMAN_FOOD_CONTEXT_VERSION,
  type HumanFoodContext,
} from "../../../shared/humanFoodContext";
import type { HumanFoodCandidate } from "../../../shared/humanFoodValidation";
import type { PediatricMealGenerationContext } from "../pediatric/pediatricResolver";
import { freezeHumanFoodContext } from "./resolveHumanFoodContext";
import {
  normalizeFoodInclusionPrioritiesDocument,
  type FoodInclusionPrioritiesDocument,
} from "../../../shared/nutritionPriorities";

interface AllergyInput {
  allergenId: string;
  customAllergenName?: string;
  severity: string;
}

interface BuildPediatricHumanFoodContextInput {
  actorUserId: string;
  subjectId: string;
  correlationId?: string | null;
  resolverContext: PediatricMealGenerationContext | null;
  allergies: AllergyInput[];
  dietaryPattern?: string | null;
  explicitCuisine?: string | null;
  foodInclusionPriorities?: FoodInclusionPrioritiesDocument | null;
}

const unavailablePreference = () => ({
  value: null,
  source: "unavailable" as const,
  available: false,
});

export function buildPediatricHumanFoodContext(
  input: BuildPediatricHumanFoodContextInput,
): HumanFoodContext {
  const now = new Date();
  const effectiveDiet =
    input.dietaryPattern && input.dietaryPattern !== "omnivore"
      ? [
          input.dietaryPattern === "gluten_free_diagnosed"
            ? "gluten free"
            : input.dietaryPattern === "dairy_free"
              ? "dairy free"
              : input.dietaryPattern,
        ]
      : [];
  const resolvedCuisine =
    input.explicitCuisine?.trim() ||
    input.resolverContext?.parentOverrides.culturalCuisine?.trim() ||
    null;
  const allergyNames = input.allergies
    .filter((entry) => entry.severity !== "preference_avoid")
    .map((entry) =>
      entry.allergenId === "other" && entry.customAllergenName
        ? entry.customAllergenName
        : entry.allergenId.replace(/_/g, " "),
    );
  const avoidedFoods = input.allergies
    .filter((entry) => entry.severity === "preference_avoid")
    .map((entry) =>
      entry.allergenId === "other" && entry.customAllergenName
        ? entry.customAllergenName
        : entry.allergenId.replace(/_/g, " "),
    );
  const base: Omit<HumanFoodContext, "internalFingerprint"> = {
    version: HUMAN_FOOD_CONTEXT_VERSION,
    status: "resolved",
    creator: "my_perfect_beginning",
    actorUserId: input.actorUserId,
    subjectUserId: input.subjectId,
    generationChainId: randomUUID(),
    correlationId: input.correlationId || randomUUID(),
    resolvedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    diet: {
      stored: effectiveDiet,
      effective: effectiveDiet,
      source: input.dietaryPattern ? "request" : "unavailable",
      requestOverride: input.dietaryPattern || null,
      adaptationOutcome: input.dietaryPattern
        ? "request_override_applied"
        : "unavailable",
    },
    flavor: {
      heat: unavailablePreference(),
      seasoningIntensity: unavailablePreference(),
      broadFlavor: unavailablePreference(),
      flavorStyle: unavailablePreference(),
      cuisine: resolvedCuisine
        ? {
            value: resolvedCuisine,
            source: input.explicitCuisine ? "request" : "current_profile",
            available: true,
          }
        : unavailablePreference(),
      cuisineIntensity: unavailablePreference(),
      spiceComplexity: unavailablePreference(),
    },
    safety: {
      allergies: Array.from(new Set(allergyNames)),
      avoidedFoods: Array.from(new Set(avoidedFoods)),
      dislikedFoods: input.resolverContext?.foodAcceptanceDirectives
        .filter((directive) => directive.type === "avoid_dislike")
        .flatMap((directive) => directive.items) ?? [],
      // Pediatric protocols remain governed by the pediatric resolver and
      // post-generation scanner. Do not represent them as universally
      // validated clinical conditions without deterministic protocol evidence.
      healthConditions: [],
    },
    authorization: {
      status: "none",
      action: null,
      reservationId: null,
      waivers: [],
    },
    nutrition: null,
    behavior: null,
    foodsIEnjoy: { explicit: [], legacyLikes: [] },
    nutritionPriorities: (() => {
      const document = normalizeFoodInclusionPrioritiesDocument(
        input.foodInclusionPriorities,
      );
      return {
        selectedPriorityIds: document.selectedPriorityIds,
        registryVersion: document.registryVersion,
      };
    })(),
    sweeteners: { preferred: [], avoided: [] },
    diabetesFoodPreferences: null,
    gaps: [],
    notices: [],
    blockedReasons: [],
  };
  const key = process.env.SESSION_SECRET;
  if (!key) throw new Error("SESSION_SECRET is required for pediatric Human Food Context");
  const internalFingerprint = createHmac("sha256", key)
    .update(JSON.stringify(base))
    .digest("base64url");
  return freezeHumanFoodContext({ ...base, internalFingerprint });
}

export function toPediatricHumanFoodCandidate(
  recipe: any,
  context: HumanFoodContext,
): HumanFoodCandidate {
  return {
    name: recipe.recipeName,
    description: recipe.whyThisVersionIsBetter,
    category: "meal",
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    nutrition: {
      calories: recipe.nutrition?.calories ?? recipe.calories,
      protein: recipe.nutrition?.protein ?? recipe.protein,
      carbs: recipe.nutrition?.carbs ?? recipe.carbs,
      fat: recipe.nutrition?.fat ?? recipe.fat,
    },
    evidence: {
      sourceType: "generated_recipe",
      ingredientEvidence: "structured_generation",
      preparationEvidence: "structured_generation",
      nutritionEvidence: "structured_generation",
      cuisine: typeof recipe.cuisine === "string" && recipe.cuisine.trim()
        ? recipe.cuisine.trim()
        : undefined,
    },
  };
}