import { generateFridgeRescue } from "./mealEngineApi";

export async function boostProteinNextMeal(navigate: (path: string) => void) {
  console.log("🥩 Boosting protein in next meal...");
  navigate("/craving-creator?focus=protein");
  return { success: true };
}

export async function generateOnePanFridgeRescue(
  userId: string,
  fridgeItems: string[],
  navigate: (path: string) => void
) {
  console.log("🍳 Generating one-pan fridge rescue dinner...");
  
  const meal = await generateFridgeRescue({
    userId,
    fridgeItems,
    servings: 1,
    generateImages: true,
  });
  
  console.log(`✅ Generated: ${meal.name}`);
  navigate("/craving-creator");
  
  return { success: true, meal };
}
