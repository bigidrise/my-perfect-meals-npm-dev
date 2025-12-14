import { type User, type Recipe } from "@shared/schema";
import { storage } from "./storage";

export async function generateMealPlan(user: User) {
  // Get all available recipes
  const allRecipes = await storage.getRecipes();
  
  // Filter recipes based on user's dietary restrictions
  let suitableRecipes = allRecipes;
  
  if (user.dietaryRestrictions && user.dietaryRestrictions.length > 0) {
    suitableRecipes = allRecipes.filter(recipe => {
      // Recipe is suitable if it has at least one matching dietary restriction
      return user.dietaryRestrictions!.some(restriction => 
        recipe.dietaryRestrictions?.includes(restriction)
      ) || recipe.dietaryRestrictions?.length === 0;
    });
  }

  // Separate by meal type
  const breakfastRecipes = suitableRecipes.filter(r => r.mealType === 'breakfast');
  const lunchRecipes = suitableRecipes.filter(r => r.mealType === 'lunch');
  const dinnerRecipes = suitableRecipes.filter(r => r.mealType === 'dinner');

  // Generate 7-day meal plan
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const meals: any = {};
  
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  days.forEach(day => {
    const breakfast = getRandomRecipe(breakfastRecipes);
    const lunch = getRandomRecipe(lunchRecipes);
    const dinner = getRandomRecipe(dinnerRecipes);

    meals[day] = {
      breakfast: breakfast?.id,
      lunch: lunch?.id,
      dinner: dinner?.id
    };

    // Accumulate nutrition totals
    if (breakfast) {
      totalCalories += breakfast.calories || 0;
      totalProtein += breakfast.protein || 0;
      totalCarbs += breakfast.carbs || 0;
      totalFat += breakfast.fat || 0;
    }
    if (lunch) {
      totalCalories += lunch.calories || 0;
      totalProtein += lunch.protein || 0;
      totalCarbs += lunch.carbs || 0;
      totalFat += lunch.fat || 0;
    }
    if (dinner) {
      totalCalories += dinner.calories || 0;
      totalProtein += dinner.protein || 0;
      totalCarbs += dinner.carbs || 0;
      totalFat += dinner.fat || 0;
    }
  });

  return {
    meals,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat
  };
}

function getRandomRecipe(recipes: Recipe[]): Recipe | undefined {
  if (recipes.length === 0) return undefined;
  return recipes[Math.floor(Math.random() * recipes.length)];
}
