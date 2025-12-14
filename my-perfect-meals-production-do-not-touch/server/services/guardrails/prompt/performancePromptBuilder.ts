/**
 * Performance & Competition Prompt Builder
 * 
 * Constructs AI prompts with strict competition-prep conditioning.
 * Every meal must be stage-safe, prep-safe, and coach-safe.
 * NO creativity. NO fun meals. Predictable, boring, repeatable.
 */

import { performanceRules, getCompetitionPhaseRules, calculateProteinPerMeal, performanceSnackRules, type CompetitionPhase } from '../rules/performanceRules';

export interface PerformancePromptOptions {
  dietType: 'performance';
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  userInput: string;
  carbPhase?: CompetitionPhase;
  mealFrequency?: number;
  dailyProteinTarget?: number;
}

/**
 * Build the complete performance prompt with all guardrails
 */
export function buildPerformancePrompt(options: PerformancePromptOptions): string {
  const {
    mealType,
    userInput,
    carbPhase = 'carb',
    mealFrequency = 5,
    dailyProteinTarget = 200,
  } = options;
  
  if (mealType === 'snack') {
    return buildPerformanceSnackPrompt(userInput, carbPhase);
  }
  
  const phaseRules = getCompetitionPhaseRules(carbPhase);
  const proteinTarget = calculateProteinPerMeal(dailyProteinTarget, mealFrequency);
  
  return `${userInput}

=== COMPETITION PREP GUARDRAILS (MANDATORY) ===

You are generating a meal for an athlete in COMPETITION PREP.
This must be a STAGE-SAFE, PREP-SAFE, COACH-SAFE meal.
NO creativity. NO fun meals. Predictable, boring, repeatable.

**CURRENT PHASE: ${carbPhase.toUpperCase()}**
${phaseRules.notes}

**MACRO TARGETS PER MEAL:**
- Protein: ${proteinTarget}g (non-negotiable)
- Carbs: Maximum ${phaseRules.maxCarbsPerMeal}g ${!phaseRules.carbsAllowed ? '(FIBROUS VEGGIES ONLY - no starchy carbs)' : ''}
- Fat: Maximum ${phaseRules.maxFatPerMeal}g (VERY LOW)

**ALLOWED PROTEINS ONLY:**
${performanceRules.preferredIngredients.filter(i => 
  i.includes('chicken') || i.includes('turkey') || i.includes('fish') || 
  i.includes('tilapia') || i.includes('cod') || i.includes('egg') ||
  i.includes('tuna') || i.includes('shrimp') || i.includes('whey')
).slice(0, 12).join(', ')}

**ALLOWED CARBS (phase: ${carbPhase}):**
${phaseRules.carbsAllowed ? 'White rice, jasmine rice, oats, sweet potato, cream of rice, rice cakes' : 'NONE - vegetables only'}

**ALLOWED VEGETABLES:**
Asparagus, green beans, broccoli, zucchini, bell peppers, spinach, cucumber, celery

**COOKING METHODS - ONLY:**
Air fry, bake, grill, steam, or with cooking spray. NO oil, NO butter, NO frying.

**ALLOWED CONDIMENTS ONLY:**
Mustard, sugar-free ketchup (minimal), hot sauce (low sodium), lemon/lime juice, herbs, spices, garlic powder, salt-free seasoning

=== ABSOLUTELY FORBIDDEN ===
NEVER include these in any competition meal:
- Cheese, cream, butter, bacon, sausage, fatty meats
- Deli meat, cured meats, high-sodium foods
- Honey, maple syrup, sugar, fruit juice, high-sugar fruit
- Nuts, nut butter, avocado, coconut, hummus
- Pasta, white potato, pizza, bread, tortilla, cereal
- Mayo, ranch, BBQ sauce, cream sauces
- ANY fried or breaded foods
- ANY desserts or treats

=== MEAL FORMAT ===
Create a simple, predictable competition meal with:
1. Single lean protein source (chicken breast, white fish, ground turkey, egg whites)
2. ${phaseRules.carbsAllowed ? 'Single clean carb source (rice, oats, sweet potato)' : 'Fibrous vegetables only'}
3. One or two vegetables
4. Simple seasoning (herbs, spices, lemon)

The meal should look like something a bodybuilder would eat during prep.
Example: "Grilled Chicken Breast with Jasmine Rice and Steamed Asparagus"`;
}

/**
 * Build snack-specific performance prompt
 */
function buildPerformanceSnackPrompt(userInput: string, carbPhase: CompetitionPhase = 'carb'): string {
  const phaseRules = getCompetitionPhaseRules(carbPhase);
  
  return `${userInput}

=== COMPETITION PREP SNACK GUARDRAILS (MANDATORY) ===

You are generating a SNACK for an athlete in COMPETITION PREP.
Must be high protein, very low fat, stage-safe.

**CURRENT PHASE: ${carbPhase.toUpperCase()}**

**SNACK TARGETS:**
- Protein: 20-30g
- Carbs: Maximum ${Math.round(phaseRules.maxCarbsPerMeal / 2)}g
- Fat: Maximum 5g

**ALLOWED SNACK OPTIONS:**
${performanceSnackRules.allowed.join(', ')}

**ABSOLUTELY FORBIDDEN FOR SNACKS:**
${performanceSnackRules.forbidden.join(', ')}

Also forbidden: ${performanceRules.blockedIngredients.slice(0, 20).join(', ')}

=== SNACK FORMAT ===
Create a simple, clean competition snack:
- Greek yogurt + berries
- Rice cakes + protein shake
- Cottage cheese
- Egg white muffins
- Chicken bites
- Tuna packet (no mayo)

NO protein bars, NO nuts, NO nut butter, NO granola.
Keep it simple, clean, and stage-safe.`;
}

/**
 * Get the system prompt for performance/competition meals
 */
export function getPerformanceSystemPrompt(): string {
  return `You are a competition prep meal specialist. You ONLY create meals suitable for athletes preparing for physique competitions, bodybuilding shows, or athletic events requiring strict nutrition.

RULES YOU MUST FOLLOW:
1. Every meal must be stage-safe and prep-safe
2. Protein must be lean: chicken breast, white fish, turkey, egg whites
3. Carbs must be clean: rice, oats, sweet potato (when allowed)
4. Fat must be VERY low: 2-10g per meal maximum
5. No creativity or "fun" meals - predictable and repeatable
6. No sauces except mustard, hot sauce, or lemon juice
7. No processed foods, no high-sodium foods
8. No sugar, no honey, no high-sugar fruits
9. Cooking methods: air fry, bake, grill, steam only

Your meals should look like what a bodybuilder eats during prep:
- Chicken + rice + green beans
- Tilapia + sweet potato + asparagus
- Ground turkey + zucchini + rice
- Egg whites + oatmeal

Never deviate from these strict guidelines.`;
}

export { CompetitionPhase };
