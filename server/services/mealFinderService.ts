// Meal Finder Service
// Finds nearby restaurants for a given meal craving + ZIP code
// Uses shared Restaurant Resolver + AI Restaurant Meal Generator

import { resolveRestaurantsByZip, ResolvedRestaurant } from './restaurantResolver';
import { generateRestaurantMealsAI } from './restaurantMealGeneratorAI';
import type { User } from '@shared/schema';
import { violatesDietaryConstraints, getPrimaryDiet } from './allergyGuardrails';

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
    console.warn(`⚠️ ${resolverResult.error || 'No restaurants found via Places API'} — falling back to AI-generated suggestions`);

    // Fallback: infer likely restaurants from the craving and generate AI meals
    const fallbackRestaurants = inferRestaurantsFromCraving(mealQuery, zipCode);

    const fallbackPromises = fallbackRestaurants.map(async (restaurant) => {
      try {
        // Try to resolve the real address for each inferred restaurant
        let resolvedAddress = `Near ${zipCode}`;
        try {
          const addrResult = await resolveRestaurantsByZip({
            query: restaurant.name,
            zipCode,
            radiusMiles: 15,
            limit: 1,
            searchMode: 'restaurant'
          });
          if (addrResult.success && addrResult.restaurants.length > 0) {
            resolvedAddress = addrResult.restaurants[0].address;
            console.log(`📍 Resolved address for ${restaurant.name}: ${resolvedAddress}`);
          }
        } catch (addrErr) {
          console.warn(`⚠️ Could not resolve address for ${restaurant.name}:`, addrErr);
        }

        const aiMeals = await generateRestaurantMealsAI({
          restaurantName: restaurant.name,
          cuisine: restaurant.cuisine,
          user,
          cravingContext: mealQuery
        });
        if (aiMeals && aiMeals.length > 0) {
          return aiMeals.slice(0, 2).map(meal => ({
            restaurantName: restaurant.name,
            cuisine: restaurant.cuisine,
            address: resolvedAddress,
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
      } catch (err) {
        console.error(`❌ Fallback meal generation failed for ${restaurant.name}:`, err);
        return [];
      }
    });

    const fallbackResults = (await Promise.all(fallbackPromises)).flat();
    console.log(`✅ Fallback generated ${fallbackResults.length} AI suggestions`);
    return fallbackResults;
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

  // DEFENSIVE FINAL DIETARY FILTER — catches anything that slipped through upstream
  const userDietaryRestrictions = user?.dietaryRestrictions || [];
  if (userDietaryRestrictions.length > 0 && getPrimaryDiet(userDietaryRestrictions)) {
    const beforeCount = results.length;
    const filteredResults = results.filter(r => {
      const fullText = `${r.meal.name} ${r.meal.description} ${r.meal.ingredients.join(" ")}`;
      const { violates, reasons } = violatesDietaryConstraints(fullText, userDietaryRestrictions);
      if (violates) {
        console.log(`🚫 [MEAL FINDER DIET FILTER] Removed "${r.meal.name}" from ${r.restaurantName} — violates ${getPrimaryDiet(userDietaryRestrictions)} diet (${reasons.join(", ")})`);
        return false;
      }
      return true;
    });
    if (filteredResults.length < beforeCount) {
      console.log(`🥗 [MEAL FINDER DIET FILTER] Removed ${beforeCount - filteredResults.length} non-compliant result(s), ${filteredResults.length} remaining`);
    }
    return filteredResults;
  }

  return results;
}

/**
 * Infer likely restaurant chains from a craving when Google Places returns nothing.
 * Returns 2-3 common restaurant names + their cuisine type.
 */
function inferRestaurantsFromCraving(
  craving: string,
  zipCode: string
): Array<{ name: string; cuisine: string }> {
  const q = craving.toLowerCase();

  if (q.includes('burger') || q.includes('beef') || q.includes('smash')) {
    return [
      { name: "Five Guys", cuisine: "American" },
      { name: "Shake Shack", cuisine: "American" },
      { name: "In-N-Out Burger", cuisine: "American" }
    ];
  }
  if (q.includes('sushi') || q.includes('japanese') || q.includes('ramen') || q.includes('poke')) {
    return [
      { name: "Nobu", cuisine: "Japanese" },
      { name: "Sushi Bar", cuisine: "Japanese" },
      { name: "Ramen Noodle House", cuisine: "Japanese" }
    ];
  }
  if (q.includes('taco') || q.includes('mexican') || q.includes('burrito') || q.includes('enchilada')) {
    return [
      { name: "Chipotle Mexican Grill", cuisine: "Mexican" },
      { name: "Taco Bell", cuisine: "Mexican" },
      { name: "Qdoba Mexican Eats", cuisine: "Mexican" }
    ];
  }
  if (q.includes('pizza') || q.includes('italian') || q.includes('pasta')) {
    return [
      { name: "Olive Garden", cuisine: "Italian" },
      { name: "Pizza Hut", cuisine: "Italian" },
      { name: "Domino's", cuisine: "Italian" }
    ];
  }
  if (q.includes('steak') || q.includes('grilled') || q.includes('bbq') || q.includes('barbecue') || q.includes('ribs')) {
    return [
      { name: "Texas Roadhouse", cuisine: "American" },
      { name: "Outback Steakhouse", cuisine: "American" },
      { name: "LongHorn Steakhouse", cuisine: "American" }
    ];
  }
  if (q.includes('chinese') || q.includes('dim sum') || q.includes('lo mein') || q.includes('fried rice')) {
    return [
      { name: "PF Chang's", cuisine: "Chinese" },
      { name: "Panda Express", cuisine: "Chinese" },
      { name: "Mandarin House", cuisine: "Chinese" }
    ];
  }
  if (q.includes('indian') || q.includes('curry') || q.includes('tandoori') || q.includes('naan')) {
    return [
      { name: "Bombay Palace", cuisine: "Indian" },
      { name: "India Palace", cuisine: "Indian" },
      { name: "Spice Garden", cuisine: "Indian" }
    ];
  }
  if (q.includes('mediterranean') || q.includes('greek') || q.includes('gyro') || q.includes('hummus') || q.includes('falafel')) {
    return [
      { name: "The Great Greek Mediterranean Grill", cuisine: "Mediterranean" },
      { name: "Cosi", cuisine: "Mediterranean" },
      { name: "Zoes Kitchen", cuisine: "Mediterranean" }
    ];
  }
  if (q.includes('thai') || q.includes('pad thai') || q.includes('tom yum')) {
    return [
      { name: "Thai Orchid", cuisine: "Thai" },
      { name: "Lotus of Siam", cuisine: "Thai" },
      { name: "Bangkok Garden", cuisine: "Thai" }
    ];
  }
  if (q.includes('chicken') || q.includes('wings') || q.includes('nuggets') || q.includes('fried')) {
    return [
      { name: "Chick-fil-A", cuisine: "American" },
      { name: "Raising Cane's", cuisine: "American" },
      { name: "Wingstop", cuisine: "American" }
    ];
  }
  if (q.includes('salad') || q.includes('healthy') || q.includes('bowl') || q.includes('wrap') || q.includes('vegan') || q.includes('vegetarian')) {
    return [
      { name: "Sweetgreen", cuisine: "American" },
      { name: "Panera Bread", cuisine: "American" },
      { name: "Freshii", cuisine: "American" }
    ];
  }
  if (q.includes('seafood') || q.includes('fish') || q.includes('shrimp') || q.includes('lobster') || q.includes('salmon')) {
    return [
      { name: "Red Lobster", cuisine: "Seafood" },
      { name: "Bonefish Grill", cuisine: "Seafood" },
      { name: "The Boiling Crab", cuisine: "Seafood" }
    ];
  }
  if (q.includes('breakfast') || q.includes('brunch') || q.includes('eggs') || q.includes('pancake') || q.includes('waffle')) {
    return [
      { name: "IHOP", cuisine: "American" },
      { name: "First Watch", cuisine: "American" },
      { name: "Cracker Barrel", cuisine: "American" }
    ];
  }

  // Generic fallback — common full-service restaurants
  return [
    { name: "Applebee's", cuisine: "American" },
    { name: "Chili's Grill & Bar", cuisine: "American" },
    { name: "TGI Fridays", cuisine: "American" }
  ];
}
