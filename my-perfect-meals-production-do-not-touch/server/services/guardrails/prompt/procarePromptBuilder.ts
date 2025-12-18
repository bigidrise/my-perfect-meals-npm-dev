/**
 * ProCare Prompt Builder - Phase 3.7
 * 
 * Builds dynamic prompts based on client-specific rule packs.
 * Injects macro targets, ingredient rules, and cooking constraints.
 */

import { 
  ProCareRulePack, 
  ProCareGuardrailRequest,
  PROCARE_FIXED_RULES,
  calculateProteinPerMeal,
  calculateCaloriesPerMeal 
} from '../rules/procareTypes';
import { resolveProCareRules, getProCareSystemPrompt } from '../rules/procareRules';

export function buildProCarePrompt(request: ProCareGuardrailRequest): string {
  const { mealType, rulePack, userRequest, selectedIngredients } = request;
  
  const basePrompt = getProCareSystemPrompt(rulePack);
  const resolved = resolveProCareRules(rulePack);
  const proteinPerMeal = calculateProteinPerMeal(rulePack);

  const mealGuidelines = getMealTypeGuidelines(mealType, proteinPerMeal, resolved);
  const ingredientGuidance = getIngredientGuidance(selectedIngredients, resolved);

  return `${basePrompt}

MEAL TYPE: ${mealType.toUpperCase()}
${mealGuidelines}

${ingredientGuidance}

${userRequest ? `USER REQUEST: ${userRequest}` : ''}

Generate a clean, high-protein, macro-compliant ${mealType} for this professionally supervised client.`;
}

function getMealTypeGuidelines(
  mealType: string, 
  proteinTarget: number,
  resolved: ReturnType<typeof resolveProCareRules>
): string {
  const baseGuidelines = `PROTEIN TARGET: ${proteinTarget}g
MAX CARBS: ${resolved.macroLimits.carbsMax}g
MAX FAT: ${resolved.macroLimits.fatsMax}g
MAX CALORIES: ${resolved.macroLimits.caloriesMax}`;

  switch (mealType) {
    case 'breakfast':
      return `${baseGuidelines}
BREAKFAST GUIDELINES:
- Start the day with high protein
- Good options: egg whites, Greek yogurt, lean protein with vegetables
- Avoid heavy starches and sugars
- Keep portion moderate for morning digestion`;

    case 'lunch':
      return `${baseGuidelines}
LUNCH GUIDELINES:
- Balanced protein + moderate carbs
- Good options: grilled chicken/fish, vegetables, light starches
- Ideal for sustaining energy through afternoon
- Keep fat content low to moderate`;

    case 'dinner':
      return `${baseGuidelines}
DINNER GUIDELINES:
- Protein-focused with lower carbs
- Good options: lean protein, steamed/roasted vegetables
- Lighter preparation for evening
- Minimize heavy sauces or added fats`;

    case 'snack':
      return `SNACK GUIDELINES (PROCARE):
PROTEIN: Minimum ${PROCARE_FIXED_RULES.snackMinProtein}g
MAX CARBS: ${PROCARE_FIXED_RULES.snackMaxCarbs}g
MAX FAT: ${PROCARE_FIXED_RULES.snackMaxFat}g

ProCare snacks must be:
- High protein, low fat
- Clean ingredients only
- No candy, chips, pastries, or junk
- Good options: Greek yogurt, cottage cheese, protein shake, chicken bites, tuna packet`;

    default:
      return baseGuidelines;
  }
}

function getIngredientGuidance(
  selectedIngredients: string[] | undefined,
  resolved: ReturnType<typeof resolveProCareRules>
): string {
  if (!selectedIngredients || selectedIngredients.length === 0) {
    if (resolved.preferredIngredients.length > 0) {
      return `RECOMMENDED INGREDIENTS (from whitelist):
${resolved.preferredIngredients.slice(0, 15).join(', ')}`;
    }
    return '';
  }

  const blocked = selectedIngredients.filter(ing =>
    resolved.blockedIngredients.some(b =>
      ing.toLowerCase().includes(b.toLowerCase())
    )
  );

  if (blocked.length > 0) {
    return `WARNING: The following ingredients are BLOCKED by ProCare rules:
${blocked.join(', ')}

These MUST be substituted with compliant alternatives.`;
  }

  return `SELECTED INGREDIENTS (approved):
${selectedIngredients.join(', ')}`;
}

export function buildProCareSnackPrompt(rulePack: ProCareRulePack, craving?: string): string {
  const basePrompt = getProCareSystemPrompt(rulePack);
  const resolved = resolveProCareRules(rulePack);

  return `${basePrompt}

PROCARE SNACK CREATION:
${craving ? `User craving: "${craving}"` : 'Create a compliant ProCare snack'}

SNACK MACRO REQUIREMENTS:
- Protein: Minimum ${PROCARE_FIXED_RULES.snackMinProtein}g
- Carbs: Maximum ${PROCARE_FIXED_RULES.snackMaxCarbs}g
- Fat: Maximum ${PROCARE_FIXED_RULES.snackMaxFat}g
- Calories: ~100-150

ALLOWED PROCARE SNACKS:
- Plain Greek yogurt + berries
- Cottage cheese + fruit
- Whey protein shake (not thick)
- Rice cake + lean protein spread
- Chicken bites
- Tuna packet (no mayo)
- Hard-boiled egg whites

NEVER ALLOWED:
- Candy, chips, pastries
- High-fat snacks
- Bread/pastry-based snacks
- Sugary snacks
- Junk food of any kind

${resolved.blockedIngredients.length > 0 ? `ADDITIONAL BLOCKED INGREDIENTS:\n${resolved.blockedIngredients.slice(0, 20).join(', ')}` : ''}

Generate a small, clean, high-protein snack that satisfies the craving while being ProCare compliant.`;
}

export function filterIngredientsForProCare(
  ingredients: string[],
  rulePack: ProCareRulePack
): string[] {
  const resolved = resolveProCareRules(rulePack);
  
  return ingredients.filter(ing => {
    const lowerIng = ing.toLowerCase();
    return !resolved.blockedIngredients.some(blocked =>
      lowerIng.includes(blocked.toLowerCase())
    );
  });
}
