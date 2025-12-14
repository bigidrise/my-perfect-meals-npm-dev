import OpenAI from 'openai';

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


interface FamilyRecipeInput {
  name: string;
  description: string;
}

interface ParsedFamilyRecipe {
  name: string;
  ingredients: Array<{
    name: string;
    quantity: string;
    unit: string;
  }>;
  optionalInstructions?: string;
  servings?: number;
  prepTime?: string;
  cookTime?: string;
}

export async function parseFamilyRecipe(input: FamilyRecipeInput): Promise<ParsedFamilyRecipe> {
  try {
    console.log("🤖 OpenAI parsing family recipe:", input.name);

    const prompt = `You are a professional chef and recipe parser. Parse this family recipe into a structured format.

Recipe Name: ${input.name}
Recipe Description: ${input.description}

Parse this into a JSON object with the following structure:
{
  "name": "Recipe name (cleaned up if needed)",
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": "amount",
      "unit": "unit of measurement"
    }
  ],
  "optionalInstructions": "Step-by-step cooking instructions (if you can infer from description)",
  "servings": number_of_servings_if_mentioned,
  "prepTime": "prep time if mentioned",
  "cookTime": "cook time if mentioned"
}

Rules:
1. Extract all ingredients mentioned in the description
2. If quantities are not specified, provide reasonable estimates for typical home cooking
3. If no clear instructions are provided, create logical cooking steps based on the ingredients
4. Use standard cooking units (cups, tablespoons, teaspoons, ounces, pounds, etc.)
5. Make the recipe family-friendly and traditional
6. If servings aren't specified, assume 6-8 servings for family recipes

Return only valid JSON.`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    console.log("🤖 OpenAI family recipe response received, parsing...");
    const parsedRecipe = JSON.parse(content) as ParsedFamilyRecipe;

    // Validate the parsed recipe
    if (!parsedRecipe.name || !parsedRecipe.ingredients || !Array.isArray(parsedRecipe.ingredients)) {
      throw new Error("Invalid recipe structure from OpenAI");
    }

    // Ensure all ingredients have required fields
    parsedRecipe.ingredients = parsedRecipe.ingredients.map(ingredient => ({
      name: ingredient.name || "Unknown ingredient",
      quantity: ingredient.quantity || "1",
      unit: ingredient.unit || "unit"
    }));

    console.log("✅ Family recipe parsed successfully");
    console.log("🥄 Ingredients count:", parsedRecipe.ingredients.length);

    return parsedRecipe;

  } catch (error: any) {
    console.error("❌ Family recipe parsing failed:", error);
    
    // Fallback parsing using simple text processing
    console.log("🔄 Attempting fallback parsing...");
    
    return {
      name: input.name,
      ingredients: extractIngredientsFromText(input.description),
      optionalInstructions: `Mix ingredients for ${input.name} and cook according to family tradition.`,
      servings: 6
    };
  }
}

// Fallback ingredient extraction from text
function extractIngredientsFromText(description: string): Array<{name: string; quantity: string; unit: string}> {
  const ingredients = [];
  const text = description.toLowerCase();
  
  // Common ingredient patterns
  const ingredientPatterns = [
    /(\d+(?:\/\d+)?)\s*(cups?|cup)\s+([a-zA-Z\s]+)/g,
    /(\d+(?:\/\d+)?)\s*(tablespoons?|tbsp|teaspoons?|tsp)\s+([a-zA-Z\s]+)/g,
    /(\d+(?:\/\d+)?)\s*(pounds?|lbs?|ounces?|oz)\s+([a-zA-Z\s]+)/g,
    /(\d+)\s+([a-zA-Z\s]+)/g
  ];

  for (const pattern of ingredientPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      ingredients.push({
        name: match[3]?.trim() || match[2]?.trim() || "ingredient",
        quantity: match[1] || "1",
        unit: match[2] || "unit"
      });
    }
  }

  // If no patterns matched, extract common food words
  if (ingredients.length === 0) {
    const foodWords = text.match(/\b(flour|sugar|butter|eggs?|milk|cheese|chicken|beef|onion|garlic|salt|pepper|oil|water)\b/g);
    if (foodWords) {
      foodWords.forEach(word => {
        ingredients.push({
          name: word,
          quantity: "1",
          unit: "unit"
        });
      });
    }
  }

  // Ensure we have at least some basic ingredients
  if (ingredients.length === 0) {
    ingredients.push({
      name: "family recipe ingredients",
      quantity: "as needed",
      unit: "portion"
    });
  }

  return ingredients.slice(0, 15); // Limit to 15 ingredients max
}