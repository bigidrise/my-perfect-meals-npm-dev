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
      ingredients: ((existingMeal as any).ingredients || []).map((ing: any) => ({
        name: ing.name || ing.ingredient || ing,
        qty: ing.amount || ing.qty,
        unit: ing.unit || ''
      })),
      instructions: (existingMeal as any).instructions || (existingMeal as any).steps || [],
      nutrition: {
        calories: (existingMeal as any).nutrition?.calories || (existingMeal as any).calories || 400,
        proteinG: (existingMeal as any).nutrition?.protein || (existingMeal as any).protein || 20,
        carbsG: (existingMeal as any).nutrition?.carbs || (existingMeal as any).carbs || 45,
        fatG: (existingMeal as any).nutrition?.fat || (existingMeal as any).fat || 15,
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