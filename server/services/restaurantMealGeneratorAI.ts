// AI-Powered Restaurant Meal Generator
// Generates restaurant-specific meals using OpenAI GPT-4
// Falls back to locked generator if AI fails
import { type User } from "@shared/schema";
import OpenAI from 'openai';
import { generateImage } from './imageService';
import { generateRestaurantMeals as generateFallbackMeals } from './restaurantMealGenerator';
import { enforceCarbs } from '../utils/carbClassifier';
import { buildDietPromptBlock, violatesDietaryConstraints, getPrimaryDiet } from './allergyGuardrails';
import { loadUserProtocolEnvelope, enforceBeforeGenerate, buildGuestEnvelope, scanGeneratedOutput, UserProtocolEnvelope } from './protocolEnvelope';
import { resolveAICarbsStrict } from './guardrails/macroTruthContract';

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

// ─── Duplicate detection helpers ────────────────────────────────────────────
// Expanded keyword groups — catches pasta by many names, tacos by all variants, etc.
const FORMAT_GROUPS: Record<string, string[]> = {
  pasta:     ["pasta", "spaghetti", "fettuccine", "penne", "ravioli", "lasagna", "linguine", "rigatoni", "tagliatelle", "gnocchi", "noodle", "orzo", "carbonara", "alfredo"],
  taco:      ["taco", "burrito", "quesadilla", "enchilada", "fajita"],
  bowl:      ["bowl", "rice bowl", "grain bowl"],
  pizza:     ["pizza", "flatbread"],
  salad:     ["salad"],
  risotto:   ["risotto"],
  wrap:      ["wrap"],
  sandwich:  ["sandwich", "panini", "sub", "hoagie"],
  stirfry:   ["stir fry", "stir-fry", "stir fried"],
  soup:      ["soup", "chowder", "bisque", "stew", "broth"],
};

function detectFormatGroup(mealName: string): string | null {
  const normalized = mealName.toLowerCase();
  for (const [group, keywords] of Object.entries(FORMAT_GROUPS)) {
    if (keywords.some(kw => normalized.includes(kw))) return group;
  }
  return null;
}
// ────────────────────────────────────────────────────────────────────────────

interface RestaurantMealRequest {
  restaurantName: string;
  cuisine: string;
  user?: User;
  cravingContext?: string; // NEW: For Meal Finder - what food the user is craving
  protocolBlock?: string;           // Pre-built protocol enforcement block from caller
  protocolEnvelope?: UserProtocolEnvelope; // Envelope for post-gen scan
}

interface RestaurantMeal {
  id: string;
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
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
  const { restaurantName, cuisine, user, cravingContext, protocolBlock, protocolEnvelope } = request;
  const userConditions = user?.healthConditions || [];

  console.log(`🤖 AI Generator: Creating restaurant-specific meals for ${restaurantName} (${cuisine} cuisine)${cravingContext ? ` featuring ${cravingContext}` : ''}`);

  const userAllergies = user?.allergies || [];
  const userDietaryRestrictions = user?.dietaryRestrictions || [];
  const userAvoidedFoods = user?.avoidedFoods || user?.dislikedFoods || [];

  const allergyContext = userAllergies.length > 0
    ? `\n\nCRITICAL ALLERGY SAFETY: User is allergic to: ${userAllergies.join(", ")}. NEVER suggest meals containing these ingredients or any derivatives. This is a medical safety requirement.`
    : "";

  // Use hard dietary constraint block for vegan/vegetarian/pescatarian; generic fallback for others
  const dietPromptBlock = buildDietPromptBlock(userDietaryRestrictions);
  const dietaryContext = dietPromptBlock
    ? `\n\n${dietPromptBlock}`
    : userDietaryRestrictions.length > 0
      ? `\nDietary restrictions: ${userDietaryRestrictions.join(", ")}. All meals must comply.`
      : "";

  const avoidContext = userAvoidedFoods.length > 0
    ? `\nUser avoids these foods: ${userAvoidedFoods.join(", ")}. Do not include them.`
    : "";

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
    // Build diet-aware variety hints so suggestions don't contradict the user's diet
    const primaryDiet = getPrimaryDiet(userDietaryRestrictions);
    const proteinVarietyHint = primaryDiet === "vegan"
      ? "Focus on different plant-based protein sources (tofu, tempeh, lentils, chickpeas, black beans)"
      : primaryDiet === "vegetarian"
        ? "Focus on different vegetarian protein sources (eggs, tofu, tempeh, lentils, cheese, chickpeas)"
        : primaryDiet === "pescatarian"
          ? "Focus on different seafood protein sources (salmon, tuna, shrimp, cod, tilapia)"
          : "Focus on different protein sources (chicken, fish, beef, turkey, plant-based)";

    const varietyInstructions = [
      proteinVarietyHint,
      "Vary the cooking methods (grilled, baked, steamed, roasted)",
      "Include different meal types (salads, bowls, wraps, plates)",
      "Mix appetizers and entrees",
      "Consider seasonal ingredients and specialties"
    ];
    const randomVarietyHint = varietyInstructions[Math.floor(Math.random() * varietyInstructions.length)];

    // Build mutually exclusive diet behavior block — prevents cross-contamination between diet modes.
    // Each block applies ONLY to its exact diet. No shared fallback language.
    let dietBehaviorBlock = "";
    if (primaryDiet === "vegetarian") {
      dietBehaviorBlock = `\nVEGETARIAN BEHAVIOR RULES (apply ONLY for vegetarian — do NOT apply vegan logic here):
- Dairy products (cheese, butter, milk, cream, yogurt) ARE permitted and should NOT be removed or avoided
- Eggs ARE permitted and should NOT be removed or avoided
- In the "modifications" field, NEVER suggest removing cheese or dairy — these are vegetarian-safe foods
- If a dish is heavy on dairy, suggest portion adjustment only (e.g., "ask for lighter cheese" — never "no cheese")
- Modifications should focus on confirming no meat, poultry, seafood, gelatin, or animal-based broths only
- If the meal protein is below 20g, add a gentle coaching note in modifications such as "consider adding beans, lentils, eggs, or extra cheese for more protein" — frame it as a suggestion, not a criticism
- Ensure recommendations feel natural for vegetarian eating — do not apply vegan caution or restriction`;
    } else if (primaryDiet === "vegan") {
      dietBehaviorBlock = `\nVEGAN BEHAVIOR RULES (apply ONLY for vegan — do NOT apply these to vegetarian users):
- All animal products are strictly forbidden: meat, poultry, fish, shellfish, dairy, eggs, honey, gelatin, lard, bone broth
- In the "modifications" field, confirm no dairy, no eggs, and request plant-based oils instead of butter
- Suggest plant-based protein sources: tofu, tempeh, lentils, chickpeas, black beans
- If protein is below 20g, suggest "consider adding tofu, tempeh, or extra legumes for more protein"`;
    } else if (primaryDiet === "pescatarian") {
      dietBehaviorBlock = `\nPESCATARIAN BEHAVIOR RULES (apply ONLY for pescatarian — do NOT apply to vegetarian or vegan users):
- Fish and seafood ARE allowed and encouraged as protein sources
- Beef, pork, chicken, turkey, and their stocks or broths are NOT allowed
- Dairy and eggs ARE allowed — do NOT suggest removing them
- Modifications should focus on confirming no land-animal meat — not dairy`;
    } else if (primaryDiet === "keto") {
      dietBehaviorBlock = `\nKETO BEHAVIOR RULES (apply ONLY for keto — STRICT enforcement, filter-first):
- This is a strict low-carb diet. Do NOT return meals based on pasta, rice, bread, tortillas, grains, or sugar
- Do NOT attempt to modify a high-carb dish into keto compliance (do not say "ask to remove the pasta" for a pasta dish)
- If a dish is inherently high-carb, reject it entirely and choose a different, naturally low-carb meal
- Only return meals that are inherently keto-compliant: protein (meat, fish, eggs), non-starchy vegetables, and healthy fats
- In the "modifications" field, focus on confirming preparation method (grilled vs fried), sauce choice, and portion — never on removing a core carb
- In the "reason" field, NEVER describe carbohydrates as beneficial. Focus on protein, healthy fats, satiety, and stable blood sugar
- Suggested formats: grilled meats, egg-based dishes, salads with protein, vegetable-forward plates, lettuce wraps`;
    } else if (primaryDiet === "paleo") {
      dietBehaviorBlock = `\nPALEO BEHAVIOR RULES (apply ONLY for paleo — STRICT enforcement, filter-first):
- This is a strict whole-food diet. Do NOT return meals containing grains, dairy, legumes, or processed ingredients
- Do NOT attempt to modify a non-compliant dish into paleo compliance (do not say "ask to hold the cheese" for a dairy-based dish)
- If a dish is inherently non-paleo, reject it entirely and choose a different, naturally compliant meal
- Only return meals that are inherently paleo-compliant: meat, fish, eggs, vegetables, fruit, nuts, and natural fats (olive oil, avocado)
- Sweet potatoes ARE allowed. White potatoes, dairy, grains, and legumes are NOT
- In the "reason" field, NEVER describe grains, dairy, or legumes as beneficial. Focus on whole-food protein, natural fats, and sustained energy
- Suggested formats: grilled or roasted meats, fish dishes, vegetable-based plates, protein-forward salads`;
    }

    // Use OpenAI to generate restaurant-specific meals
    const prompt = `You are a nutrition expert helping someone choose healthy meals at "${restaurantName}", a ${cuisine} restaurant.
${protocolBlock ? `\n${protocolBlock}\n` : ""}
${medicalContext}${allergyContext}${dietaryContext}${avoidContext}${cravingInstructions}${dietBehaviorBlock}

TONE AND LANGUAGE RULES:
- For the "reason" field: use system-based language focused on energy balance, satiety, and macro alignment — explain how the meal supports the user's goals. Avoid generic textbook phrases like "good source of calcium", "rich in vitamins", "provides essential nutrients", or "provides carbohydrates for energy." Instead say things like "supports steady energy", "balances protein and carbs for consistency", or "keeps you full without a spike."
- Ensure all recommendations feel natural for the user's diet. Do not default to stricter diet behaviors than required by the diet mode specified above.

IMPORTANT: Generate 3 UNIQUE and DIFFERENT meal recommendations. Each time this request is made, create completely different meals from previous suggestions. ${randomVarietyHint}

MEAL STRUCTURE — return exactly 3 meals filling these 3 different slots. Do not put the same meal type in more than one slot:
1. One hearty main entrée (a filling baked entrée, a protein-forward plate, or a grilled dish)
2. One lighter or lower-calorie option (a salad, a broth-based soup, or a smaller plate)
3. One alternative format (a bowl, a wrap, a flatbread, or a non-traditional variation of the cuisine)

CUISINE VARIETY RULES:
- Italian: return one pasta dish, one vegetable-forward entrée (eggplant, mushroom, zucchini, etc.), and one salad or lighter option. Never return 3 pasta dishes.
- Mexican: return one taco or burrito, one bowl or plate, and one salad or lighter option. Never return 3 tacos.
- All other cuisines: ensure the 3 meals cover clearly different meal structures and preparation styles — never repeat the same base format.

Generate 3 specific meal recommendations that would realistically be available at this restaurant. Each meal should:
1. Have a realistic name that sounds like an actual menu item from this type of restaurant
2. Be a healthier choice (grilled, baked, or steamed options preferred)
3. Include accurate macro estimates (calories, protein, carbs, fat)
4. Provide specific ordering modifications to make it healthier
5. List the main ingredients
6. Fill a different slot from the 3 structure categories above

Request ID: ${varietyTimestamp}

CARB CLASSIFICATION RULES (CRITICAL):
- starchyCarbs: Energy-dense carbs from rice, pasta, bread, potatoes, grains, beans, corn, peas
- fibrousCarbs: Volume-dense carbs from vegetables, leafy greens, broccoli, cauliflower, peppers, tomatoes, cucumbers
- Both are measured in grams
- Vegetables ARE carbs (fibrous) - never return 0 for fibrousCarbs if vegetables are present

Return ONLY a JSON array of 3 meals with this exact structure:
[
  {
    "name": "Specific menu item name",
    "description": "Brief description of the dish",
    "calories": 450,
    "protein": 35,
    "starchyCarbs": 20,
    "fibrousCarbs": 10,
    "fat": 15,
    "reason": "How this meal supports the user's energy, satiety, and macro goals",
    "modifications": "Specific ordering instructions focused on preparation method and diet compliance",
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
      
      // Extract starchyCarbs and fibrousCarbs from AI response
      const starchyCarbs = meal.starchyCarbs ?? 0;
      const fibrousCarbs = meal.fibrousCarbs ?? 0;
      const totalCarbs = resolveAICarbsStrict(meal);
      
      return {
        id: mealId,
        name: meal.name || `${cuisine} Specialty ${index + 1}`,
        description: meal.description || "A delicious and healthy option",
        calories: meal.calories || 400,
        protein: meal.protein || 25,
        carbs: totalCarbs,
        starchyCarbs: starchyCarbs,
        fibrousCarbs: fibrousCarbs,
        fat: meal.fat || 12,
        reason: meal.reason || "Balanced nutrition with quality ingredients",
        modifications: meal.modifications || "Request healthy preparation",
        ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : ["protein", "vegetables", "whole grains"],
        medicalBadges: getMedicalBadges(meal, userConditions)
      };
    });

    console.log(`✅ AI generated ${meals.length} restaurant-specific meals for ${restaurantName}`);

    // ── Post-generation duplicate check ──────────────────────────────────────
    // Scan meal names for format group collisions. If two meals share the same
    // group (e.g. pasta + pasta), regenerate the later one with an explicit
    // instruction that prevents "different sauce, same dish" tricks.
    const seenGroups = new Map<string, number>(); // group → first meal index
    for (let i = 0; i < meals.length; i++) {
      const group = detectFormatGroup(meals[i].name);
      if (!group) continue;
      if (seenGroups.has(group)) {
        console.warn(`⚠️ [VARIETY] Duplicate format group "${group}" at index ${i} ("${meals[i].name}") — regenerating`);
        try {
          const existingNames = meals.map(m => m.name).join(", ");
          const fixPrompt = `You are a nutrition expert for ${restaurantName}, a ${cuisine} restaurant.
The previous meal results contained duplicate meal formats. The current meals are: ${existingNames}.
The previous result duplicated an existing meal format. Return a meal that is clearly a different type and structure from the previous results.
It must NOT be another ${group} dish. It must fill the "alternative format" slot — for example a bowl, a wrap, a salad, or another non-traditional option.
${dietaryContext}${dietBehaviorBlock}
Return ONLY a single JSON object (not an array) with this exact structure:
{"name":"...","description":"...","calories":0,"protein":0,"starchyCarbs":0,"fibrousCarbs":0,"fat":0,"reason":"...","modifications":"...","ingredients":[]}`;
          const fixCompletion = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: fixPrompt }],
            temperature: 0.9,
            max_tokens: 400,
          });
          const fixText = fixCompletion.choices[0]?.message?.content?.trim()
            ?.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          if (fixText) {
            const fixedMeal = JSON.parse(fixText);
            const starchy = fixedMeal.starchyCarbs ?? 0;
            const fibrous = fixedMeal.fibrousCarbs ?? 0;
            meals[i] = {
              id: `${restaurantName.toLowerCase().replace(/\s+/g, '-')}-ai-meal-${i + 1}-${Date.now()}`,
              name: fixedMeal.name || meals[i].name,
              description: fixedMeal.description || meals[i].description,
              calories: fixedMeal.calories || meals[i].calories,
              protein: fixedMeal.protein || meals[i].protein,
              carbs: starchy + fibrous || meals[i].carbs,
              starchyCarbs: starchy,
              fibrousCarbs: fibrous,
              fat: fixedMeal.fat || meals[i].fat,
              reason: fixedMeal.reason || meals[i].reason,
              modifications: fixedMeal.modifications || meals[i].modifications,
              ingredients: Array.isArray(fixedMeal.ingredients) ? fixedMeal.ingredients : meals[i].ingredients,
              medicalBadges: meals[i].medicalBadges,
            };
            console.log(`✅ [VARIETY] Replaced duplicate with "${meals[i].name}"`);
          }
        } catch (e) {
          console.warn(`⚠️ [VARIETY] Fallback regeneration failed — keeping original`, e);
        }
      } else {
        seenGroups.set(group, i);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (userAllergies.length > 0) {
      const allergyTerms = userAllergies.map(a => a.toLowerCase());
      const safeMeals = meals.filter(meal => {
        const ingredientText = meal.ingredients.join(" ").toLowerCase();
        const nameText = meal.name.toLowerCase();
        const descText = meal.description.toLowerCase();
        const fullText = `${nameText} ${descText} ${ingredientText}`;

        const matchedAllergen = allergyTerms.find(allergen => fullText.includes(allergen));
        if (matchedAllergen) {
          console.log(`🚫 [ALLERGY FILTER] Removed "${meal.name}" — contains "${matchedAllergen}" (user allergy)`);
          return false;
        }
        return true;
      });

      if (safeMeals.length < meals.length) {
        console.log(`🛡️ [ALLERGY FILTER] Filtered ${meals.length - safeMeals.length} unsafe meal(s), ${safeMeals.length} remaining`);
      }

      if (safeMeals.length === 0) {
        console.warn(`⚠️ [ALLERGY FILTER] All meals removed due to allergen matches — falling back to locked generator`);
        return generateFallbackMeals(request);
      }

      meals.length = 0;
      meals.push(...safeMeals);
    }

    // DIETARY HARD FILTER (vegan/vegetarian/pescatarian)
    if (userDietaryRestrictions.length > 0 && getPrimaryDiet(userDietaryRestrictions)) {
      const dietSafeMeals = meals.filter(meal => {
        const fullText = `${meal.name} ${meal.description} ${meal.ingredients.join(" ")}`;
        const { violates, reasons } = violatesDietaryConstraints(fullText, userDietaryRestrictions);
        if (violates) {
          console.log(`🚫 [DIET FILTER] Removed "${meal.name}" — violates ${getPrimaryDiet(userDietaryRestrictions)} diet (${reasons.join(", ")})`);
          return false;
        }
        return true;
      });

      if (dietSafeMeals.length < meals.length) {
        console.log(`🥗 [DIET FILTER] Filtered ${meals.length - dietSafeMeals.length} meal(s) violating diet, ${dietSafeMeals.length} remaining`);
      }

      if (dietSafeMeals.length === 0) {
        console.warn(`⚠️ [DIET FILTER] All meals violated dietary constraints — falling back to locked generator`);
        return generateFallbackMeals(request);
      }

      meals.length = 0;
      meals.push(...dietSafeMeals);
    }

    // ENFORCE CARBS: If AI returned 0s, derive from ingredients (data-layer enforcement)
    const enforcedMeals = meals.map(meal => enforceCarbs(meal));

    // ── Post-gen protocol scan (filter any meals that slip through the prompt) ──
    if (protocolEnvelope) {
      const protocolSafeMeals = enforcedMeals.filter(meal => {
        const scanResult = scanGeneratedOutput(
          { name: meal.name, description: meal.description, ingredients: meal.ingredients },
          protocolEnvelope,
          { generatorName: 'restaurant_meals' }
        );
        if (!scanResult.passed) {
          console.log(`🚫 [PROTOCOL SCAN] Removed "${meal.name}" — ${scanResult.message}`);
          return false;
        }
        return true;
      });
      if (protocolSafeMeals.length < enforcedMeals.length) {
        console.log(`🛡️ [PROTOCOL SCAN] Filtered ${enforcedMeals.length - protocolSafeMeals.length} protocol-violating meal(s)`);
      }
      if (protocolSafeMeals.length === 0) {
        console.warn(`⚠️ [PROTOCOL SCAN] All meals failed protocol scan — falling back to locked generator`);
        return generateFallbackMeals(request);
      }
      enforcedMeals.length = 0;
      enforcedMeals.push(...protocolSafeMeals);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Generate images in parallel for ALL meals at once (10x faster!)
    console.log(`🖼️ Generating images for all ${enforcedMeals.length} meals in parallel...`);
    const imagePromises = enforcedMeals.map(async (meal) => {
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
    console.log(`🎉 All ${enforcedMeals.length} images generated!`);

    return enforcedMeals;

  } catch (error) {
    console.error('❌ AI meal generation error:', error);
    console.warn('⚠️ Falling back to locked generator');
    return generateFallbackMeals(request);
  }
}
