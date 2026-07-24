/**
 * GLP-1 Prompt Builder — Phase 3.3 (updated: resolver-driven targets)
 *
 * Builds diet-specific prompts for GLP-1 meal generation.
 * When resolvedTargets are provided (from resolveGLP1MealTargets), they replace
 * every static numeric value in the prompt. Falls back to static glp1Rules
 * baselines only when the resolver has not been called.
 */

import { glp1Rules, getGLP1SystemPrompt } from '../rules/glp1Rules';
import type { ResolvedGLP1Targets } from '../../glp1/resolveGLP1MealTargets';

export interface GLP1PromptContext {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  userRequest?: string;
  selectedIngredients?: string[];
  isSnack?: boolean;
}

export function buildGLP1Prompt(
  context: GLP1PromptContext,
  resolvedTargets?: ResolvedGLP1Targets
): string {
  const basePrompt = getGLP1SystemPrompt();
  const mealTypeGuidelines = getMealTypeGuidelines(context.mealType);
  const ingredientGuidance = getIngredientGuidance(context.selectedIngredients);

  // ── Resolved vs. static targets ──────────────────────────────────────────
  let calorieNote: string;
  let fatNote: string;
  let proteinNote: string;

  if (resolvedTargets && !resolvedTargets.usedBaseline) {
    const cal = resolvedTargets.resolvedMealCalories;
    const fatMax = resolvedTargets.maximumToleratedFatGrams;
    const proteinTarget = resolvedTargets.targetProteinGrams;
    const proteinFloor = resolvedTargets.minimumProteinFloor;

    calorieNote = `~${cal} kcal (patient-specific target — daily budget ${resolvedTargets.remainingCalories} kcal ÷ ${resolvedTargets.plannedMealsRemaining} remaining meals)`;
    fatNote = `${fatMax}g maximum (patient-specific tolerance; aim for ~${resolvedTargets.targetFatGrams}g — high fat is the primary nausea trigger regardless of gram count)`;
    proteinNote = `${proteinTarget}g target / ${proteinFloor}g hard floor (patient-specific from daily budget of ${resolvedTargets.remainingProtein}g remaining)`;

    if (resolvedTargets.resolutionReasons.length > 0) {
      const reasonList = resolvedTargets.resolutionReasons.map(r => `  • ${r}`).join('\n');
      const treatmentLabel = resolvedTargets.treatmentPhase !== 'unknown'
        ? ` [${resolvedTargets.treatmentPhase.replace('_', ' ')} phase]`
        : '';
      return `${basePrompt}

MEAL TYPE: ${context.mealType.toUpperCase()}${treatmentLabel}
${mealTypeGuidelines}

${ingredientGuidance}

COOKING METHODS (ALLOWED ONLY):
${glp1Rules.cookingMethods.allowed.slice(0, 8).join(', ')}

FORBIDDEN COOKING METHODS:
${glp1Rules.cookingMethods.forbidden.slice(0, 6).join(', ')}

PATIENT-SPECIFIC MACRO TARGETS (calculated from this patient's profile):
- Calorie target: ${calorieNote}
- Maximum fat: ${fatNote}
- Protein target: ${proteinNote}
- Portion size: SMALL to MODERATE calibrated for this patient${resolvedTargets.trainingDemand !== 'none' ? ` (training demand: ${resolvedTargets.trainingDemand})` : ''}${resolvedTargets.appetiteLevel !== 'normal' ? ` (appetite: ${resolvedTargets.appetiteLevel})` : ''}

TARGET RESOLUTION REASONS:
${reasonList}

${resolvedTargets.activeConstraints.length > 0 ? `ACTIVE MEDICAL PROTOCOLS STACKED: ${resolvedTargets.activeConstraints.join(', ')}\n` : ''}${context.userRequest ? `USER REQUEST: ${context.userRequest}` : ''}

Generate a small, gentle, high-protein, low-fat ${context.mealType} that is easy to digest.`;
    }
  } else {
    // Fallback to static baselines
    calorieNote = `~${glp1Rules.portionGuidelines.maxCalories} kcal (conservative baseline — scale upward for larger, highly active, or strength-training users based on their resolved profile)`;
    fatNote = `${glp1Rules.portionGuidelines.maxFatGrams}g (hard limit — high fat is the primary nausea trigger)`;
    proteinNote = `${glp1Rules.portionGuidelines.minProteinGrams}g (floor — target ≥25g; higher for muscle-preservation goals)`;
  }

  return `${basePrompt}

MEAL TYPE: ${context.mealType.toUpperCase()}
${mealTypeGuidelines}

${ingredientGuidance}

COOKING METHODS (ALLOWED ONLY):
${glp1Rules.cookingMethods.allowed.slice(0, 8).join(', ')}

FORBIDDEN COOKING METHODS:
${glp1Rules.cookingMethods.forbidden.slice(0, 6).join(', ')}

MACRO TARGETS:
- Calorie target: ${calorieNote}
- Maximum fat: ${fatNote}
- Minimum protein: ${proteinNote}
- Portion size: SMALL to MODERATE (lean toward smaller for sedentary/suppressed-appetite; allow moderate for active users)

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
- Small portion — don't overwhelm the stomach in the morning`;

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

export function buildGLP1SnackPrompt(
  craving?: string,
  resolvedTargets?: ResolvedGLP1Targets
): string {
  const basePrompt = getGLP1SystemPrompt();

  const snackCal = resolvedTargets && !resolvedTargets.usedBaseline
    ? resolvedTargets.resolvedSnackCalories
    : 150;
  const snackFat = resolvedTargets && !resolvedTargets.usedBaseline
    ? Math.round(resolvedTargets.maximumToleratedFatGrams * 0.4)
    : 5;
  const snackProtein = resolvedTargets && !resolvedTargets.usedBaseline
    ? Math.max(resolvedTargets.minimumProteinFloor * 0.5, 8)
    : 8;

  const targetNote = resolvedTargets && !resolvedTargets.usedBaseline
    ? `\nPATIENT-SPECIFIC TARGETS: ${snackCal} kcal / max ${snackFat}g fat / min ${Math.round(snackProtein)}g protein`
    : '';

  return `${basePrompt}

SNACK CREATION FOR GLP-1 USER:
${craving ? `User craving: "${craving}"` : 'Create a light, healthy GLP-1 snack'}
${targetNote}

APPROVED GLP-1 SNACK OPTIONS:
- Plain Greek yogurt (small serving)
- Fresh berries (small handful)
- Cottage cheese (2–3 tablespoons)
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
Maximum ${snackCal} calories, maximum ${snackFat}g fat, minimum ${Math.round(snackProtein)}g protein.`;
}

export function getGLP1IngredientFilter(ingredients: string[]): string[] {
  return ingredients.filter(ing => {
    const lowerIng = ing.toLowerCase();
    return !glp1Rules.blockedIngredients.some(blocked =>
      lowerIng.includes(blocked.toLowerCase())
    );
  });
}
