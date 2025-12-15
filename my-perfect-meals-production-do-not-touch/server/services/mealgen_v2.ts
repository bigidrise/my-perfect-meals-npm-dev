// server/services/mealgen_v2.ts
// Deterministic gen + strict schema + validators + repair loop (fail‑closed)
import { z } from "zod";
import { allergenViolated, banViolated } from "./ontology";
import { estimateMacros } from "./macroEstimator";
import { getOnboarding, onboardingHash } from "./mealgenV2";
import { validateDietPacks } from "./dietRules";

const CC_GENERATE = process.env.CC_GENERATE_ENDPOINT || "/api/meals/craving-creator";
const INTERNAL_API_BASE = process.env.INTERNAL_API_BASE || "http://127.0.0.1:5000";
const TIMEOUT_MS = Number(process.env.MEALGEN_TIMEOUT_MS || 20000);
const MAX_TRIES = Number(process.env.MEALGEN_MAX_TRIES || 4);

// 1) Strict meal schema
export const MealSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  ingredients: z.array(z.object({ 
    name: z.string().min(2), 
    amount: z.string().min(1) 
  })).min(2),
  instructions: z.array(z.string().min(5)).min(2),
  calories: z.number().positive().max(2000).optional(),
  protein: z.number().min(0).max(200).optional(),
  carbs: z.number().min(0).max(300).optional(),
  fats: z.number().min(0).max(150).optional(),
  badges: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
});

export type StrictMeal = z.infer<typeof MealSchema>;

function absolutize(path: string) { 
  return path.startsWith("http") ? path : `${INTERNAL_API_BASE}${path}`; 
}

async function postJSON<T>(path: string, body: any, ms = TIMEOUT_MS): Promise<T> {
  const url = absolutize(path);
  const ctrl = new AbortController(); 
  const t = setTimeout(() => ctrl.abort(), ms);
  
  try {
    const res = await fetch(url, { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(body), 
      signal: ctrl.signal 
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json() as T;
  } finally { 
    clearTimeout(t); 
  }
}

// 2) Validate against onboarding bans & allergens
function validateOnboarding(meal: StrictMeal, ob: any): string | null {
  const names = (meal.ingredients || []).map(i => i.name.toLowerCase());
  // Existing checks
  const a = allergenViolated(names, ob); if (a) return a;
  const b = banViolated(names, ob); if (b) return b;
  // New diet packs — flags come from onboarding: ob.kosher, ob.halal, ob.lowFodmap
  const d = validateDietPacks(names, { kosher: ob?.kosher, halal: ob?.halal, lowFodmap: ob?.lowFodmap });
  if (d) return d;
  return null;
}

// 2.5) Validate meal type appropriateness
function validateMealTypeAppropriate(meal: StrictMeal, targetMealType: string): string | null {
  const name = meal.name?.toLowerCase() || '';
  const ingredients = (meal.ingredients || []).map(i => i.name.toLowerCase()).join(' ');
  const text = `${name} ${ingredients}`;
  
  // Breakfast items should not be assigned to dinner
  const breakfastKeywords = ['parfait', 'yogurt', 'oatmeal', 'cereal', 'pancake', 'waffle', 'toast', 'bagel', 'muffin', 'smoothie', 'granola'];
  const isBreakfastItem = breakfastKeywords.some(keyword => text.includes(keyword));
  
  if (isBreakfastItem && targetMealType === 'dinner') {
    return `meal_type_mismatch:${meal.name} appears to be breakfast but assigned as ${targetMealType}`;
  }
  
  // Snack items should not be assigned to main meals
  const snackKeywords = ['chip', 'cookie', 'cracker', 'nuts', 'trail mix', 'fruit cup', 'energy bar'];
  const isSnackItem = snackKeywords.some(keyword => text.includes(keyword));
  
  if (isSnackItem && ['breakfast', 'lunch', 'dinner'].includes(targetMealType)) {
    return `meal_type_mismatch:${meal.name} appears to be snack but assigned as ${targetMealType}`;
  }
  
  // Heavy dinner items should not be assigned to breakfast
  const dinnerKeywords = ['steak', 'roast', 'casserole', 'curry', 'stir fry', 'pasta with meat', 'beef', 'pork chop'];
  const isDinnerItem = dinnerKeywords.some(keyword => text.includes(keyword));
  
  if (isDinnerItem && targetMealType === 'breakfast') {
    return `meal_type_mismatch:${meal.name} appears to be dinner but assigned as ${targetMealType}`;
  }
  
  return null;
}

// 3) Macro band checker (fail-closed if we have estimates)
function validateMacros(meal: StrictMeal, ob: any, slotsPerDay = 3): string | null {
  const kcalTarget = ob?.caloriesTarget ? Number(ob.caloriesTarget) : null;
  if (!kcalTarget) return null;
  
  const perMeal = kcalTarget / slotsPerDay;
  const floor = perMeal * 0.9; 
  const ceil = perMeal * 1.1;
  const cal = meal.calories ?? estimateMacros(meal.ingredients)?.kcal ?? null;
  
  if (cal == null) return null; // we can't assert without data
  if (cal < floor) return `kcal_low:${cal} < ${Math.round(floor)}`;
  if (cal > ceil) return `kcal_high:${cal} > ${Math.round(ceil)}`;
  
  // Optional protein floor
  if (ob?.proteinPerMeal) {
    const p = meal.protein ?? estimateMacros(meal.ingredients)?.protein ?? null;
    if (p != null && p < Number(ob.proteinPerMeal)) {
      return `protein_low:${p} < ${ob.proteinPerMeal}`;
    }
  }
  
  return null;
}

// 4) Measurement enforcement
function allMeasured(meal: StrictMeal): boolean {
  return meal.ingredients.every(i => 
    /\d/.test(i.amount) && 
    /(tsp|tbsp|cup|cups|oz|lb|g|kg|ml|l|clove|slice|piece|small|medium|large)/i.test(i.amount)
  );
}

// 5) Deterministic request body
function genBody(userId: string, courseStyle: string, ob: any, variation = 0) {
  return {
    userId,
    craving: `${courseStyle} meal`,
    mealType: courseStyle,
    includeImage: false,
    constraints: {
      diet: ob?.diet,
      allergies: ob?.allergies,
      avoid: ob?.avoid,
      flags: { 
        noMeat: ob?.noMeat, 
        noFish: ob?.noFish, 
        noDairy: ob?.noDairy, 
        noEggs: ob?.noEggs, 
        noVeg: ob?.noVeg, 
        noFruit: ob?.noFruit 
      },
      macros: { 
        caloriesTarget: ob?.caloriesTarget, 
        proteinPerMeal: ob?.proteinPerMeal, 
        sodiumLimit: ob?.sodiumLimit 
      },
      cuisinesPreferred: ob?.cuisinesPreferred,
    },
    temperature: 0,
    seed: 7 + variation, // reproducible nudge per try
    schema: "MealSchemaV1", // so your CC can return strict JSON
  };
}

export async function generateStrictMeal({ 
  userId, 
  courseStyle, 
  ob, 
  slotsPerDay 
}: { 
  userId: string; 
  courseStyle: string; 
  ob: any; 
  slotsPerDay: number 
}): Promise<StrictMeal> {
  let lastErr = "unknown";
  
  for (let t = 0; t < MAX_TRIES; t++) {
    try {
      const raw = await postJSON<any>(CC_GENERATE, genBody(userId, courseStyle, ob, t));
      
      // normalize minimal fields before schema
      if (raw.ingredients) {
        raw.ingredients = raw.ingredients.map((x: any) => ({
          name: x.name ?? x.ingredient,
          amount: x.amount ?? x.quantity ?? x.qty ?? ""
        }));
      }
      
      const meal = MealSchema.parse(raw);
      
      // gates
      const vio = validateOnboarding(meal, ob);
      if (vio) { 
        lastErr = vio; 
        continue; 
      }
      
      // Validate meal type appropriateness (CRITICAL: prevent parfait as dinner)
      const mealTypeVio = validateMealTypeAppropriate(meal, courseStyle);
      if (mealTypeVio) {
        lastErr = mealTypeVio;
        console.warn(`🚫 Meal type validation failed: ${mealTypeVio}`);
        continue;
      }
      
      if (!allMeasured(meal)) { 
        lastErr = "measurements"; 
        continue; 
      }
      
      const macro = validateMacros(meal, ob, slotsPerDay);
      if (macro) { 
        lastErr = macro; 
        continue; 
      }
      
      return meal; // ✅
    } catch (e: any) {
      lastErr = `schema:${e?.message || e}`;
      continue;
    }
  }
  
  throw new Error(`Strict generation failed after ${MAX_TRIES} tries: ${lastErr}`);
}