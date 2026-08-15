// server/utils/images.ts
// Image generation utilities

import { MealResult } from "../types";

export async function pickImageForMeal(meal: MealResult): Promise<string | undefined> {
  try {
    const { generateMealImageUnified } = await import("../services/mealImageGenerator");
    return await generateMealImageUnified(meal.name, [], 'meal') ?? undefined;
  } catch (error) {
    console.log(`❌ Image generation failed for ${meal.name}:`, error);
  }
  return undefined;
}