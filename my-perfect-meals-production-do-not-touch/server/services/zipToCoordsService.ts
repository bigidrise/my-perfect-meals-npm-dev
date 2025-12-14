// ZIP Code to Coordinates Service
// Converts US ZIP codes to latitude/longitude using Google Geocoding API
// Implements 24-hour caching to minimize API calls

import axios from 'axios';

interface Coordinates {
  lat: number;
  lng: number;
}

interface CacheEntry {
  coords: Coordinates;
  timestamp: number;
}

// In-memory cache: ZIP -> { coords, timestamp }
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Convert ZIP code to coordinates using Google Geocoding API
 * Returns cached result if available and fresh (< 24h old)
 */
export async function zipToCoordinates(zipCode: string): Promise<Coordinates | null> {
  // Validate ZIP code format (5 digits)
  if (!/^\d{5}$/.test(zipCode)) {
    console.error('❌ Invalid ZIP code format:', zipCode);
    return null;
  }

  // Check cache first
  const cached = cache.get(zipCode);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_DURATION_MS) {
      console.log(`✅ Using cached coordinates for ZIP ${zipCode}`);
      return cached.coords;
    } else {
      // Expired cache entry
      cache.delete(zipCode);
    }
  }

  // Fetch from Google Geocoding API
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_PLACES_API_KEY not configured');
    return null;
  }

  try {
    console.log(`🔍 Geocoding ZIP code: ${zipCode}`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${zipCode}&key=${apiKey}`;
    
    const response = await axios.get(url);
    
    if (response.data.status !== 'OK' || !response.data.results || response.data.results.length === 0) {
      console.error(`❌ Geocoding failed for ZIP ${zipCode}:`, response.data.status);
      return null;
    }

    const location = response.data.results[0].geometry.location;
    const coords: Coordinates = {
      lat: location.lat,
      lng: location.lng
    };

    // Cache the result
    cache.set(zipCode, {
      coords,
      timestamp: Date.now()
    });

    console.log(`✅ Geocoded ZIP ${zipCode} to (${coords.lat}, ${coords.lng})`);
    return coords;

  } catch (error) {
    console.error('❌ Geocoding API error:', error);
    return null;
  }
}

/**
 * Clear the cache (useful for testing or manual refresh)
 */
export function clearCache() {
  cache.clear();
  console.log('🗑️ ZIP coordinate cache cleared');
}
