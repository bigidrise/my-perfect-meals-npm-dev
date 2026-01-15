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
import { glp1Shots } from '../../../../shared/schema';
import { eq, desc } from 'drizzle-orm';

interface GLP1ContextData {
  nauseaLevel: number;
  appetiteLevel: number;
  constipationLevel: number;
  refluxLevel: number;
  daysSinceLastShot: number;
  currentMedication?: string;
  doseLevel?: string;
}

const DEFAULT_GLP1_GUARDRAILS: HubGuardrails = {
  hubType: 'glp1',
  proteinFloor: 25,
  carbCeiling: 40,
  fatCeiling: 20,
  fiberMin: 8,
  portionCap: 400,
  blockedIngredients: [
    'fried', 'deep-fried', 'greasy', 'heavy cream', 'cream sauce',
    'alfredo', 'mac and cheese', 'pizza', 'burger', 'nachos',
    'large portions', 'buffet-style', 'all-you-can-eat'
  ],
  preferredIngredients: [
    'grilled chicken', 'baked fish', 'steamed vegetables', 'lean protein',
    'egg whites', 'greek yogurt', 'cottage cheese', 'broth-based soup',
    'small portions', 'protein-dense', 'easy to digest'
  ]
};

export const glp1HubModule: HubModule = {
  hubType: 'glp1',

  async getContext(userId: string): Promise<HubContext | null> {
    const [latestShot] = await db.select()
      .from(glp1Shots)
      .where(eq(glp1Shots.userId, userId))
      .orderBy(desc(glp1Shots.dateUtc))
      .limit(1);

    if (!latestShot) {
      return {
        hubType: 'glp1',
        userId,
        data: {
          nauseaLevel: 2,
          appetiteLevel: 3,
          constipationLevel: 2,
          refluxLevel: 1,
          daysSinceLastShot: 7
        }
      };
    }

    const daysSinceLastShot = Math.floor(
      (Date.now() - new Date(latestShot.dateUtc).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      hubType: 'glp1',
      userId,
      data: {
        nauseaLevel: 2,
        appetiteLevel: 3,
        constipationLevel: 2,
        refluxLevel: 1,
        daysSinceLastShot,
        doseLevel: latestShot.doseMg ? `${latestShot.doseMg}mg` : undefined
      }
    };
  },

  async getGuardrails(userId: string): Promise<HubGuardrails> {
    return { ...DEFAULT_GLP1_GUARDRAILS };
  },

  buildPrompt(
    context: HubContext | null,
    guardrails: HubGuardrails,
    mealType: string
  ): PromptFragment {
    const data = context?.data as GLP1ContextData | undefined;
    
    const nauseaLevel = data?.nauseaLevel ?? 2;
    const appetiteLevel = data?.appetiteLevel ?? 3;
    const constipationLevel = data?.constipationLevel ?? 2;
    const daysSinceShot = data?.daysSinceLastShot ?? 7;

    let symptomGuidance = '';
    
    if (nauseaLevel >= 3) {
      symptomGuidance += '\n- User experiencing nausea: prefer bland, lean proteins; avoid greasy/spicy/heavy foods';
    }
    
    if (appetiteLevel <= 2) {
      symptomGuidance += '\n- User has LOW appetite: create SMALL, protein-dense portions; avoid large volume meals';
    }
    
    if (constipationLevel >= 3) {
      symptomGuidance += '\n- User experiencing constipation: include gentle fiber from vegetables; suggest hydration';
    }

    const portionGuidance = daysSinceShot <= 3 
      ? 'SMALL portions only (medication side effects typically peak 1-3 days after injection)'
      : 'Moderate portions acceptable';

    return {
      systemPrompt: 'You are a GLP-1 medication nutrition specialist. Users on these medications need small, protein-first meals that are easy to digest.',
      userPromptAddition: `
GLP-1 MEDICATION MEAL REQUIREMENTS:
- PROTEIN PRIORITY: Minimum ${guardrails.proteinFloor}g protein (this comes FIRST)
- SMALL PORTIONS: Meal should be ${guardrails.portionCap} calories or less
- Easy to digest: No greasy, heavy, or large-volume foods
- Carbs: Maximum ${guardrails.carbCeiling}g
- Fat: Maximum ${guardrails.fatCeiling}g (low-fat preferred due to delayed gastric emptying)
- Fiber: At least ${guardrails.fiberMin}g for digestive health

PORTION GUIDANCE: ${portionGuidance}
${symptomGuidance ? `
SYMPTOM-AWARE ADJUSTMENTS:${symptomGuidance}` : ''}

AVOID (causes discomfort for GLP-1 users):
- Fried foods, greasy foods
- Large portions, buffet-style meals
- Heavy cream sauces, alfredo
- High-fat meats
- Carbonated beverages

PRIORITIZE:
- Lean proteins: grilled chicken, fish, egg whites
- Steamed/baked vegetables
- Broth-based preparations
- Small, nutrient-dense portions
- Easy-to-digest textures
`,
      priority: 15
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

    if (guardrails.portionCap && meal.calories > guardrails.portionCap) {
      violations.push({
        rule: 'portion_cap',
        message: `Calories (${meal.calories}) exceed portion cap (${guardrails.portionCap})`,
        severity: 'soft',
        actualValue: meal.calories,
        expectedValue: guardrails.portionCap
      });
    }

    if (guardrails.fatCeiling && meal.fat > guardrails.fatCeiling) {
      violations.push({
        rule: 'fat_ceiling',
        message: `Fat (${meal.fat}g) exceeds maximum (${guardrails.fatCeiling}g) - may cause discomfort`,
        severity: 'soft',
        actualValue: meal.fat,
        expectedValue: guardrails.fatCeiling
      });
    }

    const mealText = `${meal.name} ${meal.description || ''} ${meal.ingredients.map(i => i.name).join(' ')}`.toLowerCase();
    
    const greasyTerms = ['fried', 'deep-fried', 'crispy fried', 'pan-fried', 'greasy'];
    for (const term of greasyTerms) {
      if (mealText.includes(term) && !mealText.includes('air-fried') && !mealText.includes('stir-fried')) {
        violations.push({
          rule: 'cooking_method',
          message: `Contains ${term} - not recommended for GLP-1 users`,
          severity: 'soft',
          actualValue: term
        });
      }
    }

    const proteinRatio = (meal.protein * 4) / meal.calories * 100;
    if (proteinRatio < 25) {
      warnings.push(`Protein ratio (${proteinRatio.toFixed(0)}%) below recommended 25%+ for GLP-1 users`);
    }

    return {
      isValid: violations.filter(v => v.severity === 'hard').length === 0,
      violations,
      warnings,
      fixHint: violations.length > 0 
        ? `Increase protein to ${guardrails.proteinFloor}g+, reduce portion size, and avoid fried/greasy preparations.`
        : undefined
    };
  },

  getFixHint(violations: ValidationViolation[]): string {
    const hints: string[] = [];
    
    for (const v of violations) {
      if (v.rule === 'protein_floor') {
        hints.push(`increase protein to at least ${v.expectedValue}g`);
      } else if (v.rule === 'portion_cap') {
        hints.push(`reduce portion to under ${v.expectedValue} calories`);
      } else if (v.rule === 'fat_ceiling') {
        hints.push(`use leaner cooking methods to reduce fat`);
      } else if (v.rule === 'cooking_method') {
        hints.push(`use grilled, baked, or steamed instead of fried`);
      }
    }

    return `Regenerate with: ${hints.join('; ')}. Keep it small, protein-first, and easy to digest.`;
  }
};
