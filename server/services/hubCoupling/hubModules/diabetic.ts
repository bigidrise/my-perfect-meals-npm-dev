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
    const profile = await db.query.diabetesProfile.findFirst({
      where: (p, { eq }) => eq(p.userId, userId)
    });

    const guardrails = profile?.guardrails as Guardrails | null;
    
    return {
      hubType: 'diabetic',
      carbCeiling: guardrails?.carbLimit ?? DEFAULT_GUARDRAILS.carbLimit!,
      fiberMin: guardrails?.fiberMin ?? DEFAULT_GUARDRAILS.fiberMin!,
      giCap: guardrails?.giCap ?? DEFAULT_GUARDRAILS.giCap!,
      blockedIngredients: [
        'white sugar', 'brown sugar', 'corn syrup', 'high fructose corn syrup',
        'candy', 'soda', 'fruit juice', 'white bread', 'white rice',
        'regular pasta', 'potato chips', 'french fries', 'donuts', 'pastries'
      ],
      preferredIngredients: [
        'leafy greens', 'broccoli', 'cauliflower', 'zucchini', 'asparagus',
        'chicken breast', 'salmon', 'turkey', 'eggs', 'greek yogurt',
        'olive oil', 'avocado', 'nuts', 'seeds', 'legumes'
      ]
    };
  },

  buildPrompt(
    context: HubContext | null,
    guardrails: HubGuardrails,
    mealType: string
  ): PromptFragment {
    const data = context?.data as DiabeticContextData | undefined;
    const glucoseGuidance = data ? buildGlucoseGuidance(data) : '';

    let promptAddition = `
DIABETIC MEAL REQUIREMENTS:
- Maximum carbohydrates: ${guardrails.carbCeiling}g per meal
- Minimum fiber: ${guardrails.fiberMin}g
- Prioritize low glycemic index ingredients (under GI ${guardrails.giCap})
- Focus on lean proteins, non-starchy vegetables, and healthy fats
- Avoid: ${guardrails.blockedIngredients?.slice(0, 8).join(', ')}
`;

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

    if (guardrails.carbCeiling && meal.carbs > guardrails.carbCeiling) {
      violations.push({
        rule: 'carb_ceiling',
        message: `Carbs (${meal.carbs}g) exceed limit (${guardrails.carbCeiling}g)`,
        severity: 'hard',
        actualValue: meal.carbs,
        expectedValue: guardrails.carbCeiling
      });
    }

    const mealIngredients = meal.ingredients.map(i => i.name.toLowerCase()).join(' ');
    const mealName = meal.name.toLowerCase();
    const mealDesc = (meal.description || '').toLowerCase();
    const fullText = `${mealName} ${mealDesc} ${mealIngredients}`;

    for (const blocked of guardrails.blockedIngredients || []) {
      if (fullText.includes(blocked.toLowerCase())) {
        if (!isSafeVariant(fullText, blocked)) {
          violations.push({
            rule: 'blocked_ingredient',
            message: `Contains blocked ingredient: ${blocked}`,
            severity: 'soft',
            actualValue: blocked
          });
        }
      }
    }

    if (meal.carbs > 60) {
      warnings.push(`High carbohydrate content (${meal.carbs}g) - consider reducing for better glucose control`);
    }

    return {
      isValid: violations.filter(v => v.severity === 'hard').length === 0,
      violations,
      warnings,
      fixHint: violations.length > 0 
        ? `Reduce carbs to under ${guardrails.carbCeiling}g and avoid blocked ingredients. Keep the meal delicious.`
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
