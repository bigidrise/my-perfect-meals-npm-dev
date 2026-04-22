/**
 * Ingredient Precision — Shared across all diet builders and prompt paths.
 *
 * Layer 1: Prompt block injected into every meal generator.
 * Layer 2: Validator that rejects vague measurements and triggers retry.
 */

// ─── LAYER 1: Prompt Block ─────────────────────────────────────────────────

export const INGREDIENT_PRECISION_PROMPT_BLOCK = `
INGREDIENT MEASUREMENT RULES (NON-NEGOTIABLE):

Every ingredient MUST use a precise, measurable quantity. No guessing allowed.

SOLID FOODS — use oz or g:
  - Proteins (chicken, beef, fish, turkey, pork): ALWAYS oz — e.g. "6 oz chicken breast"
  - Potatoes / yams / sweet potatoes: ALWAYS oz — e.g. "5 oz sweet potato" (NEVER "1 potato")
  - Rice / grains / pasta: specify cooked weight — e.g. "4 oz cooked jasmine rice"
  - Dense vegetables (broccoli, asparagus, green beans): oz or cup — e.g. "4 oz broccoli florets"
  - Leafy greens: cup — e.g. "2 cup spinach"

EGGS — always include size:
  - CORRECT: "3 large eggs" or "2 medium eggs"
  - WRONG: "2 eggs" (no size = INVALID)
  - 1 large egg ≈ 50g for reference

LIQUIDS — use tbsp, tsp, fl oz, or cup:
  - Oils, sauces, condiments: tbsp or tsp — e.g. "1 tbsp olive oil"
  - Milk, broth, beverages: cup or fl oz — e.g. "8 fl oz almond milk"

FORBIDDEN UNITS — never use:
  - "each" (except as a size qualifier for eggs)
  - "piece" or "pieces"
  - "serving" or "servings"
  - "handful"

Every ingredient line must be: [number] [unit] [food name]
Examples of CORRECT output:
  6 oz chicken breast
  3 large eggs
  5 oz sweet potato
  4 oz cooked brown rice
  2 cup broccoli florets
  1 tbsp olive oil
  8 fl oz almond milk
`.trim();

// ─── LAYER 2: Validator ────────────────────────────────────────────────────

export interface IngredientPrecisionResult {
  isValid: boolean;
  violations: string[];
}

const FORBIDDEN_UNITS = ['each', 'piece', 'pieces', 'serving', 'servings', 'handful', 'handfuls'];
const EGG_PATTERN = /\begg(s)?\b/i;
const EGG_SIZE_PATTERN = /\b(large|medium|small|jumbo|extra-large|xl)\b/i;
const POTATO_PATTERN = /\b(potato|potatoes|yam|yams|sweet potato|sweet potatoes)\b/i;
const WEIGHT_UNIT_PATTERN = /\b(oz|g|gram|grams|lb|lbs)\b/i;

export function validateIngredientPrecision(
  ingredients: Array<{ name: string; quantity?: string; unit?: string }>
): IngredientPrecisionResult {
  const violations: string[] = [];

  for (const ing of ingredients) {
    const name = (ing.name || '').toLowerCase().trim();
    const unit = (ing.unit || '').toLowerCase().trim();

    // Check for forbidden units
    if (FORBIDDEN_UNITS.includes(unit)) {
      violations.push(`Ingredient "${ing.name}" uses forbidden unit "${ing.unit}" — must use oz, g, cup, tbsp, or tsp`);
      continue;
    }

    // Eggs must include size in the name
    if (EGG_PATTERN.test(name) && !EGG_SIZE_PATTERN.test(name)) {
      violations.push(`Ingredient "${ing.name}" — eggs must specify size (large/medium), e.g. "large eggs"`);
    }

    // Potatoes and yams must use a weight unit
    if (POTATO_PATTERN.test(name) && !WEIGHT_UNIT_PATTERN.test(unit) && unit !== 'oz' && unit !== 'g') {
      if (FORBIDDEN_UNITS.includes(unit) || unit === '' || unit === 'each') {
        violations.push(`Ingredient "${ing.name}" — potatoes/yams must use oz or g (e.g. "5 oz sweet potato")`);
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}
