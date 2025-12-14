// Google Places API integration service
// Enriches restaurant data with real cuisine types from Google Places API
import axios from 'axios';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const GOOGLE_PLACES_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

// In-memory cache for API responses (simple caching to reduce API calls)
const cuisineCache = new Map<string, { cuisine: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Supported cuisine types in the app
const SUPPORTED_CUISINES = [
  'Mexican',
  'Italian',
  'American',
  'Mediterranean',
  'Chinese',
  'Indian',
  'Japanese',
  'Thai',
  'Vietnamese',
  'Korean',
  'Greek',
  'French',
  'Spanish',
  'Middle Eastern',
  'Caribbean',
  'Brazilian',
  'Steakhouse',
  'Seafood',
  'BBQ',
  'Pizza',
  'Sushi',
  'Burger',
  'Sandwich'
];

/**
 * Normalize Google Places cuisine types to our supported cuisines
 */
function normalizeCuisine(googleTypes: string[]): string {
  if (!googleTypes || googleTypes.length === 0) {
    return 'American'; // Default fallback
  }

  // Convert Google types to lowercase for case-insensitive matching
  const lowerTypes = googleTypes.map(t => t.toLowerCase());

  // Direct matches
  for (const cuisine of SUPPORTED_CUISINES) {
    const lowerCuisine = cuisine.toLowerCase();
    if (lowerTypes.includes(lowerCuisine)) {
      return cuisine;
    }
  }

  // Pattern matching for common variations
  const patterns: Record<string, string> = {
    'mexican': 'Mexican',
    'italian': 'Italian',
    'chinese': 'Chinese',
    'japanese': 'Japanese',
    'sushi': 'Sushi',
    'thai': 'Thai',
    'vietnamese': 'Vietnamese',
    'korean': 'Korean',
    'indian': 'Indian',
    'mediterranean': 'Mediterranean',
    'greek': 'Greek',
    'french': 'French',
    'spanish': 'Spanish',
    'middle_eastern': 'Middle Eastern',
    'caribbean': 'Caribbean',
    'brazilian': 'Brazilian',
    'steak_house': 'Steakhouse',
    'steakhouse': 'Steakhouse',
    'seafood': 'Seafood',
    'barbecue': 'BBQ',
    'bbq': 'BBQ',
    'pizza': 'Pizza',
    'burger': 'Burger',
    'sandwich': 'Sandwich',
    'american': 'American',
    'restaurant': 'American', // Generic fallback
  };

  // Check patterns
  for (const type of lowerTypes) {
    for (const [pattern, cuisine] of Object.entries(patterns)) {
      if (type.includes(pattern)) {
        return cuisine;
      }
    }
  }

  // Default fallback
  return 'American';
}

/**
 * Resolve cuisine type for a restaurant using Google Places API
 */
export async function resolveCuisine(
  restaurantName: string,
  fallbackCuisine: string = 'American'
): Promise<string> {
  // Check if API key is configured
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('⚠️ GOOGLE_PLACES_API_KEY not configured, using fallback cuisine');
    return fallbackCuisine;
  }

  // Normalize restaurant name for cache key
  const cacheKey = restaurantName.toLowerCase().trim();

  // Check cache first
  const cached = cuisineCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`📦 Using cached cuisine for ${restaurantName}: ${cached.cuisine}`);
    return cached.cuisine;
  }

  try {
    console.log(`🔍 Looking up cuisine for: ${restaurantName}`);

    // Try multiple search strategies to find the restaurant
    const searchStrategies = [
      restaurantName, // Exact name first
      `${restaurantName} restaurant`, // Add "restaurant" suffix
      restaurantName.split(' ')[0], // Just the first word (e.g., "Red" from "Red Robin")
      `${restaurantName} USA`, // Add country for chain restaurants
    ];

    let searchResponse: any = null;
    let successfulQuery = '';

    // Try each search strategy until we get results
    for (const query of searchStrategies) {
      console.log(`🔍 Trying search query: ${query}`);
      
      try {
        const response = await axios.get(GOOGLE_PLACES_TEXT_SEARCH_URL, {
          params: {
            query,
            key: GOOGLE_PLACES_API_KEY,
            type: 'restaurant'
          },
          timeout: 5000 // 5 second timeout
        });

        if (response.data.status === 'OK' && response.data.results?.length > 0) {
          searchResponse = response;
          successfulQuery = query;
          console.log(`✅ Found results with query: ${query}`);
          break; // Success! Stop trying more queries
        }
      } catch (queryError) {
        console.warn(`⚠️ Search failed for "${query}":`, queryError instanceof Error ? queryError.message : 'Unknown error');
        continue; // Try next query
      }
    }

    // If no results from any strategy, use fallback
    if (!searchResponse || searchResponse.data.status !== 'OK' || !searchResponse.data.results?.length) {
      console.warn(`⚠️ No results found for ${restaurantName} with any search strategy, using fallback`);
      return fallbackCuisine;
    }

    console.log(`✅ Successfully found restaurant using query: "${successfulQuery}"`);

    const place = searchResponse.data.results[0];
    const placeId = place.place_id;

    console.log(`✅ Found restaurant: ${place.name} (ID: ${placeId})`);

    // Step 2: Get place details for more specific cuisine information
    const detailsResponse = await axios.get(GOOGLE_PLACES_DETAILS_URL, {
      params: {
        place_id: placeId,
        key: GOOGLE_PLACES_API_KEY,
        fields: 'types,name'
      },
      timeout: 5000
    });

    if (detailsResponse.data.status !== 'OK' || !detailsResponse.data.result) {
      console.warn(`⚠️ Could not get details for ${restaurantName}, using fallback`);
      return fallbackCuisine;
    }

    const types = detailsResponse.data.result.types || [];
    console.log(`📋 Place types for ${restaurantName}:`, types);

    // Normalize cuisine from types
    const normalizedCuisine = normalizeCuisine(types);
    console.log(`🍽️ Normalized cuisine: ${normalizedCuisine}`);

    // Cache the result
    cuisineCache.set(cacheKey, {
      cuisine: normalizedCuisine,
      timestamp: Date.now()
    });

    return normalizedCuisine;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`❌ Google Places API error for ${restaurantName}:`, error.message);
    } else {
      console.error(`❌ Unexpected error resolving cuisine for ${restaurantName}:`, error);
    }
    return fallbackCuisine;
  }
}

/**
 * Clear the cuisine cache (useful for testing or manual refresh)
 */
export function clearCuisineCache(): void {
  cuisineCache.clear();
  console.log('🗑️ Cuisine cache cleared');
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getCacheStats(): { size: number; entries: Array<{ restaurant: string; cuisine: string }> } {
  const entries = Array.from(cuisineCache.entries()).map(([restaurant, data]) => ({
    restaurant,
    cuisine: data.cuisine
  }));

  return {
    size: cuisineCache.size,
    entries
  };
}
