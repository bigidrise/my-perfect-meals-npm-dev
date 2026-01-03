import OpenAI from 'openai';
import { generateImage } from './imageService';
import { deriveCarbSplit } from './generators/macros/carbSplit';
import { convertStructuredIngredients } from '../utils/unitConverter';

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

// Robust content extraction for OpenAI responses
type AnyObj = Record<string, any>;

function safeString(x: any): string | null {
  if (!x) return null;
  if (typeof x === "string") return x.trim() || null;
  return null;
}

function tryJson(str: string | null): AnyObj | null {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    // try to salvage first {...} block
    const m = str.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch {}
    }
    return null;
  }
}

// Handles Chat Completions, tool_calls, Responses API, and content arrays
function extractAiText(raw: AnyObj): { text?: string; argsJson?: AnyObj; hint?: string } {
  // 1) Responses API (latest) — output_text shortcut
  const outputText = safeString(raw?.output_text);
  if (outputText) return { text: outputText, hint: "responses.output_text" };

  // 2) Classic chat: message.content as string
  const choice = raw?.choices?.[0];
  const msg = choice?.message ?? raw?.message ?? null;

  const direct = safeString(msg?.content);
  if (direct) return { text: direct, hint: "message.content:string" };

  // 3) content parts array (Assistants/Responses-like shape)
  const parts = Array.isArray(msg?.content) ? msg.content : null;
  if (parts && parts.length) {
    // find first text-bearing part
    for (const p of parts) {
      if (typeof p === "string" && p.trim()) return { text: p.trim(), hint: "message.content:string[] part" };
      if (p?.type === "text" && safeString(p?.text?.value)) {
        return { text: p.text.value, hint: "message.content[part].text.value" };
      }
      if (p?.type === "output_text" && safeString(p?.text)) {
        return { text: p.text, hint: "message.content[part].output_text" };
      }
    }
  }

  // 4) Function/tool call arguments (JSON-as-string)
  const tool = Array.isArray(msg?.tool_calls) ? msg.tool_calls[0] : null;
  const toolArgs = safeString(tool?.function?.arguments);
  if (toolArgs) {
    const parsed = tryJson(toolArgs);
    return { argsJson: parsed ?? undefined, text: parsed ? JSON.stringify(parsed) : toolArgs, hint: "tool_calls[0].function.arguments" };
  }

  // 5) Legacy function_call
  const fnArgs = safeString(msg?.function_call?.arguments);
  if (fnArgs) {
    const parsed = tryJson(fnArgs);
    return { argsJson: parsed ?? undefined, text: parsed ? JSON.stringify(parsed) : fnArgs, hint: "message.function_call.arguments" };
  }

  return {};
}

interface FridgeRescueMeal {
  id: string;
  name: string;
  description: string;
  ingredients: Array<{
    name: string;
    quantity: string;
    unit: string;
  }>;
  instructions: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
  cookingTime: string;
  difficulty: 'Easy' | 'Medium';
  imageUrl?: string;
  medicalBadges: Array<{
    id: string;
    label: string;
    description: string;
    color: string;
    textColor: string;
    category: 'metabolic' | 'digestive' | 'cardiovascular' | 'allergies' | 'fitness' | 'dietary';
  }>;
}

interface FridgeRescueRequest {
  fridgeItems: string[];
  user?: any;
  macroTargets?: {
    protein_g?: number;
    fibrous_carbs_g?: number;
    starchy_carbs_g?: number;
    fat_g?: number;
  };
}

// Medical condition compatibility checker - using correct badge format
function getMedicalBadges(meal: any, userConditions: string[] = []): Array<{
  id: string;
  label: string;
  description: string;
  color: string;
  textColor: string;
  category: 'metabolic' | 'digestive' | 'cardiovascular' | 'allergies' | 'fitness' | 'dietary';
}> {
  if (!meal || !userConditions || userConditions.length === 0) {
    return [];
  }

  const badges = [];
  const mealName = (meal?.name || "").toLowerCase();
  const description = (meal?.description || "").toLowerCase();
  const ingredients = (meal?.ingredients || []).map((i: any) => (i.name || "").toLowerCase()).join(" ");

  // Diabetes check
  if (userConditions.includes("diabetes") || userConditions.includes("type 2 diabetes")) {
    const diabeticFriendly = meal.carbs <= 30 && !mealName.includes("sweet") && !description.includes("sugar") && !ingredients.includes("sugar");
    badges.push({
      id: "diabetes",
      label: "Diabetes Safe",
      description: diabeticFriendly ? "Low carbohydrate content suitable for diabetes" : "Higher carbs - monitor glucose",
      color: diabeticFriendly ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50",
      textColor: diabeticFriendly ? "text-green-700" : "text-yellow-700",
      category: "metabolic" as const
    });
  }

  // Hypertension check
  if (userConditions.includes("hypertension") || userConditions.includes("high blood pressure")) {
    const lowSodium = !mealName.includes("fried") && !description.includes("salty") && !ingredients.includes("salt");
    badges.push({
      id: "hypertension",
      label: "Heart Healthy",
      description: lowSodium ? "Low sodium preparation suitable for hypertension" : "May contain higher sodium - monitor intake",
      color: lowSodium ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50",
      textColor: lowSodium ? "text-green-700" : "text-yellow-700",
      category: "cardiovascular" as const
    });
  }

  // Heart disease check
  if (userConditions.includes("heart disease") || userConditions.includes("cardiovascular")) {
    const heartHealthy = meal.fat <= 15 && (mealName.includes("grilled") || mealName.includes("steamed") || mealName.includes("baked"));
    badges.push({
      id: "heart",
      label: "Low Fat",
      description: heartHealthy ? "Low fat cooking method good for heart health" : "Consider lower fat preparation methods",
      color: heartHealthy ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50",
      textColor: heartHealthy ? "text-green-700" : "text-yellow-700",
      category: "cardiovascular" as const
    });
  }

  return badges;
}

export async function generateFridgeRescueMeals(request: FridgeRescueRequest): Promise<FridgeRescueMeal[]> {
  const { fridgeItems, user, macroTargets } = request;
  const userConditions = user?.healthConditions || [];
  
  // Safety check for fridgeItems
  if (!fridgeItems || !Array.isArray(fridgeItems) || fridgeItems.length === 0) {
    console.error("❌ Invalid fridgeItems provided:", fridgeItems);
    throw new Error("fridgeItems is required and must be a non-empty array");
  }
  
  console.log(`🧊 Generating fridge rescue meals with ingredients: ${fridgeItems.join(', ')}`);
  if (macroTargets) {
    const targets = [];
    if (macroTargets.protein_g) targets.push(`${macroTargets.protein_g}g protein`);
    if (macroTargets.fibrous_carbs_g) targets.push(`${macroTargets.fibrous_carbs_g}g fibrous carbs`);
    if (macroTargets.starchy_carbs_g) targets.push(`${macroTargets.starchy_carbs_g}g starchy carbs`);
    if (macroTargets.fat_g) targets.push(`${macroTargets.fat_g}g fat`);
    console.log(`🎯 Macro targets requested: ${targets.join(', ')}`);
  }

  const medicalConditionsText = userConditions.length > 0 ? 
    `\n\nIMPORTANT: The user has these medical conditions: ${userConditions.join(", ")}. Ensure all meal recommendations are safe and appropriate for these conditions.` : "";

  // 🎯 Add macro targeting instructions if targets provided
  const macroTargetingText = macroTargets ? `
🎯 CRITICAL MACRO TARGETING REQUIREMENT:
The user is in contest prep mode and needs EXACT macro targets for this meal:
${macroTargets.protein_g ? `- Target Protein: ${macroTargets.protein_g}g (±5g tolerance)\n` : ''}${macroTargets.fibrous_carbs_g ? `- Target Fibrous Carbs: ${macroTargets.fibrous_carbs_g}g (±5g tolerance)\n` : ''}${macroTargets.starchy_carbs_g ? `- Target Starchy Carbs: ${macroTargets.starchy_carbs_g}g (±5g tolerance)\n` : ''}${macroTargets.fat_g ? `- Target Fat: ${macroTargets.fat_g}g (±5g tolerance)\n` : ''}
YOU MUST:
1. Calculate ingredient quantities precisely to hit these exact macro targets
2. Stay within ±5g tolerance for each specified macro
3. Use FIBROUS carbs (vegetables) and STARCHY carbs (rice, potatoes) separately if both targets are provided
4. Prioritize hitting protein target first, then carbs, then fat if trade-offs needed
5. Adjust portion sizes and ingredient amounts to achieve exact macros
6. Return the ACTUAL calculated macros in your response

IMPORTANT: 
- Fibrous carbs = vegetables, leafy greens, broccoli, cauliflower, peppers, etc.
- Starchy carbs = rice, potatoes, sweet potatoes, bread, pasta, oats, etc.
- If only one carb target is provided, use appropriate sources

EXAMPLE: If target is 50g protein + 30g starchy carbs, your meal MUST have 45-55g protein and 25-35g starchy carbs.

This is for athlete meal planning - precision is critical for contest preparation.
` : "";

  const prompt = `You are a creative chef helping someone make meals with limited ingredients from their fridge.

TASK: Create 3 different, realistic meals using ONLY these ingredients: ${fridgeItems.join(', ')}
${macroTargetingText}
RULES:
- Use ONLY the ingredients provided - do not add any others
- Create actual meal names (not just ingredient lists)
- Each meal should be simple and cookable
- Provide realistic cooking instructions
- Include basic nutritional estimates
- Make each meal distinctly different from the others
${macroTargets ? '- ADJUST ingredient quantities precisely to hit the exact macro targets specified above within ±5g tolerance' : ''}

${medicalConditionsText}

CRITICAL INGREDIENT FORMAT REQUIREMENT:
- ALL ingredients MUST have quantities in GRAMS (numeric value with unit "g")
- For proteins (chicken, beef, fish, etc.): Use grams, e.g. {"name": "chicken breast", "amount": 170, "unit": "g"}
- For starches (rice, potatoes, pasta): Use grams, e.g. {"name": "rice", "amount": 150, "unit": "g"}
- For vegetables: Use grams, e.g. {"name": "broccoli", "amount": 100, "unit": "g"}
- For liquids: Use ml, e.g. {"name": "olive oil", "amount": 15, "unit": "ml"}
- For small amounts (spices): Use grams or "to taste"
- NEVER use vague units like "piece", "fillet", or "breast" - always use exact gram weights

FORMAT: Return as JSON object:
{
  "meals": [
    {
      "name": "Creative meal name (not just ingredient list)",
      "description": "Brief 1-2 sentence description",
      "ingredients": [{"name": "ingredient name", "amount": number_in_grams, "unit": "g"}],
      "instructions": "Step-by-step cooking instructions as single string",
      "calories": number (${macroTargets ? 'calculated from hitting macro targets' : '200-500 range'}),
      "protein": number (${macroTargets?.protein_g ? `${macroTargets.protein_g}±5 grams - MUST hit this target` : '10-40 grams'}),
      "carbs": number (total carbs ${macroTargets?.fibrous_carbs_g || macroTargets?.starchy_carbs_g ? `- should equal ${(macroTargets.fibrous_carbs_g || 0) + (macroTargets.starchy_carbs_g || 0)}±5g from combining fibrous and starchy sources` : '15-50 grams'}), 
      "fat": number (${macroTargets?.fat_g ? `${macroTargets.fat_g}±5 grams - MUST hit this target` : '5-25 grams'}),
      "cookingTime": "X minutes",
      "difficulty": "Easy or Medium"
    }
  ]
}

Remember: Only use ingredients from this list: ${fridgeItems.join(', ')}`;

  try {
    console.log("🤖 Making OpenAI API call with GPT-5...");
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o", // Using GPT-4o for better reliability in content generation
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 2000, // GPT-4o uses max_tokens
    });
    console.log("✅ OpenAI API call successful");
    
    // Debug shape analysis
    const dbg = {
      hasOutputText: Boolean(response?.output_text),
      hasChoices: Array.isArray(response?.choices),
      msgType: typeof response?.choices?.[0]?.message?.content,
      partsLen: Array.isArray(response?.choices?.[0]?.message?.content) ? response.choices[0].message.content.length : 0,
      hasToolCalls: Array.isArray(response?.choices?.[0]?.message?.tool_calls),
      hasFnCall: Boolean(response?.choices?.[0]?.message?.function_call),
    };
    console.log("[FRIDGE:AI][SHAPE]", dbg);

    const { text, argsJson, hint } = extractAiText(response);
    console.log("[FRIDGE:AI][EXTRACT]", { hint, textLen: text?.length ?? 0, hasArgsJson: Boolean(argsJson) });

    if (!text && !argsJson) {
      console.error("[FRIDGE:AI][NO-CONTENT]", JSON.stringify(dbg));
      throw new Error("No content received from OpenAI (shape unsupported)");
    }

    const content = text;

    console.log("🤖 OpenAI fridge rescue response received, parsing...");
    console.log("🧠 Raw OpenAI response content:", content);
    
    let responseData;
    try {
      // Use safer parsing to extract JSON even if wrapped in text
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("No JSON object found in response");
      }
      const jsonString = content.substring(jsonStart, jsonEnd + 1);
      console.log("🔍 Extracted JSON string:", jsonString);
      responseData = JSON.parse(jsonString);
    } catch (err) {
      console.error("❌ Failed to parse OpenAI JSON:", err.message);
      throw new Error("Invalid OpenAI format");
    }

    // Add pre-check before processing meals
    if (!responseData || !Array.isArray(responseData.meals)) {
      console.error("❌ Unexpected OpenAI format:", responseData);
      throw new Error("OpenAI did not return valid meals array");
    }

    const meals = responseData.meals;
    console.log("✅ Found", meals.length, "meals in response");

    const processedMeals: FridgeRescueMeal[] = [];
    
    for (let index = 0; index < meals.length; index++) {
      const meal = meals[index];
      console.log(`🔍 Processing meal ${index + 1}:`, meal);
      
      // Guard against undefined meals
      if (!meal) {
        console.warn(`⚠️ Meal ${index + 1} is undefined, skipping`);
        continue;
      }
      
      // Normalize ingredients from AI response (may have amount or quantity field)
      const rawIngredients = meal.ingredients || fridgeItems.map(item => ({ name: item, amount: 100, unit: "g" }));
      
      // Convert grams to user-friendly units (e.g., 170g chicken → 6 oz chicken breast)
      const normalizedIngredients = rawIngredients.map((ing: any) => ({
        name: ing.name,
        amount: ing.amount || ing.quantity || 100,
        unit: ing.unit || 'g',
        notes: ''
      }));
      
      // Apply conversion to user-friendly units (same as Craving Creator)
      const convertedIngredients = convertStructuredIngredients(normalizedIngredients);
      
      // Map to expected format with quantity field for frontend compatibility
      const mealIngredients = convertedIngredients.map((ing: any) => ({
        name: ing.name,
        quantity: ing.displayText || `${ing.amount} ${ing.unit}`,
        unit: ing.unit,
        displayText: ing.displayText || `${ing.amount} ${ing.unit} ${ing.name}`
      }));
      
      const mealCarbs = meal.carbs || 25;
      const { starchyGrams, fibrousGrams } = deriveCarbSplit(mealIngredients, mealCarbs);
      
      const processedMeal: FridgeRescueMeal = {
        id: `fridge-rescue-${index}-${Date.now()}`,
        name: meal.name || `Fridge Rescue Meal ${index + 1}`,
        description: meal.description || "A creative meal using your available ingredients",
        ingredients: mealIngredients,
        instructions: meal.instructions || "Combine ingredients and cook until done.",
        calories: meal.calories || 300,
        protein: meal.protein || 20,
        carbs: mealCarbs,
        fat: meal.fat || 12,
        starchyCarbs: starchyGrams,
        fibrousCarbs: fibrousGrams,
        cookingTime: meal.cookingTime || "20 minutes",
        difficulty: meal.difficulty || "Easy",
        medicalBadges: getMedicalBadges(meal, userConditions)
      };

      // Generate image for the meal
      try {
        const imageUrl = await generateImage({
          name: processedMeal.name,
          description: processedMeal.description,
          type: 'meal',
          style: 'homemade',
          ingredients: processedMeal.ingredients?.map(ing => ing.name) || [],
          calories: processedMeal.calories,
          protein: processedMeal.protein,
          carbs: processedMeal.carbs,
          fat: processedMeal.fat,
        });
        
        if (imageUrl) {
          processedMeal.imageUrl = imageUrl;
        }
      } catch (error) {
        console.error(`Failed to generate image for ${processedMeal.name}:`, error);
      }

      processedMeals.push(processedMeal);
    }

    console.log("✅ Fridge rescue meals generated successfully with images");
    return processedMeals;

  } catch (error: any) {
    console.error('OpenAI API error for fridge rescue meals:', error);
    
    // Fallback meals using only provided ingredients
    const fallbackIngredients1 = fridgeItems.map(item => ({ name: item, quantity: "as needed", unit: "" }));
    const fallback1Split = deriveCarbSplit(fallbackIngredients1, 22);
    const fallbackIngredients2 = fridgeItems.map(item => ({ name: item, quantity: "1 portion", unit: "" }));
    const fallback2Split = deriveCarbSplit(fallbackIngredients2, 28);
    const fallbackIngredients3 = fridgeItems.map(item => ({ name: item, quantity: "to taste", unit: "" }));
    const fallback3Split = deriveCarbSplit(fallbackIngredients3, 24);
    
    const fallbackMeals: FridgeRescueMeal[] = [
      {
        id: `fallback-fridge-1-${Date.now()}`,
        name: `Simple ${fridgeItems[0]} Skillet`,
        description: `A quick and easy one-pan meal using your available ingredients`,
        ingredients: fallbackIngredients1,
        instructions: `1. Heat a large skillet over medium heat. 2. Add ${fridgeItems.join(', ')} to the pan. 3. Cook until everything is heated through and well combined. 4. Season to taste and serve.`,
        calories: 285,
        protein: 18,
        carbs: 22,
        fat: 12,
        starchyCarbs: fallback1Split.starchyGrams,
        fibrousCarbs: fallback1Split.fibrousGrams,
        cookingTime: "15 minutes",
        difficulty: "Easy" as const,
        medicalBadges: getMedicalBadges({
          name: `Simple ${fridgeItems[0]} Skillet`,
          description: "simple skillet meal",
          ingredients: fridgeItems,
          carbs: 22,
          fat: 12
        }, userConditions)
      },
      {
        id: `fallback-fridge-2-${Date.now()}`,
        name: `Mixed ${fridgeItems.length > 1 ? fridgeItems[1] : fridgeItems[0]} Bowl`,
        description: `A nutritious bowl combining your fridge ingredients`,
        ingredients: fallbackIngredients2,
        instructions: `1. Prepare each ingredient separately. 2. Combine ${fridgeItems.join(', ')} in a large bowl. 3. Mix well and serve immediately.`,
        calories: 320,
        protein: 22,
        carbs: 28,
        fat: 10,
        starchyCarbs: fallback2Split.starchyGrams,
        fibrousCarbs: fallback2Split.fibrousGrams,
        cookingTime: "10 minutes", 
        difficulty: "Easy" as const,
        medicalBadges: getMedicalBadges({
          name: `Mixed ${fridgeItems.length > 1 ? fridgeItems[1] : fridgeItems[0]} Bowl`,
          description: "mixed bowl meal",
          ingredients: fridgeItems,
          carbs: 28,
          fat: 10
        }, userConditions)
      },
      {
        id: `fallback-fridge-3-${Date.now()}`,
        name: `Creative ${fridgeItems[0]} Combo`,
        description: `An inventive dish making the most of what you have`,
        ingredients: fallbackIngredients3,
        instructions: `1. Arrange ${fridgeItems.join(', ')} creatively. 2. Cook or combine as desired. 3. Adjust seasoning and serve.`,
        calories: 265,
        protein: 16,
        carbs: 24,
        fat: 14,
        starchyCarbs: fallback3Split.starchyGrams,
        fibrousCarbs: fallback3Split.fibrousGrams,
        cookingTime: "20 minutes",
        difficulty: "Easy" as const,
        medicalBadges: getMedicalBadges({
          name: `Creative ${fridgeItems[0]} Combo`,
          description: "creative combo meal",
          ingredients: fridgeItems,
          carbs: 24,
          fat: 14
        }, userConditions)
      }
    ];

    return fallbackMeals;
  }
}