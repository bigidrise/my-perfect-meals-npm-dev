// Main function used by stableMealGenerator
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
