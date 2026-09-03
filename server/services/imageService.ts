// Main function used by stableMealGenerator
//
// NOTE — empty ingredients tradeoff:
// This path receives only a recipe name (no structured ingredient list), so it
// passes an empty array to generateMealImageUnified.  That means the recipe
// ingredient contract (allow/deny list enforced by buildIngredientContract) is
// intentionally skipped.  The image is generated from the dish name alone,
// which may reflect the traditional visual of the dish rather than the exact
// recipe variant.  This is acceptable here because stableMealGenerator images
// are illustrative placeholders; callers that have a full ingredient list
// should pass it through the regular meal-builder image path instead.
export async function generateRecipeImage(recipeName: string): Promise<string | null> {
  const { generateMealImageUnified } = await import("./mealImageGenerator");
  return generateMealImageUnified(recipeName, [], 'meal');
}

// API endpoint for image generation
export async function handleImageGeneration(req: any, res: any) {
  try {
    const { name, type, ingredients, calories, protein, carbs, fat, description } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    const { generateMealImageUnified } = await import("./mealImageGenerator");
    const sourceType = type === "beverage" ? "beverage" : "meal";
    const imageUrl = await generateMealImageUnified(name, ingredients ?? [], sourceType);

    if (imageUrl) {
      res.json({ imageUrl });
    } else {
      res.status(500).json({ error: 'Failed to generate image' });
    }
  } catch (error) {
    console.error('Image generation endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
