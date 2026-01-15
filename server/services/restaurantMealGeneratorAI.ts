// AI-Powered Restaurant Meal Generator
// Generates restaurant-specific meals using OpenAI GPT-4
// Falls back to locked generator if AI fails
import { type User } from "@shared/schema";
import OpenAI from 'openai';
import { generateImage } from './imageService';
import { generateRestaurantMeals as generateFallbackMeals } from './restaurantMealGenerator';

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

interface RestaurantMealRequest {
  restaurantName: string;
  cuisine: string;
  user?: User;
  cravingContext?: string; // NEW: For Meal Finder - what food the user is craving
}

interface RestaurantMeal {
  id: string;
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  reason: string;
  modifications: string;
  ingredients: string[];
  medicalBadges: Array<{
    condition: string;
    compatible: boolean;
    reason: string;
    color: string;
  }>;
  imageUrl?: string;
}

// Medical condition compatibility checker
function getMedicalBadges(meal: any, userConditions: string[] = []): Array<{
  condition: string;
  compatible: boolean;
  reason: string;
  color: string;
}> {
  if (!meal || !userConditions || userConditions.length === 0) {
    return [];
  }

  const badges = [];
  const mealName = (meal?.name || "").toLowerCase();
  const description = (meal?.description || "").toLowerCase();
  const modifications = (meal?.modifications || "").toLowerCase();

  // Common medical conditions
  if (userConditions.includes("diabetes") || userConditions.includes("type 2 diabetes")) {
    const diabeticFriendly = meal.carbs <= 30 && !mealName.includes("sweet") && !description.includes("sugar");
    badges.push({
      condition: "Diabetes",
      compatible: diabeticFriendly,
      reason: diabeticFriendly ? "Low carbohydrate content" : "High carbs or sugar content",
      color: diabeticFriendly ? "green" : "red"
    });
  }

  if (userConditions.includes("hypertension") || userConditions.includes("high blood pressure")) {
    const lowSodium = !mealName.includes("fried") && !description.includes("salty") && modifications.includes("sauce on the side");
    badges.push({
      condition: "Hypertension",
      compatible: lowSodium,
      reason: lowSodium ? "Low sodium preparation" : "May contain high sodium",
      color: lowSodium ? "green" : "yellow"
    });
  }

  if (userConditions.includes("heart disease") || userConditions.includes("cardiovascular")) {
    const heartHealthy = meal.fat <= 15 && (mealName.includes("grilled") || description.includes("grilled"));
    badges.push({
      condition: "Heart Health",
      compatible: heartHealthy,
      reason: heartHealthy ? "Low fat, grilled preparation" : "Consider lower fat option",
      color: heartHealthy ? "green" : "yellow"
    });
  }

  return badges;
}

/**
 * Generate restaurant-specific meals using AI
 * Falls back to locked generator if AI fails
 */
export async function generateRestaurantMealsAI(request: RestaurantMealRequest): Promise<RestaurantMeal[]> {
  const { restaurantName, cuisine, user, cravingContext } = request;
  const userConditions = user?.healthConditions || [];

  console.log(`🤖 AI Generator: Creating restaurant-specific meals for ${restaurantName} (${cuisine} cuisine)${cravingContext ? ` featuring ${cravingContext}` : ''}`);

  // Build medical context for AI
  const medicalContext = userConditions.length > 0
    ? `User has the following health conditions: ${userConditions.join(", ")}. Consider these when suggesting modifications.`
    : "User has no specified health conditions.";
  
  // Build craving context for Meal Finder (different from Restaurant Meal Generator)
  const cravingInstructions = cravingContext
    ? `\n\nCRITICAL: The user is specifically craving "${cravingContext}". ALL meals MUST prominently feature ${cravingContext} as the main ingredient or protein. Focus on ${cravingContext}-based dishes that this restaurant would realistically serve.`
    : '';

  try {
    // Add timestamp for variety on each request
    const varietyTimestamp = Date.now();
    const varietyInstructions = [
      "Focus on different protein sources (chicken, fish, beef, turkey, plant-based)",
      "Vary the cooking methods (grilled, baked, steamed, roasted)",
      "Include different meal types (salads, bowls, wraps, plates)",
      "Mix appetizers and entrees",
      "Consider seasonal ingredients and specialties"
    ];
    const randomVarietyHint = varietyInstructions[Math.floor(Math.random() * varietyInstructions.length)];

    // Use OpenAI to generate restaurant-specific meals
    const prompt = `You are a nutrition expert helping someone choose healthy meals at "${restaurantName}", a ${cuisine} restaurant.

${medicalContext}${cravingInstructions}

IMPORTANT: Generate 3 UNIQUE and DIFFERENT meal recommendations. Each time this request is made, create completely different meals from previous suggestions. ${randomVarietyHint}

Generate 3 specific meal recommendations that would realistically be available at this restaurant. Each meal should:
1. Have a realistic name that sounds like an actual menu item from this type of restaurant
2. Be a healthier choice (grilled, baked, or steamed options preferred)
3. Include accurate macro estimates (calories, protein, carbs, fat)
4. Provide specific ordering modifications to make it healthier
5. List the main ingredients
6. Be DIFFERENT from each other (different proteins, cooking styles, and meal types)

Request ID: ${varietyTimestamp}

Return ONLY a JSON array of 3 meals with this exact structure:
[
  {
    "name": "Specific menu item name",
    "description": "Brief description of the dish",
    "calories": 450,
    "protein": 35,
    "carbs": 30,
    "fat": 15,
    "reason": "Why this is a good choice for health goals",
    "modifications": "Specific ordering instructions (e.g., sauce on side, no cheese)",
    "ingredients": ["ingredient1", "ingredient2", "ingredient3"]
  }
]

Make the meals sound authentic to ${restaurantName}. Vary the protein sources and preparation methods across the 3 meals.`;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini", // 10x faster than gpt-4
      messages: [
        {
          role: "system",
          content: "You are a nutrition expert who provides accurate, restaurant-specific meal recommendations. Return only valid JSON. Always generate unique and varied meal suggestions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7, // Lower for faster, more consistent responses
      max_tokens: 1200, // Reduced for speed
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    
    if (!responseText) {
      console.warn('⚠️ AI returned empty response, falling back to locked generator');
      return generateFallbackMeals(request);
    }

    // Parse AI response
    let aiMeals;
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      aiMeals = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('Response text:', responseText);
      console.warn('⚠️ Falling back to locked generator');
      return generateFallbackMeals(request);
    }

    // Validate and transform AI meals
    if (!Array.isArray(aiMeals) || aiMeals.length === 0) {
      console.warn('⚠️ AI returned invalid meal array, falling back to locked generator');
      return generateFallbackMeals(request);
    }

    // Transform AI meals to our format
    const meals: RestaurantMeal[] = aiMeals.slice(0, 3).map((meal, index) => {
      const mealId = `${restaurantName.toLowerCase().replace(/\s+/g, '-')}-ai-meal-${index + 1}-${Date.now()}`;
      
      return {
        id: mealId,
        name: meal.name || `${cuisine} Specialty ${index + 1}`,
        description: meal.description || "A delicious and healthy option",
        calories: meal.calories || 400,
        protein: meal.protein || 25,
        carbs: meal.carbs || 30,
        fat: meal.fat || 12,
        reason: meal.reason || "Balanced nutrition with quality ingredients",
        modifications: meal.modifications || "Request healthy preparation",
        ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : ["protein", "vegetables", "whole grains"],
        medicalBadges: getMedicalBadges(meal, userConditions)
      };
    });

    console.log(`✅ AI generated ${meals.length} restaurant-specific meals for ${restaurantName}`);

    // Generate images in parallel for ALL meals at once (10x faster!)
    console.log(`🖼️ Generating images for all ${meals.length} meals in parallel...`);
    const imagePromises = meals.map(async (meal) => {
      try {
        const imageUrl = await generateImage({
          name: meal.name,
          description: meal.description,
          type: 'meal',
          style: cuisine,
          ingredients: meal.ingredients,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
        });

        if (imageUrl) {
          meal.imageUrl = imageUrl;
          console.log(`✅ Image generated for ${meal.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to generate image for ${meal.name}:`, error);
      }
    });

    // Wait for all images to complete
    await Promise.all(imagePromises);
    console.log(`🎉 All ${meals.length} images generated!`);

    return meals;

  } catch (error) {
    console.error('❌ AI meal generation error:', error);
    console.warn('⚠️ Falling back to locked generator');
    return generateFallbackMeals(request);
  }
}
