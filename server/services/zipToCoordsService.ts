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

/**
 * Reverse geocode coordinates to ZIP code using Google Geocoding API
 * Returns the ZIP code for the given latitude/longitude
 */
export async function coordsToZip(lat: number, lng: number): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('❌ GOOGLE_PLACES_API_KEY not configured');
    return null;
  }

  try {
    console.log(`🔍 Reverse geocoding coordinates: (${lat}, ${lng})`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    
    const response = await axios.get(url);
    
    if (response.data.status !== 'OK' || !response.data.results || response.data.results.length === 0) {
      console.error(`❌ Reverse geocoding failed:`, response.data.status);
      return null;
    }

    // Search through address components for postal_code
    for (const result of response.data.results) {
      for (const component of result.address_components || []) {
        if (component.types.includes('postal_code')) {
          // Normalize to exactly 5 digits (handle ZIP+4 format like "02115-1234")
          const rawZip = component.short_name;
          const normalizedZip = rawZip.replace(/\D/g, '').slice(0, 5);
          
          // Validate it's exactly 5 digits
          if (!/^\d{5}$/.test(normalizedZip)) {
            console.error(`❌ Invalid ZIP format after normalization: ${rawZip} -> ${normalizedZip}`);
            continue; // Try next result
          }
          
          console.log(`✅ Found ZIP code: ${normalizedZip} for (${lat}, ${lng})`);
          return normalizedZip;
        }
      }
    }

    console.error('❌ No postal code found in geocoding response');
    return null;

  } catch (error) {
    console.error('❌ Reverse geocoding API error:', error);
    return null;
  }
}
