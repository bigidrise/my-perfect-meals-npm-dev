// --- server/routes/dessert-creator.ts ---
// Dessert Creator Route - RESTRUCTURED (December 9, 2025)
// New 5-field structure: Category, Flavor Family, Specific Dessert, Serving Size, Dietary

import { Router } from "express";
import OpenAI from "openai";
import { computeMedicalBadges } from "../services/medicalBadges";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const dessertCreatorRouter = Router();

const SERVING_MULTIPLIERS: Record<string, { count: number; label: string }> = {
  single: { count: 1, label: "1 serving" },
  two: { count: 2, label: "2 servings" },
  family: { count: 6, label: "6 servings (family-style)" },
  batch: { count: 12, label: "12 servings (batch)" },
};

const CATEGORY_LABELS: Record<string, string> = {
  pie: "Pie",
  cake: "Cake",
  cookies: "Cookies",
  brownies: "Brownies",
  cheesecake: "Cheesecake",
  smoothie: "Smoothie",
  frozen: "Frozen Dessert",
  pudding: "Pudding / Custard",
  nobake: "No-Bake Dessert",
  bars: "Bars",
  muffins: "Muffins",
  cupcakes: "Cupcakes",
};

const FLAVOR_LABELS: Record<string, string> = {
  apple: "Apple",
  strawberry: "Strawberry",
  blueberry: "Blueberry",
  "lemon-lime": "Lemon / Lime",
  peach: "Peach",
  cherry: "Cherry",
  mango: "Mango",
  chocolate: "Chocolate",
  vanilla: "Vanilla",
  "peanut-butter": "Peanut Butter",
  "cinnamon-spice": "Cinnamon / Spice",
  coffee: "Coffee",
  caramel: "Caramel",
};

dessertCreatorRouter.post("/", async (req, res) => {
  try {
    const {
      dessertCategory,
      flavorFamily,
      specificDessert,
      servingSize,
      dietaryPreferences,
      userId,
    } = req.body ?? {};

    if (!dessertCategory) {
      return res.status(400).json({ error: "Dessert category is required" });
    }

    if (!flavorFamily) {
      return res.status(400).json({ error: "Flavor family is required" });
    }

    const serving = SERVING_MULTIPLIERS[servingSize] || SERVING_MULTIPLIERS.single;
    const categoryLabel = CATEGORY_LABELS[dessertCategory] || dessertCategory;
    const flavorLabel = FLAVOR_LABELS[flavorFamily] || flavorFamily;
    const dietaryRules = Array.isArray(dietaryPreferences) && dietaryPreferences.length > 0
      ? dietaryPreferences.map(d => d.replace(/-/g, " ")).join(", ")
      : "none specified";

    const prompt = `
You are a master pastry chef + nutrition expert inside the My Perfect Meals system.
Generate a FULL structured dessert recipe.

Return JSON ONLY, following this exact schema:

{
  "name": "",
  "description": "",
  "ingredients": [
    {
      "name": "",
      "amount": "",
      "unit": ""
    }
  ],
  "instructions": "",
  "nutrition": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0
  },
  "servingSize": "${serving.label}",
  "reasoning": "",
  "imageUrl": ""
}

CRITERIA:
- Dessert CATEGORY: "${categoryLabel}" (this defines the structure - pie, cake, cookies, etc.)
- Flavor FAMILY: "${flavorLabel}" (this defines the main taste direction)
- Specific dessert requested: "${specificDessert || "Create your own unique version"}"
- Dietary requirements: "${dietaryRules}"
- Number of servings: ${serving.count}

GENERATION RULES:
1. If a specific dessert is named (e.g., "key lime pie"), create a HEALTHY version of that exact dessert.
2. If no specific dessert is named, CREATE a unique dessert using the category + flavor combination.
3. Include accurate measurements (cups, grams, teaspoons, etc.)
4. Instructions must be step-by-step baking/cooking directions.
5. Nutrition must be realistic and scaled for the total serving count (${serving.count} servings).
6. Reasoning explains why this dessert fits the flavor profile + dietary needs.
7. imageUrl should be a short descriptive image prompt (no quotes).
8. Apply all dietary requirements strictly (e.g., if "gluten-free" is specified, use NO gluten ingredients).
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    let meal: any;
    try {
      const rawText = completion.choices[0]?.message?.content || "{}";
      meal = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("Dessert Creator JSON parse error:", parseErr);
      return res
        .status(500)
        .json({ error: "AI returned invalid JSON for dessert" });
    }

    const ingredientNames =
      Array.isArray(meal.ingredients) && meal.ingredients.length > 0
        ? meal.ingredients.map((i: any) =>
            String(i.name ?? i.item ?? "").toLowerCase(),
          )
        : [];

    const constraints: any = {
      lowGlycemicMode: dietaryPreferences?.includes("low-sugar") || false,
      conditions: [],
    };

    const medicalBadges = computeMedicalBadges(constraints, ingredientNames);

    let imageUrl = null;
    try {
      const { generateImage } = await import("../services/imageService");
      imageUrl = await generateImage({
        name: meal.name,
        description: meal.description || `A delicious ${flavorLabel} ${categoryLabel}`,
        type: 'meal',
        style: 'homemade',
        ingredients: ingredientNames,
        calories: meal.nutrition?.calories || 0,
        protein: meal.nutrition?.protein || 0,
        carbs: meal.nutrition?.carbs || 0,
        fat: meal.nutrition?.fat || 0,
      });
      console.log(`📸 Generated image for ${meal.name}`);
    } catch (error) {
      console.log(`❌ Image generation failed for ${meal.name}:`, error);
    }

    return res.json({
      ...meal,
      imageUrl,
      medicalBadges,
      meta: {
        userId: userId ?? "1",
        dessertCategory,
        flavorFamily,
        specificDessert,
        servingSize,
        dietaryPreferences,
      },
    });
  } catch (err: any) {
    console.error("Dessert Creator Error:", err);
    return res.status(500).json({ error: "Failed to create dessert" });
  }
});

export default dessertCreatorRouter;
