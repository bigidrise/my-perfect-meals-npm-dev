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
 * Extract a 5-digit US ZIP from a Google geocoding results array.
 */
function extractZipFromGoogleResults(results: any[], lat: number, lng: number): string | null {
  for (const result of results) {
    for (const component of result.address_components || []) {
      if (component.types.includes('postal_code')) {
        const rawZip = component.short_name;
        const normalizedZip = rawZip.replace(/\D/g, '').slice(0, 5);
        if (/^\d{5}$/.test(normalizedZip)) {
          console.log(`✅ Found ZIP code: ${normalizedZip} for (${lat}, ${lng})`);
          return normalizedZip;
        }
        console.error(`❌ Invalid ZIP format after normalization: ${rawZip} -> ${normalizedZip}`);
      }
    }
  }
  return null;
}

/**
 * Reverse geocode coordinates to ZIP code using OpenStreetMap Nominatim (free, no key required).
 */
async function coordsToZipNominatim(lat: number, lng: number): Promise<string | null> {
  try {
    console.log(`🗺️ Nominatim fallback: reverse geocoding (${lat}, ${lng})`);
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'MyPerfectMeals/1.0 (contact@myperfectmeals.com)' },
      timeout: 8000,
    });

    const postcode = response.data?.address?.postcode;
    if (!postcode) {
      console.error('❌ Nominatim: no postcode in response');
      return null;
    }

    const normalizedZip = postcode.replace(/\D/g, '').slice(0, 5);
    if (!/^\d{5}$/.test(normalizedZip)) {
      console.error(`❌ Nominatim: invalid postcode format: ${postcode}`);
      return null;
    }

    console.log(`✅ Nominatim found ZIP: ${normalizedZip} for (${lat}, ${lng})`);
    return normalizedZip;
  } catch (error) {
    console.error('❌ Nominatim reverse geocoding error:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to ZIP code.
 * Tries Google Geocoding API first; falls back to OpenStreetMap Nominatim if Google fails.
 */
export async function coordsToZip(lat: number, lng: number): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  // --- Try Google first if key is available ---
  if (apiKey) {
    try {
      console.log(`🔍 Reverse geocoding coordinates: (${lat}, ${lng})`);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
      const response = await axios.get(url);

      if (response.data.status === 'OK' && response.data.results?.length > 0) {
        const zip = extractZipFromGoogleResults(response.data.results, lat, lng);
        if (zip) return zip;
        console.error('❌ No postal code found in Google response');
      } else {
        console.error(`❌ Reverse geocoding failed: ${response.data.status} — falling back to Nominatim`);
      }
    } catch (error) {
      console.error('❌ Google reverse geocoding API error — falling back to Nominatim:', error);
    }
  } else {
    console.warn('⚠️ GOOGLE_PLACES_API_KEY not configured — using Nominatim directly');
  }

  // --- Fallback: OpenStreetMap Nominatim ---
  return coordsToZipNominatim(lat, lng);
}
