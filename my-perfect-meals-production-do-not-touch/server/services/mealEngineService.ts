// server/services/mealEngineService.ts
import { buildMealPrompt } from "./promptBuilder";
import {
  validateMeal,
  ValidationConfig,
  UnitPrefs,
  roundUnitsInIngredients,
} from "./validators";
import { chatJson, genImage } from "../utils/openaiSafe";

/** ===== Types ===== */
export type EngineSource = "weekly" | "craving" | "potluck" | "fridge-rescue";

export interface UserOnboardingProfile {
  userId: string;
  name?: string;

  // Core diet rules
  dietType?: string; // e.g., "balanced", "keto", "mediterranean", "vegetarian", "vegan", etc.
  caloriesPerDay?: number;
  proteinTargetG?: number; // daily
  carbPreference?: "low" | "moderate" | "high";
  fatPreference?: "low" | "moderate" | "high";

  // Medical & safety
  hasDiabetesType1?: boolean;
  hasDiabetesType2?: boolean;
  allergies?: string[]; // ["peanut","shellfish","gluten"] etc.
  avoidIngredients?: string[]; // dislikes/intolerances

  // Sweetener prefs
  preferredSweeteners?: string[];
  bannedSweeteners?: string[];

  // Body type / misc
  bodyType?: "endomorph" | "mesomorph" | "ectomorph";

  // Image policy
  allowImageGen?: boolean;
}

export interface MealGenerationRequest {
  userId: string;
  source: EngineSource;
  selectedIngredients?: string[];
  tempDietOverride?: string;
  tempDietPreference?: string;
  tempMedicalOverride?: string;
  servings?: number;
  fridgeItems?: string[];
  potluckServings?: number;
  mealStructure?: {
    breakfasts: number;
    lunches: number;
    dinners: number;
    snacks?: number;
    days?: number;
  };
  generateImages?: boolean;
  mealType?: string; // breakfast | lunch | dinner | snack
  cravingInput?: string;

  /** Optional knobs (we’ll default them from onboarding if missing) */
  nutritionTargets?: {
    maxCaloriesPerServing?: number;
    minProteinPerServing_g?: number;
    maxAddedSugar_g?: number;
    maxSodium_mg?: number;
    preferLowGI?: boolean;
  };
  cookingRules?: {
    avoidDeepFry?: boolean;
    preferBakeAirFryGrill?: boolean;
    wholeGrainSwap?: boolean;
    leanProteinSwap?: boolean;
    reduceButterCream?: boolean;
  };
}

export interface Meal {
  id: string;
  name: string;
  description?: string;
  ingredients: Array<{
    item: string;
    amount: number;
    unit: string; // "oz","tbsp","cup","lb","g","ml"
    notes?: string;
  }>;
  instructions: string[];
  nutrition: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
    addedSugar_g?: number;
  };
  servings: number;
  imageUrl?: string;
  source: EngineSource;
  compliance: {
    allergiesCleared: boolean;
    medicalCleared: boolean;
    unitsStandardized: boolean;
  };
}

export interface PlanResponse {
  userId: string;
  meals: Meal[];
  meta: {
    source: EngineSource;
    generatedAt: string;
    imagesGenerated: boolean;
  };
}

/** ===== DB ===== */
import { getProfile, saveMeal } from "../db/repo";

async function fetchOnboardingProfile(
  userId: string,
): Promise<UserOnboardingProfile> {
  const p = await getProfile(userId);
  
  // Check if user has diabetes in healthConditions
  const healthConditions = p?.healthConditions || [];
  const hasDiabetesType1 = healthConditions.includes("diabetes_type_1") || healthConditions.includes("type_1_diabetes");
  const hasDiabetesType2 = healthConditions.includes("diabetes_type_2") || healthConditions.includes("type_2_diabetes");
  
  // Map dietary restrictions to diet type
  const dietaryRestrictions = p?.dietaryRestrictions || [];
  let dietType = "balanced";
  if (dietaryRestrictions.includes("vegetarian")) dietType = "vegetarian";
  if (dietaryRestrictions.includes("vegan")) dietType = "vegan";
  if (dietaryRestrictions.includes("keto")) dietType = "keto";
  if (dietaryRestrictions.includes("mediterranean")) dietType = "mediterranean";
  
  return {
    userId,
    dietType,
    caloriesPerDay: p?.dailyCalorieTarget ?? 2000,
    proteinTargetG: Math.round((p?.dailyCalorieTarget ?? 2000) * 0.25 / 4), // 25% of calories from protein
    carbPreference: "moderate",
    fatPreference: "moderate", 
    hasDiabetesType1,
    hasDiabetesType2,
    allergies: p?.allergies || [],
    avoidIngredients: [...(p?.dislikedFoods || []), ...(p?.avoidedFoods || [])],
    preferredSweeteners: p?.preferredSweeteners || [],
    bannedSweeteners: [], // Not in current schema
    bodyType: (p?.bodyType as any) ?? "mesomorph",
    allowImageGen: true, // Not in current schema, default to true
  };
}

function splitCSV(s?: string | null) {
  if (!s || typeof s !== "string") return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

async function persistMeal(userId: string, meal: Meal): Promise<string> {
  const saved = await saveMeal(userId, {
    name: meal.name,
    description: meal.description,
    servings: meal.servings,
    imageUrl: meal.imageUrl,
    source: meal.source || "ai-meal-creator",
    nutrition: meal.nutrition,
    ingredients: meal.ingredients,
    instructions: meal.instructions,
    compliance: meal.compliance,
  });
  return saved.id;
}

/** ===== Config & Infra ===== */
const WEEKLY_CONCURRENCY = Number(process.env.WEEKLY_CONCURRENCY ?? 4);
const MAX_INVALID_RETRIES = Number(process.env.LLM_INVALID_RETRIES ?? 2);

class Semaphore {
  private q: Array<() => void> = [];
  private c = 0;
  constructor(private max: number) {}
  async acquire() {
    if (this.c < this.max) {
      this.c++;
      return;
    }
    await new Promise<void>((r) => this.q.push(r));
    this.c++;
  }
  release() {
    this.c--;
    const next = this.q.shift();
    if (next) next();
  }
}
const weeklySem = new Semaphore(WEEKLY_CONCURRENCY);

/** Circuit breaker */
let breakerOpen = false;
let breakerTrips = 0;
const BREAKER_TRIP_THRESHOLD = Number(process.env.BREAKER_TRIP_THRESHOLD ?? 5);
const BREAKER_RESET_MS = Number(process.env.BREAKER_RESET_MS ?? 20_000);
function tripBreaker() {
  breakerTrips++;
  if (breakerTrips >= BREAKER_TRIP_THRESHOLD) {
    breakerOpen = true;
    setTimeout(() => {
      breakerOpen = false;
      breakerTrips = 0;
    }, BREAKER_RESET_MS);
  }
}

/** ===== HEALTH TARGETS derived from onboarding =====
 * We compute *per-meal* targets from daily budget + meal type.
 * Default distribution (by calories):
 *   breakfast 25% | lunch 30% | dinner 35% | snack 10%
 */
type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "unknown";
function resolveMealType(req: MealGenerationRequest): MealType {
  const t = (req.mealType || "").toLowerCase();
  if (t.includes("breakfast")) return "breakfast";
  if (t.includes("lunch")) return "lunch";
  if (t.includes("dinner")) return "dinner";
  if (t.includes("snack")) return "snack";
  // Infer from source when possible
  if (req.source === "weekly") return "dinner";
  return "unknown";
}

function deriveTargets(
  profile: UserOnboardingProfile,
  req: MealGenerationRequest,
) {
  const dailyCal = Math.max(
    1200,
    Math.min(4000, profile.caloriesPerDay ?? 2000),
  );

  const mt = resolveMealType(req);
  const split = ((): number => {
    switch (mt) {
      case "breakfast":
        return 0.25;
      case "lunch":
        return 0.3;
      case "dinner":
        return 0.35;
      case "snack":
        return 0.1;
      default:
        return 0.3; // neutral default
    }
  })();

  const maxCaloriesPerServing = Math.round(dailyCal * split);
  const minProteinPerServing_g = Math.max(
    20,
    Math.round((profile.proteinTargetG ?? 120) * split),
  );
  // Sodium & sugar stricter for diabetes
  const isDiabetes = !!profile.hasDiabetesType1 || !!profile.hasDiabetesType2;

  const baseTargets = {
    maxCaloriesPerServing,
    minProteinPerServing_g,
    maxAddedSugar_g: isDiabetes ? 5 : 8,
    maxSodium_mg: isDiabetes ? 600 : 700,
    preferLowGI: isDiabetes ? true : true,
  };

  // Allow request-level overrides (rare)
  const reqN = req.nutritionTargets || {};
  return {
    ...baseTargets,
    ...reqN,
  };
}

const HEALTH_COOKING_DEFAULTS = {
  avoidDeepFry: true,
  preferBakeAirFryGrill: true,
  wholeGrainSwap: true,
  leanProteinSwap: true,
  reduceButterCream: true,
};

function deriveCookingRules(req: MealGenerationRequest) {
  return { ...HEALTH_COOKING_DEFAULTS, ...(req.cookingRules || {}) };
}

/** Build the override string pushed into promptBuilder */
function healthyOverrideString(
  targets: ReturnType<typeof deriveTargets>,
  rules: ReturnType<typeof deriveCookingRules>,
  profile: UserOnboardingProfile,
) {
  const lines: string[] = [
    `HEALTH TRANSFORM: Create a healthier version while preserving flavor and identity.`,
    `Targets per serving (soft caps):`,
    `- Calories ≤ ${targets.maxCaloriesPerServing}`,
    `- Protein ≥ ${targets.minProteinPerServing_g} g`,
    `- Added sugar ≤ ${targets.maxAddedSugar_g} g`,
    `- Sodium ≤ ${targets.maxSodium_mg} mg`,
    targets.preferLowGI
      ? `- Prefer low-glycemic carbs; avoid refined sugar where possible.`
      : ``,
    `Cooking preferences:`,
    rules.avoidDeepFry
      ? `- Avoid deep-frying; use bake/air-fry/grill/saute.`
      : ``,
    rules.preferBakeAirFryGrill
      ? `- Prefer baking/air-frying/grilling when appropriate.`
      : ``,
    rules.wholeGrainSwap
      ? `- Prefer whole grains for tortillas/pasta/rice/breads.`
      : ``,
    rules.leanProteinSwap
      ? `- Use lean proteins (fish, chicken breast, 90/10 beef, tofu, legumes).`
      : ``,
    rules.reduceButterCream
      ? `- Reduce butter/cream; use olive oil/Greek yogurt alternatives when suitable.`
      : ``,
    profile.hasDiabetesType1 || profile.hasDiabetesType2
      ? `- Diabetes present: prioritize low-GI carbs, control total carbs, limit added sugars.`
      : ``,
  ].filter(Boolean);

  return lines.join("\n");
}

/** ===== Core LLM call via safe wrapper ===== */
async function llmGenerateMeal(
  profile: UserOnboardingProfile,
  request: MealGenerationRequest,
  unitPrefs: UnitPrefs,
): Promise<Meal> {
  if (breakerOpen)
    throw new Error("LLM temporarily unavailable (circuit open). Try again.");

  const sys = buildMealPrompt(profile, request, unitPrefs);

  try {
    const parsed = await chatJson({ system: sys.system, user: sys.user });
    const meal: Meal = {
      id: cryptoRandomId(),
      name: parsed.name,
      description: parsed.description ?? "",
      ingredients: (parsed.ingredients ?? []).map((ing: any) => ({
        item: ing.item,
        amount: Number(ing.amount),
        unit: String(ing.unit),
        notes: ing.notes ?? undefined,
      })),
      instructions: parsed.instructions ?? [],
      nutrition: {
        calories: Number(parsed.nutrition?.calories ?? 0),
        protein_g: Number(parsed.nutrition?.protein_g ?? 0),
        carbs_g: Number(parsed.nutrition?.carbs_g ?? 0),
        fat_g: Number(parsed.nutrition?.fat_g ?? 0),
        fiber_g: Number(parsed.nutrition?.fiber_g ?? 0),
        sugar_g: Number(parsed.nutrition?.sugar_g ?? 0),
        sodium_mg: Number(
          parsed.nutrition?.sodium_mg ?? parsed.nutrition?.sodium ?? 0,
        ),
        addedSugar_g: Number(parsed.nutrition?.addedSugar_g ?? 0),
      },
      servings: Number(parsed.servings ?? request.servings ?? 1),
      source: request.source,
      imageUrl: undefined,
      compliance: {
        allergiesCleared: false,
        medicalCleared: false,
        unitsStandardized: false,
      },
    };
    return meal;
  } catch (e) {
    tripBreaker();
    throw e;
  }
}

/** ===== Public API ===== */
export class MealEngineService {
  constructor(
    private validationCfg?: Partial<ValidationConfig>,
    private unitPrefs: UnitPrefs = {
      solidUnits: ["oz", "lb", "cup", "tbsp", "tsp"],
      liquidUnits: ["cup", "tbsp", "tsp", "ml"],
    },
  ) {}

  /** ALWAYS HEALTHY — enforced for all sources */
  async generateSingleMeal(req: MealGenerationRequest): Promise<Meal> {
    const profile = await fetchOnboardingProfile(req.userId);

    // 1) Derive health targets/rules from onboarding (+ optional request overrides)
    const targets = deriveTargets(profile, req);
    const rules = deriveCookingRules(req);
    const overrideStr = healthyOverrideString(targets, rules, profile);

    // 2) Augment request so your promptBuilder includes the constraints (no prompt rewrite needed)
    const mergedReq: MealGenerationRequest = {
      ...req,
      tempDietPreference: req.tempDietPreference ?? "healthier version",
      tempMedicalOverride: [overrideStr, (req.tempMedicalOverride || "").trim()]
        .filter(Boolean)
        .join("\n\n"),
      servings: req.servings ?? 2,
    };

    // 3) Generate
    let meal = await llmGenerateMeal(profile, mergedReq, this.unitPrefs);
    meal.ingredients = roundUnitsInIngredients(meal.ingredients);

    // 4) Validate with stricter, profile-driven config; retry if needed
    const validationCfg: Partial<ValidationConfig> = {
      ...this.validationCfg,
      enforceLowGIForDiabetes: targets.preferLowGI,
    };

    let attempts = 0;
    let validation = await validateMeal(meal, profile, validationCfg);
    meal.compliance = validation.flags;

    while (!validation.valid && attempts < MAX_INVALID_RETRIES) {
      attempts++;
      const regen = await llmGenerateMeal(profile, mergedReq, this.unitPrefs);
      regen.ingredients = roundUnitsInIngredients(regen.ingredients);
      const recheck = await validateMeal(regen, profile, validationCfg);
      regen.compliance = recheck.flags;
      if (recheck.valid) {
        meal = regen;
        validation = recheck;
        break;
      }
    }

    // 5) Optional image
    const shouldImage =
      (typeof req.generateImages === "boolean"
        ? req.generateImages
        : profile.allowImageGen) &&
      req.source !== "weekly" &&
      process.env.DISABLE_IMAGE_GEN !== "true";

    if (shouldImage) {
      meal.imageUrl = await genImage(
        `High-fidelity, realistic photo of ${meal.name}. Natural lighting, accurate plating.`,
      );
    }

    // 6) Persist & return
    const savedId = await persistMeal(req.userId, meal);
    meal.id = savedId;
    return meal;
  }

  async generatePlan(req: MealGenerationRequest): Promise<PlanResponse> {
    const structure = req.mealStructure ?? {
      breakfasts: 1,
      lunches: 1,
      dinners: 1,
      snacks: 0,
    };
    const days = Math.min(req.mealStructure?.days ?? 7, 7);

    const mealTypes = [
      ...Array(structure.breakfasts).fill("breakfast"),
      ...Array(structure.lunches).fill("lunch"),
      ...Array(structure.dinners).fill("dinner"),
      ...Array(structure.snacks ?? 0).fill("snack"),
    ];

    const meals: Meal[] = [];
    const usedNames = new Set<string>();

    try {
      for (let day = 0; day < days; day++) {
        for (const mealType of mealTypes) {
          await weeklySem.acquire();
          try {
            const mealReq = {
              ...req,
              source: "weekly" as const,
              mealType,
              selectedIngredients: req.selectedIngredients || [],
              generateImages: false,
            };

            let attempts = 0;
            let meal: Meal;
            do {
              meal = await this.generateSingleMeal(mealReq);
              meal.description = `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} - Day ${day + 1}`;
              attempts++;
            } while (usedNames.has(meal.name) && attempts < 3);

            usedNames.add(meal.name);
            meals.push(meal);
          } finally {
            weeklySem.release();
          }
        }
      }
    } catch (error: any) {
      console.error(
        "Weekly plan generation failed, using fallback meals:",
        error.message,
      );
      const { createFallbackMeal } = await import("./fallbackMealService");
      const mealCount = mealTypes.length * days;

      for (let i = meals.length; i < mealCount; i++) {
        const mealType = mealTypes[i % mealTypes.length];
        const fallbackMeal = createFallbackMeal({
          ...req,
          source: "weekly",
          mealType,
        });
        fallbackMeal.description = `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} - Day ${Math.floor(i / mealTypes.length) + 1}`;
        meals.push(fallbackMeal);
      }
    }

    return {
      userId: req.userId,
      meals,
      meta: {
        source: "weekly",
        generatedAt: new Date().toISOString(),
        imagesGenerated: false,
      },
    };
  }

  /** Potluck scaling (still healthy; scaling doesn’t break rules) */
  async generateScaledMeal(req: MealGenerationRequest): Promise<Meal> {
    const base = await this.generateSingleMeal({ ...req, source: "potluck" });
    const target = req.potluckServings ?? req.servings ?? base.servings;

    if (target !== base.servings) {
      const scale = target / base.servings;
      base.ingredients = base.ingredients.map((ing) => ({
        ...ing,
        amount: Number((ing.amount * scale).toFixed(2)),
      }));
      base.nutrition = {
        calories: Math.round(base.nutrition.calories * scale),
        protein_g: Math.round(base.nutrition.protein_g * scale),
        carbs_g: Math.round(base.nutrition.carbs_g * scale),
        fat_g: Math.round(base.nutrition.fat_g * scale),
        fiber_g: Math.round((base.nutrition.fiber_g ?? 0) * scale),
        sugar_g: Math.round((base.nutrition.sugar_g ?? 0) * scale),
        sodium_mg: Math.round((base.nutrition.sodium_mg ?? 0) * scale),
        addedSugar_g: Math.round((base.nutrition.addedSugar_g ?? 0) * scale),
      };
      base.servings = target;
      base.ingredients = roundUnitsInIngredients(base.ingredients);
    }
    return base;
  }

  /** Fridge Rescue (force ingredients but still obey health rules) */
  async generateFromIngredients(req: MealGenerationRequest): Promise<Meal> {
    const merged = {
      ...req,
      source: "fridge-rescue" as const,
      selectedIngredients: Array.from(
        new Set([
          ...(req.selectedIngredients ?? []),
          ...(req.fridgeItems ?? []),
        ]),
      ),
    };
    return this.generateSingleMeal(merged);
  }
}

/** ===== Utils ===== */
function cryptoRandomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "meal_" + Math.random().toString(36).slice(2);
  }
}
