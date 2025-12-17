// 🔒 RESTAURANT GUIDE BACKEND - GOOGLE PLACES + AI MEALS 🔒
// Upgraded: Uses Google Places for real restaurant data (December 2025)
import { Router } from "express";
import axios from "axios";
import { generateRestaurantMealsAI } from "../services/restaurantMealGeneratorAI";
import { zipToCoordinates } from "../services/zipToCoordsService";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * Get restaurant photo URL from Google Places
 */
function getPhotoUrl(photoReference?: string): string | undefined {
  if (!photoReference) return undefined;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${apiKey}`;
}

/**
 * Detect cuisine type from restaurant name or types
 */
function detectCuisine(name: string, types: string[] = []): string {
  const nameLower = name.toLowerCase();
  const typesStr = types.join(' ').toLowerCase();
  
  if (typesStr.includes('mexican') || nameLower.includes('taco') || nameLower.includes('burrito')) return 'Mexican';
  if (typesStr.includes('italian') || nameLower.includes('pizza') || nameLower.includes('pasta')) return 'Italian';
  if (typesStr.includes('chinese') || nameLower.includes('wok')) return 'Chinese';
  if (typesStr.includes('japanese') || nameLower.includes('sushi') || nameLower.includes('ramen')) return 'Japanese';
  if (typesStr.includes('indian') || nameLower.includes('curry') || nameLower.includes('tandoor')) return 'Indian';
  if (typesStr.includes('thai')) return 'Thai';
  if (typesStr.includes('mediterranean') || nameLower.includes('pita') || nameLower.includes('gyro')) return 'Mediterranean';
  if (typesStr.includes('greek')) return 'Greek';
  if (typesStr.includes('french')) return 'French';
  
  return 'American';
}

// Smart Restaurant Guide endpoint with craving + restaurant + location
// Uses Google Places API to find real restaurant data
// Accepts either lat/lng coordinates OR zipCode for location
router.post("/guide", async (req, res) => {
  try {
    const { restaurantName, craving, cuisine, zipCode, lat, lng, userId } = req.body;
    
    if (!restaurantName || !craving) {
      return res.status(400).json({ 
        error: "Restaurant name and craving are required" 
      });
    }

    // Accept either lat/lng OR zipCode
    const hasCoords = typeof lat === 'number' && typeof lng === 'number';
    const hasZip = zipCode && /^\d{5}$/.test(zipCode);
    
    if (!hasCoords && !hasZip) {
      return res.status(400).json({ 
        error: "Either coordinates (lat/lng) or a valid 5-digit ZIP code is required" 
      });
    }

    const locationDesc = hasCoords ? `(${lat.toFixed(4)}, ${lng.toFixed(4)})` : `ZIP ${zipCode}`;
    console.log(`🍽️ Smart Restaurant Guide: "${craving}" at "${restaurantName}" near ${locationDesc}`);
    
    const generationStart = Date.now();
    
    // Step 1: Get coordinates (use provided or convert from ZIP)
    let coords: { lat: number; lng: number } | null = null;
    
    if (hasCoords) {
      coords = { lat, lng };
      console.log(`📍 Using device coordinates: (${lat}, ${lng})`);
    } else {
      coords = await zipToCoordinates(zipCode);
      if (!coords) {
        return res.status(400).json({ 
          error: "Could not locate that ZIP code" 
        });
      }
    }
    
    // Step 2: Search for the specific restaurant near that location using Google Places
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('❌ GOOGLE_PLACES_API_KEY not configured');
      return res.status(500).json({ 
        error: "Google Places API not configured" 
      });
    }
    
    // Search for the specific restaurant by name near the ZIP
    const searchQuery = `${restaurantName} restaurant`;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json`;
    
    console.log(`🔍 Google Places search: "${searchQuery}" at (${coords.lat}, ${coords.lng})`);
    
    const placesResponse = await axios.get(url, {
      params: {
        query: searchQuery,
        location: `${coords.lat},${coords.lng}`,
        radius: 16000, // 16km radius (~10 miles) to find the restaurant
        key: apiKey,
        type: 'restaurant'
      }
    });
    
    let restaurantInfo = null;
    let detectedCuisine = cuisine || 'American';
    
    if (placesResponse.data.status === 'OK' && placesResponse.data.results?.length > 0) {
      // Get the best matching restaurant (closest to name match)
      const place = placesResponse.data.results[0];
      
      detectedCuisine = detectCuisine(place.name, place.types || []);
      
      restaurantInfo = {
        name: place.name,
        address: place.formatted_address || place.vicinity || 'Address not available',
        rating: place.rating,
        photoUrl: place.photos?.[0]?.photo_reference 
          ? getPhotoUrl(place.photos[0].photo_reference)
          : undefined
      };
      
      console.log(`✅ Found restaurant: ${restaurantInfo.name} at ${restaurantInfo.address}`);
    } else {
      console.warn(`⚠️ Restaurant "${restaurantName}" not found near ${locationDesc}, using input name`);
      restaurantInfo = {
        name: restaurantName,
        address: hasCoords ? 'Near your location' : `Near ${zipCode}`,
        rating: undefined,
        photoUrl: undefined
      };
    }
    
    // Step 3: Generate 3 AI meal recommendations for this restaurant
    const recommendations = await generateRestaurantMealsAI({
      restaurantName: restaurantInfo.name,
      cuisine: detectedCuisine,
      cravingContext: craving,
      user: undefined
    });

    const generationTime = Date.now() - generationStart;
    console.log(`✅ Generated ${recommendations.length} recommendations in ${generationTime}ms`);

    return res.json({
      recommendations,
      restaurantInfo,
      restaurantName: restaurantInfo.name,
      craving,
      cuisine: detectedCuisine,
      generatedAt: new Date().toISOString(),
      generationTime
    });

  } catch (error) {
    console.error("Smart Restaurant Guide error:", error);
    return res.status(500).json({ 
      error: "Failed to generate restaurant recommendations",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Restaurant meal generation endpoint - uses AI with fallback
router.post("/analyze-menu", async (req, res) => {
  try {
    const { restaurantName, cuisine, userId } = req.body;
    
    if (!restaurantName || !cuisine) {
      return res.status(400).json({ 
        error: "Restaurant name and cuisine are required" 
      });
    }

    console.log(`🍽️ Generating restaurant meals for ${restaurantName} (${cuisine} cuisine)`);
    
    // Fetch user data for health-based personalization
    let user = undefined;
    if (userId) {
      try {
        const [foundUser] = await db.select().from(users).where(eq(users.id, userId));
        if (foundUser) {
          user = foundUser;
          console.log(`👤 User found with health conditions: ${foundUser.healthConditions?.join(', ') || 'none'}`);
        }
      } catch (userError) {
        console.warn(`⚠️ Could not fetch user ${userId}:`, userError);
        // Continue without user data - generator will work without it
      }
    }
    
    // Use AI generator (automatically falls back to locked generator if AI fails)
    const recommendations = await generateRestaurantMealsAI({
      restaurantName: restaurantName || `${cuisine} Restaurant`,
      cuisine: cuisine || "International",
      user
    });

    console.log(`✅ Generated ${recommendations.length} restaurant meal recommendations`);

    return res.json({
      recommendations,
      restaurantName,
      cuisine,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Restaurant meal generation error:", error);
    return res.status(500).json({ 
      error: "Failed to generate restaurant meals",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;