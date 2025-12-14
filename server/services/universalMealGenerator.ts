// File: server/services/universalMealGenerator.ts

import OpenAI from "openai";
import { MealType, WeeklyMealReq } from "./stableMealGenerator";
import { randomUUID } from "crypto";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for AI features");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Convert decimal to fraction for display
function formatFraction(decimal: number): string {
  if (decimal === 0.25) return "1/4";
  if (decimal === 0.33 || Math.abs(decimal - 1/3) < 0.01) return "1/3";
  if (decimal === 0.5) return "1/2";
  if (decimal === 0.67 || Math.abs(decimal - 2/3) < 0.01) return "2/3";
  if (decimal === 0.75) return "3/4";
  if (decimal === 1.33 || Math.abs(decimal - 4/3) < 0.01) return "1 1/3";
  if (decimal === 1.5) return "1 1/2";
  if (decimal === 1.67 || Math.abs(decimal - 5/3) < 0.01) return "1 2/3";
  if (decimal === 2.5) return "2 1/2";
  
  // If it's close to a whole number, round it
  if (Math.abs(decimal - Math.round(decimal)) < 0.01) {
    return Math.round(decimal).toString();
  }
  
  // Otherwise return the decimal with max 2 decimal places
  return decimal.toFixed(2).replace(/\.?0+$/, '');
}

export type FinalMeal = {
  id: string;
  name: string;
  description: string;
  mealType: MealType;
  ingredients: { name: string; amount?: number; unit?: string; notes?: string }[];
  instructions: string[];
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
  medicalBadges: string[];
  flags: string[];
  servingSize?: string;
  imageUrl?: string | null;
  createdAt?: Date;
};

// Generate DALL-E image
async function generateImageFromDalle(prompt: string): Promise<string | null> {
  try {
    const response = await getOpenAI().images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });
    return response.data[0].url || null;
  } catch (error) {
    console.error("DALL-E image generation error:", error);
    return null;
  }
}

// 🔁 Universal AI Meal Generator for any craving
export async function generateMealFromPrompt(prompt: string, mealType: MealType, userPrefs?: Partial<WeeklyMealReq>): Promise<FinalMeal> {
  console.log("🌟 GPT-4 universal meal creation triggered with prompt:", prompt);

  const gptResponse = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: "You are a certified meal planning nutritionist. Create healthy, realistic meals using US standard measurements (oz, cups, tbsp, tsp, pounds). Format your response as:\n\nMeal Name: [name]\nDescription: [one sentence description]\n\nIngredients:\n- 6 oz tilapia fillet\n- 1/2 cup brown rice\n- 1 tbsp olive oil\n- 1 cup steamed broccoli\n\nInstructions:\n1. [step one]\n2. [step two]\n3. [step three]\n\nNutrition:\nCalories: 450\nProtein: 35g\nCarbs: 40g\nFat: 12g"
      },
      {
        role: "user",
        content: `Create a healthy ${mealType} that satisfies the craving for: ${prompt}`
      }
    ]
  });

  const text = gptResponse.choices[0]?.message.content;
  if (!text) throw new Error("GPT-4 did not return a valid response");

  // Parse GPT response sections
  const lines = text.split("\n").filter(line => line.trim());
  
  // Extract meal name and description
  const name = lines.find(l => l.toLowerCase().includes("meal name:"))?.replace(/meal name:/i, '').trim() || 
               lines.find(l => l.toLowerCase().includes("name:"))?.replace(/name:/i, '').trim() || 
               lines[0]?.trim() || "Custom AI Meal";
               
  const description = lines.find(l => l.toLowerCase().includes("description:"))?.replace(/description:/i, '').trim() || 
                     `A healthy ${mealType} created to satisfy your craving for ${prompt}.`;

  // Extract ingredients section
  const ingredientStartIndex = lines.findIndex(l => l.toLowerCase().includes("ingredient"));
  const instructionStartIndex = lines.findIndex(l => l.toLowerCase().includes("instruction"));
  
  const ingredientLines = lines.slice(
    ingredientStartIndex + 1, 
    instructionStartIndex > ingredientStartIndex ? instructionStartIndex : lines.length
  ).filter(l => l.trim().startsWith("-") || l.trim().startsWith("•"));

  // Parse ingredients into structured format
  const ingredients = ingredientLines.map(line => {
    const cleaned = line.replace(/^[-•]\s*/, '').trim();
    
    // Match patterns like "6 oz tilapia fillet" or "1/2 cup brown rice"
    const match = cleaned.match(/^(\d+(?:\/\d+)?(?:\.\d+)?)\s*(oz|cup|cups|tbsp|tsp|pound|lb|pounds|lbs)\s+(.+)$/i);
    
    if (match) {
      const [, amount, unit, name] = match;
      // Convert fraction to decimal but round to avoid precision errors
      const numAmount = amount.includes('/') ? 
        Math.round((amount.split('/').reduce((a, b) => parseFloat(a) / parseFloat(b))) * 1000) / 1000 : 
        parseFloat(amount);
        
      const formattedAmount = formatFraction(numAmount);
      return {
        name: name.trim(),
        amount: numAmount,
        unit: unit.toLowerCase(),
        notes: "",
        displayText: `${formattedAmount} ${unit} ${name.trim()}`
      };
    }
    
    // Fallback for ingredients without clear measurements
    return {
      name: cleaned,
      amount: 1,
      unit: "piece",
      notes: "",
      displayText: cleaned
    };
  });

  // Extract instructions
  const nutritionStartIndex = lines.findIndex(l => l.toLowerCase().includes("nutrition") || l.toLowerCase().includes("calories"));
  const instructionLines = lines.slice(
    instructionStartIndex + 1, 
    nutritionStartIndex > instructionStartIndex ? nutritionStartIndex : lines.length
  ).filter(l => l.match(/^\d+\./));

  const instructions = instructionLines.map(line => line.replace(/^\d+\.\s*/, '').trim());

  // Extract nutrition
  const nutritionLines = lines.slice(nutritionStartIndex);
  const nutrition = {
    calories: parseInt(nutritionLines.find(l => l.toLowerCase().includes("calories"))?.match(/\d+/)?.[0] || '400'),
    protein: parseInt(nutritionLines.find(l => l.toLowerCase().includes("protein"))?.match(/\d+/)?.[0] || '25'),
    carbs: parseInt(nutritionLines.find(l => l.toLowerCase().includes("carb"))?.match(/\d+/)?.[0] || '30'),
    fat: parseInt(nutritionLines.find(l => l.toLowerCase().includes("fat"))?.match(/\d+/)?.[0] || '15')
  };

  // Generate DALL-E image
  const imagePrompt = `${name}, healthy ${mealType}, professional food photography, overhead view, clean plate presentation`;
  const imageUrl = await generateImageFromDalle(imagePrompt);

  return {
    id: `gpt-${Date.now()}-${randomUUID().slice(0, 8)}`,
    name,
    description,
    mealType,
    ingredients,
    instructions: instructions.length > 0 ? instructions : [
      "Prepare all ingredients according to recipe",
      "Cook using appropriate methods for each ingredient", 
      "Season to taste and serve hot"
    ],
    nutrition,
    medicalBadges: [],
    flags: ["ai_generated"],
    servingSize: "1 serving",
    imageUrl,
    createdAt: new Date()
  };
}