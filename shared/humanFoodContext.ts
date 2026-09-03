import type { DailyNutritionState } from "./dailyNutritionPrescription";

export const HUMAN_FOOD_CONTEXT_VERSION = "human-food-context.v1" as const;

export type HumanFoodCreator =
  | "recipe_maker"
  | "create_a_dish"
  | "craving_creator"
  | "dessert_creator"
  | "beverage_creator"
  | "sushi_creator";

export type HumanFoodResolutionStatus =
  | "resolved"
  | "resolved_with_gaps"
  | "review_required"
  | "blocked";

export type PreferenceSource =
  | "request"
  | "current_profile"
  | "legacy_profile"
  | "clinical_cap"
  | "unavailable";

export interface ResolvedFoodPreference<T = string> {
  value: T | null;
  source: PreferenceSource;
  available: boolean;
  adapted?: boolean;
  note?: string;
}

export interface HumanFoodDietContext {
  stored: string[];
  effective: string[];
  source: "request" | "profile" | "unavailable";
  requestOverride: string | null;
  adaptationOutcome: "not_needed" | "request_override_applied" | "unavailable";
}

export interface HumanFoodFlavorContext {
  heat: ResolvedFoodPreference;
  seasoningIntensity: ResolvedFoodPreference;
  broadFlavor: ResolvedFoodPreference;
  flavorStyle: ResolvedFoodPreference;
  cuisine: ResolvedFoodPreference;
  cuisineIntensity: ResolvedFoodPreference;
  spiceComplexity: ResolvedFoodPreference;
}

export interface HumanFoodSafetyContext {
  allergies: string[];
  avoidedFoods: string[];
  dislikedFoods: string[];
  healthConditions: string[];
}

export interface HumanFoodBehaviorContext {
  preferredCuisines: string[];
  preferredProteins: string[];
  preferredMethods: string[];
  softAvoidances: string[];
  profileVersion: string | null;
}

export interface HumanFoodContext {
  version: typeof HUMAN_FOOD_CONTEXT_VERSION;
  status: HumanFoodResolutionStatus;
  creator: HumanFoodCreator;
  actorUserId: string;
  subjectUserId: string;
  generationChainId: string;
  correlationId: string;
  resolvedAt: string;
  expiresAt: string;
  diet: HumanFoodDietContext;
  flavor: HumanFoodFlavorContext;
  safety: HumanFoodSafetyContext;
  nutrition: DailyNutritionState | null;
  behavior: HumanFoodBehaviorContext | null;
  gaps: string[];
  notices: string[];
  blockedReasons: string[];
  rejectedCandidateSignatures: string[];
  internalFingerprint: string;
}

export interface HumanFoodContextReceipt {
  receipt: string;
  expiresAt: string;
  generationChainId: string;
  correlationId: string;
}

export interface HumanFoodContextPublicMeta {
  version: typeof HUMAN_FOOD_CONTEXT_VERSION;
  status: HumanFoodResolutionStatus;
  receipt: string;
  expiresAt: string;
  generationChainId: string;
  correlationId: string;
  gaps: string[];
  notices: string[];
}
