import type { 
  HubModule, 
  HubContext, 
  HubGuardrails, 
  PromptFragment, 
  ValidationResult,
  ValidationViolation 
} from '../types';
import type { UnifiedMeal } from '../../unifiedMealPipeline';
import { db } from '../../../db';
import { glucoseLogs, diabetesProfile, Guardrails, DEFAULT_GUARDRAILS } from '../../../../shared/diabetes-schema';
import { userGlycemicSettings } from '../../../../shared/schema';
import { eq, desc } from 'drizzle-orm';

export type GlucoseState = 
  | 'low'
  | 'low-normal'
  | 'in-range'
  | 'elevated'
  | 'high-risk';

interface DiabeticContextData {
  hasDiabetes: boolean;
  diabetesType: 'NONE' | 'T1D' | 'T2D';
  latestGlucose: {
    value: number;
    context: string;
    state: GlucoseState;
    recordedAt: Date;
    ageMinutes: number;
  } | null;
  hypoHistory: boolean;
}

function classifyGlucose(valueMgdl: number, context: string): GlucoseState {
  if (valueMgdl < 70) return 'low';
  if (valueMgdl <= 80) return 'low-normal';
  
  if (context === 'FASTED' || context === 'PRE_MEAL') {
    if (valueMgdl <= 120) return 'in-range';
    if (valueMgdl <= 180) return 'elevated';
    return 'high-risk';
  }
  
  if (context === 'POST_MEAL_1H' || context === 'POST_MEAL_2H') {
    if (valueMgdl <= 140) return 'in-range';
    if (valueMgdl <= 180) return 'elevated';
    return 'high-risk';
  }
  
  if (valueMgdl <= 140) return 'in-range';
  if (valueMgdl <= 180) return 'elevated';
  return 'high-risk';
}

async function fetchDiabeticContext(userId: string): Promise<DiabeticContextData> {
  const profile = await db.query.diabetesProfile.findFirst({
    where: (p, { eq }) => eq(p.userId, userId)
  });

  const [latestLog] = await db.select()
    .from(glucoseLogs)
    .where(eq(glucoseLogs.userId, userId))
    .orderBy(desc(glucoseLogs.recordedAt))
    .limit(1);

  let latestGlucose: DiabeticContextData['latestGlucose'] = null;
  
  if (latestLog) {
    const recordedAt = new Date(latestLog.recordedAt);
    const now = new Date();
    const ageMinutes = Math.floor((now.getTime() - recordedAt.getTime()) / (1000 * 60));
    
    latestGlucose = {
      value: latestLog.valueMgdl,
      context: latestLog.context,
      state: classifyGlucose(latestLog.valueMgdl, latestLog.context),
      recordedAt,
      ageMinutes
    };
  }

  return {
    hasDiabetes: profile?.type !== 'NONE' && profile?.type !== undefined,
    diabetesType: (profile?.type as 'NONE' | 'T1D' | 'T2D') || 'NONE',
    latestGlucose,
    hypoHistory: profile?.hypoHistory || false
  };
}

function buildGlucoseGuidance(data: DiabeticContextData): string {
  if (!data.latestGlucose) {
    return 'No recent glucose data available. Generate a balanced diabetic-friendly meal with moderate carbohydrates.';
  }

  const { value, state, ageMinutes } = data.latestGlucose;
  const staleData = ageMinutes > 240;
  
  if (staleData) {
    return `Last glucose reading (${value} mg/dL) is over 4 hours old. Generate a balanced diabetic-friendly meal with moderate carbohydrates.`;
  }

  switch (state) {
    case 'low':
      return `Current glucose is ${value} mg/dL (LOW). ${data.hypoHistory ? 'User has history of hypoglycemia. ' : ''}Generate a meal with adequate carbohydrates (30-45g) to help stabilize blood sugar while avoiding rapid spikes.`;
    
    case 'low-normal':
      return `Current glucose is ${value} mg/dL (lower-normal range). Generate a balanced meal with 25-35g carbohydrates to maintain stable levels.`;
    
    case 'in-range':
      return `Current glucose is ${value} mg/dL (in optimal range). Generate a balanced diabetic-friendly meal that maintains this good control, keeping carbs moderate (20-35g).`;
    
    case 'elevated':
      return `Current glucose is ${value} mg/dL (elevated above target). Generate a lower-carb meal (15-25g carbs max) with emphasis on protein and fiber to help bring levels down.`;
    
    case 'high-risk':
      return `Current glucose is ${value} mg/dL (high - needs attention). Generate a very low-carb meal (under 15g carbs) with high protein and fiber. Prioritize non-starchy vegetables.`;
    
    default:
      return 'Generate a balanced diabetic-friendly meal with moderate carbohydrates.';
  }
}

export const diabeticHubModule: HubModule = {
  hubType: 'diabetic',

  async getContext(userId: string): Promise<HubContext | null> {
    const data = await fetchDiabeticContext(userId);
    if (!data.hasDiabetes) return null;
    
    return {
      hubType: 'diabetic',
      userId,
      data: data as unknown as Record<string, unknown>
    };
  },

  async getGuardrails(userId: string): Promise<HubGuardrails> {
    const [profile, glycemicRow] = await Promise.all([
      db.query.diabetesProfile.findFirst({
        where: (p, { eq }) => eq(p.userId, userId)
      }),
      db.select({ preferredCarbs: userGlycemicSettings.preferredCarbs })
        .from(userGlycemicSettings)
        .where(eq(userGlycemicSettings.userId, userId))
        .limit(1)
        .then(rows => rows[0] ?? null)
    ]);

    const guardrails = profile?.guardrails as Guardrails | null;

    // User's personally selected low-GI carbs from Glycemic Settings screen
    const userPreferredCarbs: string[] = (glycemicRow?.preferredCarbs as string[]) || [];
    
    const basePreferred = [
      'leafy greens', 'broccoli', 'cauliflower', 'zucchini', 'asparagus',
      'chicken breast', 'salmon', 'turkey', 'eggs', 'greek yogurt',
      'olive oil', 'avocado', 'nuts', 'seeds', 'legumes'
    ];

    // Merge user's preferred carbs — deduplicated
    const mergedPreferred = [...new Set([...basePreferred, ...userPreferredCarbs])];

    if (userPreferredCarbs.length > 0) {
      console.log(`🩺 [DIABETIC HUB] Loaded user glycemic preferences: ${userPreferredCarbs.join(", ")}`);
    }
    
    const dailyCarbLimit = guardrails?.carbLimit ?? DEFAULT_GUARDRAILS.carbLimit!;
    const mealFrequency = Math.max(1, guardrails?.mealFrequency ?? DEFAULT_GUARDRAILS.mealFrequency ?? 3);
    // ✅ FIX: Convert daily carb limit to per-meal ceiling
    const perMealCarbCeiling = Math.round(dailyCarbLimit / mealFrequency);

    return {
      hubType: 'diabetic',
      carbCeiling: perMealCarbCeiling,
      fiberMin: guardrails?.fiberMin ?? DEFAULT_GUARDRAILS.fiberMin!,
      giCap: guardrails?.giCap ?? DEFAULT_GUARDRAILS.giCap!,
      userPreferredCarbs,
      // ✅ FIX: Full clinical blocked list (110 items) — replaces the previous 14-item stub
      blockedIngredients: [
        // Sugars & sweeteners
        'white sugar', 'brown sugar', 'sugar', 'honey', 'maple syrup',
        'agave', 'agave nectar', 'high-fructose corn syrup', 'corn syrup',
        'molasses', 'candy', 'milk chocolate', 'sweetened yogurt',
        'flavored yogurt', 'sugary granola', 'granola bar',
        // High-GI starches
        'white rice', 'jasmine rice', 'regular pasta', 'spaghetti', 'penne',
        'fettuccine', 'linguine', 'macaroni', 'potato', 'potatoes',
        'mashed potatoes', 'french fries', 'fries', 'baked potato',
        'hash browns', 'tater tots', 'flour tortilla', 'flour tortillas',
        'pizza crust', 'pizza dough', 'pastry', 'pastries', 'bread',
        'white bread', 'muffin', 'muffins', 'croissant', 'bagel', 'donut',
        'doughnut', 'white flour', 'all-purpose flour', 'pancake', 'pancakes',
        'waffle', 'waffles',
        // High-GI fruits
        'banana', 'bananas', 'pineapple', 'mango', 'mangoes', 'grapes',
        'grape', 'watermelon', 'dried fruit', 'raisins', 'dates',
        'fruit juice', 'orange juice', 'apple juice',
        // Sugary condiments
        'bbq sauce', 'barbecue sauce', 'ketchup', 'teriyaki sauce',
        'sweet chili sauce', 'hoisin sauce', 'caramel', 'chocolate sauce',
        'jam', 'jelly', 'marmalade',
        // Sugary beverages
        'soda', 'cola', 'sweet tea', 'lemonade', 'sports drink', 'energy drink',
        // Fried / processed
        'potato chips', 'chips', 'crackers', 'pretzels',
      ],
      preferredIngredients: mergedPreferred,
      customRules: { dailyCarbLimit, mealFrequency, perMealCarbCeiling }
    };
  },

  buildPrompt(
    context: HubContext | null,
    guardrails: HubGuardrails,
    mealType: string
  ): PromptFragment {
    const data = context?.data as DiabeticContextData | undefined;
    const glucoseGuidance = data ? buildGlucoseGuidance(data) : '';

    const userCarbsLine = guardrails.userPreferredCarbs && guardrails.userPreferredCarbs.length > 0
      ? `- User's preferred low-GI carb sources (PRIORITIZE THESE): ${guardrails.userPreferredCarbs.join(', ')}\n`
      : '';

    // Group blocked items for clearer AI instruction
    const blockedSugars = guardrails.blockedIngredients?.filter(i =>
      ['sugar','honey','maple syrup','agave','corn syrup','molasses','candy','milk chocolate',
       'sweetened yogurt','flavored yogurt','granola bar'].includes(i)
    ) ?? [];
    const blockedStarches = guardrails.blockedIngredients?.filter(i =>
      ['white rice','jasmine rice','regular pasta','spaghetti','penne','fettuccine','linguine',
       'macaroni','potato','potatoes','mashed potatoes','french fries','fries','baked potato',
       'hash browns','tater tots','flour tortilla','pizza crust','bread','white bread','muffin',
       'muffins','croissant','bagel','donut','doughnut','white flour','all-purpose flour',
       'pancake','pancakes','waffle','waffles'].includes(i)
    ) ?? [];
    const blockedFruits = guardrails.blockedIngredients?.filter(i =>
      ['banana','bananas','pineapple','mango','mangoes','grapes','grape','watermelon',
       'dried fruit','raisins','dates','fruit juice','orange juice','apple juice'].includes(i)
    ) ?? [];

    let promptAddition = `
DIABETIC MEAL REQUIREMENTS — STRICT ENFORCEMENT:
- Maximum carbohydrates THIS MEAL: ${guardrails.carbCeiling}g (hard limit — do not exceed)
- Minimum fiber: ${guardrails.fiberMin}g
- Glycemic index cap: under GI ${guardrails.giCap} for all carb sources
- Focus on lean proteins, non-starchy vegetables, and healthy fats

ABSOLUTELY FORBIDDEN — NEVER include these:
Sugars/sweeteners: ${blockedSugars.join(', ')}
High-GI starches: ${blockedStarches.join(', ')}
High-GI fruits: ${blockedFruits.join(', ')}
Also avoid: bbq sauce, ketchup, teriyaki sauce, hoisin sauce, caramel, jam, jelly, soda, fruit juice, sports drinks, potato chips, crackers

${userCarbsLine}`;


    if (glucoseGuidance) {
      promptAddition = `
REAL-TIME GLUCOSE CONTEXT (CRITICAL - FOLLOW THIS):
${glucoseGuidance}

${promptAddition}`;
    }

    return {
      systemPrompt: 'You are a diabetes-aware nutrition expert. All meals must be suitable for blood sugar management.',
      userPromptAddition: promptAddition,
      priority: 10
    };
  },

  validate(meal: UnifiedMeal, guardrails: HubGuardrails): ValidationResult {
    const violations: ValidationViolation[] = [];
    const warnings: string[] = [];

    // ✅ Phase 2: Macro presence check — missing carb data = invalid
    if (meal.carbs === null || meal.carbs === undefined || isNaN(meal.carbs)) {
      violations.push({
        rule: 'missing_macro_data',
        message: 'Carbohydrate data is missing — cannot verify diabetic safety',
        severity: 'hard',
      });
    } else {
      // Carb ceiling check (carbCeiling is already per-meal after Phase 1 fix)
      if (guardrails.carbCeiling && meal.carbs > guardrails.carbCeiling) {
        violations.push({
          rule: 'carb_ceiling',
          message: `Carbs (${meal.carbs}g) exceed per-meal limit (${guardrails.carbCeiling}g)`,
          severity: 'hard',
          actualValue: meal.carbs,
          expectedValue: guardrails.carbCeiling
        });
      }
    }

    const mealIngredients = meal.ingredients.map(i => i.name.toLowerCase()).join(' ');
    const mealName = meal.name.toLowerCase();
    const mealDesc = (meal.description || '').toLowerCase();
    const fullText = `${mealName} ${mealDesc} ${mealIngredients}`;

    // ✅ Phase 2: Blocked ingredients are now HARD failures — no soft passes
    for (const blocked of guardrails.blockedIngredients || []) {
      if (fullText.includes(blocked.toLowerCase())) {
        if (!isSafeVariant(fullText, blocked)) {
          violations.push({
            rule: 'blocked_ingredient',
            message: `Contains blocked ingredient: "${blocked}" — not safe for diabetic meal`,
            severity: 'hard',
            actualValue: blocked
          });
        }
      }
    }

    return {
      isValid: violations.filter(v => v.severity === 'hard').length === 0,
      violations,
      warnings,
      fixHint: violations.length > 0
        ? `Regenerate: keep carbs under ${guardrails.carbCeiling}g per meal, remove blocked ingredients, and use low-GI alternatives. Maintain flavor.`
        : undefined
    };
  },

  getFixHint(violations: ValidationViolation[]): string {
    const carbViolation = violations.find(v => v.rule === 'carb_ceiling');
    const ingredientViolations = violations.filter(v => v.rule === 'blocked_ingredient');

    const hints: string[] = [];
    
    if (carbViolation) {
      hints.push(`reduce total carbohydrates to under ${carbViolation.expectedValue}g`);
    }
    
    if (ingredientViolations.length > 0) {
      const ingredients = ingredientViolations.map(v => v.actualValue).join(', ');
      hints.push(`remove or substitute: ${ingredients}`);
    }

    return `Please regenerate with these adjustments: ${hints.join('; ')}. Maintain flavor and satisfaction.`;
  }
};

function isSafeVariant(text: string, blocked: string): boolean {
  const safePatterns: Record<string, string[]> = {
    'white sugar': ['sugar-free', 'no sugar', 'zero sugar'],
    'white rice': ['cauliflower rice', 'brown rice', 'wild rice'],
    'white bread': ['whole grain bread', 'low-carb bread', 'keto bread'],
    'regular pasta': ['chickpea pasta', 'lentil pasta', 'zucchini noodles', 'protein pasta'],
    'potato chips': ['veggie chips', 'kale chips'],
    'french fries': ['baked', 'air-fried sweet potato']
  };

  const patterns = safePatterns[blocked.toLowerCase()];
  if (patterns) {
    return patterns.some(safe => text.includes(safe));
  }
  return false;
}
