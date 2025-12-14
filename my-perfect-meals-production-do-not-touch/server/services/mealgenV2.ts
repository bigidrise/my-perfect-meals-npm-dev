// server/services/mealgenV2.ts
// Centralized meal generation with mandatory onboarding integration
import crypto from "crypto";
import { storage } from "../storage";

// ---------- Public API ----------
export type Onboarding = {
  diet?: string;
  allergies?: string[];
  avoid?: string[];
  mustInclude?: string[];
  noMeat?: boolean; 
  noFish?: boolean; 
  noDairy?: boolean; 
  noEggs?: boolean; 
  noVeg?: boolean; 
  noFruit?: boolean;
  caloriesTarget?: number; 
  proteinPerMeal?: number; 
  sodiumLimit?: number;
  cuisinesPreferred?: string[];
  preferredSweeteners?: string[];
  bannedSweeteners?: string[];
};

export type Ingredient = { name: string; amount: string };

export type Meal = {
  name: string; 
  description?: string; 
  imageUrl?: string;
  ingredients: Ingredient[]; 
  instructions: string[];
  calories?: number; 
  protein?: number; 
  carbs?: number; 
  fats?: number;
  labels?: string[]; 
  badges: string[];
};

export async function generateMealV2(opts: {
  userId: string;
  courseStyle: "Breakfast"|"Lunch"|"Dinner"|"Snack";
  onboarding: Onboarding;
  includeImage?: boolean;
  variation?: number;
}): Promise<Meal> {
  const constraints = mapOnboardingToConstraints(opts.onboarding);
  
  const raw = await callCravingCreator({
    targetMealType: opts.courseStyle.toLowerCase(),
    cravingInput: `${opts.courseStyle} ${opts.variation ? `variation ${opts.variation}` : ''}`,
    userId: opts.userId,
    dietaryRestrictions: constraints.allergies || [],
    allergies: constraints.allergies || [],
    constraints: constraints
  });

  let meal = normalizeMeal(raw);
  meal.ingredients = enforceMeasuredIngredients(meal.ingredients);

  // Validate against onboarding; auto-regen up to 4 tries
  let tries = 0;
  while (tries < 4) {
    const why = violatesOnboarding(meal, opts.onboarding);
    if (!why) break;
    
    console.log(`⚠️ Meal violates onboarding (${why}), regenerating...`);
    const regen = await callCravingCreator({
      targetMealType: opts.courseStyle.toLowerCase(),
      cravingInput: `${opts.courseStyle} variation ${tries + 2} avoiding ${why}`,
      userId: opts.userId,
      dietaryRestrictions: constraints.allergies || [],
      allergies: constraints.allergies || [],
      constraints: constraints
    });
    
    meal = normalizeMeal(regen);
    meal.ingredients = enforceMeasuredIngredients(meal.ingredients);
    tries++;
  }
  
  console.log(`✅ Generated compliant meal: ${meal.name} (${tries} retries)`);
  return meal;
}

export async function generateDayV2(opts: {
  userId: string; 
  onboarding: Onboarding;
  slots: Array<{ courseStyle: "Breakfast"|"Lunch"|"Dinner"|"Snack"; label: string; time: string; order: number }>;
  includeImage?: boolean;
}): Promise<Meal[]> {
  // Concurrency cap of 3 to prevent overwhelming the API
  const chunks = chunk(opts.slots, 3);
  const out: Meal[] = [];
  
  for (const grp of chunks) {
    const batch = await Promise.all(grp.map(async (s, i) => {
      const m = await generateMealV2({
        userId: opts.userId,
        courseStyle: s.courseStyle,
        onboarding: opts.onboarding,
        includeImage: Boolean(opts.includeImage),
        variation: i,
      });
      return m;
    }));
    out.push(...batch);
  }
  
  // Dedupe by signature and regenerate duplicates
  const seen = new Set<string>();
  for (let i = 0; i < out.length; i++) {
    let sig = mealSig(out[i]);
    let tries = 0;
    while (seen.has(sig) && tries < 4) {
      console.log(`🔄 Duplicate meal detected, regenerating...`);
      const s = opts.slots[i];
      out[i] = await generateMealV2({
        userId: opts.userId,
        courseStyle: s.courseStyle,
        onboarding: opts.onboarding,
        includeImage: Boolean(opts.includeImage),
        variation: tries + 10,
      });
      sig = mealSig(out[i]);
      tries++;
    }
    seen.add(sig);
  }
  
  return out;
}

export async function getOnboarding(userId: string): Promise<Onboarding> {
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error(`User ${userId} not found for onboarding data`);
  }
  
  return {
    diet: user.dietaryRestrictions?.[0] || undefined,
    allergies: user.allergies || [],
    avoid: user.dislikedFoods || [],
    mustInclude: [],
    noMeat: user.dietaryRestrictions?.includes('vegetarian') || user.dietaryRestrictions?.includes('vegan'),
    noFish: user.allergies?.includes('fish') || user.allergies?.includes('shellfish'),
    noDairy: user.allergies?.includes('dairy') || user.allergies?.includes('milk') || user.dietaryRestrictions?.includes('vegan'),
    noEggs: user.allergies?.includes('eggs'),
    noVeg: false, // Generally don't exclude vegetables
    noFruit: user.allergies?.includes('fruit'),
    caloriesTarget: user.dailyCalorieTarget ? Math.floor(user.dailyCalorieTarget / 4) : undefined,
    proteinPerMeal: undefined,
    sodiumLimit: user.healthConditions?.includes('hypertension') ? 600 : undefined,
    cuisinesPreferred: [],
    preferredSweeteners: user.preferredSweeteners || [],
    bannedSweeteners: user.avoidSweeteners || []
  };
}

export function onboardingHash(ob: Onboarding): string {
  const stable = JSON.stringify(ob, Object.keys(ob).sort());
  return crypto.createHash("sha256").update(stable).digest("hex").slice(0, 12);
}

// ---------- Internals ----------
async function callCravingCreator(body: any) {
  const base = process.env.INTERNAL_API_BASE || "http://127.0.0.1:5000";
  const url = `${base}/api/meals/craving-creator`;
  
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 30000);
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    
    if (!res.ok) {
      throw new Error(`Craving Creator API failed: ${res.status}`);
    }
    
    const data = await res.json();
    return data.meal || data;
  } finally {
    clearTimeout(timeout);
  }
}

function mapOnboardingToConstraints(ob: Onboarding) {
  return {
    diet: ob.diet,
    allergies: ob.allergies,
    avoid: ob.avoid,
    mustInclude: ob.mustInclude,
    flags: { 
      noMeat: ob.noMeat, 
      noFish: ob.noFish, 
      noDairy: ob.noDairy, 
      noEggs: ob.noEggs, 
      noVeg: ob.noVeg, 
      noFruit: ob.noFruit 
    },
    macros: { 
      caloriesTarget: ob.caloriesTarget, 
      proteinPerMeal: ob.proteinPerMeal, 
      sodiumLimit: ob.sodiumLimit 
    },
    cuisinesPreferred: ob.cuisinesPreferred
  };
}

function normalizeMeal(raw: any): Meal {
  const fatsRaw = raw?.fats ?? raw?.fat ?? raw?.nutrition?.fat;
  const normalizedIngredients = normalizeIngredients(raw?.ingredients);
  
  // Final validation: ensure all ingredients match universal schema
  const validatedIngredients = normalizedIngredients.map(ing => {
    // Always re-normalize to ensure universal schema compliance
    const universal = normalizeIngredientToUniversal(ing);
    
    // Final validation: ensure all fields are present and valid
    if (!universal.name || typeof universal.quantity !== 'number' || !universal.unit) {
      console.warn('⚠️ Invalid ingredient detected, applying fallback:', ing);
      return {
        name: String(ing?.name || ing?.item || 'Unknown ingredient').trim(),
        amount: '1 portion'
      };
    }
    
    return {
      name: universal.name,
      amount: `${universal.quantity} ${universal.unit}`.trim()
    };
  });
  
  return {
    name: String(raw?.name ?? raw?.title ?? raw?.mealName ?? "Chef's Choice"),
    description: raw?.description ?? raw?.summary ?? undefined,
    imageUrl: raw?.imageUrl ?? raw?.imageURL ?? raw?.image ?? undefined,
    ingredients: validatedIngredients,
    instructions: normalizeInstructions(raw?.instructions),
    calories: numOrU(raw?.calories ?? raw?.nutrition?.calories),
    protein: numOrU(raw?.protein ?? raw?.nutrition?.protein),
    carbs: numOrU(raw?.carbs ?? raw?.nutrition?.carbs),
    fats: numOrU(fatsRaw),
    labels: normStrArr(raw?.labels),
    badges: normStrArr(raw?.badges ?? raw?.medicalBadges),
  };
}

function numOrU(x: any) { 
  return x == null ? undefined : Number(x); 
}

function normStrArr(r: any) { 
  if (!r) return []; 
  if (Array.isArray(r)) return r.map(String).map(s => s.trim()).filter(Boolean); 
  if (typeof r === "string") return r.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean); 
  return []; 
}

function normalizeInstructions(raw: any): string[] { 
  if (!raw) return []; 
  if (Array.isArray(raw)) return raw.map(String).map(s => s.trim()).filter(Boolean); 
  if (typeof raw === "string") return raw.split(/\r?\n+/).map(s => s.trim()).filter(Boolean); 
  return []; 
}

// Import universal ingredient normalizer
import { normalizeIngredient as clientNormalizeIngredient } from "../../client/src/utils/normalizeIngredients";

// Server-side ingredient normalizer matching universal schema
function normalizeIngredientToUniversal(ing: any): {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
} {
  // Handle string format
  if (typeof ing === "string") {
    const parsed = parseIngredientString(ing);
    return {
      name: parsed.name,
      quantity: parsed.quantity,
      unit: parsed.unit,
      ...(parsed.notes && { notes: parsed.notes })
    };
  }

  // Handle object format
  const rawName = ing.item || ing.name || ing.ingredient || String(ing);
  const rawQty = ing.qty || ing.quantity || ing.amount || ing.amountOz || 1;
  const rawUnit = ing.unit || "";
  const rawNotes = ing.notes || "";

  // Parse quantity to number
  const quantity = parseQuantityToNumber(rawQty);
  
  // Normalize unit to singular
  const unit = normalizeSingularUnit(rawUnit);
  
  // Extract descriptors from name
  const { cleanName, extractedNotes } = extractDescriptors(rawName);
  
  // Combine notes
  const combinedNotes = [extractedNotes, rawNotes].filter(Boolean).join("; ");

  return {
    name: cleanName,
    quantity,
    unit,
    ...(combinedNotes && { notes: combinedNotes })
  };
}

function parseIngredientString(str: string): {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
} {
  const match = str.match(/^([0-9.,½¼¾⅓⅔⅛⅜⅝⅞\/\s]+)?\s*([a-z]+)?\s*(.+)?$/i);
  if (!match) {
    return { name: str.trim(), quantity: 1, unit: "" };
  }

  const [, qtyPart, unitPart, namePart] = match;
  const quantity = parseQuantityToNumber(qtyPart);
  const unit = normalizeSingularUnit(unitPart);
  const { cleanName, extractedNotes } = extractDescriptors(namePart || str);

  return {
    name: cleanName,
    quantity,
    unit,
    ...(extractedNotes && { notes: extractedNotes })
  };
}

function parseQuantityToNumber(qtyStr: any): number {
  if (qtyStr === undefined || qtyStr === null || qtyStr === '') return 1;
  if (typeof qtyStr === 'number') return qtyStr;

  const str = String(qtyStr).trim().toLowerCase();

  // Unicode fractions
  const fractionMap: Record<string, number> = {
    '½': 0.5, '⅓': 0.333, '⅔': 0.667, '¼': 0.25, '¾': 0.75,
    '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 0.167,
    '⅚': 0.833, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875
  };

  for (const [symbol, value] of Object.entries(fractionMap)) {
    if (str.includes(symbol)) {
      const rest = str.replace(symbol, '').trim();
      const whole = rest ? parseFloat(rest) : 0;
      return !isNaN(whole) ? whole + value : value;
    }
  }

  // Handle "1 1/2" or "1/2" formats
  if (str.includes('/')) {
    const parts = str.split(/\s+/);
    let total = 0;
    for (const part of parts) {
      if (part.includes('/')) {
        const [num, denom] = part.split('/').map(Number);
        if (num && denom) total += num / denom;
      } else {
        const n = parseFloat(part);
        if (!isNaN(n)) total += n;
      }
    }
    return total > 0 ? total : 1;
  }

  const num = parseFloat(str.replace(/,/g, ''));
  return !isNaN(num) && num > 0 ? num : 1;
}

function normalizeSingularUnit(unit: any): string {
  if (!unit) return "";
  
  const unitMap: Record<string, string> = {
    'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
    'cup': 'cup', 'cups': 'cup', 'ounce': 'oz', 'ounces': 'oz', 
    'pound': 'lb', 'pounds': 'lb', 'lbs': 'lb', 'gram': 'g', 'grams': 'g',
    'kilogram': 'kg', 'kilograms': 'kg', 'milliliter': 'ml', 'milliliters': 'ml',
    'liter': 'l', 'liters': 'l', 'piece': 'piece', 'pieces': 'piece',
    'clove': 'clove', 'cloves': 'clove', 'slice': 'slice', 'slices': 'slice',
    'pinch': 'pinch', 'dash': 'dash', 'each': 'each'
  };
  
  const normalized = String(unit).trim().toLowerCase();
  return unitMap[normalized] || normalized;
}

function extractDescriptors(name: string): { cleanName: string; extractedNotes: string } {
  let cleanName = String(name).trim();
  const foundDescriptors: string[] = [];

  // Extract parenthetical content
  const parenMatch = cleanName.match(/\(([^)]+)\)/);
  if (parenMatch) {
    foundDescriptors.push(parenMatch[1]);
    cleanName = cleanName.replace(/\([^)]+\)/g, '').trim();
  }

  // Known descriptors
  const descriptors = [
    'diced', 'chopped', 'minced', 'sliced', 'grated', 'shredded',
    'fresh', 'dried', 'frozen', 'cooked', 'raw', 'canned',
    'boneless', 'skinless', 'whole', 'halved', 'quartered',
    'peeled', 'unpeeled', 'trimmed', 'large', 'medium', 'small',
    'ripe', 'optional', 'plain', 'low-fat', 'grilled'
  ];

  for (const descriptor of descriptors) {
    const regex = new RegExp(`\\b${descriptor}\\b`, 'gi');
    if (regex.test(cleanName)) {
      foundDescriptors.push(descriptor);
      cleanName = cleanName.replace(regex, '').trim();
    }
  }

  cleanName = cleanName.replace(/\s{2,}/g, ' ').trim();

  return {
    cleanName,
    extractedNotes: foundDescriptors.join(', ')
  };
}

function normalizeIngredients(raw: any): Ingredient[] {
  if (!raw) return [];
  
  let rawIngredients: any[] = [];
  
  // Convert various formats to array
  if (Array.isArray(raw)) {
    rawIngredients = raw;
  } else if (typeof raw === "object") {
    rawIngredients = Object.entries(raw).map(([name, amount]) => ({
      name: String(name).trim(),
      amount: String(amount ?? "").trim()
    }));
  } else if (typeof raw === "string") {
    rawIngredients = raw.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
  }
  
  // Normalize each ingredient through universal schema
  const normalized = rawIngredients.map((ing: any) => {
    const universal = normalizeIngredientToUniversal(ing);
    return {
      name: universal.name,
      amount: `${universal.quantity} ${universal.unit}`.trim(),
      // Store universal format for validation
      _universal: universal
    };
  }).filter(i => i.name);
  
  return normalized;
}

function splitFreeformIngredient(line: string): Ingredient {
  if (!line || typeof line !== 'string') return { name: '', amount: '' };
  const t = line.trim();
  const tokens = t.split(/\s+/);
  let splitAt = 1;
  
  for (let i = 1; i < Math.min(tokens.length, 4); i++) {
    if (/[a-zA-Z]/.test(tokens[i])) {
      splitAt = i;
      break;
    }
  }
  
  return {
    amount: tokens.slice(0, splitAt).join(" "),
    name: tokens.slice(splitAt).join(" ") || t
  };
}

// Measurements: .25 → 1/4 + unit/piece
const FRACTIONS: [number, string][] = [[0.75, "3/4"], [0.66, "2/3"], [0.5, "1/2"], [0.33, "1/3"], [0.25, "1/4"]];

const UNIT_DEFAULTS: Record<string, { unit?: string; piece?: string }> = {
  cucumber: { piece: "medium" }, lemon: { piece: "medium" }, lime: { piece: "medium" }, egg: { piece: "large" },
  onion: { piece: "small" }, garlic: { unit: "clove" }, oil: { unit: "tbsp" }, olive: { unit: "tbsp" },
  salt: { unit: "tsp" }, pepper: { unit: "tsp" }, vinegar: { unit: "tbsp" }, yogurt: { unit: "cup" }, 
  milk: { unit: "cup" }, rice: { unit: "cup" }, pasta: { unit: "oz" }, cheese: { unit: "oz" }, 
  chicken: { unit: "oz" }, beef: { unit: "oz" }, turkey: { unit: "oz" }, salmon: { unit: "oz" },
};

function toFrac(n: number) {
  const r = Math.round(n * 100) / 100;
  for (const [v, f] of FRACTIONS) {
    if (Math.abs(r - v) <= 0.02) return f;
  }
  if (Math.abs(r - Math.round(r)) <= 0.02) return String(Math.round(r));
  return String(r);
}

function guessUnit(name: string) {
  const k = Object.keys(UNIT_DEFAULTS).find(k => name.toLowerCase().includes(k));
  return k ? UNIT_DEFAULTS[k] : {};
}

function fixAmt(amt: string, name: string): string {
  let a = (amt || "").trim();
  if (/^\.\d+/.test(a)) a = "0" + a;  // ".25" -> "0.25"
  
  const pureNum = a.match(/^(\d+(?:\.\d+)?)$/)?.[1];
  if (pureNum) {
    const f = toFrac(parseFloat(pureNum));
    const g = guessUnit(name);
    return `${f} ${g.piece ?? g.unit ?? "cup"}`.trim();
  }
  
  const d = a.match(/(\d+(?:\.\d+)?)/)?.[1];
  if (d) {
    const n = parseFloat(d);
    if (n > 0 && n < 1) a = a.replace(d, toFrac(n));
  }
  
  if (!/\b(tsp|tbsp|cup|cups|oz|lb|g|kg|ml|l|clove|cloves|slice|slices|can|cans|packet|packets)\b/i.test(a)) {
    const g = guessUnit(name);
    return `1 ${g.piece ?? g.unit ?? "unit"}`.trim();
  }
  
  return a;
}

export function enforceMeasuredIngredients(ings: Ingredient[]): Ingredient[] {
  return ings.map(i => ({ name: i.name.trim(), amount: fixAmt(i.amount, i.name) }));
}

function violatesOnboarding(meal: Meal, ob: Onboarding): string | null {
  const names = (meal.ingredients || []).map(i => i.name.toLowerCase());
  const has = (re: RegExp) => names.some(n => re.test(n));
  
  if (ob.noMeat && has(/\b(chicken|beef|pork|lamb|turkey|meat)\b/)) return "meat";
  if (ob.noFish && has(/\b(salmon|tuna|shrimp|cod|fish|seafood)\b/)) return "fish";
  if (ob.noDairy && has(/\b(milk|cheese|yogurt|butter|cream|dairy)\b/)) return "dairy";
  if (ob.noEggs && has(/\begg(s)?\b/)) return "eggs";
  if (ob.noVeg && has(/\b(broccoli|spinach|kale|lettuce|pepper|cucumber|carrot|tomato|vegetable)\b/)) return "veg";
  if (ob.noFruit && has(/\b(apple|banana|berry|orange|grape|mango|fruit)\b/)) return "fruit";
  
  const anyIn = (list?: string[]) => list?.some(x => names.some(n => n.includes(x.toLowerCase())));
  if (anyIn(ob.allergies)) return "allergy";
  if (anyIn(ob.avoid)) return "avoid";
  
  return null;
}

function mealSig(m: Meal) {
  const n = String(m.name || "").toLowerCase();
  const top = (m.ingredients || []).slice(0, 5).map(i => i.name.toLowerCase()).join("|");
  return `${n}::${top}`;
}

function chunk<T>(arr: T[], n: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}