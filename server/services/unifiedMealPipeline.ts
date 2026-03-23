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
import { buildVegetableStrategyPrompt, NutritionStrategyContext } from './promptBuilder';
import { getDeterministicFallback, findMatchingTemplates, templateToMeal } from './templateMatcher';
import { STARCHY_KEYWORDS } from '../../shared/starchKeywords';
import { createIngredientSignature, hashSignature } from './ingredientSignature';
import { getCachedMeals, cacheMeals } from './mealCachePersistent';
import { generateFridgeRescueMeals } from './fridgeRescueGenerator';
import { applyGuardrails, validateMealForDiet, getSystemPromptForDiet, DietType } from './guardrails';
import { normalizeIngredients as normalizeIngredientsToUS } from './ingredientNormalizer';
import { 
  resolveHubCoupling, 
  validateMealForHub, 
  hasHardViolations, 
  getRegenerationHint,
  isValidHubType,
  ensureHubsRegistered,
  detectHubTypeFromProfile,
  HubType,
  HubCouplingResult 
} from './hubCoupling';
import { enforceCarbs } from '../utils/carbClassifier';
import { 
  buildForbiddenIngredients, 
  buildSafetyGuardrails, 
  scanForViolations,
  validateMealSafety,
  logSafetyEnforcement,
  extractSafetyProfile,
  UserSafetyProfile,
  buildDietPromptBlock,
  violatesDietaryConstraints,
  getPrimaryDiet
} from './allergyGuardrails';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { 
  enforceSafetyProfile,
  validateGeneratedMeal,
  extractSafetyProfileFromUser,
  SafetyAssessment
} from './safetyProfileService';
import { storage } from '../storage';
import OpenAI from 'openai';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for AI meal generation");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

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
// Nutrition Schema v1.1 - Added starchyCarbs/fibrousCarbs (Dec 2024)
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
  carbs: number; // Total carbs (starchyCarbs + fibrousCarbs) for backward compatibility
  starchyCarbs?: number; // Nutrition Schema v1.1: Rice, pasta, bread, potatoes, etc.
  fibrousCarbs?: number; // Nutrition Schema v1.1: Vegetables, leafy greens, etc.
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

/**
 * Starch Context - Used for intelligent carb distribution
 * The starch strategy controls how many meals per day can contain starchy carbs.
 * This is behavioral coaching, not macro tracking.
 */
export interface StarchContext {
  strategy: 'one' | 'flex'; // "one" = 1 starch meal/day, "flex" = 2 meals
  existingMeals?: Array<{
    slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    hasStarch: boolean;
  }>;
  forceStarch?: boolean; // User explicitly requested starch (overrides default)
  forceFiberBased?: boolean; // User explicitly requested no starch
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
  starchContext?: StarchContext; // Starch Game Plan context for intelligent carb distribution
  nutritionStrategy?: NutritionStrategyContext; // Vegetable system + cut intensity guardrails
  safetyAlreadyChecked?: boolean; // Skip internal safety check if route already verified with override token
}

export interface MealGenerationResponse {
  success: boolean;
  meal?: UnifiedMeal;
  meals?: UnifiedMeal[];
  source: 'ai' | 'catalog' | 'fallback' | 'error';
  error?: string;
  // Safety Profile enforcement fields
  safetyBlocked?: boolean;
  safetyAmbiguous?: boolean;
  blockedTerms?: string[];
  ambiguousTerms?: string[];
  suggestion?: string;
}

/**
 * Determine if this meal should be starch-based or fiber-based
 * Based on the Starch Game Plan coaching system
 */
function determineStarchPlacement(
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  starchContext?: StarchContext
): { shouldIncludeStarch: boolean; reason: string } {
  // No context = allow starch (legacy behavior)
  if (!starchContext) {
    return { shouldIncludeStarch: true, reason: 'no_starch_context' };
  }
  
  // User explicitly requested starch (e.g., "make me pasta")
  if (starchContext.forceStarch) {
    return { shouldIncludeStarch: true, reason: 'user_requested_starch' };
  }
  
  // User explicitly requested fiber-based (e.g., "make it low carb")
  if (starchContext.forceFiberBased) {
    return { shouldIncludeStarch: false, reason: 'user_requested_fiber' };
  }
  
  // Count existing starch meals
  const existingStarchCount = (starchContext.existingMeals || [])
    .filter(m => m.hasStarch).length;
  
  const maxStarchSlots = starchContext.strategy === 'flex' ? 2 : 1;
  const slotsRemaining = maxStarchSlots - existingStarchCount;
  
  // If all slots are used, this meal should be fiber-based
  if (slotsRemaining <= 0) {
    return { shouldIncludeStarch: false, reason: 'starch_slots_used' };
  }
  
  // Slots available - decide based on meal type priority
  // Default priority: Lunch > Breakfast > Dinner (mirrors real coaching)
  const existingSlots = (starchContext.existingMeals || []).map(m => m.slot);
  const hasStarchAlready = existingStarchCount > 0;
  
  // If no starch meal yet and this is the preferred slot, make it the starch meal
  if (!hasStarchAlready) {
    // First meal of the day being generated - use priority order
    if (mealType === 'lunch') {
      return { shouldIncludeStarch: true, reason: 'lunch_is_default_starch_slot' };
    }
    if (mealType === 'breakfast' && !existingSlots.includes('lunch')) {
      // Breakfast can be starch if lunch isn't already planned
      return { shouldIncludeStarch: true, reason: 'breakfast_available_for_starch' };
    }
    if (mealType === 'dinner' && !existingSlots.includes('lunch') && !existingSlots.includes('breakfast')) {
      // Dinner gets starch only if no other meals planned
      return { shouldIncludeStarch: true, reason: 'dinner_fallback_for_starch' };
    }
  }
  
  // Flex mode: allow second starch meal
  if (starchContext.strategy === 'flex' && slotsRemaining > 0) {
    return { shouldIncludeStarch: true, reason: 'flex_mode_slot_available' };
  }
  
  // Default: fiber-based to preserve starch slots
  return { shouldIncludeStarch: false, reason: 'preserving_starch_slot' };
}

/**
 * Build starch guidance for the AI prompt
 */
function buildStarchGuidance(
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  starchContext?: StarchContext
): string {
  const placement = determineStarchPlacement(mealType, starchContext);
  
  if (placement.shouldIncludeStarch) {
    return `
🍚 STARCH GUIDANCE: This meal MAY include starchy carbs (rice, pasta, bread, potatoes, beans, oats).
Include starchy carbs as the primary carb source for this meal.`;
  } else {
    return `
🥦 STARCH GUIDANCE: This meal should be FIBER-BASED (no starchy carbs).
- DO NOT include: rice, pasta, bread, potatoes, beans, corn, oats, crackers, tortillas
- DO include: vegetables (broccoli, spinach, peppers, zucchini, cauliflower), salads, leafy greens
- Focus on: protein + vegetables + healthy fats
- This creates a "protein + veggies" meal that keeps the user's starch slot available for another meal.`;
  }
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
// =======================
// BEGIN CANVA IMAGE SYSTEM — ensureImage
// =======================
interface MealVisualDescriptor {
  title: string;
  mealType: string;
  keyFoods: string[];
  style: string;
}

function buildMealVisual(meal: {
  name?: string;
  description?: string;
  ingredients?: Array<{ name: string; quantity?: string; unit?: string }>;
  mealType: string;
}): MealVisualDescriptor {
  const keyFoods = (meal.ingredients || [])
    .map(i => i?.name)
    .filter(Boolean)
    .slice(0, 6) as string[];

  return {
    title: meal.name || "Healthy homemade meal",
    mealType: meal.mealType,
    keyFoods,
    style:
      "realistic professional food photography, natural light, plated, clean background, shallow depth of field, no text, no watermark, no logo, no people, no hands, no utensils in motion",
  };
}

async function ensureImage(
  meal: Partial<UnifiedMeal>,
  mealType: string,
  useFallbackOnly: boolean = false
): Promise<string> {
  // 1) Respect explicitly provided image URLs
  if (meal.imageUrl && (meal.imageUrl.startsWith("http") || meal.imageUrl.startsWith("/"))) {
    return meal.imageUrl;
  }

  // 2) Premades / forced fallback: neutral placeholder ONLY
  if (useFallbackOnly) {
    return "/images/placeholders/meal-placeholder.jpg";
  }

  // 3) Canva-style image generation (image matches the meal)
  try {
    const visual = buildMealVisual({
      name: meal.name,
      description: meal.description,
      ingredients: meal.ingredients as any,
      mealType,
    });

    const keyFoodsLine =
      visual.keyFoods.length > 0
        ? `Key foods visible: ${visual.keyFoods.join(", ")}.`
        : `Key foods visible: ingredients consistent with "${visual.title}".`;

    const imageUrl = await generateImage({
      name: visual.title,
      description: `${keyFoodsLine} ${meal.description || ""}`.trim(),
      type: "meal",
      style: visual.style,
      ingredients: visual.keyFoods,
      calories: (meal as any).calories,
      protein: (meal as any).protein,
      carbs: (meal as any).carbs,
      fat: (meal as any).fat,
    });

    if (imageUrl) {
      console.log(`🖼️ Canva-style image generated for: ${meal.name || visual.title}`);
      return imageUrl;
    }
  } catch (error) {
    console.warn(`⚠️ Canva-style image generation failed for "${meal.name}"`, error);
  }

  // 4) Last resort: neutral placeholder (never pancakes)
  return "/images/placeholders/meal-placeholder.jpg";
}
// =======================
// END CANVA IMAGE SYSTEM — ensureImage
// =======================


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
  userId?: string,
  dietaryRestrictionsOverride?: string[]
): Promise<MealGenerationResponse> {
  const validMealType = normalizeMealType(mealType);

  // Step 0: Fetch dietary restrictions FIRST — before cache or template checks
  // This ensures the cache key is diet-aware and templates are validated against the user's diet
  let cravingDietBlock = "";
  let cravingDietRestrictions: string[] = [];
  if (userId) {
    try {
      const [cravingUser] = await db.select({ dietaryRestrictions: users.dietaryRestrictions })
        .from(users).where(eq(users.id, userId)).limit(1);
      cravingDietRestrictions = (cravingUser?.dietaryRestrictions as string[]) || [];
    } catch (err) {
      console.warn("[CRAVING] Could not fetch dietary restrictions:", err);
    }
  }
  // Supplement with client-provided override (for UI diet selectors or guest flows)
  if (dietaryRestrictionsOverride && dietaryRestrictionsOverride.length > 0) {
    const merged = new Set([...cravingDietRestrictions, ...dietaryRestrictionsOverride]);
    cravingDietRestrictions = Array.from(merged);
  }
  cravingDietBlock = buildDietPromptBlock(cravingDietRestrictions);
  if (cravingDietBlock) {
    console.log(`🥗 [CRAVING] Dietary constraint enforced: ${cravingDietRestrictions.join("|")}`);
  }

  // Resolve primary diet for cache key segregation
  const cravingPrimaryDiet = getPrimaryDiet(cravingDietRestrictions) || "none";
  
  // Step 1: Check diet-aware cache (includes primaryDiet in key — no cross-diet contamination)
  const signature = createIngredientSignature({
    ingredients: [cravingInput],
    mealType: validMealType,
    primaryDiet: cravingPrimaryDiet
  });
  
  const cached = await getCachedMeals(signature);
  if (cached && cached.meals.length > 0) {
    console.log(`🚀 Cache hit for craving: "${cravingInput}" diet:${cravingPrimaryDiet} (source: ${cached.source})`);
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

  if (templateMatches.length > 0 && templateMatches[0].score >= 0.3) {
    const meal = templateToMeal(templateMatches[0].template);

    // TEMPLATE DIET ENFORCEMENT: reject templates that violate the user's dietary restrictions
    // before returning — a vegan user must never receive an egg-based template
    if (cravingDietRestrictions.length > 0) {
      const templateText = `${meal.name} ${(meal.ingredients || []).map((i: any) => i.name).join(' ')}`;
      const { violates, reasons } = violatesDietaryConstraints(templateText, cravingDietRestrictions);
      if (violates) {
        console.log(`🚫 [TEMPLATE GUARD] Template "${meal.name}" violates ${cravingPrimaryDiet} diet (${reasons.join(", ")}) — escalating to AI`);
        // Fall through to AI generation below — do NOT return this template
      } else {
        // Template passes dietary check — safe to use
        console.log(`📋 Template match for "${cravingInput}" (score: ${templateMatches[0].score}) — diet OK`);
        const unifiedMeal: UnifiedMeal = {
          id: meal.id,
          name: meal.name,
          description: meal.description,
          ingredients: meal.ingredients,
          instructions: meal.instructions,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          starchyCarbs: 0,
          fibrousCarbs: 0,
          fat: meal.fat,
          cookingTime: '20 minutes',
          difficulty: 'Easy',
          imageUrl: meal.imageUrl,
          medicalBadges: [],
          source: 'catalog'
        };
        await cacheMeals(signature, [unifiedMeal], validMealType, 'template');
        return { success: true, meal: unifiedMeal, source: 'catalog' };
      }
    } else {
      // No dietary restrictions — use template as-is
      console.log(`📋 Template match for "${cravingInput}" (score: ${templateMatches[0].score})`);
      const unifiedMeal: UnifiedMeal = {
        id: meal.id,
        name: meal.name,
        description: meal.description,
        ingredients: meal.ingredients,
        instructions: meal.instructions,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        starchyCarbs: 0,
        fibrousCarbs: 0,
        fat: meal.fat,
        cookingTime: '20 minutes',
        difficulty: 'Easy',
        imageUrl: meal.imageUrl,
        medicalBadges: [],
        source: 'catalog'
      };
      await cacheMeals(signature, [unifiedMeal], validMealType, 'template');
      return { success: true, meal: unifiedMeal, source: 'catalog' };
    }
  }

  {
    // No valid template (or template was rejected by diet guard) — use AI generation
    console.log(`🤖 Using AI generation for "${cravingInput}" (diet: ${cravingPrimaryDiet})`);

    try {
      const openai = getOpenAI();
      
      const prompt = `You are a creative chef helping someone satisfy their food craving.
${cravingDietBlock ? `\n${cravingDietBlock}\n` : ""}
CRAVING: "${cravingInput}"
MEAL TYPE: ${validMealType}

Create ONE delicious meal that perfectly satisfies this craving. The meal should be:
- Realistic and cookable at home
- Focused on the craving flavors/ingredients mentioned
- Balanced and nutritious

CRITICAL INGREDIENT FORMAT RULES:
- Use ONLY U.S. measurements: oz, lb, cup, tbsp, tsp, each, fl oz
- NEVER use grams (g), milliliters (ml), or metric units
- Each ingredient must have: name, quantity (number), unit

CARB CLASSIFICATION RULES (CRITICAL):
- starchyCarbs: Energy-dense carbs from rice, pasta, bread, potatoes, grains, beans, corn, peas
- fibrousCarbs: Volume-dense carbs from vegetables, leafy greens, broccoli, cauliflower, peppers, tomatoes, cucumbers
- Both are measured in grams and should sum to approximate total carbs
- Vegetables ARE carbs (fibrous) - never return 0 for fibrousCarbs if vegetables are present

Respond with ONLY valid JSON in this exact format:
{
  "name": "Creative meal name matching the craving",
  "description": "Appetizing 1-2 sentence description",
  "ingredients": [
    {"name": "ingredient name", "quantity": "4", "unit": "oz"},
    {"name": "another ingredient", "quantity": "1", "unit": "cup"}
  ],
  "instructions": "Step-by-step cooking instructions as a single string",
  "calories": 400,
  "protein": 25,
  "starchyCarbs": 20,
  "fibrousCarbs": 15,
  "fat": 15,
  "cookingTime": "20 minutes"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty AI response");

      // Parse JSON from response (handle markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      
      const aiMeal = JSON.parse(jsonStr.trim());
      
      // Normalize ingredients to U.S. measurements
      const normalizedIngredients = normalizeIngredients(aiMeal.ingredients || []);
      
      // Extract starchyCarbs and fibrousCarbs from AI response
      const starchyCarbs = aiMeal.starchyCarbs ?? 0;
      const fibrousCarbs = aiMeal.fibrousCarbs ?? 0;
      // Total carbs = starchyCarbs + fibrousCarbs (for backward compatibility)
      const totalCarbs = aiMeal.carbs ?? ((starchyCarbs + fibrousCarbs) || 35);
      
      const rawMeal: UnifiedMeal = {
        id: `craving-ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: aiMeal.name || `${cravingInput} Delight`,
        description: aiMeal.description || `A delicious ${validMealType} inspired by ${cravingInput}`,
        ingredients: normalizedIngredients,
        instructions: aiMeal.instructions || "Prepare ingredients and cook to your preference.",
        calories: aiMeal.calories || 400,
        protein: aiMeal.protein || 25,
        carbs: totalCarbs,
        starchyCarbs: starchyCarbs,
        fibrousCarbs: fibrousCarbs,
        fat: aiMeal.fat || 15,
        cookingTime: aiMeal.cookingTime || '20 minutes',
        difficulty: 'Easy',
        imageUrl: FALLBACK_IMAGES[validMealType] || FALLBACK_IMAGES.default,
        medicalBadges: [],
        source: 'ai'
      };
      
      // ENFORCE CARBS: If AI returned 0s, derive from ingredients (data-layer enforcement)
      const unifiedMeal = enforceCarbs(rawMeal);
      
      // POST-GENERATION dietary hard filter (vegan/vegetarian/pescatarian)
      if (cravingDietRestrictions.length > 0) {
        const mealText = `${unifiedMeal.name} ${unifiedMeal.ingredients.map((i: any) => i.name).join(' ')}`;
        const { violates, reasons } = violatesDietaryConstraints(mealText, cravingDietRestrictions);
        if (violates) {
          console.warn(`⚠️ [DIET GUARD] Craving generator: ${reasons.join(", ")} — diet: ${cravingDietRestrictions.join("|")}`);
        }
      }
      
      console.log(`✅ AI generated meal: ${unifiedMeal.name}`);
      
      // Cache the AI-generated meal
      await cacheMeals(signature, [unifiedMeal], validMealType, 'ai');
      
      return {
        success: true,
        meal: unifiedMeal,
        source: 'ai'
      };
      
    } catch (aiError: any) {
      // AI failed - fall back to deterministic catalog
      console.error(`❌ AI generation failed, using catalog fallback:`, aiError.message);
      
      const fallback = getDeterministicFallback(validMealType, [cravingInput]);
      const rawFallbackMeal: UnifiedMeal = {
        id: fallback.id,
        name: fallback.name,
        description: fallback.description,
        ingredients: fallback.ingredients,
        instructions: fallback.instructions,
        calories: fallback.calories,
        protein: fallback.protein,
        carbs: fallback.carbs,
        starchyCarbs: 0,
        fibrousCarbs: 0,
        fat: fallback.fat,
        cookingTime: '20 minutes',
        difficulty: 'Easy',
        imageUrl: fallback.imageUrl,
        medicalBadges: [],
        source: 'catalog'
      };
      
      // ENFORCE CARBS: Derive from ingredients for catalog fallback
      const unifiedMeal = enforceCarbs(rawFallbackMeal);
      
      await cacheMeals(signature, [unifiedMeal], validMealType, 'template');
      
      return {
        success: true,
        meal: unifiedMeal,
        source: 'catalog'
      };
    }
  }
}

/**
 * 🎲 VARIETY ENGINE: Generate 3 distinct meal options
 * Layer 1: Temperature 0.85 (creative variety, breaks repetition)
 * Layer 2: Explicit protein pool + rotation rules (no portobello default)
 * Layer 3: excludeMeals anti-repetition memory
 * Layer 4: Always returns 3 genuinely distinct options
 */
// ─── VARIETY ENGINE HELPERS ────────────────────────────────────────────────

/** Determine if the craving is dessert-like */
function isCravingDessert(input: string): boolean {
  const dessertTerms = /cheesecake|cake|cookie|brownie|tart|pie|pudding|mousse|parfait|custard|ice.?cream|gelato|sorbet|fudge|truffle|macaron|crepe|waffle|muffin|donut|sundae|tiramisu|cannoli|panna.?cotta|cobbler|crisp|bread.?pudding|eclair|profiterole|dessert|sweet|chocolate|vanilla|caramel|strawberry.*cake|lemon.*bar|banana.*bread/i;
  return dessertTerms.test(input);
}

/** Infer dominant category from craving text */
function inferCravingCategory(input: string, mealType: string): string {
  if (isCravingDessert(input)) return "dessert";
  if (/smoothie|juice|shake|latte|coffee|tea|drink|beverage|cocktail|mocktail/i.test(input)) return "beverage";
  if (/soup|salad|sandwich|wrap|bowl|pasta|rice|steak|chicken|fish|shrimp|burger|taco|burrito|pizza/i.test(input)) return "meal";
  if (/snack|bite|bar|chip|dip|hummus|cracker/i.test(input)) return "snack";
  return mealType;
}

/** Extract dish family keyword from craving (e.g. "cheesecake", "steak", "smoothie") */
function extractDishFamily(input: string): string {
  const words = input.toLowerCase().split(/\s+/);
  // Key dish-type nouns to lock onto
  const dishNouns = ['cheesecake','cake','pie','tart','brownie','cookie','pudding','mousse','parfait','smoothie','shake','bowl','soup','salad','sandwich','wrap','steak','burger','pasta','pizza','taco','burrito','curry','stir-fry','risotto','omelette','pancake','waffle','muffin','scone','crepe','ice cream','gelato'];
  for (const noun of dishNouns) {
    if (input.toLowerCase().includes(noun)) return noun;
  }
  // fallback: last meaningful word
  return words[words.length - 1] || input;
}

/** Server-side validation: check each option stays within category and diet */
function validateVarietyOption(opt: any, category: string, dishFamily: string, dietRestrictions: string[]): boolean {
  const nameAndDesc = `${opt.name || ''} ${opt.description || ''}`.toLowerCase();
  
  // Category drift check — dessert requests must not return savory mains
  if (category === "dessert") {
    const savoryTerms = /lettuce wrap|taco|steak|chicken breast|salmon|shrimp|burger|pasta salad|rice bowl|stir.?fry|carnitas|pulled pork|fish fillet|pork chop|beef|lamb chop/i;
    if (savoryTerms.test(nameAndDesc)) return false;
  }
  if (category === "beverage") {
    const nonBeverageTerms = /salad|sandwich|steak|pasta|taco|burger|rice bowl|stir.?fry/i;
    if (nonBeverageTerms.test(nameAndDesc)) return false;
  }
  
  // Dish family drift check — core dish type must appear in name or description
  const simpleDishFamily = dishFamily.replace(/-/g, ' ');
  if (dishFamily.length > 3 && !nameAndDesc.includes(simpleDishFamily)) {
    // Allow very close synonyms before rejecting
    const synonymMap: Record<string, string[]> = {
      cheesecake: ['cheesecake', 'cheese cake', 'no-bake', 'cashew cream', 'cream cheese'],
      smoothie: ['smoothie', 'shake', 'blend'],
      steak: ['steak', 'beef', 'sirloin', 'ribeye'],
      burger: ['burger', 'patty', 'smash'],
    };
    const synonyms = synonymMap[dishFamily] || [simpleDishFamily];
    const passes = synonyms.some(s => nameAndDesc.includes(s));
    if (!passes) return false;
  }
  
  // Diet compliance — vegan: no meat/dairy/egg keywords in name/desc
  const primaryDiet = getPrimaryDiet(dietRestrictions);
  if (primaryDiet === 'vegan') {
    const nonVeganTerms = /beef|chicken|pork|salmon|shrimp|tuna|lamb|bacon|turkey|milk|butter|cream cheese|heavy cream|egg(?!plant)|gelatin|whey/i;
    if (nonVeganTerms.test(nameAndDesc)) return false;
  }
  
  return true;
}

/** Build the hierarchy-enforcing prompt for the variety engine */
function buildVarietyPrompt(
  cravingInput: string,
  validMealType: string,
  category: string,
  dishFamily: string,
  dietBlock: string,
  dietRestrictions: string[],
  excludeClause: string
): string {
  const primaryDiet = getPrimaryDiet(dietRestrictions);
  const dietLine = primaryDiet
    ? `USER DIET: ${primaryDiet.toUpperCase()} — ALL 3 options must comply fully. Zero exceptions.`
    : `USER DIET: None set — generate standard (non-vegan, non-restricted) food.`;

  const dessertNote = category === "dessert"
    ? `\nCATEGORY LOCK: This is a DESSERT request. ALL 3 options must be desserts. Never generate savory meals, wraps, salads, or non-dessert items.`
    : category === "beverage"
    ? `\nCATEGORY LOCK: This is a BEVERAGE request. ALL 3 options must be drinks. Never generate solid food.`
    : `\nCATEGORY LOCK: This is a ${category.toUpperCase()} request. Stay within this food category.`;

  return `You are a precision chef AI. Your ONLY job is to generate 3 distinct variations of the same dish type.

═══════════════════════════════════════
HIERARCHY (follow in this EXACT order):
═══════════════════════════════════════
1. DIET COMPLIANCE (non-negotiable)
   ${dietLine}
   ${dietBlock ? dietBlock : ''}

2. CATEGORY LOCK (non-negotiable)${dessertNote}

3. DISH FAMILY LOCK (non-negotiable)
   The user asked for: "${cravingInput}"
   Core dish to stay within: "${dishFamily}"
   ALL 3 options must be variations of "${dishFamily}" — different preparations, textures, or styles.
   Example: "cheesecake" → Classic Baked Cheesecake, No-Bake Cheesecake, Cheesecake Parfait.
   NEVER drift to a completely different dish type.

4. VARIATION (apply last, within constraints above)
   Each option must differ meaningfully:
   - Different preparation method (baked vs no-bake vs layered vs mousse vs parfait)
   - Different texture or format (slice, cup, jar, bar)
   - Different flavor accent (classic vs fruity vs nutty vs spiced)
   NO minor wording changes — make each option genuinely distinct.

${excludeClause}

═══════════════════════════════════════
OUTPUT FORMAT — ONLY valid JSON, no markdown:
═══════════════════════════════════════
{
  "options": [
    {
      "name": "Specific variation name",
      "description": "Appetizing 1-2 sentence description matching the dish and diet",
      "ingredients": [{"name": "ingredient", "quantity": "4", "unit": "oz"}],
      "instructions": "Full step-by-step instructions as a single paragraph",
      "calories": 400,
      "protein": 10,
      "starchyCarbs": 30,
      "fibrousCarbs": 5,
      "fat": 15,
      "cookingTime": "20 minutes"
    },
    {},
    {}
  ]
}

INGREDIENT FORMAT: US measurements only (oz, lb, cup, tbsp, tsp, each, fl oz). Never grams or ml.
MEAL TYPE context: ${validMealType}`;
}

/** Parse raw AI content into options array */
function parseVarietyContent(content: string): any[] {
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];
  const parsed = JSON.parse(jsonStr.trim());
  return parsed.options || (Array.isArray(parsed) ? parsed : [parsed]);
}

/** Map a raw AI option object into a UnifiedMeal */
function mapToUnifiedMeal(opt: any, idx: number, cravingInput: string, validMealType: string): UnifiedMeal {
  const starchyCarbs = opt.starchyCarbs ?? 0;
  const fibrousCarbs = opt.fibrousCarbs ?? 0;
  const totalCarbs = opt.carbs ?? ((starchyCarbs + fibrousCarbs) || 35);
  const raw: UnifiedMeal = {
    id: `variety-ai-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
    name: opt.name || `${cravingInput} Option ${idx + 1}`,
    description: opt.description || `A delicious ${validMealType} inspired by ${cravingInput}`,
    ingredients: (opt.ingredients || []).map((i: any) => ({
      name: i.name || '',
      quantity: String(i.quantity || ''),
      unit: i.unit || ''
    })),
    instructions: opt.instructions || "Cook as desired.",
    calories: opt.calories || 400,
    protein: opt.protein || 15,
    carbs: totalCarbs,
    starchyCarbs,
    fibrousCarbs,
    fat: opt.fat || 12,
    cookingTime: opt.cookingTime || '25 minutes',
    difficulty: 'Easy',
    imageUrl: FALLBACK_IMAGES[validMealType] || FALLBACK_IMAGES.default,
    medicalBadges: [],
    source: 'ai'
  };
  return enforceCarbs(raw);
}

// ─── MAIN VARIETY ENGINE ────────────────────────────────────────────────────

export async function generateCravingMealOptions(
  cravingInput: string,
  mealType: string,
  userId?: string,
  dietaryRestrictionsOverride?: string[],
  excludeMeals?: string[]
): Promise<UnifiedMeal[]> {
  const validMealType = normalizeMealType(mealType);
  const category = inferCravingCategory(cravingInput, validMealType);
  const dishFamily = extractDishFamily(cravingInput);
  console.log(`🎲 [VARIETY ENGINE] "${cravingInput}" → category: ${category}, dish: ${dishFamily}`);

  // Fetch + merge dietary restrictions
  let dietRestrictions: string[] = [];
  if (userId) {
    try {
      const [u] = await db.select({ dietaryRestrictions: users.dietaryRestrictions })
        .from(users).where(eq(users.id, userId)).limit(1);
      dietRestrictions = (u?.dietaryRestrictions as string[]) || [];
    } catch (err) {
      console.warn("[VARIETY ENGINE] Could not fetch dietary restrictions:", err);
    }
  }
  if (dietaryRestrictionsOverride && dietaryRestrictionsOverride.length > 0) {
    const merged = new Set([...dietRestrictions, ...dietaryRestrictionsOverride]);
    dietRestrictions = Array.from(merged);
  }
  const dietBlock = buildDietPromptBlock(dietRestrictions);

  const excludeClause = excludeMeals && excludeMeals.length > 0
    ? `ANTI-REPETITION: Do NOT generate anything resembling these recently seen options — vary the primary ingredient, preparation, and concept: ${excludeMeals.join(", ")}`
    : "";

  const openai = getOpenAI();

  /** One attempt at calling AI and parsing result */
  const attempt = async (stricterMode: boolean): Promise<any[]> => {
    const prompt = buildVarietyPrompt(cravingInput, validMealType, category, dishFamily, dietBlock, dietRestrictions, excludeClause);
    const stricter = stricterMode
      ? `\n\nSECOND ATTEMPT — STRICT MODE: The previous response drifted from the dish family. You MUST generate 3 options that are clearly recognizable variations of "${dishFamily}". No exceptions.`
      : "";
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt + stricter }],
      temperature: stricterMode ? 0.6 : 0.85,
      max_tokens: 2500,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty AI response from variety engine");
    return parseVarietyContent(content);
  };

  let rawOptions: any[];
  try {
    rawOptions = await attempt(false);
  } catch (e) {
    console.error("[VARIETY ENGINE] JSON parse failed on first attempt, retrying…");
    rawOptions = await attempt(true);
  }

  // Server-side validation — check category, dish family, diet for each option
  const valid = rawOptions.slice(0, 3).filter(opt =>
    validateVarietyOption(opt, category, dishFamily, dietRestrictions)
  );

  // If majority fail validation, regenerate once with stricter prompt
  if (valid.length < 2) {
    console.warn(`[VARIETY ENGINE] Only ${valid.length}/3 options passed validation — regenerating with strict prompt`);
    try {
      rawOptions = await attempt(true);
      const strictValid = rawOptions.slice(0, 3).filter(opt =>
        validateVarietyOption(opt, category, dishFamily, dietRestrictions)
      );
      // Use the better result
      if (strictValid.length >= valid.length) {
        rawOptions = rawOptions.slice(0, 3);
      }
    } catch (retryErr) {
      console.error("[VARIETY ENGINE] Strict retry also failed:", retryErr);
    }
  }

  const finalOptions = rawOptions.slice(0, 3);
  console.log(`✅ [VARIETY ENGINE] ${finalOptions.length} options: ${finalOptions.map((o: any) => o?.name).join(" | ")}`);
  return finalOptions.map((opt, idx) => mapToUnifiedMeal(opt, idx, cravingInput, validMealType));
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

  // Fetch dietary restrictions FIRST to ensure diet-aware cache key
  let fridgeDietRestrictions: string[] = [];
  if (userId) {
    try {
      const [fridgeUser] = await db.select({ dietaryRestrictions: users.dietaryRestrictions })
        .from(users).where(eq(users.id, userId)).limit(1);
      fridgeDietRestrictions = (fridgeUser?.dietaryRestrictions as string[]) || [];
    } catch (err) {
      console.warn("[FRIDGE] Could not fetch dietary restrictions for cache key:", err);
    }
  }
  const fridgePrimaryDiet = getPrimaryDiet(fridgeDietRestrictions) || "none";
  
  // Step 1: Check diet-aware cache (includes primaryDiet to prevent cross-diet contamination)
  const signature = createIngredientSignature({
    ingredients: fridgeItems,
    mealType: validMealType,
    primaryDiet: fridgePrimaryDiet
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
      starchyCarbs: meal.starchyCarbs || 0,
      fibrousCarbs: meal.fibrousCarbs || 0,
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
      starchyCarbs: 0,
      fibrousCarbs: 0,
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
 * Supports Starch Game Plan for intelligent carb distribution
 */
export async function generateFromDescriptionUnified(
  description: string,
  mealType: string,
  userId?: string,
  dietType?: DietType,
  starchContext?: StarchContext,
  nutritionStrategy?: NutritionStrategyContext
): Promise<MealGenerationResponse> {
  const validMealType = normalizeMealType(mealType);
  
  // Auto-detect starchy foods in user's description and force starch if found
  // Uses shared STARCHY_KEYWORDS — same list the client uses for the indicator
  // The starch coaching system should NEVER override explicit user requests
  if (starchContext && !starchContext.forceStarch && !starchContext.forceFiberBased) {
    const descLower = description.toLowerCase();
    const userRequestedStarch = STARCHY_KEYWORDS.some(kw => descLower.includes(kw));
    if (userRequestedStarch) {
      starchContext = { ...starchContext, forceStarch: true };
      console.log(`🥔 [StarchOverride] User explicitly requested starchy food in "${description}" — forcing starch inclusion`);
    }
  }
  
  // Get starch placement decision
  const starchPlacement = determineStarchPlacement(validMealType, starchContext);
  const starchGuidance = buildStarchGuidance(validMealType, starchContext);
  const vegetableStrategyGuidance = nutritionStrategy ? buildVegetableStrategyPrompt(nutritionStrategy) : '';
  
  console.log(`👨‍🍳 Create With Chef: Generating meal from description: "${description}" for ${validMealType}${dietType ? ` (diet: ${dietType})` : ''} | Starch: ${starchPlacement.shouldIncludeStarch ? 'YES' : 'NO'} (${starchPlacement.reason})${vegetableStrategyGuidance ? ' | 🥦 VegStrategy: ON' : ''}`);
  
  try {
    await ensureHubsRegistered();
    
    let hubCoupling: HubCouplingResult | null = null;
    let effectiveHubType: HubType | null = null;
    
    if (userId) {
      if (isValidHubType(dietType)) {
        effectiveHubType = dietType;
      } else {
        effectiveHubType = await detectHubTypeFromProfile(userId);
      }
      
      if (effectiveHubType) {
        try {
          hubCoupling = await resolveHubCoupling(effectiveHubType, userId, validMealType);
          if (hubCoupling) {
            console.log(`🔌 Hub coupling loaded for ${effectiveHubType}`);
          }
        } catch (err) {
          console.warn(`⚠️ Failed to load hub coupling for ${effectiveHubType}, continuing without:`, err);
        }
      }
    }
    
    // Fetch user's primary dietary restriction (vegan/vegetarian/pescatarian)
    let chefDietBlock = "";
    let chefDietRestrictions: string[] = [];
    if (userId) {
      try {
        const [chefUser] = await db.select({ dietaryRestrictions: users.dietaryRestrictions })
          .from(users).where(eq(users.id, userId)).limit(1);
        chefDietRestrictions = (chefUser?.dietaryRestrictions as string[]) || [];
        chefDietBlock = buildDietPromptBlock(chefDietRestrictions);
        if (chefDietBlock) {
          console.log(`🥗 [CREATE-WITH-CHEF] Dietary constraint enforced: ${chefDietRestrictions.join("|")}`);
        }
      } catch (err) {
        console.warn("[CREATE-WITH-CHEF] Could not fetch dietary restrictions:", err);
      }
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    let basePrompt = `You are a professional chef creating a personalized meal recipe.
${chefDietBlock ? `\n${chefDietBlock}\n` : ""}
TASK: Create a complete ${validMealType} recipe based on this request: "${description}"

REQUIREMENTS:
- Create a delicious, well-balanced meal that matches the user's description
- Include realistic ingredients with precise quantities
- Provide detailed step-by-step cooking instructions
- Include accurate nutritional estimates with SEPARATE carb types
- Make the recipe achievable for home cooks
${starchGuidance}
${vegetableStrategyGuidance ? `\n${vegetableStrategyGuidance}\n` : ''}
CARBOHYDRATE BREAKDOWN (CRITICAL):
- starchyCarbs: Carbs from rice, pasta, bread, potatoes, grains, beans, corn, oats
- fibrousCarbs: Carbs from vegetables, leafy greens, broccoli, peppers, onions, mushrooms
${hubCoupling?.promptFragment?.userPromptAddition || ''}
🚨 U.S. MEASUREMENT RULES (CRITICAL - NO GRAMS ALLOWED):
- Use ONLY these units: oz, lb, cup, tbsp, tsp, each (for eggs only), fl oz
- NEVER use grams (g), milliliters (ml), or metric units for ANY ingredient
- Proteins (chicken, beef, fish, pork): use oz (e.g., "6 oz chicken breast")
- Vegetables (broccoli, spinach, peppers, zucchini): use cup (e.g., "2 cup broccoli florets")
- Leafy greens: use cup (e.g., "3 cup mixed greens")
- Dense vegetables (asparagus, green beans): use oz (e.g., "8 oz asparagus")

FORMAT: Return as JSON object:
{
  "name": "Creative meal name based on the description",
  "description": "Brief 1-2 sentence appetizing description",
  "ingredients": [
    {"name": "chicken breast", "quantity": "6", "unit": "oz"},
    {"name": "broccoli florets", "quantity": "2", "unit": "cup"},
    {"name": "olive oil", "quantity": "1", "unit": "tbsp"}
  ],
  "instructions": "Detailed step-by-step cooking instructions as a single paragraph with numbered steps",
  "calories": number (realistic estimate 300-700),
  "protein": number (grams),
  "starchyCarbs": number (grams from starches: rice, pasta, bread, potatoes, grains),
  "fibrousCarbs": number (grams from vegetables and fibrous sources),
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

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    const hubSystemPrompt = hubCoupling?.promptFragment?.systemPrompt;
    const fallbackSystemPrompt = getSystemPromptForDiet(dietType || null);
    const systemPrompt = hubSystemPrompt || fallbackSystemPrompt;
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const MAX_REGENERATION_ATTEMPTS = 2;
    let finalMealData: any = null;
    let attemptCount = 0;
    let lastFixHint: string | null = null;

    while (attemptCount < MAX_REGENERATION_ATTEMPTS) {
      attemptCount++;
      
      const currentMessages = [...messages];
      if (lastFixHint) {
        currentMessages.push({ role: 'user', content: `IMPORTANT CORRECTION REQUIRED: ${lastFixHint}` });
        console.log(`🔄 Regeneration attempt ${attemptCount} with fix hint`);
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: currentMessages,
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });
      
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("No content received from OpenAI");
      }
      
      const mealData = JSON.parse(content);
      const starchyCarbs = typeof mealData.starchyCarbs === 'number' ? mealData.starchyCarbs : 0;
      const fibrousCarbs = typeof mealData.fibrousCarbs === 'number' ? mealData.fibrousCarbs : 0;
      const totalCarbs = (starchyCarbs + fibrousCarbs) || mealData.carbs || 35;
      
      const tempMeal: UnifiedMeal = {
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
        carbs: totalCarbs,
        starchyCarbs,
        fibrousCarbs,
        fat: mealData.fat || 15,
        cookingTime: mealData.cookingTime || '25 minutes',
        difficulty: mealData.difficulty || 'Easy',
        imageUrl: '',
        medicalBadges: [],
        source: 'ai'
      };

      if (effectiveHubType && hubCoupling?.guardrails) {
        const hubValidation = validateMealForHub(tempMeal, effectiveHubType, hubCoupling.guardrails);
        if (hasHardViolations(hubValidation)) {
          console.warn(`🚨 Attempt ${attemptCount}: Hub validation failed - ${hubValidation.violations.map(v => v.message).join(', ')}`);
          if (attemptCount < MAX_REGENERATION_ATTEMPTS) {
            lastFixHint = getRegenerationHint(effectiveHubType, hubValidation.violations);
            continue;
          } else {
            console.error(`❌ Hub guardrails exhausted after ${attemptCount} attempts - falling back to safe template`);
            throw new Error(`Hub validation failed after ${MAX_REGENERATION_ATTEMPTS} attempts`);
          }
        } else if (hubValidation.violations.length > 0) {
          console.warn(`⚠️ Hub validation soft warnings: ${hubValidation.violations.map(v => v.message).join(', ')}`);
        }
      } else if (dietType) {
        const validation = validateMealForDiet(tempMeal, dietType);
        if (!validation.isValid) {
          console.warn(`⚠️ Meal has legacy guardrail violations: ${validation.violations.join(', ')}`);
        }
      }

      // POST-GENERATION dietary hard filter (vegan/vegetarian/pescatarian)
      if (chefDietRestrictions.length > 0) {
        const mealText = `${tempMeal.name} ${tempMeal.ingredients.map((i: any) => i.name).join(' ')}`;
        const { violates, reasons } = violatesDietaryConstraints(mealText, chefDietRestrictions);
        if (violates) {
          console.warn(`⚠️ [DIET GUARD] Create-With-Chef: ${reasons.join(", ")} — diet: ${chefDietRestrictions.join("|")}`);
          if (attemptCount < MAX_REGENERATION_ATTEMPTS) {
            lastFixHint = `DIETARY VIOLATION DETECTED. The user follows a strict ${chefDietRestrictions[0]} diet. Issues found: ${reasons.join(", ")}. Regenerate with a fully ${chefDietRestrictions[0]}-compliant recipe that contains ZERO animal products.`;
            continue;
          }
        }
      }

      finalMealData = { ...mealData, starchyCarbs, fibrousCarbs, totalCarbs };
      break;
    }
    
    if (!finalMealData) {
      throw new Error("Failed to generate valid meal after regeneration attempts");
    }

    let imageUrl = getFallbackImage(validMealType);
    try {
      const generatedImage = await generateImage({
        name: finalMealData.name,
        description: finalMealData.description,
        type: 'meal',
        style: 'homemade',
        ingredients: finalMealData.ingredients?.map((ing: any) => ing.name) || [],
        calories: finalMealData.calories,
        protein: finalMealData.protein,
        carbs: finalMealData.totalCarbs,
        fat: finalMealData.fat,
      });
      
      if (generatedImage) {
        imageUrl = generatedImage;
        console.log(`🖼️ Generated DALL-E image for Create With Chef: ${finalMealData.name}`);
      }
    } catch (imgError) {
      console.warn('⚠️ DALL-E image generation failed, using fallback:', imgError);
    }
    
    const unifiedMeal: UnifiedMeal = {
      id: `chef-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: finalMealData.name,
      description: finalMealData.description,
      ingredients: (finalMealData.ingredients || []).map((ing: any) => ({
        name: ing.name,
        quantity: String(ing.quantity || ''),
        unit: ing.unit || ''
      })),
      instructions: finalMealData.instructions,
      calories: finalMealData.calories || 400,
      protein: finalMealData.protein || 25,
      carbs: finalMealData.totalCarbs,
      starchyCarbs: finalMealData.starchyCarbs,
      fibrousCarbs: finalMealData.fibrousCarbs,
      fat: finalMealData.fat || 15,
      cookingTime: finalMealData.cookingTime || '25 minutes',
      difficulty: finalMealData.difficulty || 'Easy',
      imageUrl,
      medicalBadges: [],
      source: 'ai'
    };
    
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
      starchyCarbs: 0,
      fibrousCarbs: 0,
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
    await ensureHubsRegistered();
    
    let snackHubCoupling: HubCouplingResult | null = null;
    let snackEffectiveHubType: HubType | null = null;
    
    if (userId) {
      if (isValidHubType(dietType)) {
        snackEffectiveHubType = dietType;
      } else {
        snackEffectiveHubType = await detectHubTypeFromProfile(userId);
      }
      
      if (snackEffectiveHubType) {
        try {
          snackHubCoupling = await resolveHubCoupling(snackEffectiveHubType, userId, 'snack');
          if (snackHubCoupling) {
            console.log(`🔌 Snack hub coupling loaded for ${snackEffectiveHubType}`);
          }
        } catch (err) {
          console.warn(`⚠️ Failed to load hub coupling for snack, continuing without:`, err);
        }
      }
    }
    
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
- Include accurate nutritional estimates with SEPARATE carb types
- Make it quick and easy to prepare (under 10 minutes)

CARBOHYDRATE BREAKDOWN (CRITICAL):
- starchyCarbs: Carbs from rice, pasta, bread, potatoes, grains, beans, corn, oats, crackers
- fibrousCarbs: Carbs from vegetables, leafy greens, fruits, berries
${snackHubCoupling?.promptFragment?.userPromptAddition || ''}
🚨 U.S. MEASUREMENT RULES (CRITICAL - NO GRAMS ALLOWED):
- Use ONLY these units: oz, lb, cup, tbsp, tsp, each, fl oz
- NEVER use grams (g), milliliters (ml), or metric units for ANY ingredient
- Fruits: use cup or each (e.g., "1 cup berries", "1 each apple")
- Vegetables: use cup (e.g., "1 cup carrot sticks", "1/2 cup celery")
- Nuts/seeds: use oz or tbsp (e.g., "1 oz almonds", "2 tbsp sunflower seeds")
- Yogurt/dairy: use cup or oz (e.g., "1 cup Greek yogurt", "4 oz cottage cheese")

FORMAT: Return as JSON object:
{
  "name": "Creative snack name that sounds appetizing",
  "description": "Brief 1-2 sentence appetizing description explaining how this satisfies the craving",
  "ingredients": [
    {"name": "Greek yogurt", "quantity": "1", "unit": "cup"},
    {"name": "mixed berries", "quantity": "1/2", "unit": "cup"},
    {"name": "almonds", "quantity": "1", "unit": "oz"}
  ],
  "instructions": "Clear step-by-step preparation instructions as a single paragraph with numbered steps. Even simple snacks need instructions.",
  "calories": number (realistic 100-300),
  "protein": number (grams),
  "starchyCarbs": number (grams from starches: crackers, oats, bread, granola),
  "fibrousCarbs": number (grams from vegetables, fruits, berries),
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

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    const snackHubSystemPrompt = snackHubCoupling?.promptFragment?.systemPrompt;
    const snackFallbackSystemPrompt = getSystemPromptForDiet(dietType || null);
    const systemPrompt = snackHubSystemPrompt || snackFallbackSystemPrompt;
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const SNACK_MAX_REGENERATION_ATTEMPTS = 2;
    let finalSnackData: any = null;
    let snackAttemptCount = 0;
    let snackLastFixHint: string | null = null;

    while (snackAttemptCount < SNACK_MAX_REGENERATION_ATTEMPTS) {
      snackAttemptCount++;
      
      const currentMessages = [...messages];
      if (snackLastFixHint) {
        currentMessages.push({ role: 'user', content: `IMPORTANT CORRECTION REQUIRED: ${snackLastFixHint}` });
        console.log(`🔄 Snack regeneration attempt ${snackAttemptCount} with fix hint`);
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: currentMessages,
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });
      
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("No content received from OpenAI");
      }
      
      const snackData = JSON.parse(content);
      const snackStarchyCarbs = typeof snackData.starchyCarbs === 'number' ? snackData.starchyCarbs : 0;
      const snackFibrousCarbs = typeof snackData.fibrousCarbs === 'number' ? snackData.fibrousCarbs : 0;
      const snackTotalCarbs = (snackStarchyCarbs + snackFibrousCarbs) || snackData.carbs || 15;
      
      const tempSnack: UnifiedMeal = {
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
        carbs: snackTotalCarbs,
        starchyCarbs: snackStarchyCarbs,
        fibrousCarbs: snackFibrousCarbs,
        fat: snackData.fat || 6,
        cookingTime: snackData.cookingTime || '5 minutes',
        difficulty: 'Easy',
        imageUrl: '',
        medicalBadges: [],
        source: 'ai'
      };

      if (snackEffectiveHubType && snackHubCoupling?.guardrails) {
        const snackHubValidation = validateMealForHub(tempSnack, snackEffectiveHubType, snackHubCoupling.guardrails);
        if (hasHardViolations(snackHubValidation)) {
          console.warn(`🚨 Snack attempt ${snackAttemptCount}: Hub validation failed - ${snackHubValidation.violations.map(v => v.message).join(', ')}`);
          if (snackAttemptCount < SNACK_MAX_REGENERATION_ATTEMPTS) {
            snackLastFixHint = getRegenerationHint(snackEffectiveHubType, snackHubValidation.violations);
            continue;
          } else {
            console.error(`❌ Snack hub guardrails exhausted after ${snackAttemptCount} attempts - falling back to safe template`);
            throw new Error(`Snack hub validation failed after ${SNACK_MAX_REGENERATION_ATTEMPTS} attempts`);
          }
        } else if (snackHubValidation.violations.length > 0) {
          console.warn(`⚠️ Snack hub validation soft warnings: ${snackHubValidation.violations.map(v => v.message).join(', ')}`);
        }
      } else if (dietType) {
        const validation = validateMealForDiet(tempSnack, dietType);
        if (!validation.isValid) {
          console.warn(`⚠️ Snack has legacy guardrail violations: ${validation.violations.join(', ')}`);
        }
      }

      finalSnackData = { ...snackData, snackStarchyCarbs, snackFibrousCarbs, snackTotalCarbs };
      break;
    }
    
    if (!finalSnackData) {
      throw new Error("Failed to generate valid snack after regeneration attempts");
    }

    let imageUrl = getFallbackImage('snack');
    try {
      const generatedImage = await generateImage({
        name: finalSnackData.name,
        description: finalSnackData.description,
        type: 'meal',
        style: 'homemade',
        ingredients: finalSnackData.ingredients?.map((ing: any) => ing.name) || [],
        calories: finalSnackData.calories,
        protein: finalSnackData.protein,
        carbs: finalSnackData.snackTotalCarbs,
        fat: finalSnackData.fat,
      });
      
      if (generatedImage) {
        imageUrl = generatedImage;
        console.log(`🖼️ Generated DALL-E image for Snack Creator: ${finalSnackData.name}`);
      }
    } catch (imgError) {
      console.warn('⚠️ DALL-E image generation failed for snack, using fallback:', imgError);
    }
    
    const unifiedSnack: UnifiedMeal = {
      id: `snack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: finalSnackData.name,
      description: finalSnackData.description,
      ingredients: (finalSnackData.ingredients || []).map((ing: any) => ({
        name: ing.name,
        quantity: String(ing.quantity || ''),
        unit: ing.unit || ''
      })),
      instructions: finalSnackData.instructions,
      calories: finalSnackData.calories || 150,
      protein: finalSnackData.protein || 8,
      carbs: finalSnackData.snackTotalCarbs,
      starchyCarbs: finalSnackData.snackStarchyCarbs,
      fibrousCarbs: finalSnackData.snackFibrousCarbs,
      fat: finalSnackData.fat || 6,
      cookingTime: finalSnackData.cookingTime || '5 minutes',
      difficulty: 'Easy',
      imageUrl,
      medicalBadges: [],
      source: 'ai'
    };
    
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
      starchyCarbs: 0,
      fibrousCarbs: 0,
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

  // 🚨 SAFETY INTELLIGENCE LAYER: Pre-generation enforcement
  // This MUST run before ANY AI generation to protect users with allergies
  // Skip if safety was already checked at route level (e.g., with override token)
  if (request.userId && !request.safetyAlreadyChecked) {
    const inputText = Array.isArray(request.input) ? request.input.join(' ') : request.input;
    const safetyCheck = await enforceSafetyProfile(request.userId, inputText, `unified-${request.type}`);
    
    if (safetyCheck.result === 'BLOCKED') {
      console.log(`🚫 [SAFETY] Blocked request for user ${request.userId}: ${safetyCheck.blockedTerms.join(', ')}`);
      return {
        success: false,
        source: 'error',
        error: safetyCheck.message,
        safetyBlocked: true,
        blockedTerms: safetyCheck.blockedTerms,
        suggestion: safetyCheck.suggestion
      };
    }
    
    if (safetyCheck.result === 'AMBIGUOUS') {
      console.log(`⚠️ [SAFETY] Ambiguous request for user ${request.userId}: ${safetyCheck.ambiguousTerms.join(', ')}`);
      // For ambiguous dishes (like jambalaya, pad thai), return warning to user
      return {
        success: false,
        source: 'error',
        error: safetyCheck.message,
        safetyAmbiguous: true,
        ambiguousTerms: safetyCheck.ambiguousTerms,
        suggestion: safetyCheck.suggestion
      };
    }
  } else if (request.safetyAlreadyChecked) {
    console.log(`✅ [SAFETY] Skipping internal check - already verified at route level with override token`);
  }

  // Generate the meal
  let result: MealGenerationResponse;
  switch (request.type) {
    case 'craving':
      const cravingInput = Array.isArray(request.input) 
        ? request.input.join(', ') 
        : request.input;
      result = await generateCravingMealUnified(cravingInput, request.mealType, request.userId);
      break;

    case 'create-with-chef':
      const chefDescription = Array.isArray(request.input) 
        ? request.input.join(', ') 
        : request.input;
      result = await generateFromDescriptionUnified(chefDescription, request.mealType, request.userId, request.dietType, request.starchContext, request.nutritionStrategy);
      break;

    case 'snack-creator':
      const snackCraving = Array.isArray(request.input) 
        ? request.input.join(', ') 
        : request.input;
      result = await generateSnackFromCravingUnified(snackCraving, request.userId, request.dietType);
      break;

    case 'fridge-rescue':
    case 'premade':
      const fridgeItems = Array.isArray(request.input) 
        ? request.input 
        : request.input.split(',').map(s => s.trim());
      const useFallbackOnly = request.type === 'premade';
      result = await generateFridgeRescueUnified(
        fridgeItems, 
        request.mealType, 
        request.userId,
        request.macroTargets,
        request.count || 1,
        useFallbackOnly
      );
      break;

    default:
      return {
        success: false,
        source: 'fallback',
        error: `Unknown generation type: ${request.type}`
      };
  }

  // 🚨 POST-GENERATION VALIDATION: Scan output for allergens that slipped through
  // Skip if safety was already checked with override token (user acknowledged the risk)
  if (request.userId && result.success && !request.safetyAlreadyChecked) {
    const { loadSafetyProfile, validateGeneratedMeal: validateMeal } = await import('./safetyProfileService');
    const profile = await loadSafetyProfile(request.userId);
    
    if (profile) {
      // Helper to validate a single meal
      const validateSingleMeal = (meal: UnifiedMeal) => {
        const mealForValidation = {
          name: meal.name,
          description: meal.description,
          ingredients: meal.ingredients,
          instructions: Array.isArray(meal.instructions) 
            ? meal.instructions 
            : meal.instructions ? [meal.instructions] : []
        };
        return validateMeal(mealForValidation, profile);
      };
      
      // Validate single meal
      if (result.meal) {
        const validation = validateSingleMeal(result.meal);
        if (validation.result === 'BLOCKED') {
          console.log(`🚫 [POST-GENERATION] Blocked meal "${result.meal.name}" for user ${request.userId}: ${validation.blockedTerms.join(', ')}`);
          return {
            success: false,
            source: 'error',
            error: `Generated meal contains ${validation.blockedTerms[0]} which conflicts with your allergy profile. Please try a different request.`,
            safetyBlocked: true,
            blockedTerms: validation.blockedTerms,
            suggestion: validation.suggestion
          };
        }
      }
      
      // Validate array of meals (weekly plans, batch generation)
      if (result.meals && result.meals.length > 0) {
        const safeMeals: UnifiedMeal[] = [];
        const blockedMeals: string[] = [];
        
        for (const meal of result.meals) {
          const validation = validateSingleMeal(meal);
          if (validation.result === 'BLOCKED') {
            console.log(`🚫 [POST-GENERATION] Filtered out meal "${meal.name}" for user ${request.userId}: ${validation.blockedTerms.join(', ')}`);
            blockedMeals.push(meal.name);
          } else {
            safeMeals.push(meal);
          }
        }
        
        // If all meals were blocked, return error
        if (safeMeals.length === 0) {
          return {
            success: false,
            source: 'error',
            error: `All generated meals contained ingredients that conflict with your allergy profile. Please try a different request.`,
            safetyBlocked: true
          };
        }
        
        // Return only safe meals (silently filter out blocked ones)
        result.meals = safeMeals;
        if (blockedMeals.length > 0) {
          console.log(`⚠️ [POST-GENERATION] Filtered ${blockedMeals.length} unsafe meals for user ${request.userId}`);
        }
      }
    }
  }

  return result;
}
