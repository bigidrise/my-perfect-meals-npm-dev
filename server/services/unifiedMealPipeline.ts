/**
 * Unified Meal Generation Pipeline
 * 
 * This service provides a single, consistent interface for all meal generation
 * across the application. It ensures:
 * - Consistent response formats
 * - Guaranteed image URLs (DALL-E or fallback)
 * - Proper error handling with catalog fallbacks
 * - Retry logic for transient failures
 * 
 * Used by: AI Meal Creator, AI Premades, Fridge Rescue
 */

import { generateImage } from './imageService';
import { getDeterministicFallback, findMatchingTemplates, templateToMeal } from './templateMatcher';
import { createIngredientSignature, hashSignature } from './ingredientSignature';
import { getCachedMeals, cacheMeals } from './mealCachePersistent';
import { generateFridgeRescueMeals } from './fridgeRescueGenerator';
import { applyGuardrails, validateMealForDiet, getSystemPromptForDiet, DietType } from './guardrails';
import { normalizeIngredients as normalizeIngredientsToUS } from './ingredientNormalizer';

// Fallback images by meal type
const FALLBACK_IMAGES: Record<string, string> = {
  breakfast: '/images/cravings/protein-pancakes.jpg',
  lunch: '/images/cravings/mediterranean-hummus-plate.jpg',
  dinner: '/images/cravings/turkey-nacho-skillet.jpg',
  snack: '/images/cravings/protein-trailmix-clusters.jpg',
  snacks: '/images/cravings/protein-trailmix-clusters.jpg', // Handle plural form
  dessert: '/images/cravings/choc-strawberry-bites.jpg',
  default: '/images/cravings/satisfy-cravings.jpg'
};

/**
 * Normalize meal type to canonical form (handle plural forms, etc.)
 */
function normalizeMealType(mealType: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const normalized = mealType.toLowerCase().trim();
  
  // Handle plural forms
  if (normalized === 'snacks') return 'snack';
  if (normalized === 'breakfasts') return 'breakfast';
  if (normalized === 'lunches') return 'lunch';
  if (normalized === 'dinners') return 'dinner';
  
  // Validate and return canonical form
  if (['breakfast', 'lunch', 'dinner', 'snack'].includes(normalized)) {
    return normalized as 'breakfast' | 'lunch' | 'dinner' | 'snack';
  }
  
  // Default to lunch for unknown types
  console.warn(`⚠️ Unknown meal type "${mealType}", defaulting to lunch`);
  return 'lunch';
}

// Standard meal interface
export interface UnifiedMeal {
  id: string;
  name: string;
  description: string;
  ingredients: Array<{
    name: string;
    quantity: string;
    unit: string;
  }>;
  instructions: string | string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  cookingTime?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  imageUrl: string; // ALWAYS present
  medicalBadges?: Array<{
    id: string;
    label: string;
    description: string;
    color: string;
    textColor: string;
    category: string;
  }>;
  source?: 'ai' | 'catalog' | 'fallback';
}

export interface MealGenerationRequest {
  type: 'craving' | 'fridge-rescue' | 'premade' | 'create-with-chef' | 'snack-creator';
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  input: string | string[]; // craving text, meal description, or ingredient list
  userId?: string;
  macroTargets?: {
    protein_g?: number;
    fibrous_carbs_g?: number;
    starchy_carbs_g?: number;
    fat_g?: number;
  };
  count?: number; // number of meals to generate (default 1)
  dietType?: DietType; // Diet-specific guardrails (anti-inflammatory, diabetic, etc.)
}

export interface MealGenerationResponse {
  success: boolean;
  meal?: UnifiedMeal;
  meals?: UnifiedMeal[];
  source: 'ai' | 'catalog' | 'fallback';
  error?: string;
}

/**
 * Get a fallback image URL based on meal type
 */
function getFallbackImage(mealType: string): string {
  return FALLBACK_IMAGES[mealType.toLowerCase()] || FALLBACK_IMAGES.default;
}

/**
 * Ensure a meal has an image URL, generating one if needed
 * @param useFallbackOnly - If true, skip DALL-E and use static fallback immediately (for premades)
 */
async function ensureImage(meal: Partial<UnifiedMeal>, mealType: string, useFallbackOnly: boolean = false): Promise<string> {
  // If meal already has a valid image URL, use it
  if (meal.imageUrl && (meal.imageUrl.startsWith('http') || meal.imageUrl.startsWith('/'))) {
    return meal.imageUrl;
  }

  // SPEED OPTIMIZATION: Skip DALL-E for premades, use static fallback immediately
  if (useFallbackOnly) {
    console.log(`⚡ Using static fallback for premade: ${meal.name}`);
    return getFallbackImage(mealType);
  }

  // Try to generate an image with DALL-E
  try {
    const imageUrl = await generateImage({
      name: meal.name || 'Delicious Meal',
      description: meal.description || 'A healthy homemade meal',
      type: 'meal',
      style: 'homemade'
    });

    if (imageUrl) {
      console.log(`🖼️ Generated DALL-E image for: ${meal.name}`);
      return imageUrl;
    }
  } catch (error) {
    console.warn(`⚠️ DALL-E image generation failed for ${meal.name}, using fallback`);
  }

  // Fall back to static image
  return getFallbackImage(mealType);
}

/**
 * Convert FinalMeal ingredients to unified U.S. format
 * Uses the new ingredient normalizer that enforces U.S. measurements
 */
function normalizeIngredients(ingredients: any[]): Array<{ name: string; quantity: string; unit: string }> {
  if (!ingredients || !Array.isArray(ingredients)) return [];
  
  // Use the new U.S. measurement normalizer
  const normalized = normalizeIngredientsToUS(ingredients);
  
  // Convert to the format expected by UnifiedMeal (quantity instead of amount)
  return normalized.map(ing => ({
    name: ing.name,
    quantity: ing.amount, // Map amount -> quantity for backward compat
    unit: ing.unit
  }));
}

/**
 * Convert medical badges to unified format
 */
function normalizeMedicalBadges(badges: any[]): Array<{ id: string; label: string; description: string; color: string; textColor: string; category: string }> {
  if (!badges || !Array.isArray(badges)) return [];
  
  return badges.map(badge => {
    if (typeof badge === 'string') {
      return {
        id: badge.toLowerCase().replace(/\s+/g, '-'),
        label: badge,
        description: badge,
        color: '#4CAF50',
        textColor: '#FFFFFF',
        category: 'dietary'
      };
    }
    return badge;
  });
}

/**
 * Generate a single meal using the craving creator
 * 
 * Flow: Cache → Templates → AI (deterministic first, AI second)
 * NOTE: This is Craving Creator - DO NOT MODIFY per user directive
 */
export async function generateCravingMealUnified(
  cravingInput: string,
  mealType: string,
  userId?: string
): Promise<MealGenerationResponse> {
  const validMealType = normalizeMealType(mealType);
  
  // Step 1: Check cache first (both memory and database)
  const signature = createIngredientSignature({
    ingredients: [cravingInput],
    mealType: validMealType
  });
  
  const cached = await getCachedMeals(signature);
  if (cached && cached.meals.length > 0) {
    console.log(`🚀 Cache hit for craving: "${cravingInput}" (source: ${cached.source})`);
    return {
      success: true,
      meal: cached.meals[0],
      source: cached.meals[0].source === 'ai' ? 'ai' : 'catalog'
    };
  }

  // Step 2: Check for template match BEFORE trying AI
  const templateMatches = findMatchingTemplates({
    ingredients: [cravingInput],
    mealType: validMealType
  }, 1);

  // Step 2: ALWAYS use deterministic source first (template match OR hash-based fallback)
  // Only escalate to AI if user explicitly requests it (which we don't support yet)
  
  if (templateMatches.length > 0 && templateMatches[0].score >= 0.3) {
    // Good template match - use it
    console.log(`📋 Template match for "${cravingInput}" (score: ${templateMatches[0].score})`);
    const meal = templateToMeal(templateMatches[0].template);
    const unifiedMeal: UnifiedMeal = {
      id: meal.id,
      name: meal.name,
      description: meal.description,
      ingredients: meal.ingredients,
      instructions: meal.instructions,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      cookingTime: '20 minutes',
      difficulty: 'Easy',
      imageUrl: meal.imageUrl,
      medicalBadges: [],
      source: 'catalog'
    };
    
    await cacheMeals(signature, [unifiedMeal], validMealType, 'template');
    
    return {
      success: true,
      meal: unifiedMeal,
      source: 'catalog'
    };
  } else {
    // No template match - use deterministic hash-based fallback
    console.log(`📋 No template match, using deterministic fallback for "${cravingInput}"`);
    const fallback = getDeterministicFallback(validMealType, [cravingInput]);
    const unifiedMeal: UnifiedMeal = {
      id: fallback.id,
      name: fallback.name,
      description: fallback.description,
      ingredients: fallback.ingredients,
      instructions: fallback.instructions,
      calories: fallback.calories,
      protein: fallback.protein,
      carbs: fallback.carbs,
      fat: fallback.fat,
      cookingTime: '20 minutes',
      difficulty: 'Easy',
      imageUrl: fallback.imageUrl,
      medicalBadges: [],
      source: 'catalog'
    };
    
    await cacheMeals(signature, [unifiedMeal], validMealType, 'template');
    
    return {
      success: true,
      meal: unifiedMeal,
      source: 'catalog'
    };
  }
}

/**
 * Generate multiple meals using fridge rescue
 * 
 * Flow: Cache → REAL Fridge Rescue AI Generator (same as Fridge Rescue page)
 * This is the UNIFIED approach - all meal generation uses the same stable system
 */
export async function generateFridgeRescueUnified(
  fridgeItems: string[],
  mealType: string,
  userId?: string,
  macroTargets?: MealGenerationRequest['macroTargets'],
  count: number = 3,
  useFallbackOnly: boolean = false
): Promise<MealGenerationResponse> {
  const validMealType = normalizeMealType(mealType);
  
  // Step 1: Check cache first (both memory and database)
  const signature = createIngredientSignature({
    ingredients: fridgeItems,
    mealType: validMealType
  });
  
  const cached = await getCachedMeals(signature);
  if (cached && cached.meals.length >= count) {
    // Validate cached meals have BOTH imageUrl AND ingredients - if not, regenerate
    const hasValidData = cached.meals.slice(0, count).every(m => 
      m.imageUrl && m.imageUrl.length > 0 && 
      m.ingredients && Array.isArray(m.ingredients) && m.ingredients.length > 0
    );
    if (hasValidData) {
      console.log(`🚀 Cache hit for fridge rescue: ${fridgeItems.join(', ')} (source: ${cached.source})`);
      return {
        success: true,
        meals: cached.meals.slice(0, count),
        meal: cached.meals[0],
        source: cached.meals[0].source === 'ai' ? 'ai' : 'catalog'
      };
    } else {
      console.log(`⚠️ Cache has stale entries without imageUrl/ingredients - regenerating: ${fridgeItems.join(', ')}`);
    }
  }

  // Step 2: Use the REAL Fridge Rescue generator (OpenAI-powered, proven stable)
  // This is the same system that works perfectly on Fridge Rescue page
  console.log(`🧊 Unified Pipeline: Using Fridge Rescue AI generator for: ${fridgeItems.join(', ')}`);
  
  try {
    const fridgeRescueMeals = await generateFridgeRescueMeals({
      fridgeItems,
      macroTargets
    });
    
    // Convert to UnifiedMeal format
    const resultMeals: UnifiedMeal[] = fridgeRescueMeals.slice(0, count).map(meal => ({
      id: meal.id,
      name: meal.name,
      description: meal.description,
      ingredients: meal.ingredients.map(ing => ({
        name: ing.name,
        quantity: String(ing.quantity),
        unit: ing.unit
      })),
      instructions: meal.instructions,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      cookingTime: meal.cookingTime,
      difficulty: meal.difficulty,
      imageUrl: meal.imageUrl || getFallbackImage(validMealType),
      medicalBadges: meal.medicalBadges || [],
      source: 'ai' as const
    }));
    
    console.log(`✅ Fridge Rescue AI generated ${resultMeals.length} complete meals`);
    
    // Cache the results for future use
    await cacheMeals(signature, resultMeals, validMealType, 'ai');
    
    return {
      success: true,
      meals: resultMeals,
      meal: resultMeals[0],
      source: 'ai'
    };
  } catch (error) {
    console.error('❌ Fridge Rescue AI generation failed:', error);
    
    // Fallback to deterministic templates only if AI fails
    console.log('⚠️ Falling back to deterministic templates...');
    const fallback = getDeterministicFallback(validMealType, fridgeItems);
    const fallbackMeal: UnifiedMeal = {
      id: fallback.id,
      name: fallback.name,
      description: fallback.description,
      ingredients: fallback.ingredients,
      instructions: fallback.instructions,
      calories: fallback.calories,
      protein: fallback.protein,
      carbs: fallback.carbs,
      fat: fallback.fat,
      cookingTime: '15 minutes',
      difficulty: 'Easy' as const,
      imageUrl: fallback.imageUrl,
      medicalBadges: [],
      source: 'fallback' as const
    };
    
    return {
      success: true,
      meals: [fallbackMeal],
      meal: fallbackMeal,
      source: 'fallback'
    };
  }
}

/**
 * Generate a meal from a free-form description (Create With Chef)
 * Uses OpenAI to generate a complete recipe with ingredients, instructions, and image
 * Supports diet-specific guardrails for specialized builders
 */
export async function generateFromDescriptionUnified(
  description: string,
  mealType: string,
  userId?: string,
  dietType?: DietType
): Promise<MealGenerationResponse> {
  const validMealType = normalizeMealType(mealType);
  
  console.log(`👨‍🍳 Create With Chef: Generating meal from description: "${description}" for ${validMealType}${dietType ? ` (diet: ${dietType})` : ''}`);
  
  try {
    // Import OpenAI directly for description-based generation
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Base prompt for meal generation
    let basePrompt = `You are a professional chef creating a personalized meal recipe.

TASK: Create a complete ${validMealType} recipe based on this request: "${description}"

REQUIREMENTS:
- Create a delicious, well-balanced meal that matches the user's description
- Include realistic ingredients with precise quantities
- Provide detailed step-by-step cooking instructions
- Include accurate nutritional estimates
- Make the recipe achievable for home cooks

FORMAT: Return as JSON object:
{
  "name": "Creative meal name based on the description",
  "description": "Brief 1-2 sentence appetizing description",
  "ingredients": [
    {"name": "ingredient name", "quantity": "precise amount", "unit": "tbsp/cup/oz/etc"}
  ],
  "instructions": "Detailed step-by-step cooking instructions as a single paragraph with numbered steps",
  "calories": number (realistic estimate 300-700),
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "cookingTime": "X minutes",
  "difficulty": "Easy" or "Medium" or "Hard"
}

Create the recipe for: "${description}"`;

    // Apply diet-specific guardrails to the prompt
    const guardrailResult = applyGuardrails(basePrompt, dietType || null, validMealType);
    const prompt = guardrailResult.modifiedPrompt;
    
    if (guardrailResult.appliedRules.length > 0) {
      console.log(`🛡️ Applied guardrails: ${guardrailResult.appliedRules.join(', ')}`);
    }

    // Build messages with optional system prompt for diet
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    const systemPrompt = getSystemPromptForDiet(dietType || null);
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });
    
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }
    
    const mealData = JSON.parse(content);
    
    // Generate DALL-E image for the meal
    let imageUrl = getFallbackImage(validMealType);
    try {
      const generatedImage = await generateImage({
        name: mealData.name,
        description: mealData.description,
        type: 'meal',
        style: 'homemade',
        ingredients: mealData.ingredients?.map((ing: any) => ing.name) || [],
        calories: mealData.calories,
        protein: mealData.protein,
        carbs: mealData.carbs,
        fat: mealData.fat,
      });
      
      if (generatedImage) {
        imageUrl = generatedImage;
        console.log(`🖼️ Generated DALL-E image for Create With Chef: ${mealData.name}`);
      }
    } catch (imgError) {
      console.warn('⚠️ DALL-E image generation failed, using fallback:', imgError);
    }
    
    const unifiedMeal: UnifiedMeal = {
      id: `chef-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: mealData.name,
      description: mealData.description,
      ingredients: (mealData.ingredients || []).map((ing: any) => ({
        name: ing.name,
        quantity: String(ing.quantity || ''),
        unit: ing.unit || ''
      })),
      instructions: mealData.instructions,
      calories: mealData.calories || 400,
      protein: mealData.protein || 25,
      carbs: mealData.carbs || 35,
      fat: mealData.fat || 15,
      cookingTime: mealData.cookingTime || '25 minutes',
      difficulty: mealData.difficulty || 'Easy',
      imageUrl,
      medicalBadges: [],
      source: 'ai'
    };
    
    // Post-generation validation for diet compliance
    if (dietType) {
      const validation = validateMealForDiet(unifiedMeal, dietType);
      if (!validation.isValid) {
        console.warn(`⚠️ Meal has guardrail violations: ${validation.violations.join(', ')}`);
        // Log warning but still return meal - guardrails are guidance, not hard blocks
      }
    }
    
    console.log(`✅ Create With Chef generated complete meal: ${unifiedMeal.name}`);
    
    return {
      success: true,
      meal: unifiedMeal,
      meals: [unifiedMeal],
      source: 'ai'
    };
    
  } catch (error: any) {
    console.error('❌ Create With Chef generation failed:', error);
    
    // Fallback to deterministic template
    const fallback = getDeterministicFallback(validMealType, [description]);
    const fallbackMeal: UnifiedMeal = {
      id: fallback.id,
      name: fallback.name,
      description: fallback.description,
      ingredients: fallback.ingredients,
      instructions: fallback.instructions,
      calories: fallback.calories,
      protein: fallback.protein,
      carbs: fallback.carbs,
      fat: fallback.fat,
      cookingTime: '20 minutes',
      difficulty: 'Easy',
      imageUrl: fallback.imageUrl,
      medicalBadges: [],
      source: 'fallback'
    };
    
    return {
      success: true,
      meal: fallbackMeal,
      meals: [fallbackMeal],
      source: 'fallback'
    };
  }
}

/**
 * Generate a snack from a craving description (Snack Creator)
 * Uses craving-to-healthy transformation logic with full meal card output
 * Outputs identical format to Create With Chef and Fridge Rescue
 * Supports diet-specific guardrails for specialized builders
 */
export async function generateSnackFromCravingUnified(
  cravingDescription: string,
  userId?: string,
  dietType?: DietType
): Promise<MealGenerationResponse> {
  console.log(`🍪 Snack Creator: Generating healthy snack from craving: "${cravingDescription}"${dietType ? ` (diet: ${dietType})` : ''}`);
  
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    let basePrompt = `You are a nutrition-focused chef specializing in healthy snack alternatives.

TASK: Transform this craving into a HEALTHY snack: "${cravingDescription}"

TRANSFORMATION RULES:
- If they want something crunchy/salty → suggest nuts, seeds, veggie chips, roasted chickpeas
- If they want something sweet → suggest fruit, dark chocolate, Greek yogurt parfait
- If they want something chocolatey → suggest protein-rich chocolate alternatives
- If they want something creamy → suggest Greek yogurt, cottage cheese, avocado-based
- If they want something fruity → suggest fresh fruit combos, smoothie bites, frozen treats
- Keep calories reasonable (100-300 for snacks)
- Prioritize protein and fiber over empty carbs
- Make it genuinely delicious - this should satisfy the craving healthily

REQUIREMENTS:
- Create a satisfying snack that addresses their craving
- Include realistic ingredients with precise quantities
- Provide clear preparation instructions (even if simple)
- Include accurate nutritional estimates
- Make it quick and easy to prepare (under 10 minutes)

FORMAT: Return as JSON object:
{
  "name": "Creative snack name that sounds appetizing",
  "description": "Brief 1-2 sentence appetizing description explaining how this satisfies the craving",
  "ingredients": [
    {"name": "ingredient name", "quantity": "precise amount", "unit": "tbsp/cup/oz/etc"}
  ],
  "instructions": "Clear step-by-step preparation instructions as a single paragraph with numbered steps. Even simple snacks need instructions.",
  "calories": number (realistic 100-300),
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "cookingTime": "X minutes",
  "difficulty": "Easy"
}

Create the healthy snack transformation for: "${cravingDescription}"`;

    // Apply diet-specific guardrails to the prompt
    const guardrailResult = applyGuardrails(basePrompt, dietType || null, 'snack');
    const prompt = guardrailResult.modifiedPrompt;
    
    if (guardrailResult.appliedRules.length > 0) {
      console.log(`🛡️ Applied snack guardrails: ${guardrailResult.appliedRules.join(', ')}`);
    }

    // Build messages with optional system prompt for diet
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    const systemPrompt = getSystemPromptForDiet(dietType || null);
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });
    
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content received from OpenAI");
    }
    
    const snackData = JSON.parse(content);
    
    // Generate DALL-E image for the snack
    let imageUrl = getFallbackImage('snack');
    try {
      const generatedImage = await generateImage({
        name: snackData.name,
        description: snackData.description,
        type: 'meal',
        style: 'homemade',
        ingredients: snackData.ingredients?.map((ing: any) => ing.name) || [],
        calories: snackData.calories,
        protein: snackData.protein,
        carbs: snackData.carbs,
        fat: snackData.fat,
      });
      
      if (generatedImage) {
        imageUrl = generatedImage;
        console.log(`🖼️ Generated DALL-E image for Snack Creator: ${snackData.name}`);
      }
    } catch (imgError) {
      console.warn('⚠️ DALL-E image generation failed for snack, using fallback:', imgError);
    }
    
    const unifiedSnack: UnifiedMeal = {
      id: `snack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: snackData.name,
      description: snackData.description,
      ingredients: (snackData.ingredients || []).map((ing: any) => ({
        name: ing.name,
        quantity: String(ing.quantity || ''),
        unit: ing.unit || ''
      })),
      instructions: snackData.instructions,
      calories: snackData.calories || 150,
      protein: snackData.protein || 8,
      carbs: snackData.carbs || 15,
      fat: snackData.fat || 6,
      cookingTime: snackData.cookingTime || '5 minutes',
      difficulty: 'Easy',
      imageUrl,
      medicalBadges: [],
      source: 'ai'
    };
    
    // Post-generation validation for diet compliance
    if (dietType) {
      const validation = validateMealForDiet(unifiedSnack, dietType);
      if (!validation.isValid) {
        console.warn(`⚠️ Snack has guardrail violations: ${validation.violations.join(', ')}`);
        // Log warning but still return snack - guardrails are guidance, not hard blocks
      }
    }
    
    console.log(`✅ Snack Creator generated complete snack: ${unifiedSnack.name}`);
    
    return {
      success: true,
      meal: unifiedSnack,
      meals: [unifiedSnack],
      source: 'ai'
    };
    
  } catch (error: any) {
    console.error('❌ Snack Creator generation failed:', error);
    
    // Fallback to deterministic template for snacks
    const fallback = getDeterministicFallback('snack', [cravingDescription]);
    const fallbackSnack: UnifiedMeal = {
      id: fallback.id,
      name: fallback.name,
      description: fallback.description,
      ingredients: fallback.ingredients,
      instructions: fallback.instructions,
      calories: fallback.calories,
      protein: fallback.protein,
      carbs: fallback.carbs,
      fat: fallback.fat,
      cookingTime: '5 minutes',
      difficulty: 'Easy',
      imageUrl: fallback.imageUrl,
      medicalBadges: [],
      source: 'fallback'
    };
    
    return {
      success: true,
      meal: fallbackSnack,
      meals: [fallbackSnack],
      source: 'fallback'
    };
  }
}

/**
 * Main unified generation function - routes to appropriate generator
 */
export async function generateMealUnified(
  request: MealGenerationRequest
): Promise<MealGenerationResponse> {
  console.log(`🔄 Unified pipeline processing ${request.type} request for ${request.mealType}`);

  switch (request.type) {
    case 'craving':
      const cravingInput = Array.isArray(request.input) 
        ? request.input.join(', ') 
        : request.input;
      return generateCravingMealUnified(cravingInput, request.mealType, request.userId);

    case 'create-with-chef':
      // Create With Chef uses description-based generation (AI + DALL-E image)
      // Supports diet-specific guardrails when dietType is provided
      const chefDescription = Array.isArray(request.input) 
        ? request.input.join(', ') 
        : request.input;
      return generateFromDescriptionUnified(chefDescription, request.mealType, request.userId, request.dietType);

    case 'snack-creator':
      // Snack Creator uses craving-to-healthy transformation (AI + DALL-E image)
      // Supports diet-specific guardrails when dietType is provided
      const snackCraving = Array.isArray(request.input) 
        ? request.input.join(', ') 
        : request.input;
      return generateSnackFromCravingUnified(snackCraving, request.userId, request.dietType);

    case 'fridge-rescue':
    case 'premade':
      const fridgeItems = Array.isArray(request.input) 
        ? request.input 
        : request.input.split(',').map(s => s.trim());
      // Skip DALL-E for premades - use static fallbacks for instant loading
      const useFallbackOnly = request.type === 'premade';
      return generateFridgeRescueUnified(
        fridgeItems, 
        request.mealType, 
        request.userId,
        request.macroTargets,
        request.count || 1,
        useFallbackOnly
      );

    default:
      return {
        success: false,
        source: 'fallback',
        error: `Unknown generation type: ${request.type}`
      };
  }
}
