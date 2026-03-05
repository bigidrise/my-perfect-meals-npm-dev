import { Router } from "express";
import OpenAI from "openai";
import { computeMedicalBadges } from "../services/medicalBadges";
import { normalizeIngredients } from "../services/ingredientNormalizer";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { enforceSafetyProfile } from "../services/safetyProfileService";
import { buildPalateSection, PalatePreferences } from "../services/promptBuilder";

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

const beverageCreatorRouter = Router();

const SERVING_MULTIPLIERS: Record<string, { count: number; label: string }> = {
  single: { count: 1, label: "1 drink" },
  two: { count: 2, label: "2 drinks" },
  pitcher: { count: 5, label: "Pitcher (4–6 drinks)" },
  party: { count: 10, label: "Party Batch (8–12 drinks)" },
};

const CATEGORY_LABELS: Record<string, string> = {
  cocktail: "Cocktail",
  mocktail: "Mocktail",
  smoothie: "Smoothie",
  "protein-shake": "Protein Shake",
  milkshake: "Milkshake",
  coffee: "Coffee Drink",
  tea: "Tea Drink",
  frozen: "Frozen Drink",
  hydration: "Hydration Drink",
};

const FLAVOR_LABELS: Record<string, string> = {
  citrus: "Citrus",
  berry: "Berry",
  tropical: "Tropical",
  chocolate: "Chocolate",
  vanilla: "Vanilla",
  coffee: "Coffee",
  caramel: "Caramel",
  herbal: "Herbal",
  spicy: "Spicy",
};

const isDev = process.env.NODE_ENV === "development";

beverageCreatorRouter.post("/", async (req, res) => {
  if (isDev) console.log("[BEVERAGE] POST request received");
  try {
    const {
      beverageCategory,
      flavorFamily,
      specificDrink,
      servingSize,
      dietaryPreferences,
      userId,
      safetyMode,
      overrideToken,
      skipPalate,
    } = req.body ?? {};

    if (isDev) console.log("[BEVERAGE] Request params:", { beverageCategory, flavorFamily, servingSize });

    if (!beverageCategory) {
      return res.status(400).json({ error: "Beverage category is required" });
    }

    if (!flavorFamily) {
      return res.status(400).json({ error: "Flavor family is required" });
    }

    if (userId) {
      const inputText = [specificDrink, flavorFamily, beverageCategory].filter(Boolean).join(' ');
      const safetyCheck = await enforceSafetyProfile(userId, inputText, "beverage-creator", {
        safetyMode: safetyMode || "STRICT",
        overrideToken: overrideToken
      });
      if (safetyCheck.result === "BLOCKED") {
        console.log(`🚫 [SAFETY] Blocked beverage for user ${userId}: ${safetyCheck.blockedTerms.join(", ")}`);
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

    let palateGuidance = "\nFLAVOR STYLE: Use light, neutral flavoring suitable for serving to guests or family.";
    if (!skipPalate && userId && userId !== "1") {
      try {
        const [user] = await db.select({
          palateSpiceTolerance: users.palateSpiceTolerance,
          palateSeasoningIntensity: users.palateSeasoningIntensity,
          palateFlavorStyle: users.palateFlavorStyle,
        }).from(users).where(eq(users.id, userId)).limit(1);
        
        if (user && (user.palateSpiceTolerance || user.palateSeasoningIntensity || user.palateFlavorStyle)) {
          const palatePrefs: PalatePreferences = {
            palateSpiceTolerance: user.palateSpiceTolerance as PalatePreferences['palateSpiceTolerance'],
            palateSeasoningIntensity: user.palateSeasoningIntensity as PalatePreferences['palateSeasoningIntensity'],
            palateFlavorStyle: user.palateFlavorStyle as PalatePreferences['palateFlavorStyle'],
          };
          palateGuidance = `\nFLAVOR PREFERENCES: ${buildPalateSection(palatePrefs)}`;
          console.log(`🎨 [BEVERAGE] Loaded palate preferences for user`);
        }
      } catch (err) {
        console.log("[BEVERAGE] Could not fetch palate preferences:", err);
      }
    } else if (skipPalate) {
      console.log(`🎨 [BEVERAGE] Palate preferences skipped - using neutral flavoring for shared drink`);
    }

    const serving = SERVING_MULTIPLIERS[servingSize] || SERVING_MULTIPLIERS.single;
    const categoryLabel = CATEGORY_LABELS[beverageCategory] || beverageCategory;
    const flavorLabel = FLAVOR_LABELS[flavorFamily] || flavorFamily;
    const dietaryRules = Array.isArray(dietaryPreferences) && dietaryPreferences.length > 0
      ? dietaryPreferences.map((d: string) => d.replace(/-/g, " ")).join(", ")
      : "none specified";

    const categorySpecificRules = (() => {
      switch (beverageCategory) {
        case "cocktail":
          return `\n🍸 COCKTAIL-SPECIFIC RULES:
- Generate a balanced cocktail with correct alcohol ratios
- Include the specific spirit/liquor base
- Use proper bartending measurements (oz, dashes, parts)
- Include garnish instructions
- If serving size is pitcher or party batch, scale proportionally`;
        case "mocktail":
          return `\n🥤 MOCKTAIL-SPECIFIC RULES:
- Must be completely alcohol-free
- Use creative flavor combinations that feel sophisticated
- Include garnish and presentation notes`;
        case "smoothie":
          return `\n🥝 SMOOTHIE-SPECIFIC RULES:
- Prioritize whole fruits and natural sweetness
- Include a liquid base (milk, juice, water, coconut water)
- Suggest optional add-ins (chia seeds, flax, etc.)`;
        case "protein-shake":
          return `\n💪 PROTEIN SHAKE-SPECIFIC RULES:
- Prioritize macro balance and protein density
- Include protein source (whey, plant protein, Greek yogurt, etc.)
- Target at least 20g protein per serving
- Keep ingredients practical and available`;
        case "milkshake":
          return `\n🍦 MILKSHAKE-SPECIFIC RULES:
- Rich, indulgent, and satisfying
- Include ice cream or frozen yogurt base
- Include topping/garnish suggestions`;
        case "coffee":
          return `\n☕ COFFEE DRINK-SPECIFIC RULES:
- Specify coffee type (espresso, cold brew, drip, etc.)
- Include milk/cream options
- Include sweetener amounts if applicable`;
        case "tea":
          return `\n🍵 TEA DRINK-SPECIFIC RULES:
- Specify tea type (green, black, herbal, matcha, chai, etc.)
- Include steeping instructions or preparation method
- Temperature guidance (hot or iced)`;
        case "frozen":
          return `\n🧊 FROZEN DRINK-SPECIFIC RULES:
- Must be blended or frozen
- Include ice quantities
- Specify blending instructions`;
        case "hydration":
          return `\n💧 HYDRATION DRINK-SPECIFIC RULES:
- Focus on electrolytes and hydration benefits
- Use natural ingredients where possible
- Include health benefits in reasoning`;
        default:
          return "";
      }
    })();

    const prompt = `
You are a professional mixologist, nutritionist, and beverage chef inside the My Perfect Meals system.
Generate a FULL structured beverage recipe.

The result MUST be a drink. Never generate solid food, meals, or desserts.

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
- Beverage CATEGORY: "${categoryLabel}" (this defines the drink type)
- Flavor FAMILY: "${flavorLabel}" (this defines the main taste direction)
- Specific drink requested: "${specificDrink || "Create your own unique version"}"
- Dietary requirements: "${dietaryRules}"
- Number of servings: ${serving.count}
${categorySpecificRules}

GENERATION RULES:
1. The output MUST be a DRINK — never solid food, baked goods, or desserts.
2. If a specific drink is named (e.g., "mojito", "matcha latte"), create that exact drink.
3. If no specific drink is named, CREATE a unique beverage using the category + flavor combination.
4. Instructions must be clear, step-by-step preparation directions.
5. Nutrition must be realistic and scaled for the total serving count (${serving.count} servings).
6. Reasoning explains why this beverage fits the flavor profile + dietary needs.
7. imageUrl should be a short descriptive image prompt (no quotes).
8. Apply all dietary requirements strictly.
${palateGuidance}

🚨 U.S. MEASUREMENT RULES (CRITICAL):
- Use ONLY these units: oz, fl oz, cup, tbsp, tsp, each (for whole items like limes)
- NEVER use grams (g), milliliters (ml), or metric units
- Liquids: use oz, fl oz, cup, tbsp, tsp (e.g., "2 oz vodka", "1 cup milk", "1 tbsp honey")
- Whole items: use "each" (e.g., "1 each lime", "2 each mint sprigs")
- DO NOT include macro/nutrition data in ingredient rows - macros go in the nutrition object only

CORRECT INGREDIENT EXAMPLES:
- {"name": "vodka", "amount": "2", "unit": "oz"}
- {"name": "fresh lime juice", "amount": "1", "unit": "oz"}
- {"name": "simple syrup", "amount": "0.5", "unit": "oz"}
- {"name": "mint leaves", "amount": "6", "unit": "each"}
- {"name": "whole milk", "amount": "1", "unit": "cup"}

INCORRECT (NEVER DO THIS):
- {"name": "vodka", "amount": "60", "unit": "ml"} ❌ (use oz)
- {"name": "sugar", "amount": "15", "unit": "g"} ❌ (use tsp/tbsp)
`;

    if (isDev) console.log("[BEVERAGE] Calling OpenAI GPT-4o...");
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    if (isDev) console.log("[BEVERAGE] OpenAI response received");

    let meal: any;
    try {
      const rawText = completion.choices[0]?.message?.content || "{}";
      meal = JSON.parse(rawText);
      if (isDev) console.log("[BEVERAGE] Parsed beverage:", meal.name);
    } catch (parseErr) {
      console.error("Beverage Creator JSON parse error:", parseErr);
      return res
        .status(500)
        .json({ error: "AI returned invalid JSON for beverage" });
    }

    const normalizedIngredients = normalizeIngredients(meal.ingredients || []);
    meal.ingredients = normalizedIngredients;

    const ingredientNames = normalizedIngredients.map((i: any) =>
      String(i.name ?? "").toLowerCase()
    );

    let userConditions: string[] = [];
    if (userId && userId !== "1") {
      try {
        const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (dbUser?.healthConditions && Array.isArray(dbUser.healthConditions)) {
          userConditions = dbUser.healthConditions;
          console.log("[BEVERAGE] User health conditions loaded:", userConditions.length, "conditions");
        }
      } catch (err) {
        console.log("[BEVERAGE] Could not fetch user health conditions:", err);
      }
    }

    const constraints: any = {
      lowGlycemicMode: dietaryPreferences?.includes("low-sugar") || false,
      conditions: userConditions,
    };

    const medicalBadges = computeMedicalBadges(constraints, ingredientNames);

    if (isDev) console.log("[BEVERAGE] Starting image generation...");
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
      if (isDev) console.log(`[BEVERAGE] 📸 Image generated for ${meal.name}`);
    } catch (error) {
      if (isDev) console.log(`[BEVERAGE] ❌ Image generation failed for ${meal.name}:`, error);
    }

    if (isDev) console.log("[BEVERAGE] Sending response...");
    return res.json({
      ...meal,
      imageUrl,
      medicalBadges,
      meta: {
        userId: userId ?? "1",
        beverageCategory,
        flavorFamily,
        specificDrink,
        servingSize,
        dietaryPreferences,
      },
    });
  } catch (err: any) {
    console.error("Beverage Creator Error:", err);
    return res.status(500).json({ error: "Failed to create beverage" });
  }
});

export default beverageCreatorRouter;
