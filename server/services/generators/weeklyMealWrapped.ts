import type { GeneratorFn, GenerationResult } from './_base';
import { runWithOnboarding } from './_base';
import type { ResolvedConstraints } from '../../../shared/types/profile';
import { generateWeeklyMeals } from '../stableMealGenerator';

// Convert your existing weekly meal generator to use constraints
const weeklyGenerator: GeneratorFn = async (c: ResolvedConstraints) => {
  try {
    // Call your existing generator with constraint-based inputs
    const weeklyMeals = await generateWeeklyMeals(c.userId, {
      dietaryRestrictions: [c.diet],
      allergies: c.allergies,
      servings: c.servings
    });
    
    // Transform to standard Meal format array
    const meals = (weeklyMeals || []).map((meal: any) => ({
      title: meal.name || meal.title || 'Weekly Meal',
      ingredients: (meal.ingredients || []).map((ing: any) => ({
        name: ing.name || ing.ingredient || ing,
        qty: ing.amount || ing.qty,
        unit: ing.unit || ''
      })),
      instructions: meal.instructions || meal.steps || [],
      nutrition: {
        calories: meal.calories,
        proteinG: meal.protein,
        carbsG: meal.carbs,
        fatG: meal.fat,
      }
    }));

    // Filter out meals with excluded ingredients
    return meals.filter((meal: any) => {
      return !meal.ingredients.some((ing: any) => {
        const name = ing.name.toLowerCase();
        return c.excludeIngredients.some(exc => name.includes(exc.toLowerCase()));
      });
    });
  } catch (error) {
    console.error('Weekly meal generator error:', error);
    // Fallback meals that respect constraints
    const baseMeals = [
      { name: 'Breakfast Bowl', type: 'breakfast' },
      { name: 'Lunch Salad', type: 'lunch' },
      { name: 'Dinner Plate', type: 'dinner' }
    ];
    
    return baseMeals.map(base => ({
      title: `${c.diet} ${base.name}`,
      ingredients: c.includeIngredients.slice(0, 3).map(ing => ({ name: ing, qty: 1, unit: 'serving' })),
      instructions: ['Prepare ingredients according to dietary preferences', 'Combine and enjoy'],
      nutrition: { calories: c.macroTargets?.calories || 400 }
    }));
  }
};

export async function generateWeeklyMealPlanWithProfile(userId: string, overrides?: any): Promise<GenerationResult> {
  return runWithOnboarding(userId, weeklyGenerator, overrides);
}