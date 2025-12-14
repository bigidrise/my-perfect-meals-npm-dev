/**
 * GLP-1 Prompt Builder - Phase 3.3
 * 
 * Builds diet-specific prompts for GLP-1 meal generation
 * Emphasizes small portions, low-fat, high-protein, easy digestion
 */

import { glp1Rules, getGLP1SystemPrompt } from '../rules/glp1Rules';

export interface GLP1PromptContext {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  userRequest?: string;
  selectedIngredients?: string[];
  isSnack?: boolean;
}

export function buildGLP1Prompt(context: GLP1PromptContext): string {
  const basePrompt = getGLP1SystemPrompt();
  
  const mealTypeGuidelines = getMealTypeGuidelines(context.mealType);
  const ingredientGuidance = getIngredientGuidance(context.selectedIngredients);
  
  return `${basePrompt}

MEAL TYPE: ${context.mealType.toUpperCase()}
${mealTypeGuidelines}

${ingredientGuidance}

COOKING METHODS (ALLOWED ONLY):
${glp1Rules.cookingMethods.allowed.slice(0, 8).join(', ')}

FORBIDDEN COOKING METHODS:
${glp1Rules.cookingMethods.forbidden.slice(0, 6).join(', ')}

MACRO TARGETS:
- Maximum calories: ${glp1Rules.portionGuidelines.maxCalories}kcal
- Maximum fat: ${glp1Rules.portionGuidelines.maxFatGrams}g
- Minimum protein: ${glp1Rules.portionGuidelines.minProteinGrams}g
- Portion size: SMALL (prioritize light meals)

${context.userRequest ? `USER REQUEST: ${context.userRequest}` : ''}

Generate a small, gentle, high-protein, low-fat ${context.mealType} that is easy to digest.`;
}

function getMealTypeGuidelines(mealType: string): string {
  switch (mealType) {
    case 'breakfast':
      return `BREAKFAST GUIDELINES FOR GLP-1:
- Light, easy start to the day
- Protein-focused (egg whites, Greek yogurt, cottage cheese)
- Avoid heavy pancakes, waffles, or French toast
- Good options: scrambled egg whites, Greek yogurt parfait (small), oatmeal with berries
- Small portion - don't overwhelm the stomach in the morning`;

    case 'lunch':
      return `LUNCH GUIDELINES FOR GLP-1:
- Light and balanced
- Lean protein with soft vegetables
- Avoid heavy sandwiches or large salads
- Good options: grilled chicken wrap (small), light soup with protein, fish with steamed veggies
- Keep portions modest to avoid afternoon nausea`;

    case 'dinner':
      return `DINNER GUIDELINES FOR GLP-1:
- Lightest meal of the day if possible
- Focus on lean protein and cooked vegetables
- Avoid heavy pasta dishes, fried foods, or rich sauces
- Good options: baked fish, steamed vegetables, light stir-fry (no oil)
- Eat early to aid digestion before sleep`;

    case 'snack':
      return `SNACK GUIDELINES FOR GLP-1:
- Very small, light snacks only
- Protein-focused for satiety
- Avoid chips, cookies, candy, heavy nuts
- Good options: Greek yogurt (plain), berries, cottage cheese, rice cake with lean protein
- Single-serving size maximum`;

    default:
      return 'Follow GLP-1 guidelines: small, light, high-protein, low-fat, easy to digest.';
  }
}

function getIngredientGuidance(selectedIngredients?: string[]): string {
  if (!selectedIngredients || selectedIngredients.length === 0) {
    return `RECOMMENDED GLP-1 INGREDIENTS:
${glp1Rules.preferredIngredients.slice(0, 15).join(', ')}`;
  }

  const blocked = selectedIngredients.filter(ing => 
    glp1Rules.blockedIngredients.some(b => 
      ing.toLowerCase().includes(b.toLowerCase())
    )
  );

  if (blocked.length > 0) {
    return `WARNING: The following ingredients are NOT GLP-1 safe and should be substituted:
${blocked.join(', ')}

Use these GLP-1-friendly alternatives instead:
${glp1Rules.preferredIngredients.slice(0, 10).join(', ')}`;
  }

  return `USER SELECTED INGREDIENTS (approved for GLP-1):
${selectedIngredients.join(', ')}`;
}

export function buildGLP1SnackPrompt(craving?: string): string {
  const basePrompt = getGLP1SystemPrompt();
  
  return `${basePrompt}

SNACK CREATION FOR GLP-1 USER:
${craving ? `User craving: "${craving}"` : 'Create a light, healthy GLP-1 snack'}

APPROVED GLP-1 SNACK OPTIONS:
- Plain Greek yogurt (small serving)
- Fresh berries (small handful)
- Cottage cheese (2-3 tablespoons)
- Light protein shake (not thick, small)
- Rice cake with thin protein topping
- Cucumber slices with light dip
- Hard-boiled egg white

FORBIDDEN FOR GLP-1 SNACKS:
- Candy, chips, pastries
- Heavy nuts in large amounts
- Sweetened yogurt
- Thick smoothies
- High-fat snacks
- Large portions

Generate a small, gentle, protein-focused snack that satisfies the craving while being GLP-1 safe.
Maximum 150 calories, maximum 5g fat, minimum 8g protein.`;
}

export function getGLP1IngredientFilter(ingredients: string[]): string[] {
  return ingredients.filter(ing => {
    const lowerIng = ing.toLowerCase();
    return !glp1Rules.blockedIngredients.some(blocked => 
      lowerIng.includes(blocked.toLowerCase())
    );
  });
}
