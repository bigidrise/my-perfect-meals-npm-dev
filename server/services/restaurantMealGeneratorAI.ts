// AI-Powered Restaurant Meal Generator
// Generates restaurant-specific meals using OpenAI GPT-4
// Falls back to locked generator if AI fails
import { type User } from "@shared/schema";
import OpenAI from 'openai';
// DO NOT call generateImage() from imageService directly.
// Use generateMealImageUnified only.
import { generateMealImageUnified } from './mealImageGenerator';
import { generateRestaurantMeals as generateFallbackMeals } from './restaurantMealGenerator';
import { enforceCarbs } from '../utils/carbClassifier';
import { buildDietPromptBlock, violatesDietaryConstraints, getPrimaryDiet } from './allergyGuardrails';
import { loadUserProtocolEnvelope, enforceBeforeGenerate, buildGuestEnvelope, scanGeneratedOutput, UserProtocolEnvelope } from './protocolEnvelope';
import { resolveAICarbsStrict } from './guardrails/macroTruthContract';
import { classifyRestaurantArchetype } from './restaurantCuisineArchetype';
import { validateDiabeticMeal } from './guardrails/validators/diabeticValidator';

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
  cravingContext?: string; // For Meal Finder - what food the user is craving
  skipImages?: boolean;    // Skip server-side image generation (client ChefFlow handles it)
  protocolBlock?: string;           // Pre-built protocol enforcement block from caller
  protocolEnvelope?: UserProtocolEnvelope; // Envelope for post-gen scan
  builderBlock?: string;            // Active meal builder guidance (additive, after protocol)
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
  menuAnchorItem?: string;
  howToOrder?: {
    askFor: string;
    modify: string[];
    swap: string[];
  };
  medicalWaiterScript?: string;
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
 * Builds a per-condition medical ordering block that drives the AI's
 * modifications, howToOrder, and medicalWaiterScript fields.
 */
function buildMedicalWaiterBlock(conditions: string[]): string {
  if (!conditions || conditions.length === 0) return "User has no specified health conditions.";

  const c = conditions.map(s => s.toLowerCase());
  const hasDiabetes     = c.some(x => x.includes("diabet"));
  const hasHypertension = c.some(x => x.includes("hypertension") || x.includes("high blood pressure"));
  const hasCardiac      = c.some(x => x.includes("heart") || x.includes("cardiac") || x.includes("cardiovascular"));
  const hasRenal        = c.some(x => x.includes("kidney") || x.includes("renal") || x.includes("ckd"));
  const hasCholesterol  = c.some(x => x.includes("cholesterol") || x.includes("lipid"));
  const hasGout         = c.some(x => x.includes("gout"));
  const hasGERD         = c.some(x => x.includes("gerd") || x.includes("acid reflux") || x.includes("reflux"));

  const rules: string[] = [];

  if (hasDiabetes) {
    rules.push(`DIABETES — required ordering behavior:
- Only suggest meals under 30g net carbs. Never recommend pasta, white rice, battered/breaded items, sweetened sauces, or dessert-adjacent entrees.
- In "modifications": describe exactly what the person should tell the server to keep the meal blood-sugar safe (e.g., "Ask for grilled chicken, no sweet sauce, swap white rice for extra vegetables or a side salad").
- In "howToOrder.modify": include "no sweet glazes or sauces", "grilled not fried", "no added sugar"
- In "howToOrder.swap": include swaps like "white rice → steamed vegetables", "bun → lettuce wrap", "regular dressing → oil and vinegar", "soda → water or unsweetened tea"
- In "medicalWaiterScript": write the exact sentence(s) to say out loud — first person, natural speech, e.g.: "I'm managing my blood sugar. Could I get this grilled with no sweet sauces? And can I swap the rice or starch for extra vegetables?"
- In "reason": explain blood glucose stability — avoid phrases like "provides carbohydrates for energy"`);
  }

  if (hasHypertension) {
    rules.push(`HYPERTENSION / HIGH BLOOD PRESSURE — required ordering behavior:
- Avoid fried, smothered, salty, heavily processed, cured, or pickled preparations.
- In "modifications": describe what to tell the server to reduce sodium (e.g., "Ask for sauce on the side, no added salt, no cured toppings").
- In "howToOrder.modify": include "no added salt", "sauce on the side", "no cured or smoked meats", "no pickled toppings"
- In "howToOrder.swap": include "french fries → steamed or roasted vegetables", "regular soup → broth-based if available"
- In "medicalWaiterScript": write the exact phrase to say — e.g.: "I have high blood pressure. Could you please hold the added salt, serve all sauces on the side, and avoid any cured or salty toppings? Thank you."
- In "reason": focus on sodium reduction and heart-protective benefits`);
  }

  if (hasCardiac) {
    rules.push(`HEART DISEASE / CARDIAC — required ordering behavior:
- Prioritize lean grilled or baked proteins (fish especially), fiber-rich vegetables, and meals with fat ≤ 12g.
- Avoid fried items, butter-basted dishes, heavy cream sauces, processed meats, organ meats.
- In "modifications": describe what to tell the server for cardiac-safe prep (e.g., "Ask for grilled or baked only, no butter, sauce on the side").
- In "howToOrder.modify": include "grilled or baked only", "no butter", "use olive oil if available", "sauce on the side"
- In "howToOrder.swap": include "cream sauce → tomato or broth-based sauce", "fried sides → steamed vegetables"
- In "medicalWaiterScript": write the exact phrase — e.g.: "I have heart disease. Please grill or bake this — no butter or frying. Could the sauce come on the side, and can I swap any fried sides for steamed vegetables?"
- In "reason": explain lean protein and healthy fat choices; note heart-protective omega-3s if fish is selected`);
  }

  if (hasRenal) {
    rules.push(`KIDNEY DISEASE / RENAL DISEASE / CKD — required ordering behavior:
- Avoid or minimize high-potassium foods (tomatoes, avocado, bananas, spinach, beans, oranges) and high-phosphorus foods (dairy, nuts, whole grains, colas).
- Prefer lower-potassium starches: white rice over brown rice, white bread over whole grain.
- In "modifications": describe what to tell the server to protect kidney function (e.g., "Ask for no added salt, light cheese, avoid heavy tomato sauce").
- In "howToOrder.modify": include "no added salt", "light cheese or no cheese", "no heavy tomato sauce", "no avocado"
- In "howToOrder.swap": include "brown rice → white rice (lower potassium)", "spinach → iceberg lettuce", "bean-heavy dishes → rice or pasta based"
- In "medicalWaiterScript": write the exact phrase — e.g.: "I have kidney disease. Please hold the added salt, go light on any cheese or dairy, avoid heavy tomato sauce, and skip the avocado if it's in there. White rice is better for me than brown rice."
- In "reason": focus on low-potassium, low-phosphorus, low-sodium approach`);
  }

  if (hasCholesterol) {
    rules.push(`HIGH CHOLESTEROL / HYPERLIPIDEMIA — required ordering behavior:
- Avoid saturated fats (fried foods, butter, heavy cream, fatty/processed meats). Prefer omega-3-rich fish, lean proteins, and high-fiber options.
- In "howToOrder.modify": include "grilled not fried", "no butter", "light on cheese"
- In "howToOrder.swap": include "cream sauce → olive oil or tomato-based", "fried side → salad or steamed vegetables"
- In "medicalWaiterScript": write the exact phrase — e.g.: "I'm managing my cholesterol. Could this be grilled instead of fried, with no butter? And dressings on the side please."
- In "reason": explain reduced saturated fat and increased fiber`);
  }

  if (hasGout) {
    rules.push(`GOUT — required ordering behavior:
- Avoid high-purine foods: organ meats, anchovies, sardines, mackerel, scallops, large red meat portions, sugary drinks, alcohol.
- Prefer lower-purine proteins: chicken, eggs, tofu, and dairy.
- In "howToOrder.modify": include "no organ meats", "light on red meat", "no shellfish or anchovies"
- In "medicalWaiterScript": write — e.g.: "I have gout, so I need to avoid organ meats, heavy red meat, and shellfish. Chicken or vegetarian options work best."
- In "reason": explain purine reduction and uric acid management`);
  }

  if (hasGERD) {
    rules.push(`ACID REFLUX / GERD — required ordering behavior:
- Avoid spicy foods, citrus, heavy tomato sauces, fried high-fat dishes, chocolate, coffee, mint, and alcohol.
- Prefer mild, lightly seasoned, grilled or baked preparations.
- In "howToOrder.modify": include "mild spice only", "no spicy sauces", "no citrus garnish"
- In "howToOrder.swap": include "spicy sauce → mild sauce or herb-based", "fried → grilled"
- In "medicalWaiterScript": write — e.g.: "I have acid reflux. Could this be kept mild — no spicy sauces, nothing fried, and no citrus? Grilled and lightly seasoned is perfect."
- In "reason": explain avoidance of common reflux triggers`);
  }

  if (rules.length === 0) {
    return `User has these health conditions: ${conditions.join(", ")}. Consider these when suggesting modifications.`;
  }

  return `MEDICAL CONDITIONS (user has: ${conditions.join(", ")}) — CRITICAL ordering rules below. These drive the modifications, howToOrder, and medicalWaiterScript fields.

${rules.join("\n\n")}

UNIVERSAL RULE FOR ALL MEDICAL CONDITIONS:
"medicalWaiterScript" MUST be a complete, natural-language sentence the user can literally say out loud to their server. Write in first person. Keep it under 2 sentences. Example format: "I have [condition]. Please [specific request]."`;
}

/**
 * Generate restaurant-specific meals using AI
 * Falls back to locked generator if AI fails
 */
export async function generateRestaurantMealsAI(request: RestaurantMealRequest): Promise<RestaurantMeal[]> {
  const { restaurantName, cuisine, user, cravingContext, skipImages, protocolBlock, protocolEnvelope, builderBlock } = request;
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

  const medicalWaiterBlock = buildMedicalWaiterBlock(userConditions);
  
  // Build craving context for Meal Finder (different from Restaurant Meal Generator)
  const cravingInstructions = cravingContext
    ? `\n\nCRITICAL: The user is specifically craving "${cravingContext}". ALL meals MUST prominently feature ${cravingContext} as the main ingredient or protein. Focus on ${cravingContext}-based dishes that this restaurant would realistically serve.`
    : '';

  // ── Cuisine archetype classification ────────────────────────────────────────
  const archetypeResult = classifyRestaurantArchetype(restaurantName, [], cravingContext);
  const archetype = archetypeResult.archetype;
  const anchorPool = archetypeResult.chainPatterns ?? archetype.anchorItems;
  const chainNote = archetypeResult.chainName
    ? `This is a ${archetypeResult.chainName} location.`
    : `This restaurant is classified as: ${archetype.label}.`;

  const archetypeRealism = `
RESTAURANT REALISM RULES (CRITICAL — do NOT violate these):
${chainNote}
${archetype.menuRealism}

MENU ANCHOR — Every generated meal MUST be based on a recognizable real-world item from this restaurant type.
Anchor item pool (choose or adapt from these): ${anchorPool.join(", ")}.
For each meal, set the "menuAnchorItem" field to the anchor it is based on (e.g., "Grilled Chicken Sandwich", "Burrito Bowl").

GUARDRAIL REALISM RULE — When dietary or health adjustments are needed, PRESERVE the restaurant's menu language.
WRONG: "Healthy protein bowl" (at a burger restaurant)
RIGHT: "Grilled Chicken Sandwich, no mayo, lettuce wrap"
Adjustments go in "howToOrder.modify" and "howToOrder.swap" — NOT in the meal name.`;
  // ────────────────────────────────────────────────────────────────────────────

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
    const prompt = `You are a nutrition expert helping someone order healthy meals at "${restaurantName}", a ${cuisine} restaurant.
${protocolBlock ? `\n${protocolBlock}\n` : ""}${builderBlock ? `\n${builderBlock}\n` : ""}
${medicalWaiterBlock}${allergyContext}${dietaryContext}${avoidContext}${cravingInstructions}${dietBehaviorBlock}
${archetypeRealism}

TONE AND LANGUAGE RULES:
- For the "reason" field: use system-based language focused on energy balance, satiety, and macro alignment — explain how the meal supports the user's goals. Avoid generic textbook phrases like "good source of calcium", "rich in vitamins", "provides essential nutrients", or "provides carbohydrates for energy." Instead say things like "supports steady energy", "balances protein and carbs for consistency", or "keeps you full without a spike."
- Ensure all recommendations feel natural for the user's diet. Do not default to stricter diet behaviors than required by the diet mode specified above.

IMPORTANT: Generate 3 UNIQUE and DIFFERENT meal recommendations. Each time this request is made, create completely different meals from previous suggestions. ${randomVarietyHint}

MEAL STRUCTURE — return exactly 3 meals filling these 3 different slots. Do not put the same meal type in more than one slot:
1. One hearty main entrée (a filling protein-forward or grilled dish)
2. One lighter or lower-calorie option (a salad, soup, or smaller plate)
3. One alternative format appropriate for this restaurant type

CUISINE VARIETY RULES:
- Italian: return one pasta dish, one vegetable-forward entrée (eggplant, mushroom, zucchini, etc.), and one salad or lighter option. Never return 3 pasta dishes.
- Mexican: return one taco or burrito, one bowl or plate, and one salad or lighter option. Never return 3 tacos.
- Fast food: all 3 items must sound like real fast food menu items (burger, sandwich, nuggets, etc.) — not generic bowls.
- All other cuisines: ensure the 3 meals cover clearly different meal structures and preparation styles — never repeat the same base format.

Generate 3 specific meal recommendations that a person could walk into this restaurant and order TODAY. Each meal should:
1. Have a realistic name matching this restaurant type's menu language (see RESTAURANT REALISM RULES above)
2. Be a healthier choice (grilled, baked, or steamed options preferred)
3. Include accurate macro estimates (calories, protein, carbs, fat)
4. Include structured ordering instructions (howToOrder)
5. List the main ingredients
6. Be anchored to a real-world recognizable item (menuAnchorItem)

Request ID: ${varietyTimestamp}

CARB CLASSIFICATION RULES (CRITICAL):
- starchyCarbs: Energy-dense carbs from rice, pasta, bread, potatoes, grains, beans, corn, peas
- fibrousCarbs: Volume-dense carbs from vegetables, leafy greens, broccoli, cauliflower, peppers, tomatoes, cucumbers
- Both are measured in grams
- Vegetables ARE carbs (fibrous) - never return 0 for fibrousCarbs if vegetables are present

Return ONLY a JSON array of 3 meals with this exact structure:
[
  {
    "name": "Specific menu item name matching this restaurant's language",
    "description": "Brief description of the dish",
    "calories": 450,
    "protein": 35,
    "starchyCarbs": 20,
    "fibrousCarbs": 10,
    "fat": 15,
    "reason": "How this meal supports the user's energy, satiety, and macro goals",
    "modifications": "Brief summary of key ordering modifications",
    "ingredients": ["ingredient1", "ingredient2", "ingredient3"],
    "menuAnchorItem": "The recognizable real-world menu item this is based on",
    "howToOrder": {
      "askFor": "Exact item name to say at the counter or to the server",
      "modify": ["no mayo", "add avocado", "grilled not fried"],
      "swap": ["fries → side salad", "white rice → brown rice"]
    },
    "medicalWaiterScript": "Only populate if the user has medical conditions. Write the exact phrase the user should say to the server — first person, 1-2 sentences, e.g.: 'I have diabetes. Could I get this grilled with no sweet sauces and swap the rice for extra vegetables?' Leave as empty string if no medical conditions."
  }
]

Make the meals sound like something you would genuinely see on the menu at ${restaurantName}. A person should be able to walk in and order this out loud.`;

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
      temperature: 0.7,
      max_tokens: 1800, // Increased to accommodate medicalWaiterScript per meal
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
      
      const rawHowToOrder = meal.howToOrder;
      const howToOrder = rawHowToOrder && typeof rawHowToOrder === 'object'
        ? {
            askFor: rawHowToOrder.askFor || meal.name || `${cuisine} Specialty`,
            modify: Array.isArray(rawHowToOrder.modify) ? rawHowToOrder.modify : [],
            swap: Array.isArray(rawHowToOrder.swap) ? rawHowToOrder.swap : [],
          }
        : undefined;

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
        medicalBadges: getMedicalBadges(meal, userConditions),
        menuAnchorItem: meal.menuAnchorItem || undefined,
        howToOrder,
        medicalWaiterScript: typeof meal.medicalWaiterScript === 'string' && meal.medicalWaiterScript
          ? meal.medicalWaiterScript : undefined,
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

    // ── Post-generation diabetic hard validator ───────────────────────────────
    // Runs for ALL diabetic users — not just those with a recent glucose log.
    // Ingredient blocking (potatoes, white rice, sugar, etc.) is unconditional
    // for any user with diabetes in their medical conditions.
    // Glucose state additionally governs the carb threshold severity:
    //   - elevated / high-risk: carb excess is a hard VIOLATION (triggers retry)
    //   - in-range / no log:    carb excess is a warning only
    // This closes both gaps:
    //   1. AI slipping through with non-compliant meal composition despite prompt guidance
    //   2. Users with diabetes but no recent glucose log getting mashed potatoes / white rice
    const diabeticGlucoseState = protocolEnvelope?.diabeticGlucoseState ?? null;
    const hasDiabetes = protocolEnvelope?.hasDiabetes ?? false;
    if (hasDiabetes) {
      console.log(`🩸 [DIABETIC VALIDATOR] Running post-gen check — hasDiabetes=true, glucose state: ${diabeticGlucoseState ?? 'none'}`);
      const validatedMeals: typeof enforcedMeals = [];

      for (const meal of enforcedMeals) {
        const mealForValidation = {
          name: meal.name,
          description: meal.description,
          ingredients: meal.ingredients,
          macros: { carbs: meal.carbs, fiber: undefined as number | undefined },
        };
        const result = validateDiabeticMeal(mealForValidation, { glucoseState: diabeticGlucoseState });

        if (result.isValid) {
          validatedMeals.push(meal);
          continue;
        }

        // Violations found — log and retry with explicit failure context
        console.warn(`🚫 [DIABETIC VALIDATOR] "${meal.name}" failed: ${result.violations.join('; ')}`);

        const carbLimit = diabeticGlucoseState === 'high-risk' ? 15
          : diabeticGlucoseState === 'elevated' ? 25
          : diabeticGlucoseState === 'low' ? 45
          : 30;

        const retryPrompt = `You are a nutrition expert for ${restaurantName}, a ${cuisine} restaurant.
${protocolBlock ? `\n${protocolBlock}\n` : ''}
CRITICAL — PREVIOUS MEAL REJECTED BY DIABETIC SAFETY VALIDATOR.
Violations detected: ${result.violations.join('; ')}

The user's current blood glucose is in the "${diabeticGlucoseState}" state.
HARD RULES for this replacement meal:
- Maximum ${carbLimit}g total carbohydrates — this is a clinical hard limit, not a guideline
- ABSOLUTELY NO: potatoes, white rice, pasta, bread, tortillas, corn, sugar, mashed potatoes, french fries, hash browns, waffles, pancakes, bagels, or any high-starch/high-GI ingredient
- Protein must be prominent (minimum 25g)
- Non-starchy vegetables are required
- Choose a completely different meal format from the one that was rejected ("${meal.name}")

Return ONLY a single JSON object (not an array):
{"name":"...","description":"...","calories":0,"protein":0,"starchyCarbs":0,"fibrousCarbs":0,"fat":0,"reason":"...","modifications":"...","ingredients":[],"menuAnchorItem":"...","howToOrder":{"askFor":"...","modify":[],"swap":[]},"medicalWaiterScript":""}`;

        try {
          const retryCompletion = await getOpenAI().chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: retryPrompt }],
            temperature: 0.5,
            max_tokens: 600,
          });
          const retryText = retryCompletion.choices[0]?.message?.content?.trim()
            ?.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

          if (retryText) {
            const retryMeal = JSON.parse(retryText);
            const starchy = retryMeal.starchyCarbs ?? 0;
            const fibrous = retryMeal.fibrousCarbs ?? 0;
            const retryCarbTotal = starchy + fibrous || retryMeal.carbs || 0;

            // Second-pass validation on the retry
            const retryForValidation = {
              name: retryMeal.name || meal.name,
              description: retryMeal.description || '',
              ingredients: Array.isArray(retryMeal.ingredients) ? retryMeal.ingredients : [],
              macros: { carbs: retryCarbTotal },
            };
            const retryResult = validateDiabeticMeal(retryForValidation, { glucoseState: diabeticGlucoseState });

            if (retryResult.isValid) {
              const rawHowToOrder = retryMeal.howToOrder;
              validatedMeals.push({
                ...meal,
                name: retryMeal.name || meal.name,
                description: retryMeal.description || meal.description,
                calories: retryMeal.calories || meal.calories,
                protein: retryMeal.protein || meal.protein,
                carbs: retryCarbTotal,
                starchyCarbs: starchy,
                fibrousCarbs: fibrous,
                fat: retryMeal.fat || meal.fat,
                reason: retryMeal.reason || meal.reason,
                modifications: retryMeal.modifications || meal.modifications,
                ingredients: Array.isArray(retryMeal.ingredients) ? retryMeal.ingredients : meal.ingredients,
                menuAnchorItem: retryMeal.menuAnchorItem || undefined,
                howToOrder: rawHowToOrder && typeof rawHowToOrder === 'object'
                  ? { askFor: rawHowToOrder.askFor || retryMeal.name, modify: Array.isArray(rawHowToOrder.modify) ? rawHowToOrder.modify : [], swap: Array.isArray(rawHowToOrder.swap) ? rawHowToOrder.swap : [] }
                  : undefined,
                medicalWaiterScript: typeof retryMeal.medicalWaiterScript === 'string' ? retryMeal.medicalWaiterScript : undefined,
              });
              console.log(`✅ [DIABETIC VALIDATOR] Retry succeeded — replaced with "${retryMeal.name}"`);
            } else {
              console.warn(`⚠️ [DIABETIC VALIDATOR] Retry still failed for "${retryMeal.name}" — dropping meal`);
            }
          }
        } catch (retryErr) {
          console.warn(`⚠️ [DIABETIC VALIDATOR] Retry generation failed for "${meal.name}":`, retryErr);
        }
      }

      if (validatedMeals.length === 0 && enforcedMeals.length > 0) {
        console.warn(`⚠️ [DIABETIC VALIDATOR] All meals failed diabetic validation — falling back to locked generator`);
        return generateFallbackMeals(request);
      }

      if (validatedMeals.length < enforcedMeals.length) {
        console.log(`🛡️ [DIABETIC VALIDATOR] ${enforcedMeals.length - validatedMeals.length} meal(s) replaced, ${validatedMeals.length} clean meals ready`);
      } else {
        console.log(`✅ [DIABETIC VALIDATOR] All ${validatedMeals.length} meals passed diabetic validation`);
      }

      enforcedMeals.length = 0;
      enforcedMeals.push(...validatedMeals);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Image generation — skipped when caller has client-side image rendering (ChefFlow)
    if (skipImages) {
      console.log(`⚡ Skipping server-side image generation — ChefFlow will render images client-side`);
    } else {
      console.log(`🖼️ Generating images for all ${enforcedMeals.length} meals in parallel...`);
      const imagePromises = enforcedMeals.map(async (meal) => {
        try {
          // DO NOT call image generation directly.
          // Use generateMealImageUnified only.
          const imageUrl = await generateMealImageUnified(meal.name, meal.ingredients || [], 'meal');
          meal.imageUrl = imageUrl;
          console.log(`✅ Image generated for ${meal.name}`);
        } catch (error) {
          console.error(`❌ Failed to generate image for ${meal.name}:`, error);
        }
      });

      await Promise.all(imagePromises);
      console.log(`🎉 All ${enforcedMeals.length} images generated!`);
    }

    return enforcedMeals;

  } catch (error) {
    console.error('❌ AI meal generation error:', error);
    console.warn('⚠️ Falling back to locked generator');
    return generateFallbackMeals(request);
  }
}
