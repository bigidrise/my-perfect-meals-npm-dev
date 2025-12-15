import type { GeneratorFn, GenerationResult } from './_base';
import { runWithOnboarding } from './_base';
import type { ResolvedConstraints } from '../../../shared/types/profile';
import { generateCravingMeal } from '../stableMealGenerator';

// Convert your existing craving generator to use constraints
const cravingGenerator: GeneratorFn = async (c: ResolvedConstraints) => {
  try {
    // Call your existing generator with constraint-based inputs
    const cravingInput = c.includeIngredients[0] || 'something delicious';
    const existingMeal = await generateCravingMeal('lunch', cravingInput, { 
      userId: c.userId,
      dietaryRestrictions: c.excludeIngredients || [],
      allergies: []
    });
    
    // Transform to standard Meal format with constraint compliance
    const meal = {
      title: existingMeal.name || 'Custom Craving Meal',
      ingredients: (existingMeal.ingredients || []).map((ing: any) => ({
        name: ing.name || ing.ingredient || ing,
        qty: ing.amount || ing.qty,
        unit: ing.unit || ''
      })),
      instructions: existingMeal.instructions || existingMeal.steps || [],
      nutrition: {
        calories: existingMeal.nutrition?.calories || existingMeal.calories || 400,
        proteinG: existingMeal.nutrition?.protein || existingMeal.protein || 20,
        carbsG: existingMeal.nutrition?.carbs || existingMeal.carbs || 45,
        fatG: existingMeal.nutrition?.fat || existingMeal.fat || 15,
      }
    };

    // Filter out any excluded ingredients based on constraints
    meal.ingredients = meal.ingredients.filter(ing => {
      const name = ing.name.toLowerCase();
      return !c.excludeIngredients.some(exc => name.includes(exc.toLowerCase()));
    });

    return [meal];
  } catch (error) {
    console.error('Craving generator error:', error);
    // Fallback meal that respects constraints
    return [{
      title: `${c.diet} Style Craving Meal`,
      ingredients: c.includeIngredients.slice(0, 3).map(ing => ({ name: ing, qty: 1, unit: 'serving' })),
      instructions: ['Prepare ingredients according to dietary preferences', 'Combine and enjoy'],
      nutrition: { calories: c.macroTargets?.calories || 400 }
    }];
  }
};

export async function generateCravingMealWithProfile(userId: string, craving?: string, overrides?: any): Promise<GenerationResult> {
  const profileOverrides = {
    includeIngredients: craving ? [craving] : [],
    ...overrides
  };
  return runWithOnboarding(userId, cravingGenerator, profileOverrides);
}