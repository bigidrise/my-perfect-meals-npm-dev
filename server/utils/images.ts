// server/utils/images.ts
// Image generation utilities

import { MealResult } from "../types";

// NOTE — empty ingredients tradeoff:
// MealResult objects at this call-site do not carry a structured ingredient
// list, so an empty array is passed to generateMealImageUnified.  This means
// the recipe ingredient contract (allow/deny list) is intentionally skipped —
// the image is built from the meal name alone and may reflect the traditional
// visual of the dish rather than the exact recipe variant.  Callers that hold
// a full ingredient list should call generateMealImageUnified directly with
// that list to get the stricter recipe-fidelity guarantee.
export async function pickImageForMeal(meal: MealResult): Promise<string | undefined> {
  try {
    const { generateMealImageUnified } = await import("../services/mealImageGenerator");
    return await generateMealImageUnified(meal.name, [], 'meal') ?? undefined;
  } catch (error) {
    console.log(`❌ Image generation failed for ${meal.name}:`, error);
  }
  return undefined;
}