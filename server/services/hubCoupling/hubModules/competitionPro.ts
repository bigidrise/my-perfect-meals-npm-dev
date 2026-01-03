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
import { users } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';

interface CompetitionProContextData {
  phase: 'cut' | 'bulk' | 'maintain' | 'competition-prep';
  weeksOut?: number;
  bodyweightLbs?: number;
  targetProteinPerLb?: number;
}

const DEFAULT_COMPETITION_GUARDRAILS: HubGuardrails = {
  hubType: 'competition-pro',
  proteinFloor: 40,
  carbCeiling: 25,
  fatFloor: 8,
  fatCeiling: 25,
  fiberMin: 5,
  blockedIngredients: [
    'sugar', 'candy', 'soda', 'chips', 'crackers', 'bread', 'pasta', 
    'rice', 'potatoes', 'corn', 'beer', 'wine', 'cocktails',
    'ice cream', 'cookies', 'cake', 'donuts', 'pastries', 'cereal'
  ],
  preferredIngredients: [
    'chicken breast', 'turkey breast', 'lean beef', 'white fish', 'salmon',
    'egg whites', 'greek yogurt', 'cottage cheese', 'whey protein',
    'broccoli', 'asparagus', 'spinach', 'green beans', 'zucchini',
    'olive oil', 'avocado', 'almonds'
  ]
};

export const competitionProHubModule: HubModule = {
  hubType: 'competition-pro',

  async getContext(userId: string): Promise<HubContext | null> {
    return {
      hubType: 'competition-pro',
      userId,
      data: {
        phase: 'cut',
        targetProteinPerLb: 1.0
      }
    };
  },

  async getGuardrails(userId: string): Promise<HubGuardrails> {
    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId)
    });

    const bodyweight = user?.weight ? Number(user.weight) : 180;
    const proteinTarget = Math.round(bodyweight * 1.0);
    const mealsPerDay = 4;
    const proteinPerMeal = Math.round(proteinTarget / mealsPerDay);

    return {
      ...DEFAULT_COMPETITION_GUARDRAILS,
      proteinFloor: Math.max(proteinPerMeal, 40),
      customRules: {
        bodyweightLbs: bodyweight,
        dailyProteinTarget: proteinTarget,
        mealsPerDay
      }
    };
  },

  buildPrompt(
    context: HubContext | null,
    guardrails: HubGuardrails,
    mealType: string
  ): PromptFragment {
    const data = context?.data as unknown as CompetitionProContextData | undefined;
    const phase = data?.phase || 'cut';

    return {
      systemPrompt: `You are a competition bodybuilding nutrition coach. Every meal MUST meet strict macro requirements. This is non-negotiable - competitors depend on precise nutrition.`,
      userPromptAddition: `
COMPETITION PRO REQUIREMENTS (STRICT - NO EXCEPTIONS):
- MINIMUM protein: ${guardrails.proteinFloor}g (this is a HARD FLOOR - meal MUST have at least this much)
- MAXIMUM carbs: ${guardrails.carbCeiling}g (this is a HARD CEILING - do NOT exceed)
- Fat range: ${guardrails.fatFloor}-${guardrails.fatCeiling}g
- Minimum fiber: ${guardrails.fiberMin}g

PHASE: ${phase.toUpperCase()}
${phase === 'cut' ? '- Prioritize lean protein sources and fibrous vegetables' : ''}
${phase === 'bulk' ? '- Allow slightly more calories but maintain protein priority' : ''}

ALLOWED CARB SOURCES (fibrous only):
- Green vegetables: broccoli, asparagus, spinach, green beans, zucchini
- Leafy greens: lettuce, kale, arugula, cabbage
- Other low-carb: cauliflower, mushrooms, peppers, onions

BANNED FOODS (never include):
${guardrails.blockedIngredients?.join(', ')}

PROTEIN SOURCES TO USE:
${guardrails.preferredIngredients?.filter(i => 
  ['chicken', 'turkey', 'beef', 'fish', 'salmon', 'egg', 'yogurt', 'cottage', 'whey'].some(p => i.includes(p))
).join(', ')}

If the user requests a high-carb meal like pasta or pizza, you MUST decline and offer a compliant alternative that satisfies similar flavor profiles using allowed ingredients.
`,
      priority: 20
    };
  },

  validate(meal: UnifiedMeal, guardrails: HubGuardrails): ValidationResult {
    const violations: ValidationViolation[] = [];
    const warnings: string[] = [];

    if (guardrails.proteinFloor && meal.protein < guardrails.proteinFloor) {
      violations.push({
        rule: 'protein_floor',
        message: `Protein (${meal.protein}g) below minimum (${guardrails.proteinFloor}g)`,
        severity: 'hard',
        actualValue: meal.protein,
        expectedValue: guardrails.proteinFloor
      });
    }

    if (guardrails.carbCeiling && meal.carbs > guardrails.carbCeiling) {
      violations.push({
        rule: 'carb_ceiling',
        message: `Carbs (${meal.carbs}g) exceed maximum (${guardrails.carbCeiling}g)`,
        severity: 'hard',
        actualValue: meal.carbs,
        expectedValue: guardrails.carbCeiling
      });
    }

    if (guardrails.fatCeiling && meal.fat > guardrails.fatCeiling) {
      violations.push({
        rule: 'fat_ceiling',
        message: `Fat (${meal.fat}g) exceeds maximum (${guardrails.fatCeiling}g)`,
        severity: 'soft',
        actualValue: meal.fat,
        expectedValue: guardrails.fatCeiling
      });
    }

    if (guardrails.fatFloor && meal.fat < guardrails.fatFloor) {
      warnings.push(`Fat (${meal.fat}g) below recommended minimum (${guardrails.fatFloor}g)`);
    }

    const mealText = `${meal.name} ${meal.description || ''} ${meal.ingredients.map(i => i.name).join(' ')}`.toLowerCase();
    
    for (const blocked of guardrails.blockedIngredients || []) {
      if (mealText.includes(blocked.toLowerCase())) {
        if (!isAllowedVariant(mealText, blocked)) {
          violations.push({
            rule: 'blocked_ingredient',
            message: `Contains banned ingredient: ${blocked}`,
            severity: 'hard',
            actualValue: blocked
          });
        }
      }
    }

    const proteinRatio = meal.protein / meal.calories * 100;
    if (proteinRatio < 30) {
      warnings.push(`Protein ratio (${proteinRatio.toFixed(0)}%) is below optimal 30%+ for competition prep`);
    }

    return {
      isValid: violations.filter(v => v.severity === 'hard').length === 0,
      violations,
      warnings,
      fixHint: violations.length > 0 ? buildFixHint(violations, guardrails) : undefined
    };
  },

  getFixHint(violations: ValidationViolation[]): string {
    const proteinViolation = violations.find(v => v.rule === 'protein_floor');
    const carbViolation = violations.find(v => v.rule === 'carb_ceiling');
    const ingredientViolations = violations.filter(v => v.rule === 'blocked_ingredient');

    const hints: string[] = [];
    
    if (proteinViolation) {
      hints.push(`INCREASE protein to at least ${proteinViolation.expectedValue}g using chicken breast, fish, or egg whites`);
    }
    
    if (carbViolation) {
      hints.push(`REDUCE carbs to under ${carbViolation.expectedValue}g by removing starches and using only fibrous vegetables`);
    }
    
    if (ingredientViolations.length > 0) {
      const ingredients = ingredientViolations.map(v => v.actualValue).join(', ');
      hints.push(`REMOVE banned ingredients: ${ingredients}`);
    }

    return `CRITICAL: Regenerate this meal with: ${hints.join('. ')}. Keep it delicious but MUST meet macro requirements.`;
  }
};

function isAllowedVariant(text: string, blocked: string): boolean {
  const allowedVariants: Record<string, string[]> = {
    'rice': ['cauliflower rice', 'riced cauliflower'],
    'pasta': ['zucchini noodles', 'shirataki', 'spaghetti squash'],
    'bread': ['lettuce wrap', 'cloud bread'],
    'potatoes': ['mashed cauliflower', 'turnip']
  };

  const variants = allowedVariants[blocked.toLowerCase()];
  if (variants) {
    return variants.some(v => text.includes(v));
  }
  return false;
}

function buildFixHint(violations: ValidationViolation[], guardrails: HubGuardrails): string {
  const hints: string[] = [];
  
  for (const v of violations) {
    if (v.rule === 'protein_floor') {
      hints.push(`increase protein to ${v.expectedValue}g+`);
    } else if (v.rule === 'carb_ceiling') {
      hints.push(`reduce carbs to under ${v.expectedValue}g`);
    } else if (v.rule === 'blocked_ingredient') {
      hints.push(`remove ${v.actualValue}`);
    }
  }

  return `Regenerate with: ${hints.join(', ')}. Use lean proteins and fibrous vegetables only.`;
}
