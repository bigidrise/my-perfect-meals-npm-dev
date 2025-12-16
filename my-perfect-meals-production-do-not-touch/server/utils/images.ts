// server/utils/images.ts
// Image generation utilities

import { MealResult } from "../types";

export async function pickImageForMeal(meal: MealResult): Promise<string | undefined> {
  try {
    // Import the image service dynamically
    const imageService = await import("../services/imageService");
    if (imageService.generateRecipeImage) {
      return await imageService.generateRecipeImage(meal.name);
    }
  } catch (error) {
    console.log(`❌ Image generation failed for ${meal.name}:`, error);
  }
  return undefined;
}