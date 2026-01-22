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
import { enforceSafetyProfile } from "../services/safetyProfileService";

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

const SERVING_MULTIPLIERS: Record<string, { count: number; label: string; tiers?: number }> = {
  single: { count: 1, label: "1 serving" },
  two: { count: 2, label: "2 servings" },
  family: { count: 6, label: "6 servings (family-style)" },
  batch: { count: 12, label: "12 servings (batch)" },
  "small-wedding": { count: 40, label: "Small Wedding (30–50 guests)", tiers: 2 },
  "medium-wedding": { count: 88, label: "Medium Wedding (75–100 guests)", tiers: 3 },
  "large-wedding": { count: 135, label: "Large Wedding (120–150 guests)", tiers: 3 },
  "extra-large-wedding": { count: 200, label: "Large Event (200+ guests)", tiers: 4 },
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

const CAKE_STYLE_LABELS: Record<string, string> = {
  classic: "Classic Frosted",
  "semi-naked": "Semi-Naked (Light Frosting)",
  naked: "Naked Cake (Minimal Frosting)",
};

const CAKE_TYPE_LABELS: Record<string, string> = {
  "wedding-cake": "Wedding Cake",
  "birthday-cake": "Birthday Cake",
  "celebration-cake": "Celebration Cake",
};

const isDev = process.env.NODE_ENV === "development";

dessertCreatorRouter.post("/", async (req, res) => {
  if (isDev) console.log("[DESSERT] POST request received");
  try {
    const {
      dessertCategory,
      flavorFamily,
      specificDessert,
      servingSize,
      cakeStyle,
      cakeType,
      dietaryPreferences,
      userId,
    } = req.body ?? {};

    if (isDev) console.log("[DESSERT] Request params:", { dessertCategory, flavorFamily, servingSize, cakeStyle, cakeType });

    if (!dessertCategory) {
      return res.status(400).json({ error: "Dessert category is required" });
    }

    if (!flavorFamily) {
      return res.status(400).json({ error: "Flavor family is required" });
    }

    // 🚨 SAFETY INTELLIGENCE LAYER: Pre-generation enforcement
    if (userId) {
      const inputText = [specificDessert, flavorFamily, dessertCategory].filter(Boolean).join(' ');
      const safetyCheck = await enforceSafetyProfile(userId, inputText, "dessert-creator");
      if (safetyCheck.result === "BLOCKED") {
        console.log(`🚫 [SAFETY] Blocked dessert for user ${userId}: ${safetyCheck.blockedTerms.join(", ")}`);
        return res.status(400).json({
          success: false,
          error: safetyCheck.message,
          safetyBlocked: true,
          blockedTerms: safetyCheck.blockedTerms,
          suggestion: safetyCheck.suggestion
        });
      }
      if (safetyCheck.result === "AMBIGUOUS") {
        return res.status(400).json({
          success: false,
          error: safetyCheck.message,
          safetyAmbiguous: true,
          ambiguousTerms: safetyCheck.ambiguousTerms,
          suggestion: safetyCheck.suggestion
        });
      }
    }

    const serving = SERVING_MULTIPLIERS[servingSize] || SERVING_MULTIPLIERS.single;
    const categoryLabel = CATEGORY_LABELS[dessertCategory] || dessertCategory;
    const flavorLabel = FLAVOR_LABELS[flavorFamily] || flavorFamily;
    const cakeStyleLabel = cakeStyle ? CAKE_STYLE_LABELS[cakeStyle] || cakeStyle : null;
    const cakeTypeLabel = cakeType ? CAKE_TYPE_LABELS[cakeType] || cakeType : null;
    const dietaryRules = Array.isArray(dietaryPreferences) && dietaryPreferences.length > 0
      ? dietaryPreferences.map(d => d.replace(/-/g, " ")).join(", ")
      : "none specified";

    const isWeddingCake = cakeType === "wedding-cake";
    const isNakedCake = cakeStyle === "naked" || cakeStyle === "semi-naked";
    const isCelebrationCake = isWeddingCake || cakeType === "celebration-cake" || cakeType === "birthday-cake";

    const cakeRulesBlock = dessertCategory === "cake" ? `
🎂 CAKE-SPECIFIC RULES:
- Cake Style: ${cakeStyleLabel || "Classic Frosted"}
- Cake Type: ${cakeTypeLabel || "Standard cake"}
${isNakedCake ? `
NAKED/SEMI-NAKED CAKE REQUIREMENTS:
- Reduce frosting volume significantly (naked = minimal, semi-naked = thin layer showing cake layers)
- Favor lighter fillings: fresh fruit, mascarpone, whipped yogurt-cream, lemon curd, fresh berries
- Emphasize the cake layers themselves - they should be the star
- Use drip glazes or fresh fruit decoration instead of heavy buttercream
- The aesthetic is rustic, elegant, and naturally beautiful
` : ""}
${isWeddingCake ? `
WEDDING CAKE REQUIREMENTS:
- This is for a CELEBRATION - present it elegantly without "diet language"
- Guest count: ${serving.count} guests
- Recommended tiers: ${serving.tiers || 3} tiers
- Focus on sophistication: subtle flavors, elegant presentation
- Include a "perSliceNutrition" object with per-slice values (assume 1 oz slice)
- Nutrition should be realistic for celebration portions
- Fillings should complement the occasion: champagne, elderflower, rose, lavender work well
- Avoid anything that sounds "healthy" or "diet" - this is a wedding!
- Include "tiers" field in response indicating recommended tier count
${isNakedCake && serving.count > 100 ? `
⚠️ NAKED CAKE STRUCTURAL WARNING:
- For ${serving.count}+ guests with naked style, recommend SEMI-NAKED instead of fully naked
- Naked cakes at this scale need structural support
- Use sturdier sponge recipes and consider dowel support between tiers
- Include this structural guidance in the instructions
` : ""}
` : ""}
${isCelebrationCake && !isWeddingCake ? `
CELEBRATION CAKE REQUIREMENTS:
- This is for a special occasion - make it feel special
- Include a "perSliceNutrition" object with per-slice values
- Balance indulgence with quality ingredients
` : ""}
` : "";

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
  ${dessertCategory === "cake" ? `"perSliceNutrition": {
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fat": 0,
    "sliceSize": "1 oz"
  },
  "totalSlices": 0,${isWeddingCake ? `
  "tiers": ${serving.tiers || 3},` : ""}` : ""}
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
${cakeRulesBlock}
GENERATION RULES:
1. If a specific dessert is named (e.g., "key lime pie"), create a HEALTHY version of that exact dessert.
2. If no specific dessert is named, CREATE a unique dessert using the category + flavor combination.
3. Instructions must be step-by-step baking/cooking directions.
4. Nutrition must be realistic and scaled for the total serving count (${serving.count} servings).
5. Reasoning explains why this dessert fits the flavor profile + dietary needs.
6. imageUrl should be a short descriptive image prompt (no quotes).
7. Apply all dietary requirements strictly (e.g., if "gluten-free" is specified, use NO gluten ingredients).
${dessertCategory === "cake" ? `8. For CAKES: Include "perSliceNutrition" with nutrition per 1 oz slice, and "totalSlices" with the number of slices.` : ""}

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

    if (isDev) console.log("[DESSERT] Calling OpenAI GPT-4o...");
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    if (isDev) console.log("[DESSERT] OpenAI response received");

    let meal: any;
    try {
      const rawText = completion.choices[0]?.message?.content || "{}";
      meal = JSON.parse(rawText);
      if (isDev) console.log("[DESSERT] Parsed meal:", meal.name);
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

    if (isDev) console.log("[DESSERT] Starting image generation...");
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
      if (isDev) console.log(`[DESSERT] 📸 Image generated for ${meal.name}`);
    } catch (error) {
      if (isDev) console.log(`[DESSERT] ❌ Image generation failed for ${meal.name}:`, error);
    }

    if (isDev) console.log("[DESSERT] Sending response...");
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
        cakeStyle: dessertCategory === "cake" ? cakeStyle : undefined,
        cakeType: dessertCategory === "cake" ? cakeType : undefined,
        dietaryPreferences,
      },
    });
  } catch (err: any) {
    console.error("Dessert Creator Error:", err);
    return res.status(500).json({ error: "Failed to create dessert" });
  }
});

export default dessertCreatorRouter;
