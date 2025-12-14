// server/utils/mealGenerator.ts
// This file centralizes generation so Weekly Plan & Craving Creator never drift.

import { OpenAI } from "openai";
import { normalizeUnits } from "./units";
import { pickImageForMeal } from "./images";
import { OnboardingProfile, MealRequest, MealResult } from "../types";
import { storage } from "../storage";

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

export async function generateMeal(req: MealRequest): Promise<MealResult> {
  console.log(`🎯 Generating meal using AI with user onboarding data for user ${req.userId}`);
  
  // Get user's onboarding data from storage
  const user = await storage.getUser(req.userId);
  if (!user) {
    throw new Error(`User ${req.userId} not found`);
  }
  
  // Build comprehensive onboarding profile from user data
  const onboarding: OnboardingProfile = {
    dietType: user.dietType || user.fitnessGoal || undefined, // Use actual dietType field from user profile
    allergies: user.allergies || [],
    dislikes: user.dislikedFoods || [],
    healthConditions: user.healthConditions || [],
    dietaryRestrictions: user.dietaryRestrictions || [],
    activityLevel: user.activityLevel || undefined,
    fitnessGoal: user.fitnessGoal || undefined,
    dailyCalorieTarget: user.dailyCalorieTarget || undefined,
    weight: user.weight || undefined,
    height: user.height || undefined,
    age: user.age || undefined
  };
  
  // Handle diet type preference hierarchy: medical override > temporary preference > onboarding default
  const baseDietType = onboarding.dietType || 'Balanced';
  const effectiveDietType = req.tempMedicalOverride || req.tempDietPreference || baseDietType;
  
  console.log(`📋 User profile loaded: diet=${baseDietType} (effective: ${effectiveDietType}), allergies=${onboarding.allergies?.length || 0}, restrictions=${onboarding.dietaryRestrictions?.length || 0}`);
  
  // Generate meal using AI with user's profile
  const meal = await gptFallback({ ...req, onboarding });
  
  // Fix units
  meal.ingredients = meal.ingredients.map(normalizeUnits);
  
  // Attach image
  if (req.includeImage) {
    meal.imageUrl = await pickImageForMeal(meal);
  }
  
  return meal;
}

async function gptFallback(req: MealRequest): Promise<MealResult> {
  const { onboarding, mealType, craving } = req;
  
  const system = `You are a professional chef and nutritionist creating personalized recipes. 
Return a JSON response with this exact structure:
{
  "name": "Recipe Name",
  "description": "Brief appetizing description",
  "ingredients": [{"name": "ingredient", "amount": "quantity", "unit": "unit"}],
  "instructions": ["step 1", "step 2", ...],
  "nutrition": {"calories": 400, "protein": 25, "carbs": 30, "fat": 15, "fiber": 8}
}

Rules:
- Use exact amounts (1/2 cup, 2 tbsp, 8 oz, 1 lb)
- Avoid decimals except 0.5
- 6-10 clear cooking steps
- Always respect allergies and dietary restrictions STRICTLY
- Create healthy, balanced meals
- When following specific diet types (Mediterranean, Keto, etc.), strictly adhere to that diet's principles

Mediterranean Diet Principles:
- High in olive oil, nuts, fish, vegetables, fruits, legumes, whole grains
- Limited red meat, processed foods, refined sugars
- Focus on fresh herbs, tomatoes, olives, feta cheese
- Cooking methods: grilling, roasting, sautéing with olive oil
- Signature ingredients: olive oil, lemon, garlic, herbs (oregano, basil, thyme)`;

  const allergiesText = onboarding.allergies?.length ? ` ALLERGIES: ${onboarding.allergies.join(', ')} - MUST AVOID COMPLETELY` : '';
  const restrictionsText = onboarding.dietaryRestrictions?.length ? ` DIET: ${onboarding.dietaryRestrictions.join(', ')}` : '';
  const dislikesText = onboarding.dislikes?.length ? ` DISLIKES: ${onboarding.dislikes.join(', ')}` : '';
  const healthText = onboarding.healthConditions?.length ? ` HEALTH CONDITIONS: ${onboarding.healthConditions.join(', ')}` : '';
  
  // Handle diet type preference (from onboarding profile or temporary override)
  const baseDietType = onboarding.dietType || 'Balanced';
  const effectiveDietType = req.tempDietPreference || req.tempMedicalOverride || baseDietType;
  const dietTypeText = effectiveDietType !== 'Balanced' ? ` DIET TYPE: ${effectiveDietType} - Follow ${effectiveDietType} diet principles strictly` : '';
  
  const mealTypeText = mealType ? ` for ${mealType}` : '';
  const cravingText = craving ? ` satisfying craving for "${craving}"` : '';
  
  const userPrompt = `Create a personalized recipe${mealTypeText}${cravingText}.
User Profile:${allergiesText}${restrictionsText}${dislikesText}${healthText}${dietTypeText}
Goal: ${onboarding.fitnessGoal || 'healthy eating'}
Activity: ${onboarding.activityLevel || 'moderate'}
${onboarding.dailyCalorieTarget ? `Daily calories: ${onboarding.dailyCalorieTarget}` : ''}

Return ONLY valid JSON - no explanations or extra text.`;

  console.log(`🤖 Generating AI meal with GPT-4o for ${mealType || 'meal'}${cravingText}`);
  
  const resp = await getOpenAI().chat.completions.create({
    model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    temperature: 0.7,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" }
  });
  
  const content = resp.choices[0].message?.content ?? "";
  
  try {
    const parsed = JSON.parse(content);
    console.log(`✅ Successfully generated AI meal: ${parsed.name}`);
    
    // Backend compliance will be handled by frontend dynamic badge system
    const meal = parsed as MealResult;
    
    // Ensure nutrition data is complete
    meal.nutrition = {
      calories: meal.nutrition?.calories || 400,
      protein_g: meal.nutrition?.protein || meal.nutrition?.protein_g || 25,
      carbs_g: meal.nutrition?.carbs || meal.nutrition?.carbs_g || 30,
      fat_g: meal.nutrition?.fat || meal.nutrition?.fat_g || 15,
      fiber_g: meal.nutrition?.fiber || meal.nutrition?.fiber_g || 8,
      sugar_g: meal.nutrition?.sugar || meal.nutrition?.sugar_g || 5
    };
    
    return meal;
  } catch (error) {
    console.error("Failed to parse GPT response:", error);
    return fallbackMeal(req);
  }


}

function fallbackMeal(req: MealRequest): MealResult {
  const { mealType, craving, onboarding } = req;
  const isVegetarian = onboarding.dietaryRestrictions?.includes('vegetarian');
  const isVegan = onboarding.dietaryRestrictions?.includes('vegan');
  
  // Create appropriate fallback based on meal type and restrictions
  if (mealType === 'breakfast') {
    if (isVegan) {
      return {
        name: "Overnight Oats with Berries",
        description: "A nutritious vegan breakfast with rolled oats and fresh berries",
        ingredients: [
          { name: "Rolled oats", amount: "1/2", unit: "cup" },
          { name: "Almond milk", amount: "1/2", unit: "cup" },
          { name: "Chia seeds", amount: "1", unit: "tbsp" },
          { name: "Mixed berries", amount: "1/2", unit: "cup" },
          { name: "Maple syrup", amount: "1", unit: "tsp" }
        ],
        instructions: [
          "Mix oats, almond milk, and chia seeds in a jar",
          "Refrigerate overnight",
          "Top with berries and maple syrup before serving"
        ],
        nutrition: { calories: 320, protein_g: 8, carbs_g: 45, fat_g: 12, fiber_g: 10, sugar_g: 15 }
      };
    }
    return {
      name: "Scrambled Eggs with Toast",
      description: "Classic protein-rich breakfast with whole grain toast",
      ingredients: [
        { name: "Eggs", amount: "2", unit: "large" },
        { name: "Whole grain bread", amount: "2", unit: "slices" },
        { name: "Butter", amount: "1", unit: "tbsp" },
        { name: "Salt", amount: "1/4", unit: "tsp" },
        { name: "Black pepper", amount: "1/8", unit: "tsp" }
      ],
      instructions: [
        "Toast bread slices until golden brown",
        "Crack eggs into a bowl and whisk with salt and pepper",
        "Heat butter in a non-stick pan over medium-low heat",
        "Pour in eggs and gently scramble until set",
        "Serve eggs with toast"
      ],
      nutrition: { calories: 380, protein_g: 18, carbs_g: 25, fat_g: 22, fiber_g: 4, sugar_g: 3 }
    };
  }
  
  // Default fallback
  return {
    name: "Simple Grilled Chicken",
    description: "A healthy, protein-rich meal perfect for any time",
    ingredients: [
      { name: "Chicken breast", amount: "6", unit: "oz" },
      { name: "Olive oil", amount: "1", unit: "tbsp" },
      { name: "Salt", amount: "1/2", unit: "tsp" },
      { name: "Black pepper", amount: "1/4", unit: "tsp" },
      { name: "Garlic powder", amount: "1/4", unit: "tsp" }
    ],
    instructions: [
      "Preheat grill or grill pan to medium-high heat",
      "Season chicken with salt, pepper, and garlic powder",
      "Brush with olive oil",
      "Grill for 6-7 minutes per side until internal temperature reaches 165°F",
      "Let rest for 5 minutes before serving"
    ],
    nutrition: { calories: 280, protein_g: 42, carbs_g: 0, fat_g: 11, fiber_g: 0, sugar_g: 0 }
  };
}