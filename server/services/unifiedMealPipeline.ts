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
import { loadUserProtocolEnvelope, enforceBeforeGenerate, scanGeneratedOutput, buildGuestEnvelope } from './protocolEnvelope';
import { buildVegetableStrategyPrompt, NutritionStrategyContext, buildStrictModeBlock } from './promptBuilder';
import { getDeterministicFallback, findMatchingTemplates, templateToMeal } from './templateMatcher';
import { STARCHY_KEYWORDS } from '../../shared/starchKeywords';
import { createIngredientSignature, hashSignature } from './ingredientSignature';
import { getCachedMeals, cacheMeals } from './mealCachePersistent';
import { generateFridgeRescueMeals } from './fridgeRescueGenerator';
import { applyGuardrails, validateMealForDiet, getSystemPromptForDiet, DietType, BuilderMode } from './guardrails';
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
  getPrimaryDiet,
  applyDietarySubstitutions,
  RESTRICTION_EXPANSION,
  AVOIDANCE_EXPANSION,
} from './allergyGuardrails';
import { validateDietaryRestriction, type DietaryMode } from './guardrails/validators/dietaryRestrictionValidator';
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
import { resolveAICarbsStrict } from './guardrails/macroTruthContract';
import { macroAudit, macroAuditPrompt, macroAuditCache } from '../utils/macroAuditLogger';
import { derivePreferenceProfile, buildBehavioralMemoryPromptSection } from './behavioralMemoryService';
import { buildOncologySupportPrompt, isOncologySupportEnabled, type OncologySupportContext } from './guardrails/prompt/oncologySupportPromptBuilder';
import { validateOncologyMealSafety, filterOncologySafeMeals } from './guardrails/validators/oncologySupportValidator';
import { filterByStarchStructure, validateStarchStructure, buildStarchFixHint } from './guardrails/validators/vegetarianMacroValidator';
import { scoreOncologyMealQuality } from './guardrails/validators/oncologyQualityScorer';
import { scoreOncologySnackQuality } from './guardrails/validators/oncologySnackScorer';
import { buildDishTypeHint, getSemanticFallback, buildStableCacheKey, generateMealImageUnified } from './mealImageGenerator';
import { normalizeMealName, culturalNameTransform } from './mealNameNormalizer';
import { mealImageCache } from '../db/schema/mealImageCache';

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE PERSISTENCE HELPER
// Wraps imageService's generateImage with DB cache (check → generate → save).
// Prevents different images on server restart. Layer 2: removes description bleed.
// ─────────────────────────────────────────────────────────────────────────────

async function generateImageCached(
  name: string,
  ingredients: string[],
  type: string,
  style: string,
  extraParams?: Record<string, any>
): Promise<string | null> {
  // NORMALIZATION — applied before cache key derivation and prompt construction
  const name_ = normalizeMealName(name);
  const cacheKey = buildStableCacheKey(name_, ingredients);

  try {
    const [dbRow] = await db
      .select({ imageUrl: mealImageCache.imageUrl })
      .from(mealImageCache)
      .where(eq(mealImageCache.cacheKey, cacheKey))
      .limit(1);

    if (dbRow) {
      console.log(`🗄️ [pipeline] DB cache hit for: ${name_}`);
      return dbRow.imageUrl;
    }
  } catch (e) {
    console.warn(`⚠️ [pipeline] DB cache read failed for "${name_}":`, e);
  }

  const dishHint = buildDishTypeHint(name_);

  let imageUrl: string | null = null;
  try {
    const result = await Promise.race([
      generateImage({
        name: name_,
        description: dishHint,
        type,
        style,
        ingredients,
        ...extraParams,
      }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Image generation timeout")), 8000)
      ),
    ]);
    imageUrl = result ?? null;
  } catch (e: any) {
    console.warn(`⚠️ [pipeline] generateImage failed for "${name_}": ${e.message}`);
  }

  if (!imageUrl) {
    return getSemanticFallback(name_);
  }

  try {
    await db
      .insert(mealImageCache)
      .values({ cacheKey, imageUrl, mealName: name_, promptUsed: dishHint })
      .onConflictDoNothing();
  } catch (e) {
    console.warn(`⚠️ [pipeline] DB cache write failed for "${name_}":`, e);
  }

  return imageUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// AVOIDANCE PROMPT BLOCK BUILDER
// Expands user avoidance categories into concrete ingredient lists for injection.
// ─────────────────────────────────────────────────────────────────────────────

function buildVarietyAvoidanceBlock(avoidList: string[]): string {
  if (!avoidList?.length) return "";
  const expanded = new Set<string>();
  for (const item of avoidList) {
    const key = item.trim().toLowerCase();
    expanded.add(key);
    const mapped = AVOIDANCE_EXPANSION[key];
    if (mapped) mapped.forEach(t => expanded.add(t));
  }
  const list = Array.from(expanded).join(", ");
  return `\n⛔ FOODS TO AVOID — ABSOLUTE RULE (applies to ALL 3 options, overrides everything including the user's craving):
The user has marked these as foods they do not eat: ${list}
- Do NOT include any of these as a main ingredient, in a sauce, broth, seasoning, garnish, or coating.
- If the user's craving is itself an avoided food (e.g. "lobster" when seafood is avoided), substitute with a compliant protein and keep the dish style.
- This rule has NO exceptions across all 3 options.\n`;
}

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
  carbs: number | null; // Total carbs — null means unknown (AI did not provide). NEVER invented.
  starchyCarbs?: number; // Nutrition Schema v1.1: Rice, pasta, bread, potatoes, etc.
  fibrousCarbs?: number; // Nutrition Schema v1.1: Vegetables, leafy greens, etc.
  fat: number;
  cookingTime?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  imageUrl: string; // ALWAYS present
  substitutionNotes?: string[]; // Smart Substitutions: explains ingredient swaps made for nutrition strategy
  medicalBadges?: Array<{
    id: string;
    label: string;
    description: string;
    color: string;
    textColor: string;
    category: string;
  }>;
  source?: 'ai' | 'catalog' | 'fallback';
  /**
   * True only when post-generation dietary validation confirmed full compliance
   * for vegan / vegetarian / pescatarian diets (isValid: true AND confidence: high).
   * Undefined / false means the badge should NOT be shown.
   */
  dietaryComplianceVerified?: boolean;
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

export interface ExplicitOverride {
  item: string;
  confirmed: boolean;
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
  dietPhase?: string; // Phase for phase-aware builders (e.g. BeachBody: 'lean' | 'carb-control' | 'maintenance' | 'sculpt')
  /**
   * Remaining macro budget for today. When provided, the AI generates
   * within these values — not the baseline daily targets.
   * Used by BeachBody (and future builders) for real-time budget awareness.
   */
  remainingMacros?: {
    protein?: number;
    carbs?: number;
    fat?: number;
    calories?: number;
  };
  starchContext?: StarchContext; // Starch Game Plan context for intelligent carb distribution
  diversityContext?: { usedBases: Record<string, number>; usedTypes: Record<string, number> } | null; // Meal diversity tracking
  nutritionStrategy?: NutritionStrategyContext; // Vegetable system + cut intensity guardrails
  safetyAlreadyChecked?: boolean; // Skip internal safety check if route already verified with override token
  strictMode?: boolean; // "Keep It Simple" — AI uses ONLY user-listed ingredients, no additions
  skipImage?: boolean; // Skip DALL-E generation — client handles image async via /api/meals/generate-image
  explicitOverride?: ExplicitOverride | null; // User confirmed override for a builder guardrail conflict
  /**
   * Controls how remainingMacros is presented to the AI.
   * - targeted: hard ceiling (BeachBody, GLP-1, Anti-Inflammatory, Diabetic)
   * - lifestyle: guidance only (General Nutrition, Weekly)
   * - hybrid: strong aim with small deviation allowed (Performance)
   */
  builderMode?: BuilderMode;
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
  // 1) Trust ONLY static local image paths (templates, fallbacks, snack assets).
  //    AI-generated S3 URLs are NOT trusted here — they bypass the cache pipeline
  //    and may serve stale wrong images (e.g., a salad for a smoothie).
  //    S3/AI URLs fall through to generateImageCached which validates via versioned
  //    cache keys, regenerating only when the cached version is stale or wrong.
  const storedUrl = meal.imageUrl;
  if (storedUrl && storedUrl.startsWith('/images/')) {
    return storedUrl; // static local asset — always correct, no regeneration needed
  }
  // AI-generated URLs (S3, temp DALL-E) intentionally fall through to cache pipeline.

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

    const imageUrl = await generateImageCached(
      visual.title,
      visual.keyFoods,
      "meal",
      visual.style,
    );

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
  dietaryRestrictionsOverride?: string[],
  strictMode: boolean = false
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
  // Kosher category intent: inject DAIRY/MEAT/PAREVE block so the AI
  // never auto-converts explicit dairy (butter, milk) to pareve/coconut milk.
  const cravingKosherIntent = detectKosherCategoryIntent(cravingDietRestrictions, cravingInput);
  if (cravingKosherIntent) {
    cravingDietBlock += (cravingDietBlock ? '\n' : '') + buildKosherCategoryBlock(cravingKosherIntent);
    console.log(`🕍 [CRAVING] Kosher category intent: ${cravingKosherIntent}`);
  }
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
    macroAuditCache(cached.meals[0]?.name ?? cravingInput, "hit", signature, { carbs: cached.meals[0]?.carbs });
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

      // When the user is on the Cancer Support protocol, inject a clinical
      // transformation block so the AI targets quality ingredients from the start.
      const isOncologyCraving = cravingDietRestrictions.includes('oncology-support');
      const oncologyCravingBlock = isOncologyCraving
        ? `\nCANCER SUPPORT PROTOCOL — MANDATORY CRAVING TRANSFORMATION:
You are NOT generating a standard meal. You are transforming the user's craving into a clinically-safe, anti-cancer version.
TRANSFORMATION RULES (follow ALL of them):
- "pancakes" or "cake" or "pastry" → Use rolled oats, eggs, and mashed banana or berries. NEVER all-purpose flour or granulated sugar.
- "cookies" or "brownies" or "dessert" → Greek yogurt or cottage cheese base with berries, walnuts, dark chocolate (70%+), chia seeds.
- "pizza" → Egg-based or cauliflower crust with vegetables and lean protein.
- "pasta" → Zucchini noodles, spaghetti squash, or quinoa base.
- "fried food" → Oven-baked or air-fried with almond flour or oats coating.
FORBIDDEN INGREDIENTS: all-purpose flour, white flour, granulated sugar, powdered sugar, corn syrup, white bread, white rice.
REQUIRED STRUCTURE FOR EVERY MEAL:
1. PROTEIN: ≥20g from eggs, chicken, salmon, Greek yogurt, tofu, lentils, or chickpeas
2. FIBER ANCHOR: quinoa, oats, lentils, chickpeas, sweet potato, or brown rice
3. ANTI-INFLAMMATORY VEG: broccoli, kale, spinach, mushrooms, or bell peppers
4. HEALTHY FAT: olive oil, avocado, tahini, or nuts
5. THERAPEUTIC BOOSTER: garlic, turmeric, ginger, berries, lemon, or fresh herbs
`
        : '';
      
      const prompt = `You are a creative chef helping someone satisfy their food craving.
${cravingDietBlock ? `\n${cravingDietBlock}\n` : ""}${oncologyCravingBlock}${strictMode ? `\n${buildStrictModeBlock(cravingInput)}\n` : ""}
CRAVING: "${cravingInput}"
MEAL TYPE: ${validMealType}

Create ONE delicious meal that perfectly satisfies this craving. The meal should be:
- Realistic and cookable at home
- Focused on the craving flavors/ingredients mentioned
- Balanced and nutritious

INGREDIENT MEASUREMENT RULES (NON-NEGOTIABLE):
Every ingredient MUST use a precise, measurable quantity:
- Proteins (chicken, beef, fish): ALWAYS oz — e.g. "6 oz chicken breast"
- Potatoes/yams: ALWAYS oz — e.g. "5 oz sweet potato" (NEVER "1 potato" or "each")
- Rice/grains: cooked weight in oz — e.g. "4 oz cooked rice"
- Eggs: MUST include size — e.g. "3 large eggs" (NEVER just "2 eggs")
- Garlic: ALWAYS cloves — e.g. "4 cloves garlic" (NEVER "units", "each", "medium")
- Onions / shallots: ALWAYS cup — e.g. "1 cup diced onion" (NEVER "1 medium onion")
- Oils/sauces: tbsp or tsp — e.g. "1 tbsp olive oil"
- Liquids: cup or fl oz — e.g. "8 fl oz almond milk"
FORBIDDEN: "each", "piece", "serving", "handful", "unit", "units", "medium", "large", "small" as units

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
      // Total carbs: resolveAICarbsStrict returns null if AI provided no carb data (never invents a value)
      const totalCarbs = resolveAICarbsStrict(aiMeal);
      macroAudit("ai_raw", aiMeal.name ?? cravingInput, { carbs: totalCarbs, protein: aiMeal.protein, calories: aiMeal.calories }, { source: "craving-ai" });
      
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
      let unifiedMeal = enforceCarbs(rawMeal);
      let cravingDietaryComplianceVerified = false;

      // POST-GENERATION dietary validation (vegan / vegetarian / pescatarian)
      // Order: validate → substitute (max 1 pass) → re-validate → single AI regeneration
      const cravingPrimaryDiet = getPrimaryDiet(cravingDietRestrictions);
      if (cravingPrimaryDiet && ['vegan', 'vegetarian', 'pescatarian'].includes(cravingPrimaryDiet)) {
        let cravingDietValidation = validateDietaryRestriction(
          { name: unifiedMeal.name, ingredients: unifiedMeal.ingredients },
          cravingPrimaryDiet as DietaryMode,
        );

        if (!cravingDietValidation.isValid || cravingDietValidation.confidence === 'low') {
          // Step A: substitution pass (max 1)
          if (cravingDietValidation.violations.length > 0) {
            const { ingredients: subIngredients, substitutionsApplied } = applyDietarySubstitutions(
              unifiedMeal.ingredients,
              cravingPrimaryDiet as DietaryMode,
            );
            if (substitutionsApplied.length > 0) {
              console.log(`🔄 [DIET GUARD] Craving substitution pass for ${cravingPrimaryDiet}: ${substitutionsApplied.map(s => `${s.original} → ${s.replacement}`).join(', ')}`);
              unifiedMeal = { ...unifiedMeal, ingredients: subIngredients };
              cravingDietValidation = validateDietaryRestriction(
                { name: unifiedMeal.name, ingredients: unifiedMeal.ingredients },
                cravingPrimaryDiet as DietaryMode,
              );
            }
          }

          // Step B: single AI regeneration if still invalid
          if (!cravingDietValidation.isValid || cravingDietValidation.confidence === 'low') {
            console.warn(`⚠️ [DIET GUARD] Craving ${cravingPrimaryDiet} violation: ${cravingDietValidation.violations.join('; ')} — triggering single regeneration`);
            try {
              const openai = getOpenAI();
              const fixHint = `DIETARY VIOLATION DETECTED. This user strictly follows a ${cravingPrimaryDiet.toUpperCase()} diet. ` +
                `Violations: ${cravingDietValidation.violations.join('; ')}. ` +
                `Regenerate a fully compliant ${cravingPrimaryDiet} meal for the craving "${cravingInput}". ` +
                `FORBIDDEN: ${(RESTRICTION_EXPANSION[cravingPrimaryDiet] || []).join(', ')}.`;
              const regenResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  { role: 'user', content: fixHint },
                ],
                response_format: { type: "json_object" },
                max_tokens: 1500,
              });
              const regenContent = regenResponse.choices?.[0]?.message?.content;
              if (regenContent) {
                const regenMeal = JSON.parse(regenContent);
                const regenNormalized = normalizeIngredients(regenMeal.ingredients || []);
                const regenRaw: UnifiedMeal = {
                  ...unifiedMeal,
                  name: regenMeal.name || unifiedMeal.name,
                  description: regenMeal.description || unifiedMeal.description,
                  ingredients: regenNormalized,
                  instructions: regenMeal.instructions || unifiedMeal.instructions,
                };
                const regenValidation = validateDietaryRestriction(
                  { name: regenRaw.name, ingredients: regenRaw.ingredients },
                  cravingPrimaryDiet as DietaryMode,
                );
                if (regenValidation.isValid && regenValidation.confidence !== 'low') {
                  console.log(`✅ [DIET GUARD] Craving regeneration succeeded — ${cravingPrimaryDiet} compliant: ${regenRaw.name}`);
                  unifiedMeal = enforceCarbs(regenRaw);
                  cravingDietaryComplianceVerified = true;
                } else {
                  console.error(`❌ [DIET GUARD] Craving regeneration still non-compliant for ${cravingPrimaryDiet} — badge suppressed`);
                }
              }
            } catch (regenErr) {
              console.warn(`⚠️ [DIET GUARD] Craving regeneration attempt failed:`, regenErr);
            }
          } else {
            console.log(`✅ [DIET GUARD] Craving ${cravingPrimaryDiet} compliance confirmed after substitution — confidence: ${cravingDietValidation.confidence}`);
            cravingDietaryComplianceVerified = true;
          }
        } else {
          console.log(`✅ [DIET GUARD] Craving ${cravingPrimaryDiet} compliance confirmed — confidence: ${cravingDietValidation.confidence}`);
          cravingDietaryComplianceVerified = true;
        }

        unifiedMeal = { ...unifiedMeal, dietaryComplianceVerified: cravingDietaryComplianceVerified };
        if (cravingDietaryComplianceVerified) {
          console.log(`🌿 [DIET GUARD] ${cravingPrimaryDiet} badge authorized for craving: ${unifiedMeal.name}`);
        }
      }

      // ── Oncology quality gate for craving creator — 2-retry escalation ────
      // Matches the same standard as Create With Chef: 85+ to display.
      // Attempt 1: specific component correction hints.
      // Attempt 2: structural reset — transform the craving into a proven template.
      if (cravingDietRestrictions.includes('oncology-support')) {
        const ONCOLOGY_CRAVING_MAX_RETRIES = 2;
        let oncologyCravingAttempt = 0;
        let currentMeal = unifiedMeal;

        while (oncologyCravingAttempt < ONCOLOGY_CRAVING_MAX_RETRIES) {
          const cravingQuality = scoreOncologyMealQuality({
            name: currentMeal.name,
            ingredients: currentMeal.ingredients,
            description: currentMeal.description,
            protein: currentMeal.protein,
          });

          console.log(`🧬 [ONCOLOGY CRAVING] Attempt ${oncologyCravingAttempt + 1} — Score: ${cravingQuality.total}/100 — tier: ${cravingQuality.tier} — caps: [${cravingQuality.breakdown.caps.join(', ') || 'none'}]`);

          if (cravingQuality.approvedForDisplay) {
            // Passed — use this meal
            unifiedMeal = currentMeal;
            break;
          }

          // Score too low — build escalating correction hint
          let correctionHint: string;
          if (oncologyCravingAttempt === 0) {
            // Attempt 1: specific component hints from the scorer
            correctionHint =
              "CANCER SUPPORT QUALITY CORRECTION (Attempt 1). " +
              (cravingQuality.regenerationHint || "") +
              ` Original craving: "${cravingInput}". Honor the spirit of the craving with a healthy transformation. ` +
              "NEVER use all-purpose flour, granulated sugar, or refined carbs. " +
              "Use oats, almond flour, or protein powder instead of flour. Use banana, berries, or dates instead of sugar.";
          } else {
            // Attempt 2: structural reset — stop trying to adjust, build from scratch
            correctionHint =
              "STRUCTURAL RESET — FINAL ATTEMPT. The previous version failed Cancer Support standards. " +
              "Do NOT try to fix the previous meal. BUILD A NEW MEAL that satisfies the craving concept safely. " +
              `Craving: "${cravingInput}". ` +
              "TRANSFORMATION RULES: " +
              "'pancakes' or 'cake' → protein oat pancakes: 3 large eggs + 1/2 cup rolled oats + 1 mashed banana + blueberries + cinnamon. " +
              "'cookies' or 'brownies' → Greek yogurt parfait: 1 cup Greek yogurt + berries + walnuts + chia seeds + cacao nibs. " +
              "'pizza' → open-face egg white omelet with vegetables and herbs. " +
              "'pasta' → zucchini noodles or quinoa base with salmon and vegetables. " +
              "REQUIRED STRUCTURE: protein (eggs/Greek yogurt/salmon) + fiber anchor (oats/quinoa/lentils) + vegetables + healthy fat + therapeutic booster (garlic/turmeric/berries/herbs). " +
              "NO all-purpose flour. NO granulated sugar. NO refined carbs.";
          }

          console.warn(`🔄 [ONCOLOGY CRAVING] Score ${cravingQuality.total}/100 — escalation attempt ${oncologyCravingAttempt + 1}`);

          try {
            const openai = getOpenAI();
            const correctionResponse = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                { role: 'user', content: prompt },
                { role: 'assistant', content: JSON.stringify({ name: currentMeal.name, description: currentMeal.description }) },
                { role: 'user', content: correctionHint },
              ],
              response_format: { type: "json_object" },
              max_tokens: 1500,
            });
            const corrContent = correctionResponse.choices?.[0]?.message?.content;
            if (corrContent) {
              const corrMeal = JSON.parse(corrContent);
              const corrNormalized = normalizeIngredients(corrMeal.ingredients || []);
              currentMeal = enforceCarbs({
                ...currentMeal,
                name: corrMeal.name || currentMeal.name,
                description: corrMeal.description || currentMeal.description,
                ingredients: corrNormalized,
                instructions: corrMeal.instructions || currentMeal.instructions,
                protein: corrMeal.protein ?? currentMeal.protein,
                calories: corrMeal.calories ?? currentMeal.calories,
                carbs: resolveAICarbsStrict(corrMeal),
                starchyCarbs: corrMeal.starchyCarbs ?? 0,
                fibrousCarbs: corrMeal.fibrousCarbs ?? 0,
                fat: corrMeal.fat ?? currentMeal.fat,
              });
            }
          } catch (corrErr) {
            console.warn(`⚠️ [ONCOLOGY CRAVING] Correction attempt ${oncologyCravingAttempt + 1} failed:`, corrErr);
            break;
          }

          oncologyCravingAttempt++;
        }

        // After retries exhausted, use the best version we have
        if (currentMeal !== unifiedMeal) {
          const finalQuality = scoreOncologyMealQuality({
            name: currentMeal.name,
            ingredients: currentMeal.ingredients,
            description: currentMeal.description,
            protein: currentMeal.protein,
          });
          if (finalQuality.approvedForDisplay) {
            console.log(`✅ [ONCOLOGY CRAVING] Quality gate passed after retries — score ${finalQuality.total}/100`);
          } else {
            console.warn(`⚠️ [ONCOLOGY CRAVING] Serving best available after ${ONCOLOGY_CRAVING_MAX_RETRIES} retries — score ${finalQuality.total}/100`);
          }
          unifiedMeal = currentMeal;
        }
      }

      console.log(`✅ AI generated meal: ${unifiedMeal.name}`);
      macroAudit("post_processing", unifiedMeal.name, { carbs: unifiedMeal.carbs, protein: unifiedMeal.protein, calories: unifiedMeal.calories }, { diet: cravingPrimaryDiet });
      macroAuditCache(unifiedMeal.name, "write", signature, { carbs: unifiedMeal.carbs });
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
      const CRAVING_DIET_VALIDATION_REQUIRED = ['vegan', 'vegetarian', 'pescatarian'];
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
        source: 'catalog',
        // Hard guarantee: unverified catalog fallbacks are never vegan/veg/pesc compliant
        dietaryComplianceVerified: CRAVING_DIET_VALIDATION_REQUIRED.includes(cravingPrimaryDiet) ? false : undefined,
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

// ── Kosher category intent detection ─────────────────────────────────────────
// Reads the user's craving text to determine which kosher category they are
// implicitly requesting, so the AI never auto-converts dairy to pareve when
// the user explicitly mentions butter, milk, cream, etc.

const DAIRY_INTENT_TERMS = [
  'milk', 'butter', 'cream', 'cheese', 'yogurt', 'dairy',
  'mozzarella', 'cheddar', 'parmesan', 'brie', 'camembert',
  'ricotta', 'sour cream', 'heavy cream', 'half and half',
  'whipped cream', 'ice cream', 'milchig', 'milchige', 'queso',
];

const MEAT_INTENT_TERMS = [
  'chicken', 'beef', 'lamb', 'turkey', 'veal', 'duck', 'goose',
  'brisket', 'steak', 'burger', 'meatball', 'liver', 'pastrami',
  'corned beef', 'schnitzel', 'flanken', 'ribs', 'fleishig',
  'ground beef', 'ground turkey', 'ground chicken',
];

/**
 * Detect which kosher category the craving implies.
 * Returns null when the user is not on a kosher diet.
 * Returns 'pareve' when no specific dairy/meat terms are found, OR when both
 * are present (meat-dairy mix is a conflict — safe fallback is pareve).
 */
function detectKosherCategoryIntent(
  restrictions: string[],
  craving: string,
): 'dairy' | 'meat' | 'pareve' | null {
  // getPrimaryDiet only covers strict diet modes (vegan/keto/paleo/etc) — not religious diets.
  // Check for kosher directly so "Kosher" (capital K from DB) is not missed.
  const normalizedRestrictions = (restrictions || []).map(r => r.trim().toLowerCase());
  const isKosher = normalizedRestrictions.includes('kosher') || normalizedRestrictions.includes('kosher-halal');
  if (!isKosher) return null;
  const lower = craving.toLowerCase();
  const hasDairy = DAIRY_INTENT_TERMS.some(t => lower.includes(t));
  const hasMeat = MEAT_INTENT_TERMS.some(t => lower.includes(t));
  if (hasDairy && !hasMeat) return 'dairy';
  if (hasMeat && !hasDairy) return 'meat';
  return 'pareve'; // conflict (both) or neutral (neither) → safe pareve
}

/**
 * Build a kosher category enforcement block to inject into the AI prompt.
 * This tells the AI exactly which category to generate and what's forbidden.
 */
function buildKosherCategoryBlock(category: 'dairy' | 'meat' | 'pareve'): string {
  if (category === 'dairy') {
    return [
      `KOSHER CATEGORY — DAIRY (Milchig):`,
      `The user explicitly requested dairy ingredients. Generate a DAIRY kosher dish.`,
      `✅ USE FREELY: milk, butter, cream, cream cheese, sour cream, yogurt, and all cheeses.`,
      `❌ FORBIDDEN: ALL meat and poultry — no chicken, beef, lamb, turkey, veal, or meat products of any kind.`,
      `⛔ DO NOT substitute dairy with non-dairy alternatives (no coconut milk, oat milk, cashew cream, vegan butter).`,
      `The dairy ingredients ARE the dish. Honor the user's explicit request and use them as written.`,
    ].join('\n');
  }
  if (category === 'meat') {
    return [
      `KOSHER CATEGORY — MEAT (Fleishig):`,
      `The user requested a meat-based dish. Generate a MEAT kosher dish.`,
      `✅ USE FREELY: chicken, beef, lamb, turkey, veal, and all kosher meats.`,
      `❌ FORBIDDEN: ALL dairy — no milk, butter, cream, cheese, yogurt, or any dairy products.`,
      `For richness and creaminess, use: olive oil, meat broths, reduced stock sauces, or vegetable-based foundations.`,
    ].join('\n');
  }
  return [
    `KOSHER CATEGORY — PAREVE:`,
    `Generate a PAREVE kosher dish (neither meat nor dairy).`,
    `✅ USE FREELY: fish, eggs, vegetables, fruits, grains, legumes, olive oil, vegetable broths.`,
    `❌ FORBIDDEN: ALL meat AND ALL dairy — absolutely no mixing of the two.`,
  ].join('\n');
}

/**
 * Detect if the previous generation attempt violated kosher meat/dairy separation
 * and return a targeted correction block to append to the retry prompt.
 * Returns undefined when no targeted correction is needed (non-kosher, non-meat, or no dairy found).
 */
function buildKosherViolationHint(
  rawOptions: any[],
  dietRestrictions: string[],
  kosherIntent: 'dairy' | 'meat' | 'pareve' | null,
): string | undefined {
  if (kosherIntent !== 'meat') return undefined;
  const normalized = (dietRestrictions || []).map(r => r.trim().toLowerCase());
  const isKosher = normalized.includes('kosher') || normalized.includes('kosher-halal');
  if (!isKosher) return undefined;

  const DAIRY_DETECTION = [
    'butter', 'ghee', 'cream', 'heavy cream', 'light cream', 'half-and-half', 'half and half',
    'cheese', 'feta', 'parmesan', 'mozzarella', 'cheddar', 'brie', 'goat cheese', 'ricotta',
    'milk', 'yogurt', 'sour cream', 'crème fraîche', 'creme fraiche', 'tzatziki',
  ];

  const hasDairy = rawOptions.some(opt => {
    const text = [
      opt.name || '',
      opt.description || '',
      ...(opt.ingredients || []).map((i: any) => i.name || ''),
    ].join(' ').toLowerCase();
    return DAIRY_DETECTION.some(t => text.includes(t));
  });

  if (!hasDairy) return undefined;

  return [
    `DIETARY VIOLATION FIX — URGENT CORRECTION:`,
    `Your previous response included dairy in a KOSHER MEAT dish (butter, cream, feta, cheese, or similar).`,
    `This is a strict kosher law violation (basar b'chalav). Correct this immediately.`,
    ``,
    `MANDATORY FOR THIS RETRY:`,
    `❌ ZERO dairy: no butter, ghee, cream, heavy cream, half-and-half, cheese, feta,`,
    `   parmesan, mozzarella, cheddar, goat cheese, ricotta, milk, yogurt, sour cream`,
    `✅ COOKING FAT: olive oil, avocado oil, grapeseed oil, or rendered meat drippings ONLY`,
    `✅ RICHNESS/CREAMINESS: use pureed vegetables, reduced meat stock, tahini, or hummus — never cream`,
    `✅ MEDITERRANEAN DISHES: replace feta entirely with olives, capers, lemon zest, or sun-dried tomatoes`,
    `✅ HERB SAUCES: chimichurri, salsa verde, lemon-herb vinaigrette — all dairy-free`,
    ``,
    `Generate 3 options that are 100% dairy-free. Check every ingredient before including it.`,
  ].join('\n');
}

/** Build the hierarchy-enforcing prompt for the variety engine */
function buildCuisineGroundingBlock(cuisine: string): string {
  return `\n🌍 CULTURAL GROUNDING — CUISINE OVERRIDE ACTIVE:
Cuisine: ${cuisine}

BEFORE GENERATING EACH OPTION, determine all four of the following:
1. EATING PATTERN — What do people in ${cuisine} cuisine actually eat at the requested meal time? Do NOT default to Western breakfast/lunch/dinner patterns (no scrambles, oatmeal, wraps, sandwiches). Identify the real-world eating pattern for this culture.
2. DISH FORMAT — What is the culturally appropriate dish structure? (e.g., rice bowl, soup, grilled plate, stir-fry, porridge, flatbread with sides) — must match how this cuisine is actually served.
3. CORE INGREDIENT SET — What proteins, starches, and vegetables are typical in ${cuisine} cuisine? Prefer culturally authentic ingredients; only substitute when required by dietary/allergy constraints.
4. FLAVOR SYSTEM — What defines the flavor architecture of this cuisine? Apply this flavor system — not a generic "exotic spice" approximation.

GENERATION RULES:
- Build each option ONLY from the cultural framework above
- Do NOT take a Western meal template and add cultural elements on top
- Prefer culturally authentic proteins, starches, and vegetables
- If constraints require substitution, find the nearest culturally plausible compliant alternative — NEVER default to a Western substitute. Adapt the dish inside the cuisine: keep the flavor profile, adjust only the non-compliant components. Examples of correct adaptation: Vietnamese diabetic vegan → Gỏi Chay (tofu/herb salad with fish sauce substitute + lime) instead of pho; Ethiopian diabetic → smaller injera portion with extra Misir Wat and Gomen; Japanese diabetic → half-portion rice with extra protein and seaweed. The output must still feel like the cuisine to someone who grew up eating it.

REJECTION RULE: If any option resembles a Western template (scramble, wrap, sandwich, yogurt bowl, quinoa bowl, oatmeal) with minor cultural additions — DISCARD it and rebuild from the cultural framework.

STRUCTURAL ENFORCEMENT RULE: The dish format for each option MUST match a real, commonly consumed meal structure within ${cuisine} cuisine at the requested meal time. Do NOT assume a format common in nearby cuisines is automatically correct for ${cuisine}. Ask: do people in ${cuisine} actually eat this dish format at this meal time? If the answer is no or uncertain — REJECT the format and rebuild using a structure that is genuinely typical for ${cuisine} at this meal time.

FORMAT AUTHENTICITY RULE: Do NOT default to globally generic formats such as "salad", "bowl", "wrap", or "balanced plate" unless those formats are clearly and commonly part of ${cuisine} cuisine specifically. These are universal AI fallbacks — they signal the AI is unsure and reached for a safe container instead of thinking culturally. If the format is globally common but not culturally specific to ${cuisine}, treat it as invalid and rebuild using a format distinctly found in ${cuisine} food traditions.

INGREDIENT AUTHENTICITY RULE: Avoid generic "healthy" vegetables (broccoli, red bell pepper, kale, spinach, zucchini) UNLESS they are commonly used in ${cuisine} cuisine. These ingredients signal a generic health-food default. Prefer vegetables, herbs, proteins, and starches genuinely found in ${cuisine} home cooking. When in doubt, choose the more culturally specific ingredient.

FLAVOR COMPLETENESS RULE: Ensure the core flavor components of ${cuisine} cuisine are present in the meal. Do NOT strip out foundational condiments, sauces, or seasoning agents in an attempt to "clean up" a dish — these are the flavor identity of the cuisine. Examples of non-negotiable flavor elements that MUST be included when the dish calls for them: Vietnamese dishes require fish sauce and citrus (lime); Japanese dishes require dashi, soy sauce, or mirin as appropriate; Ethiopian dishes require berbere and/or niter kibbeh; Cambodian dishes require fish sauce, lemongrass, and galangal; Mexican dishes require chiles and lime. If the dish you are generating traditionally includes these elements, they MUST appear in the ingredients — omitting them produces an inauthentic, flavorless version of the dish.

DISH CONTEXT RULE: If referencing a known or named cultural dish (e.g., Amok, Pho, Injera, Rendang, Bobotie, Mole, etc.), that dish MUST be used in the correct cultural context — the meal type must match how that dish is typically consumed in ${cuisine} culture. Do NOT borrow a real cultural dish name and apply it to a different meal time or format (e.g., Amok is a Cambodian lunch/dinner dish, NOT a breakfast preparation). If a named dish does not genuinely fit the requested meal time, DO NOT use it — generate a different culturally appropriate meal instead.

DISH COMPOSITION RULE: If a known or named cultural dish is being generated, preserve its traditional composition exactly. Do NOT modify core ingredients or add new primary components to satisfy fitness or nutritional goals (e.g., adding chicken breast to Firfir, adding quinoa to a traditional stew, adding lean protein to a dish that does not traditionally contain it). Nutritional goals MUST be achieved through portioning or the dish's existing ingredients only — NOT by altering the dish's fundamental identity. The dish must remain what it is, not what the AI decides it should be. Additionally, preserve the traditional protein type, cut, and preparation method exactly — this is a hard requirement, not a suggestion. Do NOT substitute bone-in cuts with boneless, do NOT swap traditional cuts for "lean" alternatives (e.g., chicken breast in place of bone-in thighs/drumsticks in Doro Wat), do NOT replace fatty or skin-on cuts with trimmed versions. The protein cut is part of the dish's cultural identity. If the dish traditionally uses bone-in chicken, you MUST use bone-in chicken — fitness goals do not override this.

STRICT DISH EXECUTION RULE: When a known cultural dish is being generated (e.g., Firfir, Doro Wat, Pho, Rendang, Injera-based dish), generate it exactly as it is traditionally prepared. Do NOT modify it, reinterpret it, "enhance" it, or create a variation of it. Do NOT add new primary ingredients, create a wrap version, bowl version, or "twist." If the output deviates from the traditional form in any way — REJECT it and rebuild the dish exactly as it is known. Creativity is NOT permitted when executing a named traditional dish. Do NOT describe known cultural dishes using modern nutrition language — words like "healthy", "balanced", "nutritious", "light", "clean", or "twist" are BANNED when describing a named traditional dish. Present the dish as it is traditionally understood, not as a nutrition-app product. Do NOT assign Western meal-time labels (breakfast, lunch, dinner) to a dish unless that label is culturally accurate for how the dish is actually eaten in its cuisine of origin. Many traditional dishes are not meal-time-specific — do not force them into a Western eating structure.

CUISINE BOUNDARY RULE: All ingredients, dishes, and preparations must originate from or be commonly used within ${cuisine} cuisine. Do NOT combine elements from different cuisines (e.g., Egyptian ful medames with Ethiopian injera, Japanese miso with Indian roti). Do NOT introduce globally common dishes unless they are also genuinely part of ${cuisine} cuisine specifically. If any component does not belong to the selected cuisine — REJECT and rebuild using only ingredients and preparations authentic to ${cuisine}.

SERVING CONTEXT RULE: Meals must reflect how they are traditionally served and consumed in ${cuisine} cuisine. If a dish is typically served with a specific base or delivery medium, that element MUST be included — Doro Wat requires injera, sushi requires rice, tacos require tortillas. Do NOT reinterpret meals as generic "main + sides" if the cuisine does not follow that plating structure. Prefer authentic serving formats: shared platters, layered dishes, wrapped preparations, or communal formats as appropriate. If the serving structure is incomplete or wrong, reject and rebuild.

DISH NAMING COMMITMENT RULE: When the generated meal clearly corresponds to a known or widely recognized dish within ${cuisine} cuisine, use the authentic dish name. Optionally include a short English descriptor in parentheses if helpful (e.g., "Gỏi Gà (Vietnamese Chicken Salad)", "Doro Wat (Ethiopian Chicken Stew) with Injera"). Do NOT default to generic descriptive names like "Herb Salad", "Flatbread Plate", or "Fish Rice Meal" when a specific dish identity is apparent. Commit to the real name. NEVER use hedging qualifiers such as "inspired", "style", "influenced", or "based" (e.g., "Ethiopian-Inspired Stew" is WRONG — if it is Doro Wat, name it Doro Wat).

ALL 3 options must be authentically ${cuisine} preparations, with culturally correct formats, ingredients, AND flavor systems.\n`;
}

function buildVarietyPrompt(
  cravingInput: string,
  validMealType: string,
  category: string,
  dishFamily: string,
  dietBlock: string,
  dietRestrictions: string[],
  excludeClause: string,
  allergyBlock: string = '',
  strictMode: boolean = false,
  avoidanceBlock: string = '',
  cuisineGroundingBlock: string = ''
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
${allergyBlock ? allergyBlock + '\n' : ''}${avoidanceBlock ? avoidanceBlock + '\n' : ''}${cuisineGroundingBlock}
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

INGREDIENT MEASUREMENT RULES (NON-NEGOTIABLE): Use oz for proteins/potatoes/grains (e.g. "6 oz chicken", "5 oz sweet potato", "4 oz cooked rice"). Garlic: always cloves (e.g. "4 cloves garlic"). Onions: always cup (e.g. "1 cup diced onion"). Eggs must include size (e.g. "3 large eggs"). Oils use tbsp/tsp. Liquids use cup/fl oz. NEVER use "each", "piece", "serving", "handful", "unit", "units", "medium", "large", "small" as units, or metric units.
MEAL TYPE context: ${validMealType}
${strictMode ? `\n${buildStrictModeBlock(cravingInput)}` : ""}`;
}

/** Recipe Mode prompt — culinary-ratio-first, not macro-first */
function buildRecipeVarietyPrompt(
  cravingInput: string,
  validMealType: string,
  dishFamily: string,
  dietBlock: string,
  dietRestrictions: string[],
  excludeClause: string,
  allergyBlock: string = '',
  strictMode: boolean = false,
  avoidanceBlock: string = '',
  cuisineGroundingBlock: string = ''
): string {
  const primaryDiet = getPrimaryDiet(dietRestrictions);
  const dietLine = primaryDiet
    ? `DIET: ${primaryDiet.toUpperCase()} — ALL 3 options must comply. Zero exceptions.`
    : `DIET: None set.`;

  return `You are a professional chef generating real-world recipes. Think like a cook, NOT a nutrition calculator.
${allergyBlock ? '\n' + allergyBlock + '\n' : ''}${avoidanceBlock ? avoidanceBlock + '\n' : ''}${cuisineGroundingBlock}
═══════════════════════════════════════
RECIPE MODE — CULINARY-FIRST RULES:
═══════════════════════════════════════

PRIORITY 1 — CULINARY ACCURACY (non-negotiable):
  - Use REALISTIC ingredient ratios for this type of dish
  - Do NOT scale ingredients by macro targets
  - Eggs: most dishes use 2–4 eggs. Never exceed what a real recipe requires.
  - Flour/butter/sugar: follow standard baking/cooking proportions for the dish
  - Serving size must be realistic (a dinner roll is a roll, not a macro-portioned block)
  - Scale by RECIPE LOGIC, not nutrition math

PRIORITY 2 — ALLERGEN SAFETY & DIET (non-negotiable):
  ${dietLine}
  ${dietBlock ? dietBlock : ''}
PRIORITY 3 — DISH VARIETY:
  The user requested: "${cravingInput}"
  Core dish family: "${dishFamily}"
  Generate 3 distinct variations using different:
  - Preparation methods (baked vs pan-fried vs stovetop)
  - Flavor profiles (classic vs herbed vs spiced)
  - Textures or formats

${excludeClause}

═══════════════════════════════════════
OUTPUT FORMAT — ONLY valid JSON, no markdown:
═══════════════════════════════════════
{
  "options": [
    {
      "name": "Specific recipe name",
      "description": "1-2 sentence appetizing description",
      "ingredients": [{"name": "ingredient", "quantity": "2", "unit": "cup"}],
      "instructions": "Full step-by-step recipe as a single paragraph",
      "calories": 350,
      "protein": 8,
      "starchyCarbs": 40,
      "fibrousCarbs": 3,
      "fat": 12,
      "cookingTime": "25 minutes"
    },
    {},
    {}
  ]
}

INGREDIENT MEASUREMENT RULES (NON-NEGOTIABLE): Use oz for proteins/potatoes/grains (e.g. "6 oz chicken", "5 oz sweet potato", "4 oz cooked rice"). Garlic: always cloves (e.g. "4 cloves garlic"). Onions: always cup (e.g. "1 cup diced onion"). Eggs must include size (e.g. "3 large eggs"). Oils use tbsp/tsp. Liquids use cup/fl oz. NEVER use "each", "piece", "serving", "handful", "unit", "units", "medium", "large", "small" as units, or metric units.
CRITICAL SANITY CHECK: Before outputting, verify your ingredient counts are physically realistic for ${cravingInput}. A dozen rolls does not require 5 dozen eggs.
MEAL TYPE context: ${validMealType}
${strictMode ? `\n${buildStrictModeBlock(cravingInput)}` : ""}`;
}

/** Deterministic post-generation sanity check for unrealistic ingredient quantities.
 *  Returns true if quantities look sane, false if a re-generation should be triggered. */
function checkIngredientSanity(options: any[], servings: number = 1): boolean {
  const s = Math.max(1, servings);
  for (const opt of options) {
    for (const ing of (opt.ingredients || [])) {
      const name = (ing.name || '').toLowerCase();
      const qty = parseFloat(ing.quantity) || 0;
      if (!qty) continue;
      // Eggs — more than 4 per serving is suspicious (most recipes: 2-3 eggs regardless of servings)
      if (name.includes('egg') && !name.includes('eggplant') && !name.includes('noodle')) {
        if (qty > Math.max(6, 4 * s)) {
          console.warn(`[RECIPE SANITY] Unrealistic eggs: ${qty} for ${s} serving(s) in "${opt.name}"`);
          return false;
        }
      }
      // Flour — more than 4 cups per single serving is suspicious
      if (name.includes('flour') && (ing.unit || '').toLowerCase() === 'cup') {
        if (qty > Math.max(8, 4 * s)) {
          console.warn(`[RECIPE SANITY] Unrealistic flour: ${qty} cups for ${s} serving(s) in "${opt.name}"`);
          return false;
        }
      }
    }
  }
  return true;
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
  const totalCarbs = resolveAICarbsStrict(opt);
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
    imageUrl: '',
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
  excludeMeals?: string[],
  strictMode: boolean = false,
  generationMode: 'meal' | 'recipe' = 'meal',
  cuisineOverride?: string
): Promise<UnifiedMeal[]> {
  const validMealType = normalizeMealType(mealType);
  const category = inferCravingCategory(cravingInput, validMealType);
  const dishFamily = extractDishFamily(cravingInput);
  console.log(`🎲 [VARIETY ENGINE] "${cravingInput}" → category: ${category}, dish: ${dishFamily}`);

  // Fix B: Fetch dietary restrictions, allergies, AND health conditions from the user profile
  let dietRestrictions: string[] = [];
  let allergyBlock = '';
  let avoidanceBlock = '';
  let proceduralBlock = '';
  if (userId) {
    try {
      const [u] = await db.select({
        dietaryRestrictions: users.dietaryRestrictions,
        allergies: users.allergies,
        healthConditions: users.healthConditions,
        dislikedFoods: users.dislikedFoods,
        avoidedFoods: users.avoidedFoods,
      }).from(users).where(eq(users.id, userId)).limit(1);

      dietRestrictions = (u?.dietaryRestrictions as string[]) || [];

      const allergies: string[] = (u?.allergies as string[]) || [];
      if (allergies.length > 0) {
        allergyBlock = `\n🚨 ALLERGEN BLOCK — ABSOLUTE MEDICAL SAFETY REQUIREMENT:\nThis user has confirmed allergies to: ${allergies.join(', ')}.\nDo NOT include these ingredients or any derivative/hidden form in ANY of the 3 options. This overrides all other instructions.`;
        console.log(`[VARIETY ENGINE] Allergy block active for user ${userId}: ${allergies.join(', ')}`);
      }

      const healthConditions: string[] = (u?.healthConditions as string[]) || [];
      if (healthConditions.length > 0) {
        console.log(`[VARIETY ENGINE] Health conditions for user ${userId}: ${healthConditions.join(', ')}`);
      }

      // Merge dislikedFoods + avoidedFoods into a single avoidance list
      const rawAvoidances: string[] = [
        ...((u?.dislikedFoods as string[]) || []),
        ...((u?.avoidedFoods as string[]) || []),
      ];
      if (rawAvoidances.length > 0) {
        avoidanceBlock = buildVarietyAvoidanceBlock(rawAvoidances);
        console.log(`[VARIETY ENGINE] Avoidance block active for user ${userId}: ${rawAvoidances.join(', ')}`);
      }
    } catch (err) {
      console.warn("[VARIETY ENGINE] Could not fetch user profile:", err);
    }

    // ── Procedural enforcement block (instruction-level compliance) ──────────
    // Load the full protocol envelope and extract the procedural layer.
    // This adds preparation, equipment, and forbidden-instruction rules to
    // the prompt — so the AI is constrained at the instruction level too.
    try {
      const envelope = await loadUserProtocolEnvelope(userId);
      if (envelope) {
        const promptBlock = enforceBeforeGenerate(envelope, {
          userInput: cravingInput,
          generatorName: 'craving_creator',
        });
        if (promptBlock.layers.procedural) {
          proceduralBlock = promptBlock.layers.procedural;
          console.log(`[VARIETY ENGINE] Procedural enforcement active for user ${userId} (${envelope.dietaryIdentity.join(', ')})`);
        }
      }
    } catch (err) {
      console.warn("[VARIETY ENGINE] Could not load protocol envelope for procedural block:", err);
    }
  }
  if (dietaryRestrictionsOverride && dietaryRestrictionsOverride.length > 0) {
    const merged = new Set([...dietRestrictions, ...dietaryRestrictionsOverride]);
    dietRestrictions = Array.from(merged);
  }
  let dietBlock = buildDietPromptBlock(dietRestrictions);
  // Kosher category intent: inject DAIRY/MEAT/PAREVE block so the AI
  // never auto-converts explicit dairy (butter, milk) to pareve/coconut milk.
  const varietyKosherIntent = detectKosherCategoryIntent(dietRestrictions, cravingInput);
  if (varietyKosherIntent) {
    dietBlock += (dietBlock ? '\n' : '') + buildKosherCategoryBlock(varietyKosherIntent);
    console.log(`🕍 [VARIETY ENGINE] Kosher category intent: ${varietyKosherIntent}`);
  }

  // ── Oncology overlay for variety engine ──────────────────────────────────
  // The oncology protocol prompt is normally injected only in the stable
  // single-meal generator. For variety cards shown to oncology-support users,
  // we must also enforce hard-blocks at the prompt level so the AI never
  // suggests processed meats, added sugars, or vegan sausage as options.
  const isVarietyOncology = dietRestrictions.includes('oncology-support');
  if (isVarietyOncology) {
    const oncologyVarietyOverlay = [
      ``,
      `═══ CANCER SUPPORT NUTRITION — HARD BLOCK (ALL 3 OPTIONS) ═══`,
      `This user is under a Cancer Support Nutrition protocol. ALL 3 options MUST comply.`,
      ``,
      `STRICTLY FORBIDDEN — never appear in any option:`,
      `• Processed/cured meats: bacon, sausage (ALL forms including vegan sausage, veggie sausage,`,
      `  plant-based sausage), pepperoni, salami, ham, hot dogs, deli meat, chorizo, bratwurst`,
      `• Added sugars: maple syrup, honey, agave, corn syrup, brown sugar, powdered sugar, refined sugar`,
      `• Heavily processed fats: lard, margarine, shortening, hydrogenated oils`,
      `• Refined white carbs as primary starch: white bread, white pasta — upgrade to whole grain`,
      ``,
      `REQUIRED in every option:`,
      `• A green-tier protein: fresh fish, eggs, chicken breast, tofu, tempeh, lentils, chickpeas`,
      `• At least ONE anti-inflammatory vegetable: broccoli, kale, spinach, mushrooms, bell peppers`,
      `• A real fiber anchor: oats, quinoa, lentils, sweet potato, brown rice, or berries`,
      `• A therapeutic booster: garlic, turmeric, ginger, lemon, or fresh herbs`,
      `═════════════════════════════════════════════════════════════`,
    ].join('\n');
    dietBlock += oncologyVarietyOverlay;
    console.log(`🧬 [VARIETY ENGINE] Oncology hard-block overlay injected`);
  }

  const excludeClause = excludeMeals && excludeMeals.length > 0
    ? `ANTI-REPETITION: Do NOT generate anything resembling these recently seen options — vary the primary ingredient, preparation, and concept: ${excludeMeals.join(", ")}`
    : "";

  const openai = getOpenAI();

  const isRecipeMode = generationMode === 'recipe';
  if (isRecipeMode) {
    console.log(`🍳 [RECIPE MODE] Using culinary-ratio prompt for "${cravingInput}"`);
  }

  const cuisineGroundingBlock = cuisineOverride && cuisineOverride.trim()
    ? buildCuisineGroundingBlock(cuisineOverride.trim())
    : '';

  if (cuisineGroundingBlock) {
    console.log(`🌍 [VARIETY ENGINE] Cultural grounding active: ${cuisineOverride}`);
  }

  /** One attempt at calling AI and parsing result */
  const attempt = async (stricterMode: boolean, violationHint?: string): Promise<any[]> => {
    const prompt = isRecipeMode
      ? buildRecipeVarietyPrompt(cravingInput, validMealType, dishFamily, dietBlock, dietRestrictions, excludeClause, allergyBlock, strictMode, avoidanceBlock, cuisineGroundingBlock)
      : buildVarietyPrompt(cravingInput, validMealType, category, dishFamily, dietBlock, dietRestrictions, excludeClause, allergyBlock, strictMode, avoidanceBlock, cuisineGroundingBlock);
    const stricter = stricterMode
      ? `\n\nSECOND ATTEMPT — STRICT MODE: The previous response drifted from the dish family. You MUST generate 3 options that are clearly recognizable variations of "${dishFamily}". No exceptions.`
      : "";
    const hintAddendum = violationHint ? `\n\n${violationHint}` : "";
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: (proceduralBlock ? proceduralBlock + '\n\n' : '') + prompt + stricter + hintAddendum }],
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

  // Recipe Mode: post-generation sanity check for unrealistic ingredient quantities
  if (isRecipeMode && !checkIngredientSanity(rawOptions)) {
    console.warn("[RECIPE MODE] Sanity check failed — regenerating with stricter culinary constraints");
    try {
      rawOptions = await attempt(true);
    } catch (sanityRetryErr) {
      console.error("[RECIPE MODE] Sanity retry failed:", sanityRetryErr);
    }
  }

  // Server-side validation — check category, dish family, diet for each option
  const valid = rawOptions.slice(0, 3).filter(opt =>
    validateVarietyOption(opt, category, dishFamily, dietRestrictions)
  );

  // If majority fail validation, regenerate once with stricter prompt
  if (valid.length < 2) {
    console.warn(`[VARIETY ENGINE] Only ${valid.length}/3 options passed validation — regenerating with strict prompt`);
    // Detect WHY options failed and build a targeted correction for the retry
    const violationHint = buildKosherViolationHint(rawOptions, dietRestrictions, varietyKosherIntent);
    if (violationHint) {
      console.warn(`[VARIETY ENGINE] Kosher dairy violation detected — injecting targeted dietary correction into retry`);
    }
    try {
      rawOptions = await attempt(true, violationHint);
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

  let finalOptions = rawOptions.slice(0, 3);

  // ── Oncology post-generation filter ──────────────────────────────────────
  // Second line of defense: after all retries, scan each variety card for
  // hard-blocked ingredients. Any option containing a blocked item is dropped.
  // If this leaves < 2 options, we serve what passed rather than blocking the user.
  if (isVarietyOncology && finalOptions.length > 0) {
    const beforeCount = finalOptions.length;
    finalOptions = filterOncologySafeMeals(finalOptions);
    if (finalOptions.length < beforeCount) {
      console.warn(`🧬 [VARIETY ENGINE ONCOLOGY] ${beforeCount - finalOptions.length} option(s) rejected by oncology hard-block validator — serving ${finalOptions.length} clean option(s)`);
    }
  }

  // ── Hard starch stacking filter (vegetarian / vegan) ─────────────────────
  // Server-side enforcement: drops any variety card where legume + grain coexist
  // OR where more than 1 starch source is present. Prompts alone are insufficient —
  // this is the code-level enforcement the AI cannot bypass.
  finalOptions = filterByStarchStructure(finalOptions, dietRestrictions);

  console.log(`✅ [VARIETY ENGINE] ${finalOptions.length} options: ${finalOptions.map((o: any) => o?.name).join(" | ")}`);
  return finalOptions.map((opt, idx) => {
    const meal = mapToUnifiedMeal(opt, idx, cravingInput, validMealType);
    if (cuisineOverride) meal.name = culturalNameTransform(meal.name, cuisineOverride);
    return meal;
  });
}

/**
 * Emergency fallback: generate a single guaranteed-compliant meal when the
 * variety engine AND its retry both produce options that fail protocol scanning.
 * Uses a maximum-constraint single-option prompt at temperature 0.3.
 */
export async function generateSingleCompliantFallback(
  cravingInput: string,
  mealType: string,
  dietaryIdentity: string[],
): Promise<UnifiedMeal | null> {
  const validMealType = normalizeMealType(mealType);
  const kosherIntent = detectKosherCategoryIntent(dietaryIdentity, cravingInput);
  const dietBlock = buildDietPromptBlock(dietaryIdentity);
  const kosherBlock = kosherIntent ? buildKosherCategoryBlock(kosherIntent) : '';

  const meatDairyGuard = kosherIntent === 'meat' ? [
    `ABSOLUTE KOSHER MEAT REQUIREMENT:`,
    `❌ ZERO dairy: no butter, ghee, cream, heavy cream, half-and-half, cheese, feta,`,
    `   parmesan, mozzarella, cheddar, goat cheese, ricotta, milk, yogurt, or sour cream`,
    `✅ COOKING FAT: olive oil or avocado oil ONLY`,
    `✅ CREAMINESS: use reduced meat stock, pureed vegetables, or tahini — never cream`,
    `✅ Every single ingredient must be dairy-free. No exceptions.`,
  ].join('\n') : '';

  const prompt = [
    `You are a precision dietary chef. Generate exactly ONE meal that strictly complies with all dietary rules below.`,
    dietBlock,
    kosherBlock,
    meatDairyGuard,
    `The meal must be: ${cravingInput}`,
    `Keep it simple, compliant, and delicious.`,
    ``,
    `OUTPUT FORMAT — ONLY valid JSON, no markdown fences:`,
    `{"name":"...","description":"One appetizing sentence.","ingredients":[{"name":"...","quantity":"...","unit":"..."}],"instructions":"Full cooking steps as one paragraph.","calories":400,"protein":30,"starchyCarbs":20,"fibrousCarbs":10,"fat":15,"cookingTime":"25 minutes"}`,
  ].filter(Boolean).join('\n');

  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1200,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const opt = JSON.parse(jsonMatch[0]);
    console.log(`🛟 [FALLBACK] Generated compliant fallback: "${opt.name}"`);
    return mapToUnifiedMeal(opt, 0, cravingInput, validMealType);
  } catch (err) {
    console.error('[FALLBACK GENERATION] Failed:', err);
    return null;
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

  // Fetch dietary restrictions FIRST to ensure diet-aware cache key
  let fridgeDietRestrictions: string[] = [];
  let fridgeSpecialtyCondition: string | null = null;
  if (userId) {
    try {
      const [fridgeUser] = await db.select({ dietaryRestrictions: users.dietaryRestrictions, specialtyCondition: users.specialtyCondition })
        .from(users).where(eq(users.id, userId)).limit(1);
      fridgeDietRestrictions = (fridgeUser?.dietaryRestrictions as string[]) || [];
      fridgeSpecialtyCondition = (fridgeUser?.specialtyCondition as string | null) ?? null;
    } catch (err) {
      console.warn("[FRIDGE] Could not fetch dietary restrictions for cache key:", err);
    }
  }
  const fridgePrimaryDiet = getPrimaryDiet(fridgeDietRestrictions) || "none";

  // Detect oncology protocol early (before cache) so we can bypass stale cache.
  // Check both dietaryRestrictions AND specialtyCondition — oncology-support may be stored in either.
  const isOncologyFridge = fridgePrimaryDiet === 'oncology-support'
    || fridgeDietRestrictions.includes('oncology-support')
    || fridgeSpecialtyCondition === 'oncology-support';
  
  // Step 1: Check diet-aware cache (includes primaryDiet to prevent cross-diet contamination)
  // Oncology-support bypasses cache — enhancement logic must run fresh every time so
  // old non-enhanced cached meals don't reach oncology users.
  const signature = createIngredientSignature({
    ingredients: fridgeItems,
    mealType: validMealType,
    primaryDiet: fridgePrimaryDiet
  });
  
  if (!isOncologyFridge) {
    const cached = await getCachedMeals(signature);
    if (cached && cached.meals.length >= count) {
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
  } else {
    console.log(`🧬 [ONCOLOGY FRIDGE] Cache bypassed — oncology enhancement must run fresh.`);
  }

  // Step 2: Use the REAL Fridge Rescue generator (OpenAI-powered, proven stable)
  // This is the same system that works perfectly on Fridge Rescue page
  console.log(`🧊 Unified Pipeline: Using Fridge Rescue AI generator for: ${fridgeItems.join(', ')}`);

  // ── Load protocol envelope (same pattern as create-with-chef / craving / snack) ─
  // Passes diet identity, medical rules, and cuisine preferences into the AI prompt.
  const fridgeEnvelope = userId
    ? (await loadUserProtocolEnvelope(userId).catch(() => null)) ?? buildGuestEnvelope()
    : buildGuestEnvelope();
  if (fridgeEnvelope.dietaryIdentity.length > 0) {
    console.log(`🔒 [FRIDGE/Unified] Envelope loaded: identity=[${fridgeEnvelope.dietaryIdentity.join(',')}]`);
  }

  // ── Oncology smart enhancement layer ──────────────────────────────────────────
  // Philosophy: "Use what they gave + intelligently support it"
  // Before generation we detect oncology-critical gaps in the user's ingredient list
  // and inject a mandatory builderBlock that instructs the AI to add those items.
  // This turns a "clean meal" into a therapeutically optimized oncology meal.
  let oncologyFridgeEnhancement: string | undefined;
  if (isOncologyFridge) {
    const fridgeText = fridgeItems.join(' ').toLowerCase();

    // Fiber anchor check — same terms as oncologyQualityScorer FIBER_ANCHOR_STRONG
    const FIBER_ANCHOR_TERMS = [
      'quinoa', 'oat', 'lentil', 'bean', 'chickpea', 'sweet potato',
      'brown rice', 'barley', 'farro', 'bulgur', 'edamame', 'pea',
    ];
    const hasFiberAnchor = FIBER_ANCHOR_TERMS.some(t => fridgeText.includes(t));

    // Therapeutic booster check — same terms as THERAPEUTIC_BOOSTERS in scorer
    const BOOSTER_TERMS = [
      'garlic', 'turmeric', 'ginger', 'herb', 'parsley', 'cilantro',
      'basil', 'thyme', 'rosemary', 'cumin', 'cinnamon', 'flax', 'chia',
      'green tea',
    ];
    const hasBooster = BOOSTER_TERMS.some(t => fridgeText.includes(t));

    const enhancements: string[] = [];

    if (!hasFiberAnchor) {
      enhancements.push(
        '• FIBER ANCHOR (REQUIRED): Add ½ cup cooked quinoa, lentils, or black beans to every meal. ' +
        'These are standard pantry staples. If quinoa is unavailable, use lentils or chickpeas. ' +
        'Do NOT skip this — meals without a fiber anchor fail the oncology quality gate.'
      );
    }

    if (!hasBooster) {
      enhancements.push(
        '• THERAPEUTIC BOOSTERS (REQUIRED): Add 1–2 minced garlic cloves AND ¼ tsp turmeric to every ' +
        'meal during cooking. Finish with fresh herbs (parsley, basil, or cilantro). ' +
        'These anti-inflammatory compounds are non-negotiable for oncology-support protocol.'
      );
    }

    if (enhancements.length > 0) {
      oncologyFridgeEnhancement = [
        '🧬 ONCOLOGY-SUPPORT SMART ENHANCEMENT (MANDATORY — DO NOT IGNORE):',
        'This user is on the Oncology Support medical protocol. You MUST add these therapeutic',
        'ingredients to every meal even if not in the fridge list — they are essential pantry staples:',
        '',
        ...enhancements,
        '',
        'Build meals around the user\'s listed ingredients FIRST, then layer in the above. The result',
        'should taste cohesive and complete — not like random additions. Every meal MUST include both',
        'a fiber anchor and a therapeutic booster to meet clinical quality standards.',
      ].join('\n');
      console.log(
        `🧬 [ONCOLOGY FRIDGE ENHANCE] Gaps detected — ${!hasFiberAnchor ? 'NO FIBER ANCHOR' : 'fiber ok'}` +
        ` / ${!hasBooster ? 'NO BOOSTER' : 'booster ok'}. Enhancement block injected.`
      );
    } else {
      console.log(`🧬 [ONCOLOGY FRIDGE ENHANCE] Fridge items already contain fiber anchor + booster — no injection needed.`);
    }
  }

  try {
    const fridgeRescueMeals = await generateFridgeRescueMeals({
      fridgeItems,
      macroTargets,
      protocolEnvelope: fridgeEnvelope,
      builderBlock: oncologyFridgeEnhancement,
    });
    
    // Convert to UnifiedMeal format + normalize ingredients to US units
    const resultMeals: UnifiedMeal[] = fridgeRescueMeals.slice(0, count).map(meal => ({
      id: meal.id,
      name: meal.name,
      description: meal.description,
      ingredients: normalizeIngredients(meal.ingredients.map(ing => ({
        name: ing.name,
        quantity: String(ing.quantity),
        unit: ing.unit
      }))),
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

    // ── Dietary identity validation (Step 4) ────────────────────────────────────
    // Reject and regenerate any meal that violates the user's diet (vegan, kosher, etc.)
    // Mirrors the compliance loop already in create-with-chef and craving paths.
    const fridgeDietIdentity: string[] = fridgeEnvelope.dietaryIdentity;
    if (fridgeDietIdentity.length > 0 && resultMeals.length > 0) {
      const cleanMeals: UnifiedMeal[] = [];
      const violatingMeals: UnifiedMeal[] = [];
      for (const meal of resultMeals) {
        const mealText = [
          meal.name,
          ...((meal.ingredients as any[]).map((i: any) => i.name || ''))
        ].join(' ');
        const { violates, reasons } = violatesDietaryConstraints(mealText, fridgeDietIdentity);
        if (violates) {
          console.warn(`⚠️ [FRIDGE/Compliance] "${meal.name}" violates ${fridgeDietIdentity.join('|')}: [${reasons.join(', ')}] — regenerating`);
          violatingMeals.push(meal);
        } else {
          cleanMeals.push(meal);
        }
      }
      if (violatingMeals.length > 0) {
        console.log(`🔄 [FRIDGE/Compliance] ${violatingMeals.length} violation(s) — running strict retry`);
        try {
          const retryMeals = await generateFridgeRescueMeals({
            fridgeItems,
            macroTargets,
            protocolEnvelope: fridgeEnvelope,
            strictMode: true,
            builderBlock: oncologyFridgeEnhancement,
          });
          const retryConverted: UnifiedMeal[] = retryMeals.slice(0, violatingMeals.length).map(meal => ({
            id: meal.id,
            name: meal.name,
            description: meal.description,
            ingredients: normalizeIngredients(meal.ingredients.map(ing => ({
              name: ing.name,
              quantity: String(ing.quantity),
              unit: ing.unit
            }))),
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
          // Accept only clean retries; discard any that still violate
          for (const retryMeal of retryConverted) {
            const mealText = [retryMeal.name, ...((retryMeal.ingredients as any[]).map((i: any) => i.name || ''))].join(' ');
            const { violates } = violatesDietaryConstraints(mealText, fridgeDietIdentity);
            if (!violates) cleanMeals.push(retryMeal);
            else console.warn(`⚠️ [FRIDGE/Compliance] Retry meal "${retryMeal.name}" still violates — discarded`);
          }
        } catch (retryErr) {
          console.warn('[FRIDGE/Compliance] Strict retry failed:', retryErr);
        }
        // Replace resultMeals with only validated clean meals
        resultMeals.length = 0;
        resultMeals.push(...cleanMeals);
        console.log(`✅ [FRIDGE/Compliance] ${resultMeals.length} clean meal(s) after validation`);
      }
    }

    console.log(`✅ Fridge Rescue AI generated ${resultMeals.length} complete meals`);

    // ── Oncology quality gate for fridge rescue ─────────────────────────────
    // Fridge rescue is ingredient-constrained (meals must use what the user has).
    // We score each meal and tag it — we don't hard-block or re-generate from scratch
    // because that would violate the fridge-rescue contract. However, we log every
    // meal's oncology quality so the team can see the distribution.
    if (fridgeEnvelope.dietaryIdentity.includes('oncology-support') || fridgePrimaryDiet === 'oncology-support') {
      for (let i = 0; i < resultMeals.length; i++) {
        const fridgeMealQuality = scoreOncologyMealQuality({
          name: resultMeals[i].name,
          ingredients: resultMeals[i].ingredients,
          description: resultMeals[i].description,
          protein: resultMeals[i].protein,
        });
        const status = fridgeMealQuality.approvedForDisplay
          ? `premium_${fridgeMealQuality.total}`
          : `fridge_suboptimal_${fridgeMealQuality.total}`;
        (resultMeals[i] as any).qualityStatus = status;
        console.log(`🧬 [ONCOLOGY FRIDGE] Meal ${i + 1} "${resultMeals[i].name}" — Score: ${fridgeMealQuality.total}/100 — ${fridgeMealQuality.tier} — caps: [${fridgeMealQuality.breakdown.caps?.join(', ') ?? ''}]`);
      }
    }

    // Cache the results for future use (only cache clean meals)
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
function buildDiversityGuidance(
  diversityContext: { usedBases: Record<string, number>; usedTypes: Record<string, number> } | null | undefined
): string {
  if (!diversityContext) return "";

  const { usedBases, usedTypes } = diversityContext;

  const softAvoidBases = Object.entries(usedBases).filter(([, n]) => n >= 2 && n < 3).map(([b, n]) => `${b} (×${n})`);
  const hardAvoidBases = Object.entries(usedBases).filter(([, n]) => n >= 3).map(([b, n]) => `${b} (×${n})`);
  const softAvoidTypes = Object.entries(usedTypes).filter(([, n]) => n >= 2 && n < 3).map(([t, n]) => `${t} (×${n})`);
  const hardAvoidTypes = Object.entries(usedTypes).filter(([, n]) => n >= 3).map(([t, n]) => `${t} (×${n})`);

  if (
    softAvoidBases.length === 0 &&
    hardAvoidBases.length === 0 &&
    softAvoidTypes.length === 0 &&
    hardAvoidTypes.length === 0
  ) {
    return "";
  }

  const lines: string[] = ["🌈 MEAL DIVERSITY (important for weekly variety):"];

  if (hardAvoidBases.length > 0) {
    lines.push(`- STRONGLY avoid these overused main ingredients: ${hardAvoidBases.join(", ")}. Choose a completely different primary ingredient.`);
  }
  if (softAvoidBases.length > 0) {
    lines.push(`- Try to avoid these frequently used ingredients: ${softAvoidBases.join(", ")}. Prefer a different base if possible.`);
  }
  if (hardAvoidTypes.length > 0) {
    lines.push(`- STRONGLY avoid this meal format (used too often this week): ${hardAvoidTypes.join(", ")}. Choose a different structure (e.g. wrap, skillet, salad, soup, stir-fry).`);
  }
  if (softAvoidTypes.length > 0) {
    lines.push(`- Try to vary the meal format away from: ${softAvoidTypes.join(", ")}.`);
  }
  lines.push("- If dietary constraints make full variety difficult, prioritize meeting dietary rules over diversity.");

  return lines.join("\n");
}

export async function generateFromDescriptionUnified(
  description: string,
  mealType: string,
  userId?: string,
  dietType?: DietType,
  starchContext?: StarchContext,
  nutritionStrategy?: NutritionStrategyContext,
  strictMode: boolean = false,
  skipImage: boolean = false,
  explicitOverride?: ExplicitOverride | null,
  diversityContext?: { usedBases: Record<string, number>; usedTypes: Record<string, number> } | null,
  dietPhase?: string,
  remainingMacros?: { protein?: number; carbs?: number; fat?: number; calories?: number },
  builderMode?: BuilderMode
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
  const vegetableStrategyGuidance = (!strictMode && nutritionStrategy) ? buildVegetableStrategyPrompt(nutritionStrategy) : '';
  
  console.log(`👨‍🍳 Create With Chef: Generating meal from description: "${description}" for ${validMealType}${dietType ? ` (diet: ${dietType})` : ''} | Starch: ${starchPlacement.shouldIncludeStarch ? 'YES' : 'NO'} (${starchPlacement.reason})${vegetableStrategyGuidance ? ' | 🥦 VegStrategy: ON' : ''}`);
  
  try {
    await ensureHubsRegistered();
    
    let hubCoupling: HubCouplingResult | null = null;
    let effectiveHubType: HubType | null = null;
    
    if (userId) {
      if (isValidHubType(dietType)) {
        // Caller explicitly named a clinical hub — use it directly.
        effectiveHubType = dietType;
      } else if (dietType == null) {
        // No diet type provided at all — auto-detect from the user's profile.
        // This covers legacy callers that omit the field entirely.
        effectiveHubType = await detectHubTypeFromProfile(userId);
      }
      // else: caller passed an explicit non-hub diet type (e.g. "general-nutrition",
      // "beachbody") — respect that intent and skip clinical hub injection entirely.
      // The weekly meal builder, general nutrition builder, etc. all fall here.
      
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
    
    // ── Load protocol envelope (drives all dietary enforcement) ───────────────
    const chefEnvelope = userId
      ? (await loadUserProtocolEnvelope(userId).catch(() => null)) ?? buildGuestEnvelope()
      : buildGuestEnvelope();

    const chefProtocolBlock = enforceBeforeGenerate(chefEnvelope, {
      generatorName: 'create_with_chef',
    }).combined;

    // Use envelope's dietaryIdentity for vegan/vegetarian/pescatarian compliance loop
    const chefDietRestrictions: string[] = chefEnvelope.dietaryIdentity;
    if (chefProtocolBlock) {
      console.log(`🥗 [CREATE-WITH-CHEF] Protocol enforcement active: ${chefDietRestrictions.join('|') || 'guest'}`);
    }

    // ── Load behavioral preference profile (soft hints — after protocol, before prompt) ─
    let behavioralMemorySection = "";
    if (userId) {
      try {
        const behavioralProfile = await derivePreferenceProfile(userId);
        if (behavioralProfile) {
          behavioralMemorySection = buildBehavioralMemoryPromptSection(behavioralProfile);
          console.log(`🧠 [BehavioralMemory] Profile loaded — ${behavioralProfile.auditMeta.evidenceCount} signals | proteins: ${behavioralProfile.patterns.prefersProteins.join(", ") || "none"} | cuisines: ${behavioralProfile.patterns.prefersCuisines.join(", ") || "none"}`);
        } else {
          console.log(`🧠 [BehavioralMemory] No preference history yet for user ${userId.slice(0, 8)}`);
        }
      } catch (err) {
        console.warn("⚠️ [BehavioralMemory] Could not derive preference profile:", err);
      }
    }

    // ── Load oncology-support context if active ─────────────────────────────
    // Activation: dietType === 'oncology-support' OR description text mentions oncology/cancer protocol
    let oncologyCtx: OncologySupportContext | null = null;
    let oncologyPromptSection = "";
    const descriptionMentionsOncology = /oncolog|cancer[\s\-]?support|cancer[\s\-]?protocol/i.test(description || "");
    const oncologyTriggered = dietType === 'oncology-support' || descriptionMentionsOncology;
    if (isOncologySupportEnabled() && oncologyTriggered && userId) {
      try {
        const [oncologyUser] = await db.select({ oncologySupportContext: users.oncologySupportContext })
          .from(users).where(eq(users.id, userId)).limit(1);
        const rawCtx = oncologyUser?.oncologySupportContext as OncologySupportContext | null ?? null;
        if (rawCtx?.enabled) {
          oncologyCtx = rawCtx;
          oncologyPromptSection = buildOncologySupportPrompt(rawCtx);
          const trigger = dietType === 'oncology-support' ? 'dietType' : 'text intent';
          console.log(`🔬 [CREATE-WITH-CHEF] Oncology-support context loaded (trigger: ${trigger}) — symptoms: ${rawCtx.symptoms?.join(', ') || 'none'}`);
        } else {
          // No DB context but oncology triggered: apply default hard-block
          oncologyPromptSection = buildOncologySupportPrompt({
            enabled: true,
            symptoms: [],
            emphasis: { highProteinNutrientDensity: true },
            source: "self",
            updatedBy: null,
            updatedAt: null,
          });
          console.log(`🔬 [CREATE-WITH-CHEF] Oncology-support active (default context — no DB record)`);
        }
      } catch (err) {
        console.warn("⚠️ [CREATE-WITH-CHEF] Could not load oncology context:", err);
      }
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const diversityGuidance = buildDiversityGuidance(diversityContext);
    if (diversityGuidance) {
      console.log(`🌈 [DiversityRule] Injecting diversity guidance into prompt`);
    }

    const oncologyTransformationRule = oncologyPromptSection
      ? `\nTRANSFORMATION RULE: If the requested dish is traditionally prepared with ingredients that violate the above constraints (e.g., added sugar, honey, brown sugar, processed meats), you MUST reinterpret it into a fully compliant version while preserving its cultural identity and spirit. The dish concept should remain recognizable — only non-compliant components are replaced with protocol-safe alternatives. Example: "soul food spareribs" → dry-rubbed oven-baked spareribs with turmeric-garlic spice rub, sweet potato wedges, and braised collard greens — no added sugar, no honey glaze.\n`
      : "";

    let basePrompt = `You are a professional chef creating a personalized meal recipe.
${chefProtocolBlock ? `\n${chefProtocolBlock}\n` : ""}${oncologyPromptSection ? `\n${oncologyPromptSection}\n` : ""}${oncologyTransformationRule}${behavioralMemorySection ? `\n${behavioralMemorySection}\n` : ""}
TASK: Create a complete ${validMealType} recipe based on this request: "${description}"

REQUIREMENTS:
- Create a delicious, well-balanced meal that matches the user's description
- Include realistic ingredients with precise quantities
- Provide detailed step-by-step cooking instructions
- Include accurate nutritional estimates with SEPARATE carb types
- Make the recipe achievable for home cooks
${starchGuidance}
${diversityGuidance ? `\n${diversityGuidance}\n` : ""}${vegetableStrategyGuidance ? `\n${vegetableStrategyGuidance}\n` : ''}
CARBOHYDRATE BREAKDOWN (CRITICAL):
- starchyCarbs: Carbs from rice, pasta, bread, potatoes, grains, beans, corn, oats
- fibrousCarbs: Carbs from vegetables, leafy greens, broccoli, peppers, onions, mushrooms
${hubCoupling?.promptFragment?.userPromptAddition || ''}
INGREDIENT MEASUREMENT RULES (NON-NEGOTIABLE):
Every ingredient MUST use a precise, measurable quantity. No vague units. No guessing.
- Proteins (chicken, beef, fish, pork, turkey): ALWAYS oz — e.g. "6 oz chicken breast"
- Potatoes / yams / sweet potatoes: ALWAYS oz — e.g. "5 oz sweet potato" (NEVER "1 potato" or "each")
- Rice / grains / pasta: cooked weight in oz — e.g. "4 oz cooked jasmine rice"
- Eggs: MUST include size — e.g. "3 large eggs" (NEVER just "2 eggs")
- Garlic: ALWAYS cloves — e.g. "4 cloves garlic" (NEVER "units", "each", or "medium")
- Onions / shallots: ALWAYS cup — e.g. "1 cup diced yellow onion" (NEVER "1 medium onion")
- Dense vegetables (broccoli, asparagus, green beans): oz — e.g. "4 oz broccoli florets"
- Leafy greens: cup — e.g. "3 cup mixed greens"
- Light vegetables (zucchini, spinach, peppers when sliced): cup — e.g. "1 cup sliced zucchini"
- Whole peppers used as vessels (stuffed): whole — e.g. "4 whole bell peppers"
- Oils / condiments / sauces: tbsp or tsp — e.g. "1 tbsp olive oil"
- Liquids (milk, broth, beverages): cup or fl oz — e.g. "8 fl oz almond milk"
- Spices / seasonings: tsp — e.g. "1 tsp cumin"
FORBIDDEN UNITS — NEVER use: "each", "piece", "pieces", "serving", "servings", "handful", "unit", "units", "medium", "large", "small" as a unit
NEVER use grams (g), milliliters (ml), or any metric unit

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
  "difficulty": "Easy" or "Medium" or "Hard",
  "substitutionNotes": ["1-sentence explanation per substitution made due to nutrition strategy, e.g. Rice was replaced with cauliflower rice to match your low-starch plan. Omit this field entirely if no substitutions were made."]
}

Create the recipe for: "${description}"`;

    // Apply diet-specific guardrails — skip entirely when strictMode is ON
    // (guardrails inject balance/wholefood rules that add unwanted ingredients)
    let prompt: string;
    if (strictMode) {
      prompt = `${basePrompt}\n\n${buildStrictModeBlock(description)}`;
      console.log(`🔒 [StrictMode] Guardrails skipped — user override active`);
    } else {
      const guardrailResult = applyGuardrails(
        basePrompt,
        dietType || null,
        validMealType,
        dietPhase as any,
        remainingMacros,
        builderMode
      );
      prompt = guardrailResult.modifiedPrompt;
      if (guardrailResult.appliedRules.length > 0) {
        console.log(`🛡️ Applied guardrails: ${guardrailResult.appliedRules.join(', ')}`);
      }
    }

    // EXPLICIT OVERRIDE INJECTION: user confirmed a builder guardrail conflict
    // Must be appended AFTER guardrails so it takes final precedence in the prompt
    if (explicitOverride?.confirmed && explicitOverride.item) {
      const overrideInstruction = `\n\nEXPLICIT USER REQUEST — MANDATORY: The user has explicitly requested "${explicitOverride.item}". You MUST include it in this meal. Do NOT substitute or remove it. You may only adjust the portion size, cooking method, or sides to best fit the plan. Never say it is "not allowed" or omit it.`;
      prompt = prompt + overrideInstruction;
      console.log(`✅ [ExplicitOverride] Injected override for "${explicitOverride.item}"`);
    }

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    const hubSystemPrompt = hubCoupling?.promptFragment?.systemPrompt;
    const fallbackSystemPrompt = getSystemPromptForDiet(dietType || null);
    const systemPrompt = hubSystemPrompt || fallbackSystemPrompt;
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    // Pre-build a relaxed prompt for BeachBody — strips remaining macro ceilings so the AI
    // isn't trapped in an impossible constraint on the final retry attempt.
    // Respects all clean-eating and phase rules; only the remaining-budget block is omitted.
    let relaxedMessages: Array<{ role: 'system' | 'user'; content: string }> | null = null;
    if (dietType === 'beachbody' && remainingMacros && !strictMode) {
      const relaxedGuardrail = applyGuardrails(basePrompt, 'beachbody', validMealType, dietPhase as any, undefined);
      relaxedMessages = [];
      if (systemPrompt) relaxedMessages.push({ role: 'system', content: systemPrompt });
      relaxedMessages.push({ role: 'user', content: relaxedGuardrail.modifiedPrompt });
    }

    const MAX_REGENERATION_ATTEMPTS = 2;
    let finalMealData: any = null;
    let attemptCount = 0;
    let lastFixHint: string | null = null;
    let substitutionPassUsed = false;
    // undefined = no validation context (non-vegan/vegetarian/pescatarian or legacy path)
    // true  = compliance confirmed   false = compliance failed / unresolvable
    let dietaryComplianceVerified: boolean | undefined = undefined;

    while (attemptCount < MAX_REGENERATION_ATTEMPTS) {
      attemptCount++;

      // On the last retry for BeachBody with remaining macros: switch to the relaxed prompt
      // (no budget ceilings) so the AI can still produce a clean compliant meal even when
      // the remaining budget math would make the constraint unsolvable.
      const isLastAttempt = attemptCount === MAX_REGENERATION_ATTEMPTS;
      const useRelaxedPrompt = isLastAttempt && relaxedMessages !== null;
      const currentMessages = useRelaxedPrompt ? [...relaxedMessages!] : [...messages];

      if (useRelaxedPrompt) {
        console.log(`🔄 [BeachBody] Last attempt — remaining macro ceiling relaxed, applying clean-eating fallback`);
        if (lastFixHint) {
          currentMessages.push({ role: 'user', content: `IMPORTANT CORRECTION: ${lastFixHint} (Remaining macro budget constraints have been relaxed for this attempt — focus on phase rules and clean ingredients only.)` });
        }
      } else if (lastFixHint) {
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
      const totalCarbs = resolveAICarbsStrict(mealData);
      
      let tempMeal: UnifiedMeal = {
        id: `chef-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: culturalNameTransform(mealData.name, chefEnvelope.cuisinePreference),
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

      // POST-GENERATION dietary validation (vegan / vegetarian / pescatarian)
      // Order: validate → substitute (max 1 pass) → re-validate → regenerate (max 1 retry)
      const chefPrimaryDiet = getPrimaryDiet(chefDietRestrictions);
      if (chefPrimaryDiet && ['vegan', 'vegetarian', 'pescatarian'].includes(chefPrimaryDiet)) {
        let dietValidation = validateDietaryRestriction(
          { name: tempMeal.name, ingredients: tempMeal.ingredients },
          chefPrimaryDiet as DietaryMode,
        );

        if (!dietValidation.isValid || dietValidation.confidence === 'low') {
          // Step A: attempt automatic ingredient substitution (max 1 pass)
          if (!substitutionPassUsed && dietValidation.violations.length > 0) {
            substitutionPassUsed = true;
            const { ingredients: subIngredients, substitutionsApplied } = applyDietarySubstitutions(
              tempMeal.ingredients,
              chefPrimaryDiet as DietaryMode,
            );
            if (substitutionsApplied.length > 0) {
              console.log(`🔄 [DIET GUARD] Substitution pass for ${chefPrimaryDiet}: ${substitutionsApplied.map(s => `${s.original} → ${s.replacement}`).join(', ')}`);
              tempMeal = { ...tempMeal, ingredients: subIngredients };
              // Re-validate after substitution
              dietValidation = validateDietaryRestriction(
                { name: tempMeal.name, ingredients: tempMeal.ingredients },
                chefPrimaryDiet as DietaryMode,
              );
            }
          }

          // Step B: if still invalid, trigger AI regeneration (uses existing retry loop)
          if (!dietValidation.isValid || dietValidation.confidence === 'low') {
            const violationSummary = dietValidation.violations.join('; ');
            console.warn(`⚠️ [DIET GUARD] Create-With-Chef ${chefPrimaryDiet} violation — attempt ${attemptCount}: ${violationSummary}`);
            if (attemptCount < MAX_REGENERATION_ATTEMPTS) {
              const forbidden = (chefDietRestrictions[0] || chefPrimaryDiet).toUpperCase();
              lastFixHint = `DIETARY VIOLATION DETECTED. This user strictly follows a ${forbidden} diet. ` +
                `Violations found: ${violationSummary}. ` +
                `Regenerate a fully compliant recipe — every ingredient must be ${chefPrimaryDiet}-safe. ` +
                `FORBIDDEN: ${(RESTRICTION_EXPANSION[chefPrimaryDiet] || []).join(', ')}.`;
              continue;
            }
            // Exhausted retries — meal cannot be certified
            console.error(`❌ [DIET GUARD] ${chefPrimaryDiet} compliance unresolvable after ${attemptCount} attempts — badge suppressed`);
            dietaryComplianceVerified = false;
          } else {
            console.log(`✅ [DIET GUARD] ${chefPrimaryDiet} compliance confirmed after substitution — confidence: ${dietValidation.confidence}`);
            dietaryComplianceVerified = true;
          }
        } else {
          console.log(`✅ [DIET GUARD] ${chefPrimaryDiet} compliance confirmed — confidence: ${dietValidation.confidence}`);
          dietaryComplianceVerified = true;
        }
      }

      // ── Hard starch stacking check (vegetarian / vegan) ──────────────────
      if (chefPrimaryDiet === 'vegetarian' || chefPrimaryDiet === 'vegan') {
        const starchCheck = validateStarchStructure(tempMeal, tempMeal.name);
        if (!starchCheck.valid && starchCheck.reason) {
          if (attemptCount < MAX_REGENERATION_ATTEMPTS) {
            lastFixHint = buildStarchFixHint(starchCheck, description || '');
            console.warn(`🥦 [STARCH GUARD] Stacking violation on attempt ${attemptCount} — regenerating with fix hint`);
            continue;
          }
          // Exhausted retries — log and continue (prefer serving over hard-blocking user)
          console.error(`❌ [STARCH GUARD] Starch stacking unresolvable after ${attemptCount} attempts — serving as-is`);
        }
      }

      // ── Post-gen protocol scan ────────────────────────────────────────────
      const chefScan = scanGeneratedOutput(tempMeal, chefEnvelope, {
        generatorName: 'create_with_chef',
      });
      if (!chefScan.passed) {
        console.log(`🚫 [CREATE-WITH-CHEF] Post-gen protocol violation (attempt ${attemptCount}): ${chefScan.message}`);
        if (attemptCount < MAX_REGENERATION_ATTEMPTS) {
          lastFixHint = `PROTOCOL VIOLATION: ${chefScan.message}. Regenerate a fully compliant recipe.`;
          continue;
        }
        return {
          success: false,
          source: 'error',
          error: chefScan.message,
        };
      }

      // ── Oncology hard-block post-gen scan ────────────────────────────────
      if (dietType === 'oncology-support') {
        const oncologyValidation = validateOncologyMealSafety({
          name: tempMeal.name,
          ingredients: tempMeal.ingredients,
        });
        if (!oncologyValidation.isValid) {
          console.warn(`🚨 [ONCOLOGY GUARD] Blocked ingredient detected (attempt ${attemptCount}): ${oncologyValidation.violations.join(', ')}`);
          if (attemptCount < MAX_REGENERATION_ATTEMPTS) {
            lastFixHint = `CANCER SUPPORT PROTOCOL VIOLATION: The following ingredients are strictly forbidden: ${oncologyValidation.violations.join(', ')}. ` +
              `These are processed/cured meats that are prohibited under this cancer nutrition protocol. ` +
              `Regenerate the meal using safe alternatives like wild salmon, chicken breast, eggs, legumes, or tofu. ` +
              `Do NOT include bacon, sausage, ham, deli meats, or any processed pork products.`;
            continue;
          }
          console.error(`❌ [ONCOLOGY GUARD] Unsafe meal could not be fixed after ${attemptCount} attempts — rejecting`);
          return {
            success: false,
            source: 'error',
            error: `This meal contains ingredients not permitted under the Cancer Support Nutrition protocol (${oncologyValidation.violations.join(', ')}). Please try a different description.`,
          };
        }
        console.log(`✅ [ONCOLOGY GUARD] Meal cleared — no blocked ingredients detected`);

        // ── Quality scoring ───────────────────────────────────────────────
        const qualityScore = scoreOncologyMealQuality({
          name: tempMeal.name,
          description: mealData.description,
          ingredients: tempMeal.ingredients,
        });

        console.log(`📊 [ONCOLOGY QUALITY] Score: ${qualityScore.total}/100 (${qualityScore.tier}) — ${qualityScore.scoreLabel}`);

        // ── Protein gram minimum ──────────────────────────────────────────
        const mealProteinG = tempMeal.protein ?? 0;
        const ONCOLOGY_MIN_PROTEIN_G = 20;
        if (mealProteinG < ONCOLOGY_MIN_PROTEIN_G && attemptCount < MAX_REGENERATION_ATTEMPTS) {
          console.warn(`🔬 [ONCOLOGY PROTEIN] Only ${mealProteinG}g protein — minimum is ${ONCOLOGY_MIN_PROTEIN_G}g — regenerating`);
          lastFixHint = `PROTEIN MINIMUM NOT MET: This meal only has ${mealProteinG}g of protein. Cancer Support Protocol requires at least ${ONCOLOGY_MIN_PROTEIN_G}g of clean protein per meal. ` +
            `Increase the protein source: use 5–6 oz fresh salmon or chicken breast, 3 whole eggs, 1 cup lentils or chickpeas, ` +
            `or combine 2 eggs + Greek yogurt. Ensure protein is the anchoring ingredient of this meal.`;
          continue;
        }

        if (!qualityScore.approvedForDisplay && attemptCount < MAX_REGENERATION_ATTEMPTS) {
          // Smart escalation: attempt 1 → specific component hints;
          // final attempt → force a proven structural template so the AI can't drift
          if (attemptCount === 1) {
            lastFixHint = qualityScore.regenerationHint ||
              "QUALITY IMPROVEMENT REQUIRED: Regenerate with a green-tier protein (≥20g), real fiber anchor (quinoa/lentils/oats/sweet potato — not just greens), anti-inflammatory vegetables (broccoli/kale/mushrooms), healthy fats (olive oil/avocado), and therapeutic boosters (garlic/turmeric/ginger/herbs).";
          } else {
            // Last attempt: abandon original approach and force a reliable structural pattern
            lastFixHint =
              "STRUCTURAL RESET REQUIRED. Do not try to improve the previous meal. " +
              "Build a completely new meal using this proven Cancer Support template: " +
              "PROTEIN: 5–6 oz fresh salmon OR 3 eggs OR 1 cup lentils. " +
              "FIBER: 3/4 cup cooked quinoa OR 1/2 cup oats OR 1 cup black beans or chickpeas. " +
              "VEGETABLES: 1 cup broccoli or kale or mushrooms or bell peppers. " +
              "FAT: 1 tbsp olive oil OR 1/4 avocado OR 1 tbsp tahini. " +
              "BOOSTERS: garlic clove + turmeric + lemon juice + fresh parsley or cilantro. " +
              "This template guarantees protein ≥20g, real fiber, anti-inflammatory vegetables, and therapeutic boosters. " +
              `User's original request was: "${description}". Adapt the template to match the spirit of the request while keeping all five quality pillars.`;
          }
          console.warn(`🔄 [ONCOLOGY QUALITY] Score ${qualityScore.total}/100 — attempt ${attemptCount} escalation triggered`);
          continue;
        }

        if (!qualityScore.approvedForDisplay) {
          // Exhausted retries — log but don't reject. A below-threshold meal is still
          // safe (passed hard-block gate). Prefer serving over blocking.
          console.warn(`⚠️ [ONCOLOGY QUALITY] Score ${qualityScore.total}/100 after ${attemptCount} attempts — serving as-is (safe but suboptimal)`);
          (tempMeal as any).qualityStatus = "fallback_safe";
        } else {
          (tempMeal as any).qualityStatus = `premium_${qualityScore.total}`;
        }
      }

      const substitutionNotes = Array.isArray(mealData.substitutionNotes) && mealData.substitutionNotes.length > 0
        ? mealData.substitutionNotes.filter((n: any) => typeof n === 'string' && n.trim().length > 0)
        : undefined;
      // IMPORTANT: use tempMeal.ingredients (not mealData.ingredients) so that any
      // dietary substitutions applied during validation are persisted to the response.
      finalMealData = { ...mealData, ingredients: tempMeal.ingredients, starchyCarbs, fibrousCarbs, totalCarbs, substitutionNotes, qualityStatus: (tempMeal as any).qualityStatus ?? undefined };
      break;
    }
    
    if (!finalMealData) {
      throw new Error("Failed to generate valid meal after regeneration attempts");
    }

    // Image generation — skipped when client handles it async (skipImage: true)
    let imageUrl: string | null = skipImage ? null : getFallbackImage(validMealType);
    if (!skipImage) {
      try {
        const generatedImage = await generateImageCached(
          finalMealData.name,
          finalMealData.ingredients?.map((ing: any) => ing.name) || [],
          'meal',
          'homemade',
        );
        if (generatedImage) {
          imageUrl = generatedImage;
          console.log(`🖼️ [create-with-chef] Image ready for: ${finalMealData.name}`);
        }
      } catch (imgError) {
        console.warn('⚠️ Image generation failed, using fallback:', imgError);
      }
    } else {
      console.log(`⚡ [create-with-chef] skipImage=true — returning text immediately, client handles image`);
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
      substitutionNotes: finalMealData.substitutionNotes,
      medicalBadges: [],
      source: 'ai',
      dietaryComplianceVerified,
    };
    
    if (dietaryComplianceVerified) {
      console.log(`🌿 [DIET GUARD] ${getPrimaryDiet(chefDietRestrictions)} badge authorized for: ${unifiedMeal.name}`);
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
    const CHEF_DIET_VALIDATION_REQUIRED = ['vegan', 'vegetarian', 'pescatarian'];
    const chefFallbackPrimaryDiet = dietType ? String(dietType).toLowerCase() : '';
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
      source: 'fallback',
      // Hard guarantee: unverified fallbacks are never vegan/veg/pesc compliant
      dietaryComplianceVerified: CHEF_DIET_VALIDATION_REQUIRED.includes(chefFallbackPrimaryDiet) ? false : undefined,
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
  dietType?: DietType,
  strictMode: boolean = false,
  explicitOverride?: ExplicitOverride | null
): Promise<MealGenerationResponse> {
  console.log(`🍪 Snack Creator: Generating healthy snack from craving: "${cravingDescription}"${dietType ? ` (diet: ${dietType})` : ''}`);
  
  try {
    await ensureHubsRegistered();
    
    let snackHubCoupling: HubCouplingResult | null = null;
    let snackEffectiveHubType: HubType | null = null;
    
    if (userId) {
      if (isValidHubType(dietType)) {
        snackEffectiveHubType = dietType;
      } else if (dietType == null) {
        snackEffectiveHubType = await detectHubTypeFromProfile(userId);
      }
      // else: explicit non-hub diet type → skip clinical hub injection
      
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
    
    // ── Load protocol envelope (drives all dietary enforcement) ───────────────
    const snackEnvelope = userId
      ? (await loadUserProtocolEnvelope(userId).catch(() => null)) ?? buildGuestEnvelope()
      : buildGuestEnvelope();

    const snackProtocolBlock = enforceBeforeGenerate(snackEnvelope, {
      generatorName: 'snack_creator',
    }).combined;

    // Use envelope's dietaryIdentity for vegan/vegetarian/pescatarian compliance loop
    const snackDietRestrictions: string[] = snackEnvelope.dietaryIdentity;
    if (snackProtocolBlock) {
      console.log(`🥗 [SNACK] Protocol enforcement active: ${snackDietRestrictions.join('|') || 'guest'}`);
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
${snackProtocolBlock ? `${snackProtocolBlock}\n` : ''}${snackHubCoupling?.promptFragment?.userPromptAddition || ''}
INGREDIENT MEASUREMENT RULES (NON-NEGOTIABLE):
Every ingredient MUST use a precise, measurable quantity:
- Proteins: ALWAYS oz — e.g. "4 oz turkey slices"
- Eggs: MUST include size — e.g. "2 large eggs" (NEVER just "2 eggs")
- Garlic: ALWAYS cloves — e.g. "2 cloves garlic" (NEVER "units", "each", "medium")
- Onions / shallots: ALWAYS cup — e.g. "0.5 cup diced onion" (NEVER "1 medium onion")
- Nuts/seeds: oz or tbsp — e.g. "1 oz almonds", "2 tbsp sunflower seeds"
- Fruits: cup or oz — e.g. "1 cup berries", "5 oz apple slices" (NEVER "1 apple")
- Vegetables: cup — e.g. "1 cup carrot sticks"
- Yogurt/dairy: cup or oz — e.g. "1 cup Greek yogurt"
- Oils/dressings: tbsp or tsp — e.g. "1 tbsp almond butter"
- Liquids: cup or fl oz — e.g. "8 fl oz almond milk"
FORBIDDEN: "each", "piece", "serving", "handful", "unit", "units", "medium", "large", "small" as units

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
    let guardrailedPrompt = guardrailResult.modifiedPrompt;
    
    if (guardrailResult.appliedRules.length > 0) {
      console.log(`🛡️ Applied snack guardrails: ${guardrailResult.appliedRules.join(', ')}`);
    }

    // EXPLICIT OVERRIDE INJECTION: user confirmed a builder guardrail conflict for snack
    if (explicitOverride?.confirmed && explicitOverride.item) {
      const overrideInstruction = `\n\nEXPLICIT USER REQUEST — MANDATORY: The user has explicitly requested "${explicitOverride.item}". You MUST include it in this snack. Do NOT substitute or remove it. You may only adjust the portion size, cooking method, or accompaniments to best fit the plan.`;
      guardrailedPrompt = guardrailedPrompt + overrideInstruction;
      console.log(`✅ [ExplicitOverride] Injected snack override for "${explicitOverride.item}"`);
    }

    // Apply Keep It Simple — same block as Create with Chef, no variation
    const prompt = strictMode
      ? `${guardrailedPrompt}\n\n${buildStrictModeBlock(cravingDescription)}`
      : guardrailedPrompt;

    if (strictMode) {
      console.log(`🔒 [KeepItSimple] Snack Creator strict mode ON — no extra ingredients`);
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
    let snackSubstitutionPassUsed = false;
    // undefined = no validation context (non-vegan/vegetarian/pescatarian or legacy path)
    // true  = compliance confirmed   false = compliance failed / unresolvable
    let snackDietaryComplianceVerified: boolean | undefined = undefined;

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
      const snackTotalCarbs = resolveAICarbsStrict(snackData);
      
      let tempSnack: UnifiedMeal = {
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

      // POST-GENERATION dietary validation for snacks (vegan / vegetarian / pescatarian)
      const snackPrimaryDiet = getPrimaryDiet(snackDietRestrictions);
      if (snackPrimaryDiet && ['vegan', 'vegetarian', 'pescatarian'].includes(snackPrimaryDiet)) {
        let snackDietValidation = validateDietaryRestriction(
          { name: tempSnack.name, ingredients: tempSnack.ingredients },
          snackPrimaryDiet as DietaryMode,
        );

        if (!snackDietValidation.isValid || snackDietValidation.confidence === 'low') {
          if (!snackSubstitutionPassUsed && snackDietValidation.violations.length > 0) {
            snackSubstitutionPassUsed = true;
            const { ingredients: subIngredients, substitutionsApplied } = applyDietarySubstitutions(
              tempSnack.ingredients,
              snackPrimaryDiet as DietaryMode,
            );
            if (substitutionsApplied.length > 0) {
              console.log(`🔄 [DIET GUARD] Snack substitution pass for ${snackPrimaryDiet}: ${substitutionsApplied.map(s => `${s.original} → ${s.replacement}`).join(', ')}`);
              tempSnack = { ...tempSnack, ingredients: subIngredients };
              snackDietValidation = validateDietaryRestriction(
                { name: tempSnack.name, ingredients: tempSnack.ingredients },
                snackPrimaryDiet as DietaryMode,
              );
            }
          }

          if (!snackDietValidation.isValid || snackDietValidation.confidence === 'low') {
            const snackViolationSummary = snackDietValidation.violations.join('; ');
            console.warn(`⚠️ [DIET GUARD] Snack ${snackPrimaryDiet} violation — attempt ${snackAttemptCount}: ${snackViolationSummary}`);
            if (snackAttemptCount < SNACK_MAX_REGENERATION_ATTEMPTS) {
              snackLastFixHint = `DIETARY VIOLATION DETECTED. This user strictly follows a ${snackPrimaryDiet.toUpperCase()} diet. ` +
                `Violations: ${snackViolationSummary}. ` +
                `Regenerate a fully ${snackPrimaryDiet}-compliant snack. ` +
                `FORBIDDEN: ${(RESTRICTION_EXPANSION[snackPrimaryDiet] || []).join(', ')}.`;
              continue;
            }
            console.error(`❌ [DIET GUARD] Snack ${snackPrimaryDiet} compliance unresolvable — badge suppressed`);
            snackDietaryComplianceVerified = false;
          } else {
            console.log(`✅ [DIET GUARD] Snack ${snackPrimaryDiet} compliance confirmed after substitution — confidence: ${snackDietValidation.confidence}`);
            snackDietaryComplianceVerified = true;
          }
        } else {
          console.log(`✅ [DIET GUARD] Snack ${snackPrimaryDiet} compliance confirmed — confidence: ${snackDietValidation.confidence}`);
          snackDietaryComplianceVerified = true;
        }
      }

      // ── Post-gen protocol scan ────────────────────────────────────────────
      const snackScan = scanGeneratedOutput(tempSnack, snackEnvelope, {
        generatorName: 'snack_creator',
      });
      if (!snackScan.passed) {
        console.log(`🚫 [SNACK] Post-gen protocol violation (attempt ${snackAttemptCount}): ${snackScan.message}`);
        if (snackAttemptCount < SNACK_MAX_REGENERATION_ATTEMPTS) {
          snackLastFixHint = `PROTOCOL VIOLATION: ${snackScan.message}. Regenerate a fully compliant snack.`;
          continue;
        }
        // Exhausted retries — surface the violation
        return {
          success: false,
          source: 'error',
          error: snackScan.message,
        };
      }

      // ── Oncology snack quality gate ───────────────────────────────────────
      // Applies when user is on the Cancer Support protocol.
      // Threshold: 70+ (lighter than the 85+ meal standard).
      const isOncologySnack =
        dietType === 'oncology-support' ||
        snackEnvelope.dietaryIdentity.includes('oncology-support');

      if (isOncologySnack) {
        const snackQuality = scoreOncologySnackQuality({
          name: tempSnack.name,
          ingredients: tempSnack.ingredients,
          description: tempSnack.description,
          protein: tempSnack.protein,
        });

        console.log(`🧬 [ONCOLOGY SNACK] Score: ${snackQuality.total}/100 — tier: ${snackQuality.tier} — caps: [${snackQuality.breakdown.caps.join(', ') || 'none'}]`);

        if (!snackQuality.approvedForDisplay && snackAttemptCount < SNACK_MAX_REGENERATION_ATTEMPTS) {
          snackLastFixHint = snackQuality.regenerationHint ||
            "CANCER SUPPORT SNACK: Include a clean protein (Greek yogurt/nuts/seeds/hummus), an anti-inflammatory ingredient (berries/dark chocolate/turmeric), and a healthy fat/fiber source (almonds/chia/avocado). Avoid processed foods.";
          console.warn(`🔄 [ONCOLOGY SNACK] Score ${snackQuality.total}/100 — regenerating with quality hint`);
          continue;
        }

        if (!snackQuality.approvedForDisplay) {
          console.warn(`⚠️ [ONCOLOGY SNACK] Score ${snackQuality.total}/100 after ${snackAttemptCount} attempts — serving as-is (safe but suboptimal)`);
          (tempSnack as any).qualityStatus = "snack_fallback_safe";
        } else {
          (tempSnack as any).qualityStatus = `snack_approved_${snackQuality.total}`;
        }
      }

      finalSnackData = { ...snackData, snackStarchyCarbs, snackFibrousCarbs, snackTotalCarbs, tempSnackIngredients: tempSnack.ingredients, qualityStatus: (tempSnack as any).qualityStatus ?? undefined };
      break;
    }
    
    if (!finalSnackData) {
      throw new Error("Failed to generate valid snack after regeneration attempts");
    }

    let imageUrl = getFallbackImage('snack');
    try {
      const generatedImage = await generateMealImageUnified(
        finalSnackData.name,
        finalSnackData.ingredients || [],
      );

      if (generatedImage) {
        imageUrl = generatedImage;
        console.log(`🖼️ [snack-creator] Image ready for: ${finalSnackData.name}`);
      }
    } catch (imgError) {
      console.warn('⚠️ Image generation failed for snack, using fallback:', imgError);
    }
    
    const snackIngredients = finalSnackData.tempSnackIngredients || (finalSnackData.ingredients || []).map((ing: any) => ({
      name: ing.name,
      quantity: String(ing.quantity || ''),
      unit: ing.unit || ''
    }));

    const unifiedSnack: UnifiedMeal = {
      id: `snack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: finalSnackData.name,
      description: finalSnackData.description,
      ingredients: snackIngredients,
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
      source: 'ai',
      dietaryComplianceVerified: snackDietaryComplianceVerified,
    };
    
    if (snackDietaryComplianceVerified) {
      console.log(`🌿 [DIET GUARD] ${getPrimaryDiet(snackDietRestrictions)} snack badge authorized for: ${unifiedSnack.name}`);
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
    const SNACK_DIET_VALIDATION_REQUIRED = ['vegan', 'vegetarian', 'pescatarian'];
    const snackFallbackPrimaryDiet = dietType ? String(dietType).toLowerCase() : '';
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
      source: 'fallback',
      // Hard guarantee: unverified fallbacks are never vegan/veg/pesc compliant
      dietaryComplianceVerified: snackFallbackPrimaryDiet && SNACK_DIET_VALIDATION_REQUIRED.includes(snackFallbackPrimaryDiet) ? false : undefined,
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
      result = await generateCravingMealUnified(cravingInput, request.mealType, request.userId, undefined, request.strictMode === true);
      break;

    case 'create-with-chef':
      const chefDescription = Array.isArray(request.input) 
        ? request.input.join(', ') 
        : request.input;
      result = await generateFromDescriptionUnified(
        chefDescription,
        request.mealType,
        request.userId,
        request.dietType,
        request.starchContext,
        request.nutritionStrategy,
        request.strictMode === true,
        request.skipImage === true,
        request.explicitOverride,
        request.diversityContext,
        request.dietPhase,
        request.remainingMacros,
        request.builderMode
      );
      break;

    case 'snack-creator':
      const snackCraving = Array.isArray(request.input) 
        ? request.input.join(', ') 
        : request.input;
      result = await generateSnackFromCravingUnified(snackCraving, request.userId, request.dietType, request.strictMode === true, request.explicitOverride);
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
