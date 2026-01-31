// server/services/promptBuilder.ts
import { MealGenerationRequest, UserOnboardingProfile } from "./mealEngineService";
import { UnitPrefs } from "./validators";

export interface PalatePreferences {
  palateSpiceTolerance?: "none" | "mild" | "medium" | "hot";
  palateSeasoningIntensity?: "light" | "balanced" | "bold";
  palateFlavorStyle?: "classic" | "herb" | "savory" | "bright";
}

export function buildPalateSection(profile: PalatePreferences): string {
  const spice = profile.palateSpiceTolerance || "mild";
  const seasoning = profile.palateSeasoningIntensity || "balanced";
  const flavor = profile.palateFlavorStyle || "classic";

  const spiceMap: Record<string, string> = {
    none: "NO spicy ingredients - no chili, hot sauce, cayenne, jalapeno, or any heat",
    mild: "mild spice only - light black pepper, minimal heat",
    medium: "moderate spice welcome - can use cumin, paprika, mild chilies",
    hot: "spicy foods preferred - include bold heat, chilies, hot sauce when appropriate",
  };

  const seasoningMap: Record<string, string> = {
    light: "light seasoning - subtle flavors, minimal salt/spices",
    balanced: "balanced seasoning - well-seasoned but not overpowering",
    bold: "bold seasoning - rich, pronounced flavors, generous herbs/spices",
  };

  const flavorMap: Record<string, string> = {
    classic: "classic comfort flavors - traditional preparations",
    herb: "herb-forward - fresh herbs like basil, cilantro, parsley, dill",
    savory: "savory umami-rich - garlic, soy, mushroom, roasted notes",
    bright: "bright & fresh - citrus, vinegar, fresh vegetables, zesty",
  };

  return `Flavor preferences: ${spiceMap[spice]}. ${seasoningMap[seasoning]}. ${flavorMap[flavor]}.`;
}

export function buildMealPrompt(
  profile: UserOnboardingProfile,
  req: MealGenerationRequest,
  unitPrefs: UnitPrefs
): { system: string; user: string } {
  // Handle diet hierarchy: medical override > temporary preference > profile default > balanced
  const diet = req.tempMedicalOverride ?? req.tempDietPreference ?? req.tempDietOverride ?? profile.dietType ?? "balanced";
  const servings = req.servings ?? 1;

  const medical: string[] = [];
  if (profile.hasDiabetesType1 || profile.hasDiabetesType2) {
    medical.push(
      "Diabetes: prioritize low/medium glycemic carbs, pair carbs with protein/fiber, avoid sugary sauces/juices, avoid dessert-like breakfasts."
    );
  }

  const avoid = Array.from(new Set([...(profile.allergies ?? []), ...(profile.avoidIngredients ?? [])]));
  const bannedSweeteners = profile.bannedSweeteners?.length ? `Banned sweeteners: ${profile.bannedSweeteners.join(", ")}.` : "";

  const mediterraneanRules = diet.toLowerCase().includes('mediterranean') ? `

MEDITERRANEAN DIET PRINCIPLES (MANDATORY):
- Use olive oil as primary cooking fat and dressing base
- Include fresh herbs: oregano, basil, thyme, rosemary, parsley
- Prefer fish and seafood over red meat
- Use tomatoes, olives, garlic, and lemon frequently
- Include nuts, seeds, and legumes
- Choose whole grains over refined
- Fresh vegetables and fruits in abundance
- Limited red meat and processed foods
- Cooking methods: grilling, roasting, sautéing with olive oil` : '';

  const sys = `
You are a meticulous nutrition chef AI. Your job is to generate SAFE, PRECISE, REALISTIC meals that strictly obey user rules.

ABSOLUTE RULES:
- Respect ALLERGIES and AVOIDS with zero exceptions.
- If user has diabetes (T1 or T2), use low/medium GI carbs, balance carbs with protein/fiber, avoid added sugars.
- Respect diet type (${diet}) and ingredient bans.
- Use straightforward, kitchen-ready instructions only. No fluff, no tips, no equipment essays.${mediterraneanRules}

🚨 MEAL TYPE APPROPRIATENESS RULES (CRITICAL - NEVER VIOLATE):
- BREAKFAST: Appropriate foods include eggs, oatmeal, toast, pancakes, yogurt, smoothies, cereal, fruit bowls, breakfast sandwiches. NEVER assign heavy dinner foods like steak, casseroles, or pasta dishes to breakfast.
- LUNCH: Appropriate foods include sandwiches, salads, soups, wraps, grain bowls, light pasta dishes, burgers, lighter proteins.
- DINNER: Appropriate foods include hearty proteins (steak, chicken thighs, salmon), pasta dishes, casseroles, stir-fries, roasts, full entrees. NEVER assign breakfast items like parfait, yogurt bowls, smoothies, or cereal to dinner.
- SNACK: Appropriate foods include nuts, fruits, crackers, small portions, energy bites, veggie sticks with dip. NEVER assign full meals to snack time.
🚨 EXAMPLES OF INCORRECT ASSIGNMENTS TO AVOID:
- "Nutty Fruit Parfait" as DINNER (this is a breakfast/snack item)
- "Greek Yogurt Bowl" as DINNER (this is breakfast)
- "Smoothie Bowl" as DINNER (this is breakfast)
- "Steak and Potatoes" as BREAKFAST (this is dinner)
- "Heavy Casserole" as BREAKFAST (this is dinner)
- "Steak and Potatoes" as BREAKFAST (this is dinner)
- "Heavy Casserole" as BREAKFAST (this is dinner)
${(req as any).cravingInput ? `
🔥 CRITICAL USER REQUEST: User specifically requested "${(req as any).cravingInput}". You MUST create this exact dish/recipe. Do NOT substitute with a different meal. This is their explicit request - honor it precisely.` : ""}

OUTPUT FORMAT: a single JSON object with keys:
{
  "name": string,
  "description": string,
  "ingredients": [{"name": string, "amount": string, "unit": string, "preparationNote": string?}, ...],
  "instructions": [string, ...], // actionable steps only
  "nutrition": {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number, "sugar_g": number},
  "servings": number
}

🚨 U.S. MEASUREMENT RULES (CRITICAL - EXACT MEASUREMENTS REQUIRED):
- Use ONLY these units: oz, lb, cup, tbsp, tsp, each (for eggs only), fl oz
- NEVER use grams (g), milliliters (ml), or metric units
- NEVER use "piece" or "pieces" for meats/proteins - always use oz or lb
- Proteins (chicken, beef, fish, pork) MUST be measured in oz (4-8 oz typical serving)
- Dairy (yogurt, cheese, milk) use oz or cups
- Liquids use cup, tbsp, tsp, or fl oz
- ALWAYS provide EXACT numeric measurements - never use "a pinch", "dash", "to taste"
- Use precise amounts like 6 oz, 1/2 cup, 2 tbsp - no vague measurements
- For small amounts, use fractions: 1/4 tsp, 1/2 cup
- Scale output for the requested servings exactly (${servings})
- Every ingredient MUST have a specific amount and unit
- DO NOT include macro/nutrition data in ingredient rows - macros go in the nutrition object only

EXAMPLES OF CORRECT INGREDIENT FORMAT:
- {"name": "chicken breast", "amount": "6", "unit": "oz", "preparationNote": "boneless, skinless"}
- {"name": "Greek yogurt", "amount": "1", "unit": "cup"}
- {"name": "olive oil", "amount": "2", "unit": "tbsp"}
- {"name": "eggs", "amount": "2", "unit": "each", "preparationNote": "scrambled"}
- {"name": "broccoli florets", "amount": "2", "unit": "cup", "preparationNote": "steamed"}
- {"name": "mixed greens", "amount": "3", "unit": "cup"}
- {"name": "bell pepper", "amount": "1", "unit": "cup", "preparationNote": "diced"}
- {"name": "zucchini", "amount": "1.5", "unit": "cup", "preparationNote": "sliced"}
- {"name": "asparagus", "amount": "8", "unit": "oz", "preparationNote": "trimmed"}
- {"name": "spinach", "amount": "2", "unit": "cup", "preparationNote": "fresh"}

EXAMPLES OF INCORRECT FORMAT (NEVER DO THIS):
- {"name": "chicken", "amount": "1", "unit": "piece"} ❌ (use oz instead)
- {"name": "yogurt", "amount": "340", "unit": "g"} ❌ (use cups instead)
- {"name": "chicken", "amount": "150", "unit": "g", "protein": 30} ❌ (no grams, no macros)
- {"name": "broccoli", "amount": "100", "unit": "g"} ❌ (use cups instead)
- {"name": "spinach", "amount": "50", "unit": "grams"} ❌ (use cups instead)

DO NOT:
- Do not include banned ingredients or sweeteners.
- Do not use vague steps like "cook until done." Be specific with times/temps.
- Do not use vague measurements like "a pinch", "to taste", "handful", "dash".
- Do not output anything except the JSON object.
- Do not omit measurement amounts - every ingredient needs exact quantities.
  `.trim();

  const palateSection = buildPalateSection(profile);

  const user = `
User: ${profile.name ?? profile.userId}
Diet: ${diet}
Calories/day target: ${profile.caloriesPerDay ?? "unknown"}
Protein target/day: ${profile.proteinTargetG ?? "unknown"} g
Medical: ${medical.join(" ")}
Allergies: ${avoid.length ? avoid.join(", ") : "none"}
Avoid ingredients: ${profile.avoidIngredients?.length ? profile.avoidIngredients.join(", ") : "none"}
Sweeteners: allow ${profile.preferredSweeteners?.join(", ") || "standard options"}; ${bannedSweeteners}
Body type: ${profile.bodyType ?? "n/a"}
${palateSection}

Source: ${req.source}
Meal type: ${req.mealType || "any meal"}
${req.source === "craving" && (req as any).cravingInput ? `SPECIFIC CRAVING REQUEST: "${(req as any).cravingInput}" - Create this exact dish/meal the user is craving.` : ""}
Selected ingredients (must use if present): ${req.selectedIngredients?.length ? req.selectedIngredients.join(", ") : "none"}
Fridge items (available, prefer to use): ${req.fridgeItems?.length ? req.fridgeItems.join(", ") : "none"}
Servings: ${servings}

Generate ONE ${req.mealType || "meal"} obeying all rules. ${req.source === "craving" && (req as any).cravingInput ? `🔥 MANDATORY: Create "${(req as any).cravingInput}" exactly as requested. This is their specific craving - do not substitute with any other dish.` : `🚨 CRITICAL: Ensure the meal is appropriate for ${req.mealType || "the meal type"}. Choose ingredients that fit both the meal timing AND the diet+medical constraints. Never assign breakfast items to dinner or dinner items to breakfast.`} Provide full nutrition estimates.
  `.trim();

  return { system: sys, user };
}