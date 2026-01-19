// 🔒 LOCKED FEATURE - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL  
// Feature: Glycemic Meal Generation Integration | Locked: 20250108-1925 | Status: ALL GENERATORS CONNECTED
// User Warning: "I'm gonna be pissed off" if this gets messed up later
// Complete integration of glycemic filtering across ALL meal generators with preferred carb substitution

/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
import { z } from "zod";
import OpenAI from "openai";
import pLimit from "p-limit";
import { convertToUserFriendlyUnits } from "../utils/unitConverter";
import { generateMealFromPrompt } from "./universalMealGenerator";
import { getGlycemicSettings } from "./glycemicSettingsService";
import * as telemetry from "./aiTelemetry";
import type { DebugMetadata } from "./aiTelemetry";

// Lazy initialization to ensure OPENAI_API_KEY is available after env aliasing
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ---- CONFIG ----
const MAX_DAYS = 7;
const BATCH_SIZE = 5;
const CONCURRENCY = 4;
const STAGE_B_TIMEOUT_MS = 15000;
const MODEL_INSTRUCTIONS = "gpt-4o";     // steps only, small prompt
const TEMPERATURE = 0.25;

const limit = pLimit(CONCURRENCY);

// ---- TYPES ----
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

// ---- ROBUST MEAL TYPE VALIDATOR ----
interface MealLike {
  name?: string;
  mealType?: MealType;
  ingredients?: Array<{ name: string }>;
  tags?: string[];
}

interface ValidationResult {
  isValid: boolean;
  detected?: MealType;
  reasons?: string[];
}

const RE = {
  breakfast: [
    /\b(parfait)s?\b/i, /\b(yogurt|greek yogurt)\b/i, /\b(oatmeal|overnight oats)\b/i,
    /\b(cereal|granola)\b/i, /\b(pancakes?)\b/i, /\b(waffles?)\b/i,
    /\b(toast|bagel|muffin|croissant)\b/i, /\b(smoothie|acai bowl)\b/i,
    /\b(egg|eggs|omelet|omelette|scramble|frittata)\b/i,
  ],
  lunch: [
    /\b(sandwich|wrap|panini|sub)\b/i, /\b(salad)\b/i, /\b(soup|chowder|bisque)\b/i,
    /\b(bowl|grain bowl|poke)\b/i, /\b(burrito)\b/i,
  ],
  dinner: [
    /\b(steak|roast|casserole|meatloaf|stir[- ]?fry)\b/i,
    /\b(curry|braise|rag[uù]|bolognese)\b/i,
    /\b(pasta|lasagna|enchiladas?|fajitas?)\b/i,
    /\b(salmon|cod|chicken breast|thighs?|pork chops?|short ribs?)\b/i,
  ],
  snack: [
    /\b(snack|trail mix|protein bar|jerky|chips?|crackers?)\b/i,
    /\b(hummus|dip)\b/i, /\b(fruit cup|apple slices?)\b/i, /\b(smoothie)\b/i,
  ],
};

// helper: does text match any pattern in list?
const hasAny = (text: string, pats: RegExp[]) => pats.some(p => p.test(text));

// classify by strongest match (breakfast-first bias for typical conflicts like "smoothie")
function detectMealType(text: string): MealType | undefined {
  if (hasAny(text, RE.breakfast)) return 'breakfast';
  if (hasAny(text, RE.dinner))    return 'dinner';
  if (hasAny(text, RE.lunch))     return 'lunch';
  if (hasAny(text, RE.snack))     return 'snack';
  return undefined;
}

function validateMealTypeRobust(meal: MealLike, sessionId?: string): ValidationResult {
  const name = (meal.name ?? '').toLowerCase();
  const ingredientsText = (meal.ingredients ?? []).map(i => i.name?.toLowerCase() ?? '').join(' ');
  const tagText = (meal.tags ?? []).join(' ').toLowerCase();
  const text = ` ${name} ${ingredientsText} ${tagText} `.replace(/\s+/g, ' ');

  const detected = detectMealType(text);
  const desired  = meal.mealType;
  const reasons: string[] = [];

  // Enforce: breakfast ≠ dinner
  if (desired === 'dinner' && hasAny(text, RE.breakfast)) {
    reasons.push('Breakfast-style item cannot be scheduled as dinner.');
  }

  // If you want consistency check when detected exists & conflicts strongly:
  if (desired && detected && desired !== detected) {
    // Only flag when conflict is strong (e.g., breakfast vs dinner)
    if ((desired === 'dinner' && detected === 'breakfast') || (desired === 'breakfast' && detected === 'dinner')) {
      reasons.push(`Declared as ${desired} but content looks like ${detected}.`);
    }
  }
  
  // Log validation failures with telemetry
  if (reasons.length > 0 && sessionId) {
    telemetry.tagFallback(sessionId, "validator_reject", `${meal.name}: ${reasons.join("; ")}`);
  }

  return { isValid: reasons.length === 0, detected, reasons: reasons.length ? reasons : undefined };
}
export type WeeklyMealReq = {
  userId: string;
  days?: number;                      // we clamp to 7
  mealTypes: MealType[];              // e.g., ["breakfast","lunch","dinner","snack"]
  dietaryRestrictions: string[];      // ["gluten_free","kosher","no_pork"]
  allergies: string[];                // ["peanut","tree nut","shellfish","egg","milk","soy","wheat"]
  selectedIngredients?: string[];     // ingredients to prioritize/include in meal generation
  medicalFlags: string[];             // ["type2_diabetes","low_gi",...]
  diversity?: { minUniqueProteins?: number; minUniqueVeg?: number };
  kidFriendly?: boolean;              // for craving creator kid meals
};
type Skeleton = {
  name: string;
  mealType: MealType;
  ingredients: { name: string; grams: number }[];
  tags: string[];
};
type FinalMeal = {
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
  _debug?: DebugMetadata | null;
};

// ---- LOAD CATALOG ----
const CatalogSchema = z.array(z.object({
  name: z.string(),
  mealType: z.enum(["breakfast","lunch","dinner","snack"]),
  ingredients: z.array(z.object({ name: z.string(), grams: z.number().positive() })),
  tags: z.array(z.string())
}));

function loadCatalog(): Skeleton[] {
  try {
    const p = path.resolve(process.cwd(), "data/catalog/meals_skeletons.json");
    const raw = fs.readFileSync(p, "utf-8");
    const json = JSON.parse(raw);
    const parsed = CatalogSchema.parse(json);
    return parsed as Skeleton[];
  } catch (error) {
    console.error("Failed to load catalog, using comprehensive fallback:", error);
    // Comprehensive fallback catalog
    return [
      // Breakfast options
      {
        name: "Scrambled Eggs & Toast",
        mealType: "breakfast",
        ingredients: [
          { name: "Eggs", grams: 120 },
          { name: "Whole grain bread", grams: 40 },
          { name: "Butter", grams: 5 }
        ],
        tags: ["high_protein", "kid_friendly"]
      },
      {
        name: "Greek Yogurt Bowl",
        mealType: "breakfast", 
        ingredients: [
          { name: "Greek yogurt", grams: 200 },
          { name: "Mixed berries", grams: 80 },
          { name: "Granola", grams: 30 }
        ],
        tags: ["high_protein", "antioxidant_rich"]
      },
      {
        name: "Oatmeal with Banana",
        mealType: "breakfast",
        ingredients: [
          { name: "Rolled oats", grams: 50 },
          { name: "Banana", grams: 120 },
          { name: "Almond milk", grams: 200 }
        ],
        tags: ["fiber_rich", "dairy_free"]
      },
      // Lunch options
      {
        name: "Turkey Sandwich",
        mealType: "lunch",
        ingredients: [
          { name: "Turkey breast", grams: 90 },
          { name: "Whole wheat bread", grams: 60 },
          { name: "Lettuce", grams: 30 }
        ],
        tags: ["balanced", "kid_friendly"]
      },
      {
        name: "Chicken Caesar Salad",
        mealType: "lunch",
        ingredients: [
          { name: "Chicken breast", grams: 120 },
          { name: "Romaine lettuce", grams: 100 },
          { name: "Parmesan cheese", grams: 25 }
        ],
        tags: ["high_protein", "low_carb"]
      },
      {
        name: "Quinoa Bowl",
        mealType: "lunch",
        ingredients: [
          { name: "Quinoa", grams: 80 },
          { name: "Black beans", grams: 100 },
          { name: "Avocado", grams: 60 }
        ],
        tags: ["plant_based", "complete_protein"]
      },
      // Dinner options
      {
        name: "Grilled Chicken & Rice",
        mealType: "dinner",
        ingredients: [
          { name: "Chicken breast", grams: 170 },
          { name: "White rice", grams: 150 },
          { name: "Broccoli", grams: 120 }
        ],
        tags: ["high_protein", "gluten_free"]
      },
      {
        name: "Salmon with Sweet Potato",
        mealType: "dinner",
        ingredients: [
          { name: "Salmon fillet", grams: 150 },
          { name: "Sweet potato", grams: 200 },
          { name: "Asparagus", grams: 100 }
        ],
        tags: ["omega_3", "anti_inflammatory"]
      },
      {
        name: "Beef Stir Fry",
        mealType: "dinner",
        ingredients: [
          { name: "Lean beef", grams: 120 },
          { name: "Mixed vegetables", grams: 150 },
          { name: "Brown rice", grams: 100 }
        ],
        tags: ["high_protein", "iron_rich"]
      },
      // Snack options
      {
        name: "Apple Slices",
        mealType: "snack",
        ingredients: [
          { name: "Apple", grams: 150 }
        ],
        tags: ["kid_friendly", "dairy_free"]
      },

      // Essential kids meal favorites
      {
        name: "Mac and Cheese",
        mealType: "lunch",
        ingredients: [
          { name: "elbow macaroni", grams: 85 },
          { name: "cheddar cheese", grams: 60 },
          { name: "butter", grams: 15 },
          { name: "milk", grams: 50 }
        ],
        tags: ["kid_friendly", "comfort_food", "quick_meal"]
      },
      {
        name: "Chicken Nuggets",
        mealType: "lunch",
        ingredients: [
          { name: "chicken breast", grams: 120 },
          { name: "breadcrumbs", grams: 30 },
          { name: "egg", grams: 25 },
          { name: "flour", grams: 20 }
        ],
        tags: ["kid_friendly", "protein_rich", "crispy"]
      },
      {
        name: "Grilled Cheese Sandwich",
        mealType: "lunch",
        ingredients: [
          { name: "bread", grams: 60 },
          { name: "cheddar cheese", grams: 40 },
          { name: "butter", grams: 10 }
        ],
        tags: ["kid_friendly", "comfort_food", "quick_meal"]
      },
      {
        name: "Mini Pizza",
        mealType: "lunch",
        ingredients: [
          { name: "english muffin", grams: 30 },
          { name: "pizza sauce", grams: 20 },
          { name: "mozzarella cheese", grams: 25 },
          { name: "pepperoni", grams: 15 }
        ],
        tags: ["kid_friendly", "fun_food", "customizable"]
      },
      {
        name: "Pancakes",
        mealType: "breakfast",
        ingredients: [
          { name: "flour", grams: 60 },
          { name: "egg", grams: 25 },
          { name: "milk", grams: 80 },
          { name: "maple syrup", grams: 15 }
        ],
        tags: ["kid_friendly", "sweet", "weekend_treat"]
      },
      {
        name: "Peanut Butter and Jelly Sandwich",
        mealType: "lunch",
        ingredients: [
          { name: "bread", grams: 60 },
          { name: "peanut butter", grams: 20 },
          { name: "grape jelly", grams: 15 }
        ],
        tags: ["kid_friendly", "classic", "no_cooking"]
      },
      {
        name: "Mixed Nuts",
        mealType: "snack",
        ingredients: [
          { name: "Almonds", grams: 30 },
          { name: "Walnuts", grams: 20 }
        ],
        tags: ["healthy_fats", "protein"]
      },
      {
        name: "Hummus & Vegetables",
        mealType: "snack",
        ingredients: [
          { name: "Hummus", grams: 60 },
          { name: "Carrot sticks", grams: 80 },
          { name: "Cucumber", grams: 60 }
        ],
        tags: ["plant_based", "fiber_rich"]
      }
    ];
  }
}

// ---- RULES (in CODE, deterministic) ----
function violatesAllergy(ings: Skeleton["ingredients"], allergies: string[]) {
  const s = ings.map(i => i.name.toLowerCase()).join(" | ");
  return allergies.some(a => s.includes(a.toLowerCase()));
}

function violatesDiet(ings: Skeleton["ingredients"], diet: string[]) {
  const txt = ings.map(i => i.name.toLowerCase()).join(" | ");
  for (const r of diet) {
    if (r === "gluten_free" && /\b(wheat|barley|rye|breadcrumbs|panko|pasta)\b/.test(txt)) return true;
    if (r === "no_pork" && /\bpork\b/.test(txt)) return true;
    if (r === "kosher" && /\b(pork|shellfish)\b/.test(txt)) return true;
    if (r === "dairy_free" && /\b(milk|cheese|yogurt|butter|parmesan|cream)\b/.test(txt)) return true;
  }
  return false;
}

function medicalBadgesFor(s: Skeleton, flags: string[]): string[] {
  const text = (s.ingredients.map(i => i.name).join(" ") + " " + s.name).toLowerCase();
  const badges: string[] = [];
  if (flags.some(f => ["type1_diabetes","type2_diabetes","low_gi"].includes(f))) {
    if (!/\b(syrup|candy|frosting|soda|donut|pastry)\b/.test(text)) badges.push("Diabetes-Safe");
    badges.push("Low-GI-Cautious");
  }
  if (flags.includes("heart_health")) {
    if (/\b(salmon|olive oil|avocado|nuts)\b/.test(text)) badges.push("Heart-Healthy");
  }
  return badges;
}

function norm(s: string){ return s.toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim(); }
function jaccard(a:Set<string>,b:Set<string>){const aArr=Array.from(a);const i=aArr.filter(x=>b.has(x)).length;const u=new Set(aArr.concat(Array.from(b))).size;return u?i/u:0;}
function tooSimilarByName(a:string,b:string){const A=new Set(norm(a).split(" ")),B=new Set(norm(b).split(" "));return jaccard(A,B)>0.7;}
function tooSimilarByIngs(a:Skeleton["ingredients"],b:Skeleton["ingredients"]){
  const A=new Set(a.map(x=>norm(x.name))); const B=new Set(b.map(x=>norm(x.name))); return jaccard(A,B)>0.6;
}

// ---- MEAL TYPE VALIDATION ----
function validateMealType(meal: Skeleton): boolean {
  const name = meal.name.toLowerCase();
  const ingredients = meal.ingredients.map(i => i.name.toLowerCase()).join(' ');
  const text = `${name} ${ingredients}`;
  
  // Breakfast items should not be assigned to dinner
  const breakfastKeywords = ['parfait', 'yogurt', 'oatmeal', 'cereal', 'pancake', 'waffle', 'toast', 'bagel', 'muffin', 'smoothie', 'granola'];
  const isBreakfastItem = breakfastKeywords.some(keyword => text.includes(keyword));
  
  if (isBreakfastItem && meal.mealType === 'dinner') {
    console.warn(`⚠️ Meal type mismatch: "${meal.name}" appears to be breakfast but assigned as ${meal.mealType}`);
    return false;
  }
  
  // Snack items should not be assigned to main meals
  const snackKeywords = ['chip', 'cookie', 'cracker', 'nuts', 'trail mix', 'fruit cup', 'energy bar'];
  const isSnackItem = snackKeywords.some(keyword => text.includes(keyword));
  
  if (isSnackItem && ['breakfast', 'lunch', 'dinner'].includes(meal.mealType)) {
    console.warn(`⚠️ Meal type mismatch: "${meal.name}" appears to be snack but assigned as ${meal.mealType}`);
    return false;
  }
  
  // Heavy dinner items should not be assigned to breakfast
  const dinnerKeywords = ['steak', 'roast', 'casserole', 'curry', 'stir fry', 'pasta with meat', 'beef', 'pork chop'];
  const isDinnerItem = dinnerKeywords.some(keyword => text.includes(keyword));
  
  if (isDinnerItem && meal.mealType === 'breakfast') {
    console.warn(`⚠️ Meal type mismatch: "${meal.name}" appears to be dinner but assigned as ${meal.mealType}`);
    return false;
  }
  
  return true;
}

// ---- MEAL TYPE CORRECTION ----
function correctMealType(meal: Skeleton): Skeleton {
  const name = meal.name.toLowerCase();
  const ingredients = meal.ingredients.map(i => i.name.toLowerCase()).join(' ');
  const text = `${name} ${ingredients}`;
  
  // Auto-correct obvious breakfast items
  const breakfastKeywords = ['parfait', 'yogurt', 'oatmeal', 'cereal', 'pancake', 'waffle', 'toast', 'bagel', 'muffin', 'smoothie', 'granola'];
  const isBreakfastItem = breakfastKeywords.some(keyword => text.includes(keyword));
  
  if (isBreakfastItem && meal.mealType !== 'breakfast') {
    console.log(`🔄 Auto-correcting "${meal.name}" from ${meal.mealType} to breakfast`);
    return { ...meal, mealType: 'breakfast' as MealType };
  }
  
  // Auto-correct obvious snack items
  const snackKeywords = ['chip', 'cookie', 'cracker', 'nuts', 'trail mix', 'fruit cup', 'energy bar', 'apple', 'banana'];
  const isSnackItem = snackKeywords.some(keyword => text.includes(keyword)) && 
                     !text.includes('salad') && !text.includes('soup') && !text.includes('sandwich');
  
  if (isSnackItem && meal.mealType !== 'snack') {
    console.log(`🔄 Auto-correcting "${meal.name}" from ${meal.mealType} to snack`);
    return { ...meal, mealType: 'snack' as MealType };
  }
  
  return meal;
}

// ---- NUTRITION (computed locally) ----
async function computeNutrition(ings: Skeleton["ingredients"]){
  // Simple nutrition calculation - replace with USDA database lookup if needed
  let calories=0,protein=0,carbs=0,fat=0;
  
  for(const i of ings) {
    const name = i.name.toLowerCase();
    const grams = i.grams;
    
    // Basic nutrition per 100g estimates
    if (name.includes('chicken') || name.includes('turkey')) {
      calories += Math.round(grams * 1.65); protein += Math.round(grams * 0.31); fat += Math.round(grams * 0.04);
    } else if (name.includes('salmon') || name.includes('fish')) {
      calories += Math.round(grams * 2.08); protein += Math.round(grams * 0.25); fat += Math.round(grams * 0.12);
    } else if (name.includes('egg')) {
      calories += Math.round(grams * 1.55); protein += Math.round(grams * 0.13); fat += Math.round(grams * 0.11);
    } else if (name.includes('rice') || name.includes('quinoa') || name.includes('pasta')) {
      calories += Math.round(grams * 1.30); carbs += Math.round(grams * 0.28); protein += Math.round(grams * 0.03);
    } else if (name.includes('bread') || name.includes('tortilla')) {
      calories += Math.round(grams * 2.65); carbs += Math.round(grams * 0.49); protein += Math.round(grams * 0.09);
    } else if (name.includes('broccoli') || name.includes('spinach') || name.includes('lettuce')) {
      calories += Math.round(grams * 0.34); carbs += Math.round(grams * 0.07); protein += Math.round(grams * 0.03);
    } else if (name.includes('apple') || name.includes('berry') || name.includes('fruit')) {
      calories += Math.round(grams * 0.52); carbs += Math.round(grams * 0.14);
    } else {
      // Default estimates
      calories += Math.round(grams * 0.8); protein += Math.round(grams * 0.05); 
      carbs += Math.round(grams * 0.12); fat += Math.round(grams * 0.03);
    }
  }
  return { calories, protein, carbs, fat };
}

// ---- PICKER ----
function buildSlots(days:number, types:MealType[]){ 
  const out:MealType[]=[]; 
  for(let d=0; d<Math.min(days, MAX_DAYS); d++){ 
    for(const t of types) out.push(t); 
  } 
  return out; 
}

function pickFromCatalog(req: WeeklyMealReq, catalog: Skeleton[], slots: MealType[], glycemicSettings?: any): Skeleton[] {
  // First, correct any meal type mismatches in the catalog
  const correctedCatalog = catalog.map(meal => correctMealType(meal));
  
  let pool = correctedCatalog.filter(s =>
    slots.includes(s.mealType) &&
    !violatesAllergy(s.ingredients, req.allergies) &&
    !violatesDiet(s.ingredients, req.dietaryRestrictions) &&
    validateMealType(s) // Ensure meal type is appropriate
  );

  // Apply glycemic filtering if settings exist
  if (glycemicSettings?.preferredCarbs?.length > 0) {
    const preferredCarbs = glycemicSettings.preferredCarbs.map((c: string) => c.toLowerCase());
    pool = pool.filter(s => 
      s.ingredients.some(ing => 
        preferredCarbs.some((carb: string) => 
          ing.name.toLowerCase().includes(carb)
        )
      )
    );
    console.log(`🩸 Filtered to ${pool.length} meals matching preferred low-GI carbs`);
  }

  const out: Skeleton[] = [];
  const used: Skeleton[] = [];
  
  for (const slot of slots) {
    const candidates = pool.filter(p => 
      p.mealType === slot && 
      !used.some(u => 
        tooSimilarByName(u.name,p.name) || 
        tooSimilarByIngs(u.ingredients,p.ingredients)
      )
    );
    
    let pick: Skeleton | undefined = candidates[Math.floor(Math.random() * Math.max(candidates.length, 1))];
    if (!pick) {
      pick = pool.find(p => p.mealType === slot);
    }
    if (!pick) {
      pick = catalog.find(p => p.mealType === slot);
    }
    
    if (pick) {
      out.push(pick);
      used.push(pick);
    } else {
      console.warn(`No meal found for slot: ${slot}`);
      // Create a fallback meal to prevent null issues
      const fallback: Skeleton = {
        name: `Default ${slot} meal`,
        mealType: slot,
        ingredients: [{ name: "Placeholder ingredient", grams: 100 }],
        tags: ['fallback']
      };
      out.push(fallback);
      used.push(fallback);
    }
  }
  return out;
}

// ---- INSTRUCTIONS (small GPT pass) ----
const InstructionsSchema = z.object({
  instructions: z.array(z.object({ 
    name: z.string(), 
    steps: z.array(z.string()).min(3).max(8) 
  })).min(1)
});

async function instructBatch(items: Skeleton[]): Promise<Record<string,string[]>> {
  try {
    const sys = "You write short, precise cooking instructions ONLY. Return JSON { instructions: [{ name, steps[] }] }. Steps are imperative, max 8, no fluff.";
    const user = `Generate instructions for these meals: ${items.map(s => `${s.name}: ${s.ingredients.map(i => i.name).join(', ')}`).join('; ')}`;
    
    const response = await getOpenAI().chat.completions.create({
      model: MODEL_INSTRUCTIONS,
      temperature: TEMPERATURE,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content in response");
    
    const parsed = InstructionsSchema.parse(JSON.parse(content));
    const result: Record<string, string[]> = {};
    
    for (const item of parsed.instructions) {
      result[item.name] = item.steps;
    }
    
    return result;
  } catch (error) {
    console.error("Instruction generation failed:", error);
    // Return fallback instructions
    const result: Record<string, string[]> = {};
    for (const item of items) {
      result[item.name] = [
        "Prepare all ingredients",
        "Follow basic cooking methods for each ingredient", 
        "Combine and serve"
      ];
    }
    return result;
  }
}

// ---- MAIN GENERATOR ----
export async function generateWeeklyMeals(req: WeeklyMealReq): Promise<FinalMeal[]> {
  console.log("🎯 Starting stable meal generation with catalog system");
  
  // Get glycemic settings for user
  const glycemicSettings = await getGlycemicSettings(req.userId).catch(() => null);
  if (glycemicSettings) {
    console.log(`🩸 Loaded glycemic settings: glucose=${glycemicSettings.bloodGlucose}, carbs=${glycemicSettings.preferredCarbs?.length || 0}`);
  }
  
  // Build slots based on request
  const days = Math.min(req.days || 7, MAX_DAYS);
  const slots = buildSlots(days, req.mealTypes);
  console.log(`📅 Generated ${slots.length} meal slots for ${days} days`);
  
  // Load catalog and pick meals
  const catalog = loadCatalog();
  console.log(`📚 Loaded ${catalog.length} meal templates from catalog`);
  
  const picked = pickFromCatalog(req, catalog, slots, glycemicSettings);
  console.log(`✅ Selected ${picked.length} meals from catalog`);
  
  // Generate nutrition and instructions
  const results: FinalMeal[] = [];
  
  // Process in batches for instructions
  for (let i = 0; i < picked.length; i += BATCH_SIZE) {
    const batch = picked.slice(i, i + BATCH_SIZE);
    
    // Get instructions for batch
    const instructions = await limit(() => instructBatch(batch));
    
    // Process each meal in the batch
    for (const skeleton of batch) {
      const nutrition = await computeNutrition(skeleton.ingredients);
      const medicalBadges = medicalBadgesFor(skeleton, req.medicalFlags);
      
      const meal: FinalMeal = {
        id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: skeleton.name,
        description: `A delicious ${skeleton.mealType} featuring ${skeleton.ingredients.slice(0, 3).map(i => i.name).join(', ')}`,
        mealType: skeleton.mealType,
        ingredients: convertToUserFriendlyUnits(skeleton.ingredients.map(ing => ({
          name: ing.name,
          amount: ing.grams,
          unit: 'g',
          notes: ''
        }))),
        instructions: instructions[skeleton.name] || [
          "Prepare all ingredients",
          "Cook according to standard methods",
          "Season and serve"
        ],
        nutrition,
        medicalBadges,
        flags: skeleton.tags,
        servingSize: "1 serving",
        imageUrl: null, // No images for speed
        createdAt: new Date()
      };
      
      results.push(meal);
    }
  }
  
  console.log(`🍽️ Generated ${results.length} complete meals with instructions and nutrition`);
  return results;
}

// ---- CRAVING CREATOR (single meal) ----
export async function generateCravingMeal(targetMealType: MealType, craving?: string, userPrefs?: Partial<WeeklyMealReq>): Promise<FinalMeal> {
  console.log(`🎯 Generating single ${targetMealType} meal for craving creator`);
  if (craving) console.log(`🎯 Craving: ${craving}`);
  
  // Create telemetry session for tracking
  const sessionId = telemetry.createSession("cravingCreator");
  
  // Get glycemic settings for user if userId provided
  let glycemicSettings = null;
  if (userPrefs?.userId) {
    glycemicSettings = await getGlycemicSettings(userPrefs.userId).catch(() => null);
    if (glycemicSettings) {
      console.log(`🩸 Loaded glycemic settings: glucose=${glycemicSettings.bloodGlucose}, carbs=${glycemicSettings.preferredCarbs?.length || 0}`);
    }
  }
  
  const catalog = loadCatalog();
  // First, correct any meal type mismatches in the catalog
  const correctedCatalog = catalog.map(meal => correctMealType(meal));
  
  let filtered = correctedCatalog.filter(s => {
    const validation = validateMealTypeRobust({ 
      name: s.name, 
      mealType: targetMealType,
      ingredients: s.ingredients.map(ing => ({ name: ing.name })),
      tags: s.tags 
    }, sessionId);
    
    if (!validation.isValid) {
      console.log(`🚫 Filtered out ${s.name}: ${validation.reasons?.join(', ')}`);
      return false;
    }
    
    return s.mealType === targetMealType &&
      (!userPrefs?.allergies || !violatesAllergy(s.ingredients, userPrefs.allergies)) &&
      (!userPrefs?.dietaryRestrictions || !violatesDiet(s.ingredients, userPrefs.dietaryRestrictions));
  });

  // Apply glycemic filtering if settings exist
  if (glycemicSettings && glycemicSettings.preferredCarbs && glycemicSettings.preferredCarbs.length > 0) {
    const preferredCarbs = glycemicSettings.preferredCarbs.map((c: string) => c.toLowerCase());
    const originalCount = filtered.length;
    const glycemicFiltered = filtered.filter(s => 
      s.ingredients.some(ing => 
        preferredCarbs.some((carb: string) => 
          ing.name.toLowerCase().includes(carb)
        )
      )
    );
    if (glycemicFiltered.length > 0) {
      filtered = glycemicFiltered;
      console.log(`🩸 Applied glycemic filtering: ${filtered.length} meals match preferred low-GI carbs`);
    } else if (originalCount > 0) {
      telemetry.tagFallback(sessionId, "glycemic_filter_fallback", `No meals matched glycemic preferences, keeping ${originalCount} meals`);
    }
  }

  // Special handling for kid-friendly meals
  if (userPrefs?.kidFriendly || (craving && typeof craving === 'string' && craving.includes('kid-friendly'))) {
    console.log("🧒 Filtering for kid-friendly meals");
    
    // Direct craving match for kids
    if (craving && typeof craving === 'string' && craving.toLowerCase().includes('mac')) {
      const macAndCheese = catalog.find(s => s.name.toLowerCase().includes('mac and cheese'));
      if (macAndCheese) {
        console.log("🧒 Direct match found: Mac and Cheese");
        filtered = [macAndCheese];
      }
    } else if (craving && typeof craving === 'string' && craving.toLowerCase().includes('nugget')) {
      const nuggets = catalog.find(s => s.name.toLowerCase().includes('chicken nuggets'));
      if (nuggets) {
        console.log("🧒 Direct match found: Chicken Nuggets");
        filtered = [nuggets];
      }
    } else if (craving && typeof craving === 'string' && (craving.toLowerCase().includes('grilled cheese') || (craving.toLowerCase().includes('grilled') && craving.toLowerCase().includes('cheese')))) {
      const grilledCheese = catalog.find(s => s.name.toLowerCase().includes('grilled cheese'));
      if (grilledCheese) {
        console.log("🧒 ✅ Direct match found: Grilled Cheese Sandwich");
        
        // Create the meal directly from the matched item
        const selected = grilledCheese;
        const isKidMeal = userPrefs?.kidFriendly || (craving && craving.includes('kid-friendly'));
        
        // Create nutrition estimate
        const nutrition = {
          calories: Math.round(selected.ingredients.reduce((sum, ing) => sum + ing.grams * 2.5, 0)),
          protein: Math.round(selected.ingredients.filter(ing => 
            ing.name.toLowerCase().includes('cheese') || 
            ing.name.toLowerCase().includes('meat') || 
            ing.name.toLowerCase().includes('chicken') ||
            ing.name.toLowerCase().includes('egg')
          ).reduce((sum, ing) => sum + ing.grams * 0.2, 0)),
          carbs: Math.round(selected.ingredients.filter(ing => 
            ing.name.toLowerCase().includes('bread') || 
            ing.name.toLowerCase().includes('rice') ||
            ing.name.toLowerCase().includes('pasta')
          ).reduce((sum, ing) => sum + ing.grams * 0.7, 0)),
          fat: Math.round(selected.ingredients.filter(ing => 
            ing.name.toLowerCase().includes('oil') || 
            ing.name.toLowerCase().includes('butter') ||
            ing.name.toLowerCase().includes('cheese')
          ).reduce((sum, ing) => sum + ing.grams * 0.3, 0))
        };
        
        // Generate image for meal
        let imageUrl = null;
        try {
          const { generateImage } = await import("./imageService");
          imageUrl = await generateImage({
            name: selected.name,
            description: `child-friendly cartoon-style version, colorful plate, fun design, appealing to kids`,
            type: 'meal',
            style: 'kid-friendly',
            ingredients: selected.ingredients.map(ing => ing.name),
            calories: nutrition.calories,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat,
          });
          console.log(`📸 Generated kid-friendly image for ${selected.name}`);
        } catch (error) {
          console.log(`❌ Image generation failed for ${selected.name}:`, error);
        }
        
        return {
          id: `craving-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: selected.name,
          description: `A kid-friendly lunch that children will love! Made with ${selected.ingredients.slice(0, 3).map(ing => ing.name).join(', ')}. Fun, tasty, and nutritious.`,
          mealType: selected.mealType,
          ingredients: selected.ingredients.map(ing => ({
            name: ing.name,
            amount: ing.grams,
            unit: 'g',
            notes: ''
          })),
          instructions: [
            "Heat a non-stick pan over medium heat.",
            "Butter one side of each bread slice.",
            "Place one slice butter-side down in the pan.",
            "Add cheese slices on top of the bread in the pan.",
            "Top with the second slice of bread, butter-side up.",
            "Cook for 2-3 minutes until golden brown.",
            "Flip carefully and cook the other side for 2-3 minutes.",
            "Remove from heat, let cool for 1 minute, and cut in half.",
            "Serve immediately while cheese is melted."
          ],
          nutrition,
          medicalBadges: [],
          flags: selected.tags,
          servingSize: "1 serving",
          imageUrl: imageUrl,
          createdAt: new Date()
        };
      } else {
        console.log("🧒 No grilled cheese found in catalog, using fallback logic");
      }
    } else if (craving && craving.toLowerCase().includes('pizza')) {
      const pizza = catalog.find(s => s.name.toLowerCase().includes('pizza'));
      if (pizza) {
        console.log("🧒 Direct match found: Mini Pizza");
        filtered = [pizza];
      }
    } else {
      // Filter for kid-friendly meals first
      const kidFriendlyFiltered = filtered.filter(s => 
        s.tags.includes('kid_friendly') || 
        s.tags.includes('comfort_food') ||
        ['Mac and Cheese', 'Chicken Nuggets', 'Grilled Cheese', 'Pizza', 'Pasta', 'Pancakes', 'French Toast', 'Peanut Butter'].some(kidMeal => 
          s.name.toLowerCase().includes(kidMeal.toLowerCase())
        )
      );
      
      if (kidFriendlyFiltered.length > 0) {
        filtered = kidFriendlyFiltered;
        console.log(`🧒 Found ${filtered.length} kid-friendly meals`);
      }
    }
  }
  
  // CRAVING MATCHING LOGIC - Filter by craving if provided
  // For kids meals, also process craving matching to find the right kid-friendly meal
  if (craving && (!userPrefs?.kidFriendly || filtered.length > 1)) {
    const cravingLower = craving.toLowerCase().trim();
    console.log(`🔍 Filtering for craving: "${cravingLower}"`);
    console.log(`🔍 Available meals before craving filter: ${filtered.map(s => s.name)}`);
    
    // Enhanced craving matching for common food categories
    const cravingMappings: Record<string, string[]> = {
      'fish': ['salmon', 'tuna', 'cod', 'tilapia', 'trout', 'bass', 'halibut'],
      'seafood': ['salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'cod', 'tilapia'],
      'chicken': ['chicken'],
      'beef': ['beef', 'steak'],
      'turkey': ['turkey'],
      'pasta': ['pasta', 'spaghetti', 'linguine', 'penne'],
      'salad': ['salad', 'lettuce', 'greens'],
      'rice': ['rice'],
      'soup': ['soup', 'broth'],
      'pizza': ['pizza'],
      'sandwich': ['sandwich', 'wrap'],
      // Desserts and sweets
      'ice cream': ['ice cream', 'gelato', 'sorbet', 'frozen yogurt', 'vanilla', 'chocolate', 'strawberry'],
      'chocolate': ['chocolate', 'cocoa', 'brownie', 'truffle', 'fudge', 'mousse'],
      'cake': ['cake', 'cupcake', 'frosting', 'sponge', 'layer cake'],
      'cookie': ['cookie', 'biscuit', 'shortbread', 'oatmeal cookie', 'chocolate chip'],
      'pie': ['pie', 'tart', 'apple pie', 'pumpkin pie', 'cherry pie'],
      'dessert': ['dessert', 'sweet', 'pudding', 'custard', 'cream', 'ice cream', 'cake', 'cookie'],
      'sweet': ['sweet', 'dessert', 'chocolate', 'vanilla', 'caramel', 'sugar', 'honey'],
      'candy': ['candy', 'gummy', 'lollipop', 'caramel', 'toffee', 'mint'],
      // Breakfast items
      'pancakes': ['pancake', 'syrup', 'maple', 'blueberry pancake'],
      'waffles': ['waffle', 'syrup', 'belgian waffle'],
      'french toast': ['french toast', 'toast', 'syrup', 'cinnamon'],
      'cereal': ['cereal', 'oats', 'granola', 'muesli'],
      'smoothie': ['smoothie', 'banana', 'berry', 'protein shake'],
      // Comfort foods
      'mac and cheese': ['mac and cheese', 'macaroni', 'cheese sauce'],
      'burger': ['burger', 'hamburger', 'cheeseburger', 'patty'],
      'fries': ['fries', 'french fries', 'potato', 'sweet potato'],
      'french fries': ['fries', 'french fries', 'potato', 'sweet potato'],
      'hot dog': ['hot dog', 'sausage', 'frankfurter'],
      // Kids favorites
      'cheese sticks': ['cheese', 'mozzarella', 'string cheese', 'cheese stick'],
      'chicken nuggets': ['chicken', 'nugget', 'tender', 'strip'],
      'grilled cheese': ['grilled cheese', 'cheese sandwich', 'melted cheese']
    };
    
    // First try direct ingredient/name matches
    let cravingFiltered = filtered.filter(s => 
      s.ingredients.some(ing => ing.name.toLowerCase().includes(cravingLower)) ||
      s.name.toLowerCase().includes(cravingLower)
    );
    
    // If no direct matches, try category mappings
    if (cravingFiltered.length === 0 && cravingMappings[cravingLower]) {
      const keywords = cravingMappings[cravingLower];
      cravingFiltered = filtered.filter(s => {
        const mealText = `${s.name} ${s.ingredients.map(i => i.name).join(' ')}`.toLowerCase();
        return keywords.some(keyword => mealText.includes(keyword));
      });
      console.log(`🔍 Using category mapping for "${cravingLower}": ${keywords.join(', ')}`);
    }
    
    // If still no matches, try partial word matches but be more conservative
    if (cravingFiltered.length === 0) {
      const cravingWords = cravingLower.split(' ').filter(w => w.length > 2);
      
      // Skip GPT-4 for generic healthy meal requests - these should use catalog
      const isGenericHealthyRequest = cravingLower.match(/^healthy\s+(breakfast|lunch|dinner|snack)\s+meal$/);
      
      // For complex requests (3+ words) or specific dish names, skip partial matching and go to GPT-4
      // BUT allow generic healthy meal requests to use catalog
      if (!isGenericHealthyRequest && 
          (cravingWords.length >= 3 || 
           ['burrito', 'bowl', 'wrap', 'curry', 'stir fry', 'casserole', 'soup'].some(dish => cravingLower.includes(dish)))) {
        console.log(`🔍 Complex craving detected "${cravingLower}" - skipping partial matches, using GPT-4`);
      } else {
        // For generic healthy requests, ignore the "healthy" and "meal" words
        const filterWords = isGenericHealthyRequest ? 
          cravingWords.filter(w => !['healthy', 'meal'].includes(w)) : 
          cravingWords;
          
        cravingFiltered = filtered.filter(s => {
          const mealText = `${s.name} ${s.ingredients.map(i => i.name).join(' ')}`.toLowerCase();
          // If no meaningful words left after filtering, return any meal of the correct type
          return filterWords.length === 0 || filterWords.some(word => mealText.includes(word));
        });
        console.log(`🔍 Trying partial word matches: ${filterWords.join(', ')}`);
      }
    }
    
    if (cravingFiltered.length > 0) {
      filtered = cravingFiltered;
      console.log(`🎯 Found ${filtered.length} matches for craving "${cravingLower}": ${filtered.map(s => s.name)}`);
    } else {
      console.log(`⚠️ No matches found for craving "${cravingLower}" in catalog, falling back to GPT-4 generation`);
      // Tag the fallback to GPT-4 before delegating
      telemetry.tagFallback(sessionId, "no_catalog_match", `Craving "${cravingLower}" not found in catalog`);
      telemetry.closeSession(sessionId);
      // Use Universal AI Meal Generator as fallback (it has its own telemetry session)
      return await generateMealFromPrompt(craving, targetMealType, userPrefs);
    }
  }
  
  if (filtered.length === 0) {
    // For kids meals, use kid-friendly fallbacks only
    if (userPrefs?.kidFriendly || (craving && craving.includes('kid-friendly'))) {
      const kidFallbacks = ["Mac and Cheese", "Chicken Nuggets", "Grilled Cheese Sandwich", "Mini Pizza", "Pancakes"];
      const fallbackMeals = catalog.filter(s => 
        kidFallbacks.some(kidMeal => s.name.toLowerCase().includes(kidMeal.toLowerCase()))
      );
      if (fallbackMeals.length > 0) {
        filtered = fallbackMeals;
        telemetry.tagFallback(sessionId, "kid_meal_fallback", "Using kid-friendly fallback meals");
        console.log("🧒 Using kid-friendly fallback meals");
      }
    } else {
      // Fallback to any meal type if no matches found
      telemetry.tagFallback(sessionId, "catalog_fallback", "No specific matches, using general catalog");
      filtered = catalog.filter(s => 
        (!userPrefs?.allergies || !violatesAllergy(s.ingredients, userPrefs.allergies)) &&
        (!userPrefs?.dietaryRestrictions || !violatesDiet(s.ingredients, userPrefs.dietaryRestrictions))
      );
    }
    
    if (filtered.length === 0) {
      telemetry.closeSession(sessionId);
      throw new Error(`No suitable meals found in catalog for preferences`);
    }
  }
  
  const selected = filtered[Math.floor(Math.random() * filtered.length)];
  console.log(`🎯 Selected meal: ${selected.name} from ${filtered.length} options`);
  const nutrition = await computeNutrition(selected.ingredients);
  const medicalBadges = medicalBadgesFor(selected, userPrefs?.medicalFlags || []);
  
  // Generate instructions for single meal
  const instructionsMap = await instructBatch([selected]);
  
  // Create more descriptive meal description
  const mainIngredients = selected.ingredients.slice(0, 3).map(i => i.name).join(', ');
  const isKidMeal = userPrefs?.kidFriendly || (craving && craving.includes('kid-friendly'));
  const description = isKidMeal 
    ? `A kid-friendly ${targetMealType} that children will love! Made with ${mainIngredients}. Fun, tasty, and nutritious.`
    : `A delicious ${targetMealType} featuring ${mainIngredients}. ${selected.tags.includes('high_protein') ? 'High in protein and ' : ''}Perfect for satisfying your cravings while maintaining your health goals.`;
  
  // Generate image for meal with kid-friendly styling
  let imageUrl = null;
  try {
    const { generateImage } = await import("./imageService");
    imageUrl = await generateImage({
      name: selected.name,
      description: isKidMeal ? `child-friendly cartoon-style version, colorful plate, fun design, appealing to kids` : description,
      type: 'meal',
      style: isKidMeal ? 'kid-friendly' : 'homemade',
      ingredients: selected.ingredients.map(ing => ing.name),
      calories: nutrition.calories,
      protein: nutrition.protein,
      carbs: nutrition.carbs,
      fat: nutrition.fat,
    });
    console.log(`📸 Generated ${isKidMeal ? 'kid-friendly ' : ''}image for ${selected.name}`);
  } catch (error) {
    telemetry.tagFallback(sessionId, "image_generation_failed", `Image failed for ${selected.name}`);
    console.log(`❌ Image generation failed for ${selected.name}:`, error);
  }
  
  // Track instruction fallback
  const finalInstructions = instructionsMap[selected.name] || [
    "Prepare all ingredients according to recipe",
    "Cook using appropriate methods for each ingredient", 
    "Season to taste and serve hot"
  ];
  
  if (!instructionsMap[selected.name]) {
    telemetry.tagFallback(sessionId, "instruction_fallback", `Default instructions used for ${selected.name}`);
  }
  
  // Build debug metadata and close session
  const debugMetadata = telemetry.buildDebugMetadata(sessionId);
  telemetry.closeSession(sessionId);
  
  return {
    id: `craving-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: selected.name,
    description: description,
    mealType: selected.mealType,
    ingredients: convertToUserFriendlyUnits(selected.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.grams,
      unit: 'g',
      notes: ''
    }))),
    instructions: finalInstructions,
    nutrition,
    medicalBadges,
    flags: selected.tags,
    servingSize: "1 serving",
    imageUrl: imageUrl,
    createdAt: new Date(),
    _debug: debugMetadata
  };
}