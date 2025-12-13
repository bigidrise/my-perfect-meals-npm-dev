// server/services/wmc2Adapter.ts
// ChatGPT-level meal generation system with strict mode controls, caching, and telemetry
import { z } from "zod";
import { MealgenCache } from "./mealgenCache";
import { getOnboarding, onboardingHash } from "./mealgenV2";

// --- CONFIG ---
const INTERNAL_API_BASE = process.env.INTERNAL_API_BASE || "http://127.0.0.1:5000";
const CC_GENERATE = process.env.CC_GENERATE_ENDPOINT || "/api/meals/craving-creator";
const CC_REGEN = process.env.CC_REGENERATE_ENDPOINT || "/api/meals/craving-creator";
const MEALGEN_TIMEOUT_MS = Number(process.env.MEALGEN_TIMEOUT_MS || 20000);
const CACHE_TTL_MS = Number(process.env.MEALGEN_CACHE_TTL_MS || 300000); // 5 min

// Smart caching system for meal generation
const cache = new MealgenCache<any>(CACHE_TTL_MS, 300);
import { allergenViolated, banViolated } from "./ontology";
import { estimateMacros } from "./macroEstimator";
import { varietyBank } from "./varietyBank";
import { generateStrictMeal } from "./mealgen_v2";

// --- SCHEMA ---
export const WMC2PlanSchema = z.object({
  userId: z.string(),
  days: z.enum(["1","4","7"]).transform(v => parseInt(v, 10)),
  schedule: z.array(z.object({
    slot: z.enum(["meal","snack"]),
    label: z.string(),
    time: z.string(),
    order: z.number().int()
  })).min(1),
  includeImages: z.boolean().default(true),
  mode: z.enum(["ai_varied","repeat_one","fixed_menu"]).optional(),
  fixedMenu: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    ingredients: z.array(z.object({
      name: z.string(),
      amount: z.string()
    })),
    instructions: z.array(z.string()),
    calories: z.number().optional(),
    protein: z.number().optional(),
    carbs: z.number().optional(),
    fats: z.number().optional(),
    labels: z.array(z.string()).optional(),
    badges: z.array(z.string())
  })).optional(),
  constraints: z.object({
    allow: z.array(z.string()).optional(),
    avoid: z.array(z.string()).optional(),
    dietFlags: z.object({
      noMeat: z.boolean().optional(),
      noFish: z.boolean().optional(),
      noDairy: z.boolean().optional(),
      noEggs: z.boolean().optional(),
      noVeg: z.boolean().optional(),
      noFruit: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

export type Ingredient = { name: string; amount: string };
export type MealResultRaw = any;
export type WMC2Item = {
  name: string;
  description?: string;
  imageUrl?: string;
  ingredients: Ingredient[];
  instructions: string[];
  calories?: number; protein?: number; carbs?: number; fats?: number;
  labels?: string[]; badges: string[];
  dayIndex: number; slot: "meal"|"snack"; label: string; time: string; order: number;
};
export type WMC2Plan = { days: number; items: WMC2Item[]; meta?: { onboardingHash?: string } };

// --- HELPERS ---
function absolute(path: string){ return path.startsWith("http") ? path : `${INTERNAL_API_BASE}${path}`; }

async function postJSON<T>(path: string, body: any, ms = MEALGEN_TIMEOUT_MS): Promise<T> {
  const url = absolute(path);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort("timeout"), ms);
  try {
    const res = await fetch(url, { 
      method: "POST", 
      headers: {"Content-Type":"application/json"}, 
      body: JSON.stringify(body), 
      signal: controller.signal 
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=>"");
      throw new Error(`HTTP ${res.status} ${url}: ${txt}`);
    }
    const data = await res.json() as T;
    return data;
  } finally { 
    clearTimeout(t); 
  }
}

function splitLines(text: string): string[] { 
  if (!text || typeof text !== 'string') return [];
  return String(text).split(/\r?\n+/).map(s=>s.trim()).filter(Boolean); 
}

function normalizeInstructions(raw:any):string[]{ 
  if(!raw) return []; 
  if(Array.isArray(raw)) return raw.map(String).map(s=>s.trim()).filter(Boolean); 
  if(typeof raw==="string") return splitLines(raw); 
  return []; 
}

function normalizeIngredients(raw:any):Ingredient[]{
  if (!raw) return [];
  if (Array.isArray(raw) && raw.every(x=>typeof x==="object")) {
    return raw.map((x:any)=>({ 
      name: String(x.name ?? x.ingredient ?? "").trim(), 
      amount: String(x.amount ?? x.quantity ?? x.qty ?? "").trim() 
    })).filter(i=>i.name);
  }
  if (Array.isArray(raw) && raw.every(x=>typeof x==="string")) {
    return raw.map(splitFreeformIngredient);
  }
  if (typeof raw === "object") {
    return Object.entries(raw).map(([name,amount])=>({ 
      name:String(name).trim(), 
      amount:String(amount ?? "").trim() 
    }));
  }
  if (typeof raw === "string") {
    return splitLines(raw).map(splitFreeformIngredient);
  }
  return [];
}

function splitFreeformIngredient(line:string):Ingredient{
  if (!line || typeof line !== 'string') return { name: '', amount: '' };
  const t = line.trim(); 
  const tokens = t.split(/\s+/); 
  let splitAt = 1;
  for (let i=1;i<Math.min(tokens.length,4);i++){ 
    if (/[a-zA-Z]/.test(tokens[i])) { 
      splitAt=i; 
      break; 
    } 
  }
  return { 
    amount: tokens.slice(0,splitAt).join(" "), 
    name: tokens.slice(splitAt).join(" ") || t 
  };
}

// Kitchen-friendly measurements
const FRACTIONS:[number,string][]= [[0.75,"3/4"],[0.66,"2/3"],[0.5,"1/2"],[0.33,"1/3"],[0.25,"1/4"]];
const UNIT_DEFAULTS: Record<string,{unit?:string; piece?:string}> = {
  cucumber:{piece:"medium"}, lemon:{piece:"medium"}, lime:{piece:"medium"}, egg:{piece:"large"},
  onion:{piece:"small"}, garlic:{unit:"clove"}, oil:{unit:"tbsp"}, olive:{unit:"tbsp"},
  salt:{unit:"tsp"}, pepper:{unit:"tsp"}, vinegar:{unit:"tbsp"}, yogurt:{unit:"cup"}, 
  milk:{unit:"cup"}, rice:{unit:"cup"}, pasta:{unit:"oz"}, cheese:{unit:"oz"}, 
  chicken:{unit:"oz"}, beef:{unit:"oz"}, turkey:{unit:"oz"}, salmon:{unit:"oz"},
};

function toFrac(n:number){ 
  const r=Math.round(n*100)/100; 
  for(const [v,f] of FRACTIONS){ 
    if(Math.abs(r-v)<=0.02) return f; 
  } 
  if(Math.abs(r-Math.round(r))<=0.02) return String(Math.round(r)); 
  return String(r); 
}

function guessUnit(name:string){ 
  const k = Object.keys(UNIT_DEFAULTS).find(k=> name.toLowerCase().includes(k)); 
  return k? UNIT_DEFAULTS[k]: {}; 
}

function fixAmt(amt:string, name:string):string{
  let a=(amt||"").trim(); 
  if (/^\.\d+/.test(a)) a = "0"+a; // .25 -> 0.25
  
  const pure = a.match(/^(\d+(?:\.\d+)?)$/)?.[1];
  if (pure){ 
    const f=toFrac(parseFloat(pure)); 
    const g=guessUnit(name); 
    return `${f} ${g.piece ?? g.unit ?? "cup"}`.trim(); 
  }
  
  const d = a.match(/(\d+(?:\.\d+)?)/)?.[1]; 
  if (d){ 
    const n=parseFloat(d); 
    if(n>0 && n<1) a=a.replace(d, toFrac(n)); 
  }
  
  if (!/\b(tsp|tbsp|cup|cups|oz|lb|g|kg|ml|l|clove|cloves|slice|slices|can|cans|packet|packets)\b/i.test(a)){
    const g=guessUnit(name); 
    return `1 ${g.piece ?? g.unit ?? "unit"}`.trim();
  }
  return a;
}

function enforceMeasuredIngredients(ings: Ingredient[]): Ingredient[] { 
  return ings.map(i => ({ name: i.name.trim(), amount: fixAmt(i.amount, i.name) })); 
}

function normalizeStringArray(raw:any):string[]{ 
  if(!raw) return []; 
  if(Array.isArray(raw)) return raw.map(String).map(s=>s.trim()).filter(Boolean); 
  if(typeof raw==="string") return splitLines(raw); 
  return []; 
}

function normalizeMeal(base:{dayIndex:number;slot:"meal"|"snack";label:string;time:string;order:number}, raw: MealResultRaw): WMC2Item {
  const fatsRaw = raw?.fats ?? raw?.fat ?? raw?.nutrition?.fat;
  const ingredients = enforceMeasuredIngredients(normalizeIngredients(raw?.ingredients));
  
  return {
    ...base,
    name: String(raw?.name ?? raw?.title ?? raw?.mealName ?? "Chef's Choice"),
    description: raw?.description ?? raw?.summary ?? undefined,
    imageUrl: raw?.imageUrl ?? raw?.imageURL ?? raw?.image ?? undefined,
    ingredients,
    instructions: normalizeInstructions(raw?.instructions),
    calories: raw?.calories != null ? Number(raw.calories) : (raw?.nutrition?.calories != null ? Number(raw.nutrition.calories) : undefined),
    protein:  raw?.protein  != null ? Number(raw.protein)  : (raw?.nutrition?.protein != null ? Number(raw.nutrition.protein) : undefined),
    carbs:    raw?.carbs    != null ? Number(raw.carbs)    : (raw?.nutrition?.carbs != null ? Number(raw.nutrition.carbs) : undefined),
    fats:     fatsRaw       != null ? Number(fatsRaw)      : undefined,
    labels:   normalizeStringArray(raw?.labels),
    badges:   normalizeStringArray(raw?.badges ?? raw?.medicalBadges),
  };
}



function slotToCourse(slot:{slot:"meal"|"snack";label:string}){ 
  return slot.slot==="snack" ? "Snack" : slot.label; 
}

// Concurrency limiter
function pLimit(max:number){
  const q: (()=>Promise<void>)[] = []; 
  let active=0;
  const next = () => { active--; const fn=q.shift(); if (fn) fn(); };
  return function run<T>(fn:()=>Promise<T>): Promise<T> {
    return new Promise<T>((resolve,reject)=>{
      const start = async () => { 
        active++; 
        try{ 
          resolve(await fn()); 
        } catch(e){ 
          reject(e); 
        } finally { 
          next(); 
        } 
      };
      active < max ? start() : q.push(start);
    });
  };
}
const limit = pLimit(3);

// Helper functions for caching and telemetry
function scheduleSig(schedule: Array<{slot:"meal"|"snack";label:string;time:string;order:number}>){
  return schedule
    .slice()
    .sort((a,b)=> a.time.localeCompare(b.time) || a.order-b.order)
    .map(s => `${s.slot}:${s.label}@${s.time}`)
    .join("|");
}

// Meal signature for variety tracking
function mealSig(m: Pick<WMC2Item, "name" | "ingredients">) {
  const n = String(m.name || "").toLowerCase();
  const top = (m.ingredients || []).slice(0, 5).map(i => i.name.toLowerCase()).join("|");
  return `${n}::${top}`;
}

function violatesOnboarding(meal: WMC2Item, onboarding: any): boolean {
  const names = (meal.ingredients || []).map(i => i.name.toLowerCase());
  
  // Use advanced ontology-based validation
  const allergenViolation = allergenViolated(names, onboarding);
  if (allergenViolation) {
    console.log(`🚫 Allergen violation detected: ${allergenViolation}`);
    return true;
  }
  
  const banViolation = banViolated(names, onboarding);
  if (banViolation) {
    console.log(`🚫 Ban violation detected: ${banViolation}`);
    return true;
  }
  
  // Additional macro validation using estimator
  const estimated = estimateMacros(meal.ingredients || []);
  if (estimated && onboarding.caloriesTarget) {
    const targetPerMeal = Number(onboarding.caloriesTarget) / 3; // rough estimate
    if (estimated.kcal > targetPerMeal * 1.5) {
      console.log(`🚫 Calorie violation: ${estimated.kcal} > ${targetPerMeal * 1.5}`);
      return true;
    }
  }
  
  return false;
}

// --- PUBLIC API ---
export async function wmc2Generate(input: z.infer<typeof WMC2PlanSchema>): Promise<WMC2Plan> {
  const t0 = Date.now();
  const req = WMC2PlanSchema.parse(input);
  
  // Get user onboarding data for personalization
  const onboarding = await getOnboarding(req.userId);
  const obHash = onboardingHash(onboarding);
  
  // Create cache signature for this specific request
  const sig = [
    `u:${req.userId}`,
    `d:${req.days}`,
    `sched:${scheduleSig(req.schedule)}`,
    `mode:${req.mode ?? "ai_varied"}`,
    `fixed:${req.fixedMenu ? req.fixedMenu.map(m => m.name).join(",") : ""}`,
    `ob:${obHash}`,
  ].join("#");

  // Check cache first
  const cached = cache.get(sig);
  if (cached) {
    console.log(`⚡ WMC2 cache HIT sig=${sig.slice(0,64)}... items=${cached.items?.length}`);
    return { ...cached, meta: { onboardingHash: obHash } };
  }

  // Telemetry counters
  let duplicatesPrevented = 0;
  let violationsFixed = 0;
  
  const dedupSlotsSeen = new Set<string>();
  const uniqueSlots = [...req.schedule]
    .sort((a,b)=>a.time.localeCompare(b.time) || a.order-b.order)
    .filter(s => { 
      const k = `${s.label}|${s.time}`; 
      if (dedupSlotsSeen.has(k)) return false; 
      dedupSlotsSeen.add(k); 
      return true; 
    });

  const items: WMC2Item[] = [];

  // MODE: repeat_one — generate once then duplicate into all positions
  if (req.mode === "repeat_one") {
    console.log("🔄 WMC2: Generating one meal for repeat mode");
    const first = uniqueSlots[0];
    
    const baseGen = await postJSON<MealResultRaw>(CC_GENERATE, {
      userId: req.userId, 
      targetMealType: slotToCourse(first).toLowerCase(),
      cravingInput: `${first.label} meal`,
      includeImage: req.includeImages
    });
    
    // Extract the meal data (handle both direct meal and response wrapper)
    const mealData = baseGen.meal || baseGen;
    let baseMeal = normalizeMeal({ 
      dayIndex:0, 
      slot:first.slot, 
      label:first.label, 
      time:first.time, 
      order:first.order 
    }, mealData);
    
    // Check for onboarding violations and regenerate if needed
    for (let t = 0; t < 3 && violatesOnboarding(baseMeal, onboarding); t++) {
      violationsFixed++;
      const regenData = await postJSON<MealResultRaw>(CC_GENERATE, {
        userId: req.userId, 
        targetMealType: slotToCourse(first).toLowerCase(),
        cravingInput: `${first.label} meal variation ${t+1}`,
        includeImage: req.includeImages
      });
      baseMeal = normalizeMeal({ 
        dayIndex:0, 
        slot:first.slot, 
        label:first.label, 
        time:first.time, 
        order:first.order 
      }, regenData.meal || regenData);
    }
    
    // Duplicate the validated meal across all slots
    for (let d=0; d<req.days; d++) {
      for (const s of uniqueSlots) {
        items.push({
          ...baseMeal,
          dayIndex: d,
          slot: s.slot,
          label: s.label,
          time: s.time,
          order: s.order
        });
      }
    }
    
    const ms = Date.now() - t0;
    console.log(`🍽️ WMC2 repeat_one: Generated ${items.length} identical meals, violationsFixed=${violationsFixed}, ms=${ms}`);
    
    const response = { days: req.days, items, meta: { onboardingHash: obHash } };
    cache.set(sig, response);
    return response;
  }

  // MODE: fixed_menu - cycle through user-selected meals
  if (req.mode === "fixed_menu" && req.fixedMenu && req.fixedMenu.length >= 2) {
    console.log(`🔄 WMC2: Fixed menu mode with ${req.fixedMenu.length} meals cycling`);
    let menuIndex = 0;
    
    for (let d = 0; d < req.days; d++) {
      for (const s of uniqueSlots) {
        const fixedMeal = req.fixedMenu[menuIndex % req.fixedMenu.length];
        
        const item: WMC2Item = {
          dayIndex: d,
          slot: s.slot,
          label: s.label,
          time: s.time,
          order: s.order,
          name: fixedMeal.name,
          description: fixedMeal.description,
          imageUrl: fixedMeal.imageUrl,
          ingredients: fixedMeal.ingredients,
          instructions: fixedMeal.instructions,
          calories: fixedMeal.calories,
          protein: fixedMeal.protein,
          carbs: fixedMeal.carbs,
          fats: fixedMeal.fats,
          labels: fixedMeal.labels || [],
          badges: fixedMeal.badges
        };
        
        items.push(item);
        menuIndex++;
      }
    }
    
    const ms = Date.now() - t0;
    console.log(`🍽️ WMC2 fixed_menu: Created ${items.length} meals from ${req.fixedMenu.length} fixed options, ms=${ms}`);
    
    const response = { days: req.days, items, meta: { onboardingHash: obHash } };
    cache.set(sig, response);
    return response;
  }

  // MODE: ai_varied (default) - generate unique meals with duplicate prevention
  console.log(`🍽️ WMC2: Generating ${req.days * uniqueSlots.length} varied meals`);
  
  // Generate day by day to maintain better variety control
  for (let d = 0; d < req.days; d++) {
    const dayResults: WMC2Item[] = [];
    const tasks: Promise<void>[] = [];
    
    for (const s of uniqueSlots) {
      tasks.push(limit(async () => {
        const gen = await postJSON<MealResultRaw>(CC_GENERATE, {
          userId: req.userId, 
          targetMealType: slotToCourse(s).toLowerCase(),
          cravingInput: `${s.label} meal day ${d+1}`,
          includeImage: false // defer images
        });
        
        const mealData = gen.meal || gen;
        let normalized = normalizeMeal({ 
          dayIndex:d, 
          slot:s.slot, 
          label:s.label, 
          time:s.time, 
          order:s.order 
        }, mealData);

        // Check for onboarding violations and regenerate if needed
        for (let t = 0; t < 4 && violatesOnboarding(normalized, onboarding); t++) {
          violationsFixed++;
          const regenData = await postJSON<MealResultRaw>(CC_GENERATE, {
            userId: req.userId, 
            targetMealType: slotToCourse(s).toLowerCase(),
            cravingInput: `${s.label} meal day ${d+1} safe variation ${t+1}`,
            includeImage: false
          });
          normalized = normalizeMeal({ 
            dayIndex:d, 
            slot:s.slot, 
            label:s.label, 
            time:s.time, 
            order:s.order 
          }, regenData.meal || regenData);
        }
        
        dayResults.push(normalized);
      }));
    }
    
    await Promise.allSettled(tasks);
    
    // Duplicate prevention within each day
    const seen = new Set<string>();
    for (let i = 0; i < dayResults.length; i++) {
      let cur = dayResults[i];
      let sigm = mealSig(cur);
      let tries = 0;
      
      while (seen.has(sigm) && tries < 4) {
        duplicatesPrevented++;
        const regenData = await postJSON<MealResultRaw>(CC_GENERATE, {
          userId: req.userId, 
          targetMealType: slotToCourse({slot: cur.slot, label: cur.label}).toLowerCase(),
          cravingInput: `${cur.label} meal day ${d+1} unique variation ${tries+10}`,
          includeImage: false
        });
        cur = normalizeMeal({ 
          dayIndex: d, 
          slot: cur.slot, 
          label: cur.label, 
          time: cur.time, 
          order: cur.order 
        }, regenData.meal || regenData);
        sigm = mealSig(cur); 
        tries++;
      }
      
      // Also check variety bank for cross-session duplicates
      let sigVB = mealSig(cur);
      let triesVB = 0;
      while (varietyBank.has(req.userId, sigVB) && triesVB < 3) {
        duplicatesPrevented++;
        const regenData = await postJSON<MealResultRaw>(CC_GENERATE, {
          userId: req.userId, 
          targetMealType: slotToCourse({slot: cur.slot, label: cur.label}).toLowerCase(),
          cravingInput: `${cur.label} meal day ${d+1} fresh variation ${triesVB+20}`,
          includeImage: false
        });
        cur = normalizeMeal({ 
          dayIndex: d, 
          slot: cur.slot, 
          label: cur.label, 
          time: cur.time, 
          order: cur.order 
        }, regenData.meal || regenData);
        sigVB = mealSig(cur);
        triesVB++;
      }
      
      seen.add(sigm);
      varietyBank.add(req.userId, mealSig(cur)); // Track in variety bank
      dayResults[i] = cur;
    }
    
    items.push(...dayResults);
  }
  
  const ms = Date.now() - t0;
  console.log(`📊 WMC2 telemetry: days=${req.days} items=${items.length} obHash=${obHash} dupesPrevented=${duplicatesPrevented} violationsFixed=${violationsFixed} ms=${ms}`);

  const response = { days: req.days, items, meta: { onboardingHash: obHash } };
  cache.set(sig, response);
  return response;
}

export async function wmc2Regenerate(userId:string, payload:{ slot:"meal"|"snack"; label:string; time:string }): Promise<WMC2Item> {
  const gen = await postJSON<MealResultRaw>(CC_REGEN, {
    userId, 
    targetMealType: slotToCourse({ slot: payload.slot, label: payload.label }).toLowerCase(),
    cravingInput: `regenerate ${payload.label}`,
    includeImage: true
  });
  
  const mealData = gen.meal || gen;
  
  // dayIndex/order filled in by client replacement; keep placeholders
  return normalizeMeal({ 
    dayIndex:0, 
    slot:payload.slot, 
    label:payload.label, 
    time:payload.time, 
    order:0 
  }, mealData);
}