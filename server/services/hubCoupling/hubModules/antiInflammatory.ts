import type { 
  HubModule, 
  HubContext, 
  HubGuardrails, 
  PromptFragment, 
  ValidationResult,
  ValidationViolation 
} from '../types';
import type { UnifiedMeal } from '../../unifiedMealPipeline';

const ANTI_INFLAMMATORY_BLOCKED = [
  'fried', 'deep-fried', 'french fries', 'chips',
  'white sugar', 'brown sugar', 'corn syrup', 'high fructose',
  'candy', 'soda', 'soft drink', 'energy drink',
  'white bread', 'white flour', 'refined flour',
  'margarine', 'vegetable oil', 'canola oil', 'corn oil', 'soybean oil',
  'processed meat', 'hot dog', 'bologna', 'salami', 'bacon',
  'deli meat', 'lunch meat',
  'artificial sweetener', 'aspartame', 'sucralose',
  'trans fat', 'partially hydrogenated',
  'msg', 'monosodium glutamate',
  'alcohol', 'beer', 'wine', 'liquor', 'cocktail'
];

const ANTI_INFLAMMATORY_PREFERRED = [
  'salmon', 'sardines', 'mackerel', 'anchovies', 'herring',
  'olive oil', 'extra virgin olive oil', 'avocado oil',
  'walnuts', 'almonds', 'flaxseed', 'chia seeds',
  'turmeric', 'ginger', 'garlic', 'cinnamon',
  'blueberries', 'strawberries', 'cherries', 'raspberries',
  'leafy greens', 'spinach', 'kale', 'swiss chard', 'collard greens',
  'broccoli', 'cauliflower', 'brussels sprouts', 'cabbage',
  'tomatoes', 'bell peppers', 'beets',
  'green tea', 'matcha',
  'dark chocolate', 'cacao',
  'bone broth', 'fermented foods', 'kimchi', 'sauerkraut'
];

const BLOCKED_COOKING_METHODS = [
  'deep-fried', 'deep fried', 'pan-fried', 'fried in oil',
  'charred', 'blackened', 'heavily grilled',
  'smoked' 
];

const PREFERRED_COOKING_METHODS = [
  'steamed', 'poached', 'baked', 'roasted', 'grilled',
  'sautéed in olive oil', 'braised', 'slow-cooked', 'raw'
];

const DEFAULT_ANTI_INFLAMMATORY_GUARDRAILS: HubGuardrails = {
  hubType: 'anti-inflammatory',
  fiberMin: 10,
  blockedIngredients: ANTI_INFLAMMATORY_BLOCKED,
  blockedCookingMethods: BLOCKED_COOKING_METHODS,
  preferredIngredients: ANTI_INFLAMMATORY_PREFERRED
};

export const antiInflammatoryHubModule: HubModule = {
  hubType: 'anti-inflammatory',

  async getContext(userId: string): Promise<HubContext | null> {
    return null;
  },

  async getGuardrails(userId: string): Promise<HubGuardrails> {
    return { ...DEFAULT_ANTI_INFLAMMATORY_GUARDRAILS };
  },

  buildPrompt(
    context: HubContext | null,
    guardrails: HubGuardrails,
    mealType: string
  ): PromptFragment {
    return {
      systemPrompt: 'You are an anti-inflammatory nutrition expert. All meals must follow anti-inflammatory dietary principles based on current research.',
      userPromptAddition: `
ANTI-INFLAMMATORY MEAL REQUIREMENTS:
Choose ingredients and cooking methods aligned with anti-inflammatory dietary patterns.

PRIORITIZE THESE ANTI-INFLAMMATORY FOODS:
- Omega-3 rich fish: salmon, sardines, mackerel
- Healthy fats: extra virgin olive oil, avocado, walnuts
- Colorful vegetables: leafy greens, broccoli, bell peppers, tomatoes
- Berries: blueberries, strawberries, cherries
- Spices: turmeric (with black pepper), ginger, garlic, cinnamon
- Fiber-rich foods: minimum ${guardrails.fiberMin}g fiber

AVOID THESE PRO-INFLAMMATORY FOODS (CRITICAL):
- Fried foods and trans fats
- Refined sugars and white flour products
- Processed meats (bacon, hot dogs, deli meats)
- Industrial seed oils (vegetable, canola, corn, soybean oil)
- Alcohol
- Artificial additives and sweeteners

COOKING METHODS:
- PREFERRED: steamed, baked, roasted, grilled, poached, sautéed in olive oil
- AVOID: deep-fried, pan-fried in vegetable oil, charred/blackened

EMPHASIZE:
- Whole, unprocessed foods
- Rich colors (indicates antioxidants)
- Mediterranean-style preparations
- Fresh herbs and anti-inflammatory spices
`,
      priority: 12
    };
  },

  validate(meal: UnifiedMeal, guardrails: HubGuardrails): ValidationResult {
    const violations: ValidationViolation[] = [];
    const warnings: string[] = [];

    const mealText = `${meal.name} ${meal.description || ''} ${meal.ingredients.map(i => i.name).join(' ')}`.toLowerCase();

    for (const blocked of guardrails.blockedIngredients || []) {
      if (mealText.includes(blocked.toLowerCase())) {
        if (!isAllowedException(mealText, blocked)) {
          violations.push({
            rule: 'blocked_ingredient',
            message: `Contains pro-inflammatory ingredient: ${blocked}`,
            severity: blocked.includes('fried') || blocked.includes('processed') ? 'hard' : 'soft',
            actualValue: blocked
          });
        }
      }
    }

    for (const method of guardrails.blockedCookingMethods || []) {
      if (mealText.includes(method.toLowerCase())) {
        if (!mealText.includes('air-fried') && !mealText.includes('stir-fried in olive oil')) {
          violations.push({
            rule: 'cooking_method',
            message: `Uses pro-inflammatory cooking method: ${method}`,
            severity: 'soft',
            actualValue: method
          });
        }
      }
    }

    const hasOmega3 = ANTI_INFLAMMATORY_PREFERRED.slice(0, 5).some(
      food => mealText.includes(food.toLowerCase())
    );
    const hasAntiInflammatorySpice = ['turmeric', 'ginger', 'garlic', 'cinnamon'].some(
      spice => mealText.includes(spice)
    );
    const hasLeafyGreens = ['spinach', 'kale', 'swiss chard', 'collard', 'arugula'].some(
      green => mealText.includes(green)
    );

    if (!hasOmega3 && !hasAntiInflammatorySpice) {
      warnings.push('Consider adding omega-3 fish or anti-inflammatory spices (turmeric, ginger)');
    }

    if (!hasLeafyGreens) {
      warnings.push('Consider adding leafy greens for additional anti-inflammatory benefits');
    }

    const antiInflammatoryScore = calculateAntiInflammatoryScore(mealText);
    if (antiInflammatoryScore < 3) {
      warnings.push(`Low anti-inflammatory score (${antiInflammatoryScore}/10) - consider adding more beneficial ingredients`);
    }

    return {
      isValid: violations.filter(v => v.severity === 'hard').length === 0,
      violations,
      warnings,
      fixHint: violations.length > 0 
        ? `Remove pro-inflammatory ingredients and use olive oil for cooking. Add anti-inflammatory foods like salmon, turmeric, or leafy greens.`
        : undefined
    };
  },

  getFixHint(violations: ValidationViolation[]): string {
    const ingredientViolations = violations.filter(v => v.rule === 'blocked_ingredient');
    const methodViolations = violations.filter(v => v.rule === 'cooking_method');

    const hints: string[] = [];
    
    if (ingredientViolations.length > 0) {
      const ingredients = ingredientViolations.map(v => v.actualValue).join(', ');
      hints.push(`remove or substitute: ${ingredients}`);
    }
    
    if (methodViolations.length > 0) {
      hints.push(`use anti-inflammatory cooking methods: baked, steamed, grilled, or sautéed in olive oil`);
    }

    hints.push('add omega-3 fish, turmeric, or leafy greens');

    return `Regenerate with anti-inflammatory focus: ${hints.join('; ')}.`;
  }
};

function isAllowedException(text: string, blocked: string): boolean {
  const exceptions: Record<string, string[]> = {
    'white sugar': ['no sugar', 'sugar-free', 'unsweetened'],
    'vegetable oil': ['olive oil', 'avocado oil', 'coconut oil'],
    'fried': ['air-fried', 'stir-fried in olive oil'],
    'processed': ['minimally processed', 'unprocessed'],
    'white flour': ['whole wheat', 'almond flour', 'coconut flour']
  };

  const allowed = exceptions[blocked.toLowerCase()];
  if (allowed) {
    return allowed.some(a => text.includes(a));
  }
  return false;
}

function calculateAntiInflammatoryScore(mealText: string): number {
  let score = 0;
  
  const highValueFoods = ['salmon', 'turmeric', 'olive oil', 'blueberries', 'spinach', 'kale', 'walnuts', 'ginger'];
  for (const food of highValueFoods) {
    if (mealText.includes(food)) score += 1.5;
  }
  
  const mediumValueFoods = ['broccoli', 'garlic', 'tomato', 'bell pepper', 'almonds', 'avocado', 'green tea'];
  for (const food of mediumValueFoods) {
    if (mealText.includes(food)) score += 1;
  }

  return Math.min(score, 10);
}
