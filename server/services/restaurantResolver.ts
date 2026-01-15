/**
 * Restaurant Resolver Service v1.0
 * 
 * Shared utility for resolving restaurant locations by ZIP code.
 * Used by both Meal Finder and Restaurant Guide features.
 * 
 * Single source of truth for:
 * - ZIP → coordinates conversion
 * - Google Places API integration
 * - Restaurant data normalization
 */

import axios from 'axios';
import { zipToCoordinates } from './zipToCoordsService';

export interface ResolvedRestaurant {
  name: string;
  cuisine: string;
  address: string;
  rating?: number;
  photoUrl?: string;
  placeId?: string;
  types?: string[];
  location?: {
    lat: number;
    lng: number;
  };
}

export interface RestaurantResolverRequest {
  query: string;
  zipCode: string;
  radiusMiles?: number;
  limit?: number;
  searchMode?: 'craving' | 'restaurant';
}

export interface RestaurantResolverResult {
  success: boolean;
  restaurants: ResolvedRestaurant[];
  coordinates?: { lat: number; lng: number };
  error?: string;
}

function detectCuisine(name: string, types: string[] = []): string {
  const nameLower = name.toLowerCase();
  const typesStr = types.join(' ').toLowerCase();
  
  if (typesStr.includes('mexican')) return 'Mexican';
  if (typesStr.includes('italian')) return 'Italian';
  if (typesStr.includes('chinese')) return 'Chinese';
  if (typesStr.includes('japanese')) return 'Japanese';
  if (typesStr.includes('indian')) return 'Indian';
  if (typesStr.includes('thai')) return 'Thai';
  if (typesStr.includes('mediterranean')) return 'Mediterranean';
  if (typesStr.includes('greek')) return 'Greek';
  if (typesStr.includes('french')) return 'French';
  if (typesStr.includes('korean')) return 'Korean';
  if (typesStr.includes('vietnamese')) return 'Vietnamese';
  
  if (nameLower.includes('taco') || nameLower.includes('burrito')) return 'Mexican';
  if (nameLower.includes('pizza') || nameLower.includes('pasta')) return 'Italian';
  if (nameLower.includes('sushi') || nameLower.includes('ramen')) return 'Japanese';
  if (nameLower.includes('curry') || nameLower.includes('tandoor')) return 'Indian';
  if (nameLower.includes('pita') || nameLower.includes('gyro')) return 'Mediterranean';
  if (nameLower.includes('pho') || nameLower.includes('banh')) return 'Vietnamese';
  if (nameLower.includes('bbq') || nameLower.includes('barbecue')) return 'BBQ';
  
  return 'American';
}

function getPhotoUrl(photoReference?: string): string | undefined {
  if (!photoReference) return undefined;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${apiKey}`;
}

/**
 * Resolve restaurants by ZIP code
 * 
 * @param request.query - Search term (craving like "steak" or restaurant name like "Chipotle")
 * @param request.zipCode - 5-digit US ZIP code
 * @param request.radiusMiles - Search radius in miles (default: 5)
 * @param request.limit - Max restaurants to return (default: 3)
 * @param request.searchMode - 'craving' searches for "restaurants serving X", 'restaurant' searches for the restaurant directly
 */
export async function resolveRestaurantsByZip(
  request: RestaurantResolverRequest
): Promise<RestaurantResolverResult> {
  const { 
    query, 
    zipCode, 
    radiusMiles = 5, 
    limit = 3,
    searchMode = 'craving'
  } = request;

  console.log(`🔍 Resolving restaurants for "${query}" near ZIP ${zipCode} (mode: ${searchMode})`);

  const coords = await zipToCoordinates(zipCode);
  if (!coords) {
    return {
      success: false,
      restaurants: [],
      error: `Could not geocode ZIP code ${zipCode}`
    };
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      restaurants: [],
      coordinates: coords,
      error: 'Google Places API key not configured'
    };
  }

  try {
    const searchQuery = searchMode === 'craving'
      ? `restaurants serving ${query}`
      : query;
    
    const radiusMeters = Math.round(radiusMiles * 1609.34);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json`;

    console.log(`🔍 Google Places: "${searchQuery}" at (${coords.lat}, ${coords.lng}), radius ${radiusMeters}m`);

    const response = await axios.get(url, {
      params: {
        query: searchQuery,
        location: `${coords.lat},${coords.lng}`,
        radius: radiusMeters,
        key: apiKey,
        type: 'restaurant'
      }
    });

    if (response.data.status !== 'OK' || !response.data.results?.length) {
      return {
        success: false,
        restaurants: [],
        coordinates: coords,
        error: `No restaurants found for "${query}" near ZIP ${zipCode}`
      };
    }

    const restaurants: ResolvedRestaurant[] = response.data.results
      .slice(0, limit)
      .map((place: any) => ({
        name: place.name,
        cuisine: detectCuisine(place.name, place.types || []),
        address: place.formatted_address || place.vicinity || 'Address not available',
        rating: place.rating,
        photoUrl: place.photos?.[0]?.photo_reference
          ? getPhotoUrl(place.photos[0].photo_reference)
          : undefined,
        placeId: place.place_id,
        types: place.types,
        location: place.geometry?.location
          ? { lat: place.geometry.location.lat, lng: place.geometry.location.lng }
          : undefined
      }));

    console.log(`✅ Resolved ${restaurants.length} restaurants`);

    return {
      success: true,
      restaurants,
      coordinates: coords
    };

  } catch (error) {
    console.error('❌ Restaurant resolver error:', error);
    return {
      success: false,
      restaurants: [],
      coordinates: coords,
      error: 'Failed to search for restaurants'
    };
  }
}
