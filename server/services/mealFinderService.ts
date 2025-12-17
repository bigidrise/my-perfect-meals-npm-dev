// Meal Finder Service
// Finds nearby restaurants for a given meal craving + ZIP code
// Uses Google Places API + AI Restaurant Meal Generator

import axios from 'axios';
import { zipToCoordinates } from './zipToCoordsService';
import { generateRestaurantMealsAI } from './restaurantMealGeneratorAI';
import type { User } from '@shared/schema';

interface MealFinderRequest {
  mealQuery: string;
  zipCode?: string;
  lat?: number;
  lng?: number;
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
 * Detect cuisine type from restaurant name or types
 */
function detectCuisine(name: string, types: string[] = []): string {
  const nameLower = name.toLowerCase();
  const typesStr = types.join(' ').toLowerCase();
  
  // Check types first (more reliable)
  if (typesStr.includes('mexican')) return 'Mexican';
  if (typesStr.includes('italian')) return 'Italian';
  if (typesStr.includes('chinese')) return 'Chinese';
  if (typesStr.includes('japanese')) return 'Japanese';
  if (typesStr.includes('indian')) return 'Indian';
  if (typesStr.includes('thai')) return 'Thai';
  if (typesStr.includes('mediterranean')) return 'Mediterranean';
  if (typesStr.includes('greek')) return 'Greek';
  if (typesStr.includes('french')) return 'French';
  
  // Check name patterns
  if (nameLower.includes('taco') || nameLower.includes('burrito')) return 'Mexican';
  if (nameLower.includes('pizza') || nameLower.includes('pasta')) return 'Italian';
  if (nameLower.includes('sushi') || nameLower.includes('ramen')) return 'Japanese';
  if (nameLower.includes('curry') || nameLower.includes('tandoor')) return 'Indian';
  if (nameLower.includes('pita') || nameLower.includes('gyro')) return 'Mediterranean';
  
  // Default
  return 'American';
}

/**
 * Get restaurant photo URL from Google Places
 */
function getPhotoUrl(photoReference?: string): string | undefined {
  if (!photoReference) return undefined;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${apiKey}`;
}

/**
 * Find meals near a location based on craving
 * Accepts either lat/lng coordinates OR zipCode for location
 */
export async function findMealsNearby(request: MealFinderRequest): Promise<RestaurantResult[]> {
  const { mealQuery, zipCode, lat, lng, user } = request;
  
  // Validate we have either coords or ZIP
  const hasCoords = typeof lat === 'number' && typeof lng === 'number';
  const hasZip = zipCode && /^\d{5}$/.test(zipCode);
  
  if (!hasCoords && !hasZip) {
    console.error('❌ Either coordinates (lat/lng) or a valid ZIP code is required');
    return [];
  }
  
  const locationDesc = hasCoords ? `(${lat!.toFixed(4)}, ${lng!.toFixed(4)})` : `ZIP ${zipCode}`;
  console.log(`🔍 Finding meals for "${mealQuery}" near ${locationDesc}`);
  
  // Step 1: Get coordinates (use provided or convert from ZIP)
  let coords: { lat: number; lng: number } | null = null;
  
  if (hasCoords) {
    coords = { lat: lat!, lng: lng! };
    console.log(`📍 Using device coordinates: (${lat}, ${lng})`);
  } else {
    coords = await zipToCoordinates(zipCode!);
    if (!coords) {
      console.error('❌ Could not geocode ZIP code');
      return [];
    }
  }
  
  // Step 2: Search for restaurants using Google Places Text Search
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_PLACES_API_KEY not configured');
    return [];
  }
  
  try {
    // IMPROVED: Search for restaurants that SERVE the food, not restaurants OF that type
    // "steak" → "restaurants serving steak" (not "steakhouse")
    const searchQuery = `restaurants serving ${mealQuery}`;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json`;
    
    console.log(`🔍 Google Places search: "${searchQuery}" at (${coords.lat}, ${coords.lng})`);
    
    const response = await axios.get(url, {
      params: {
        query: searchQuery,
        location: `${coords.lat},${coords.lng}`,
        radius: 8000, // 8km radius (~5 miles)
        key: apiKey,
        type: 'restaurant' // Ensure we only get restaurants, not stores
      }
    });
    
    if (response.data.status !== 'OK' || !response.data.results || response.data.results.length === 0) {
      console.warn(`⚠️ No restaurants found for "${searchQuery}" near ${locationDesc}`);
      return [];
    }
    
    // Get top 3 restaurants
    const restaurants = response.data.results.slice(0, 3);
    console.log(`✅ Found ${restaurants.length} restaurants`);
    
    // Step 3: Generate AI meals for ALL restaurants in parallel (10x faster!)
    console.log(`🚀 Generating meals for all ${restaurants.length} restaurants in parallel...`);
    
    const restaurantPromises = restaurants.map(async (restaurant: any) => {
      const restaurantName = restaurant.name;
      const cuisine = detectCuisine(restaurantName, restaurant.types || []);
      const address = restaurant.formatted_address || restaurant.vicinity || 'Address not available';
      const rating = restaurant.rating;
      const photoUrl = restaurant.photos?.[0]?.photo_reference 
        ? getPhotoUrl(restaurant.photos[0].photo_reference)
        : undefined;
      
      console.log(`🍽️ Generating meal for ${restaurantName} (${cuisine})`);
      
      try {
        // Use existing AI meal generator with craving context
        // Pass the mealQuery so AI focuses on generating meals featuring that food
        const aiMeals = await generateRestaurantMealsAI({
          restaurantName,
          cuisine,
          user,
          cravingContext: mealQuery // NEW: Tell AI what food the user is craving
        });
        
        if (aiMeals && aiMeals.length > 0) {
          // Take first 2 meal suggestions
          const mealsToAdd = aiMeals.slice(0, 2);
          
          return mealsToAdd.map(meal => ({
            restaurantName,
            cuisine,
            address,
            rating,
            photoUrl,
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
        console.error(`❌ Failed to generate meal for ${restaurantName}:`, error);
        return [];
      }
    });
    
    // Wait for all restaurants to complete in parallel
    const restaurantResults = await Promise.all(restaurantPromises);
    
    // Flatten results (each restaurant returns array of meals)
    const results: RestaurantResult[] = restaurantResults.flat();
    
    console.log(`✅ Successfully generated ${results.length} meal recommendations`);
    return results;
    
  } catch (error) {
    console.error('❌ Google Places API error:', error);
    return [];
  }
}
