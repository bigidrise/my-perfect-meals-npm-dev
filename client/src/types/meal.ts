/**
 * Canonical Meal and Ingredient types for the My Perfect Meals board/UI layer.
 *
 * All board-facing components and pages should import from here.
 * Files that need the engine-API response shape (protein_g / carbs_g / fat_g)
 * keep their own types in their respective modules.
 */

import type { DietClassification } from "@/components/MealClassificationPill";

export type { DietClassification };

export type Ingredient = {
  item: string;
  amount: number;
  unit: string;
  notes?: string;
};

export type Meal = {
  id: string;
  /** Saved-meal UUID — present when the meal was added to the board from Favorites */
  savedMealId?: string;
  title?: string;
  name?: string;
  description?: string;
  servings?: number;
  ingredients?: any[];
  instructions?: any[];
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    starchyCarbs?: number;
    fibrousCarbs?: number;
  };
  orderIndex?: number;
  entryType?: "quick" | "recipe";
  brand?: string;
  servingDesc?: string;
  includeInShoppingList?: boolean;
  badges?: string[];
  imageUrl?: string;
  cookingTime?: string;
  difficulty?: string;
  medicalBadges?: any[];
  starchyCarbs?: number;
  fibrousCarbs?: number;
  dietClassification?: DietClassification | null;
  builderType?: string;
  diabeticMemory?: {
    generatedBglMgdl: number;
    glucoseContext: string;
    protocolTypeLabel: string;
    bglBucket: string;
    recommendedBglRange: string;
    generatedAt: string;
    source: string;
  };
  appliedProtocol?: {
    track: "competition" | "athletic";
    competitionType?: string;
    competitionTypeLabel?: string;
    currentPhase?: string;
    currentPhaseLabel?: string;
    weeksOut?: number;
    category?: string;
    trainingType?: string;
    trainingFrequency?: string;
    primaryGoal?: string;
    trainingPhase?: string;
  } | null;
};
