// --- server/routes/dessert-creator.ts ---
// Dessert Creator Route - RESTRUCTURED (December 9, 2025)
// New 5-field structure: Category, Flavor Family, Specific Dessert, Serving Size, Dietary

import { Router } from "express";
import OpenAI from "openai";
import { computeMedicalBadges } from "../services/medicalBadges";
import { normalizeIngredients } from "../services/ingredientNormalizer";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

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
3. Instructions must be step-by-step baking/cooking directions.
4. Nutrition must be realistic and scaled for the total serving count (${serving.count} servings).
5. Reasoning explains why this dessert fits the flavor profile + dietary needs.
6. imageUrl should be a short descriptive image prompt (no quotes).
7. Apply all dietary requirements strictly (e.g., if "gluten-free" is specified, use NO gluten ingredients).

🚨 U.S. MEASUREMENT RULES (CRITICAL):
- Use ONLY these units: oz, lb, cup, tbsp, tsp, each (for eggs only), fl oz
- NEVER use grams (g), milliliters (ml), or metric units
- Baking ingredients: use cups, tbsp, tsp (e.g., "2 cups flour", "1/4 cup sugar")
- Butter: use tbsp or cups (e.g., "4 tbsp butter", "1/2 cup butter")
- Liquids: use cup, tbsp, tsp, fl oz (e.g., "1 cup milk", "2 tbsp vanilla extract")
- DO NOT include macro/nutrition data in ingredient rows - macros go in the nutrition object only

CORRECT INGREDIENT EXAMPLES:
- {"name": "all-purpose flour", "amount": "2", "unit": "cup"}
- {"name": "butter", "amount": "4", "unit": "tbsp", "preparationNote": "softened"}
- {"name": "eggs", "amount": "2", "unit": "each"}
- {"name": "vanilla extract", "amount": "1", "unit": "tsp"}

INCORRECT (NEVER DO THIS):
- {"name": "flour", "amount": "240", "unit": "g"} ❌ (use cups)
- {"name": "butter", "amount": "113", "unit": "g"} ❌ (use tbsp)
`;

    const completion = await getOpenAI().chat.completions.create({
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

    // Normalize ingredients to U.S. measurements (oz, cups, tbsp, tsp)
    const normalizedIngredients = normalizeIngredients(meal.ingredients || []);
    meal.ingredients = normalizedIngredients;

    const ingredientNames = normalizedIngredients.map((i: any) =>
      String(i.name ?? "").toLowerCase()
    );

    // Fetch user health conditions from database for medical badge generation
    let userConditions: string[] = [];
    if (userId && userId !== "1") {
      try {
        const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (dbUser?.healthConditions && Array.isArray(dbUser.healthConditions)) {
          userConditions = dbUser.healthConditions;
          console.log("[DESSERT] User health conditions loaded:", userConditions.length, "conditions");
        }
      } catch (err) {
        console.log("[DESSERT] Could not fetch user health conditions:", err);
      }
    }

    const constraints: any = {
      lowGlycemicMode: dietaryPreferences?.includes("low-sugar") || false,
      conditions: userConditions,
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
