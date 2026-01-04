// Meal Finder Service
// Finds nearby restaurants for a given meal craving + ZIP code
// Uses shared Restaurant Resolver + AI Restaurant Meal Generator

import { resolveRestaurantsByZip, ResolvedRestaurant } from './restaurantResolver';
import { generateRestaurantMealsAI } from './restaurantMealGeneratorAI';
import type { User } from '@shared/schema';

interface MealFinderRequest {
  mealQuery: string;
  zipCode: string;
  user?: User;
}

interface RestaurantResult {
  restaurantName: string;
  cuisine: string;
  address: string;
  rating?: number;
  photoUrl?: string;
  meal: {
    name: string;
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    reason: string;
    modifications: string;
    ingredients: string[];
    imageUrl?: string;
  };
  medicalBadges?: Array<{
    condition: string;
    compatible: boolean;
    reason: string;
    color: string;
  }>;
}

/**
 * Find meals near a ZIP code based on craving
 * Uses shared Restaurant Resolver for location logic
 */
export async function findMealsNearby(request: MealFinderRequest): Promise<RestaurantResult[]> {
  const { mealQuery, zipCode, user } = request;
  
  console.log(`🔍 Finding meals for "${mealQuery}" near ZIP ${zipCode}`);
  
  // Step 1: Use shared resolver to find restaurants
  const resolverResult = await resolveRestaurantsByZip({
    query: mealQuery,
    zipCode,
    radiusMiles: 5,
    limit: 3,
    searchMode: 'craving'
  });
  
  if (!resolverResult.success || resolverResult.restaurants.length === 0) {
    console.warn(`⚠️ ${resolverResult.error || 'No restaurants found'}`);
    return [];
  }
  
  const restaurants = resolverResult.restaurants;
  console.log(`✅ Found ${restaurants.length} restaurants via shared resolver`);
  
  // Step 2: Generate AI meals for ALL restaurants in parallel
  console.log(`🚀 Generating meals for all ${restaurants.length} restaurants in parallel...`);
  
  const restaurantPromises = restaurants.map(async (restaurant: ResolvedRestaurant) => {
    console.log(`🍽️ Generating meal for ${restaurant.name} (${restaurant.cuisine})`);
    
    try {
      const aiMeals = await generateRestaurantMealsAI({
        restaurantName: restaurant.name,
        cuisine: restaurant.cuisine,
        user,
        cravingContext: mealQuery
      });
      
      if (aiMeals && aiMeals.length > 0) {
        const mealsToAdd = aiMeals.slice(0, 2);
        
        return mealsToAdd.map(meal => ({
          restaurantName: restaurant.name,
          cuisine: restaurant.cuisine,
          address: restaurant.address,
          rating: restaurant.rating,
          photoUrl: restaurant.photoUrl,
          meal: {
            name: meal.name,
            description: meal.description,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
            reason: meal.reason,
            modifications: meal.modifications,
            ingredients: meal.ingredients,
            imageUrl: meal.imageUrl
          },
          medicalBadges: meal.medicalBadges
        }));
      }
      return [];
    } catch (error) {
      console.error(`❌ Failed to generate meal for ${restaurant.name}:`, error);
      return [];
    }
  });
  
  const restaurantResults = await Promise.all(restaurantPromises);
  const results: RestaurantResult[] = restaurantResults.flat();
  
  console.log(`✅ Successfully generated ${results.length} meal recommendations`);
  return results;
}
