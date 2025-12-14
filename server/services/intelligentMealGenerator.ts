// server/services/intelligentMealGenerator.ts
// ChatGPT-level intelligent meal generation system
import OpenAI from "openai";
import { storage } from "../storage";
import { enforceMeasuredIngredients } from "./mealgenV2";

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

export interface IntelligentMealRequest {
  userId: string;
  naturalLanguageInput: string; // "I want healthy breakfast for my diabetes"
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  preferences?: {
    cuisine?: string;
    cookingTime?: number;
    difficulty?: "easy" | "medium" | "hard";
    servings?: number;
  };
  mode?: "chat" | "generate" | "modify";
}

export interface IntelligentMealResponse {
  meal?: {
    name: string;
    description: string;
    ingredients: Array<{ name: string; amount: string }>;
    instructions: string[];
    nutrition: {
      calories?: number;
      protein?: number;
      carbs?: number;
      fats?: number;
    };
    cookingTime: number;
    difficulty: string;
    servings: number;
    imageUrl?: string;
    medicalBadges: string[];
  };
  conversationalResponse: string;
  suggestions?: string[];
  followUpQuestions?: string[];
}

export async function generateIntelligentMeal(request: IntelligentMealRequest): Promise<IntelligentMealResponse> {
  // Get user's complete profile for personalization
  const user = await storage.getUser(request.userId);
  if (!user) {
    throw new Error("User profile not found");
  }

  // Build comprehensive user context
  const userContext = buildUserContext(user);
  
  // Use GPT-4o for intelligent meal generation with conversation
  const systemPrompt = `You are an expert nutritionist and chef AI assistant specializing in personalized meal planning. You have access to a user's complete health profile and dietary needs.

USER PROFILE:
${userContext}

Your role is to:
1. Understand natural language requests about meals and nutrition
2. Generate personalized meal recommendations based on health conditions
3. Provide conversational, helpful responses
4. Ensure all recommendations are medically appropriate
5. Suggest modifications and alternatives

RESPONSE FORMAT: Always respond with valid JSON in this exact structure:
{
  "meal": {
    "name": "Meal Name",
    "description": "Brief description focusing on health benefits",
    "ingredients": [{"name": "ingredient", "amount": "measured amount"}],
    "instructions": ["step 1", "step 2", "..."],
    "nutrition": {"calories": 350, "protein": 25, "carbs": 30, "fats": 15},
    "cookingTime": 20,
    "difficulty": "easy",
    "servings": 1,
    "medicalBadges": ["Diabetes-Friendly", "Heart-Healthy", "Low-Sodium"]
  },
  "conversationalResponse": "Friendly, helpful response explaining the meal choice",
  "suggestions": ["Alternative 1", "Alternative 2", "Alternative 3"],
  "followUpQuestions": ["Would you like a different cuisine?", "Need a quicker option?"]
}

MEDICAL SAFETY RULES:
- For diabetes: Focus on low glycemic index, balanced carbs
- For hypertension: Limit sodium to under 600mg per meal
- For allergies: Completely avoid all allergens
- For dietary restrictions: Strictly follow (vegetarian, gluten-free, etc.)

MEASUREMENT STANDARDS:
- Use kitchen-friendly measurements (cups, tbsp, tsp, oz)
- Convert decimals to fractions (0.5 = 1/2, 0.25 = 1/4)
- Specify piece sizes (1 medium onion, 2 large eggs)`;

  const userPrompt = `User request: "${request.naturalLanguageInput}"

${request.mealType ? `Meal type: ${request.mealType}` : ''}
${request.preferences ? `Preferences: ${JSON.stringify(request.preferences)}` : ''}

Please generate a personalized meal recommendation with a conversational response.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Post-process to ensure quality
    if (result.meal?.ingredients) {
      result.meal.ingredients = enforceMeasuredIngredients(result.meal.ingredients);
    }

    // Generate image if requested
    if (request.mode === "generate" && result.meal) {
      try {
        const imageResponse = await getOpenAI().images.generate({
          model: "dall-e-3",
          prompt: `Professional food photography of ${result.meal.name}: ${result.meal.description}. Clean, appetizing, restaurant-quality presentation.`,
          size: "1024x1024",
          quality: "standard",
          n: 1
        });
        result.meal.imageUrl = imageResponse.data?.[0]?.url;
      } catch (imageError) {
        console.warn("Image generation failed:", imageError);
      }
    }

    return result as IntelligentMealResponse;

  } catch (error) {
    console.error("Intelligent meal generation failed:", error);
    
    // Fallback response
    return {
      conversationalResponse: "I'm having trouble generating a personalized meal right now. Let me suggest a simple, healthy option based on your dietary needs.",
      suggestions: [
        "Try our basic meal generator",
        "Browse our recipe library", 
        "Contact support for help"
      ],
      followUpQuestions: [
        "Would you like me to try a different approach?",
        "Can you be more specific about what you're looking for?"
      ]
    };
  }
}

export async function converseMealPlanning(request: {
  userId: string;
  conversation: Array<{ role: "user" | "assistant"; content: string }>;
  currentMeal?: any;
}): Promise<{ response: string; suggestions?: string[]; updatedMeal?: any }> {
  
  const user = await storage.getUser(request.userId);
  const userContext = buildUserContext(user);

  const systemPrompt = `You are a conversational meal planning assistant. Help users refine their meal choices through natural dialogue.

USER PROFILE:
${userContext}

Current meal context: ${request.currentMeal ? JSON.stringify(request.currentMeal) : "None"}

Respond conversationally and helpfully. If the user wants to modify the meal, provide specific suggestions.`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...request.conversation
  ];

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages,
      temperature: 0.8,
      max_tokens: 500
    });

    return {
      response: response.choices[0].message.content || "I'm here to help with your meal planning!",
      suggestions: [
        "Modify ingredients",
        "Change cooking method", 
        "Adjust portion size",
        "Try different cuisine"
      ]
    };

  } catch (error) {
    console.error("Conversation failed:", error);
    return {
      response: "I'm having trouble understanding. Could you rephrase your request?",
      suggestions: ["Try being more specific", "Ask about ingredients", "Request cooking tips"]
    };
  }
}

function buildUserContext(user: any): string {
  return `
Name: ${user.firstName} ${user.lastName}
Age: ${user.age}
Health Conditions: ${user.healthConditions?.join(", ") || "None"}
Dietary Restrictions: ${user.dietaryRestrictions?.join(", ") || "None"}
Allergies: ${user.allergies?.join(", ") || "None"}
Disliked Foods: ${user.dislikedFoods?.join(", ") || "None"}
Fitness Goal: ${user.fitnessGoal || "General health"}
Daily Calorie Target: ${user.dailyCalorieTarget || "Not specified"}
Activity Level: ${user.activityLevel || "Moderate"}

MEDICAL CONSIDERATIONS:
${user.healthConditions?.includes("diabetes") ? "- Requires low glycemic index foods, balanced carbohydrates" : ""}
${user.healthConditions?.includes("hypertension") ? "- Needs low sodium options (under 600mg per meal)" : ""}
${user.allergies?.length ? `- Must avoid: ${user.allergies.join(", ")}` : ""}
${user.dietaryRestrictions?.includes("vegetarian") ? "- Vegetarian diet required" : ""}
${user.dietaryRestrictions?.includes("vegan") ? "- Vegan diet required" : ""}
${user.dietaryRestrictions?.includes("gluten-free") ? "- Gluten-free diet required" : ""}
`.trim();
}

export async function explainMealChoice(mealData: any, userId: string): Promise<string> {
  const user = await storage.getUser(userId);
  const userContext = buildUserContext(user);

  const prompt = `Explain why this meal is a good choice for this user:

USER: ${userContext}

MEAL: ${JSON.stringify(mealData)}

Provide a brief, friendly explanation focusing on health benefits and how it fits their dietary needs.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 200
    });

    return response.choices[0].message.content || "This meal is designed to meet your specific dietary needs and health goals.";

  } catch (error) {
    console.error("Meal explanation failed:", error);
    return "This meal is carefully crafted to support your health goals and dietary requirements.";
  }
}