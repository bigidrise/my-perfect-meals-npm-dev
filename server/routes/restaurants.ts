// 🔒 RESTAURANT GUIDE BACKEND - SHARED RESOLVER + AI MEALS 🔒
// Refactored: Uses shared Restaurant Resolver (January 2026)
import { Router } from "express";
import axios from "axios";
import { generateRestaurantMealsAI } from "../services/restaurantMealGeneratorAI";
import { resolveRestaurantsByZip } from "../services/restaurantResolver";
import { coordsToZip } from "../services/zipToCoordsService";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { loadUserProtocolEnvelope, enforceBeforeGenerate, buildGuestEnvelope } from "../services/protocolEnvelope";
import { scoreRestaurantsForDiet, buildDietQuery } from "../services/restaurantScorer";
import { zipToCoordinates } from "../services/zipToCoordsService";

const router = Router();

// Smart Restaurant Guide endpoint with craving + restaurant + ZIP code
// Uses shared Restaurant Resolver for location logic
router.post("/guide", async (req, res) => {
  try {
    const { restaurantName, craving, cuisine, zipCode, userId, dietaryRestrictions } = req.body;
    
    if (!restaurantName || !craving) {
      return res.status(400).json({ 
        error: "Restaurant name and craving are required" 
      });
    }

    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      return res.status(400).json({ 
        error: "Valid 5-digit ZIP code is required" 
      });
    }

    console.log(`🍽️ Smart Restaurant Guide: "${craving}" at "${restaurantName}" near ZIP ${zipCode}`);
    
    const generationStart = Date.now();

    let user = undefined;
    if (userId) {
      try {
        const [foundUser] = await db.select().from(users).where(eq(users.id, userId));
        if (foundUser) {
          user = foundUser;
          console.log(`👤 [Guide] User profile loaded for meal generation`);
        }
      } catch (userError) {
        console.warn(`⚠️ Could not fetch user ${userId}:`, userError);
      }
    }

    // Step 1: Use shared resolver to find the restaurant
    const resolverResult = await resolveRestaurantsByZip({
      query: restaurantName,
      zipCode,
      radiusMiles: 10,
      limit: 1,
      searchMode: 'restaurant'
    });
    
    let restaurantInfo;
    let detectedCuisine = cuisine || 'American';
    
    if (resolverResult.success && resolverResult.restaurants.length > 0) {
      const restaurant = resolverResult.restaurants[0];
      detectedCuisine = restaurant.cuisine;
      
      restaurantInfo = {
        name: restaurant.name,
        address: restaurant.address,
        rating: restaurant.rating,
        photoUrl: restaurant.photoUrl
      };
      
      console.log(`✅ Found restaurant via resolver: ${restaurantInfo.name} at ${restaurantInfo.address}`);
    } else {
      console.warn(`⚠️ Restaurant "${restaurantName}" not found near ZIP ${zipCode}, using input name`);
      restaurantInfo = {
        name: restaurantName,
        address: `Near ${zipCode}`,
        rating: undefined,
        photoUrl: undefined
      };
    }
    
    // Merge body-supplied dietary restrictions into the user object so the AI prompt is constrained
    const bodyDiet: string[] = dietaryRestrictions
      ? (Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [dietaryRestrictions]).filter(Boolean)
      : [];
    let aiUser = user;
    if (bodyDiet.length > 0) {
      const existing = (user?.dietaryRestrictions as string[]) || [];
      const merged = Array.from(new Set([...existing, ...bodyDiet]));
      aiUser = { ...(user || {}), dietaryRestrictions: merged } as any;
    }

    // ── Protocol envelope: enforce dietary identity before generation ──────────
    const guideEnvelope = userId
      ? (await loadUserProtocolEnvelope(userId).catch(() => null)) ?? buildGuestEnvelope()
      : buildGuestEnvelope();
    const guideProtocolBlock = enforceBeforeGenerate(guideEnvelope, { generatorName: 'restaurant_guide' }).combined;

    // Step 2: Generate AI meal recommendations for this restaurant
    const recommendations = await generateRestaurantMealsAI({
      restaurantName: restaurantInfo.name,
      cuisine: detectedCuisine,
      cravingContext: craving,
      user: aiUser,
      protocolBlock: guideProtocolBlock,
      protocolEnvelope: guideEnvelope,
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
          console.log(`👤 User medical profile loaded`);
        }
      } catch (userError) {
        console.warn(`⚠️ Could not fetch user ${userId}:`, userError);
        // Continue without user data - generator will work without it
      }
    }
    
    // ── Protocol envelope: enforce dietary identity before generation ──────────
    const analyzeEnvelope = userId
      ? (await loadUserProtocolEnvelope(userId).catch(() => null)) ?? buildGuestEnvelope()
      : buildGuestEnvelope();
    const analyzeProtocolBlock = enforceBeforeGenerate(analyzeEnvelope, { generatorName: 'restaurant_analyze_menu' }).combined;

    // Use AI generator (automatically falls back to locked generator if AI fails)
    const recommendations = await generateRestaurantMealsAI({
      restaurantName: restaurantName || `${cuisine} Restaurant`,
      cuisine: cuisine || "International",
      user,
      protocolBlock: analyzeProtocolBlock,
      protocolEnvelope: analyzeEnvelope,
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

// Reverse geocoding endpoint - converts GPS coordinates to ZIP code
router.post("/reverse-geocode", async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ 
        error: "Latitude and longitude are required as numbers" 
      });
    }

    console.log(`📍 Reverse geocoding: (${lat}, ${lng})`);
    
    const zipCode = await coordsToZip(lat, lng);
    
    if (!zipCode) {
      return res.status(404).json({ 
        error: "Could not determine ZIP code for this location" 
      });
    }

    return res.json({ zipCode });

  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return res.status(500).json({ 
      error: "Failed to get ZIP code",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Diagnostic endpoint: tests the Google Places API key directly
// Call GET /api/restaurants/test-key to see raw Google response
router.get("/test-key", async (_req, res) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.json({ ok: false, issue: "GOOGLE_PLACES_API_KEY env var is not set in Replit secrets" });
  }

  const keyPreview = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;

  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      {
        params: {
          query: "McDonald's restaurant",
          location: "41.8781,-87.6298",
          radius: 8000,
          key: apiKey,
          type: "restaurant",
        },
        timeout: 8000,
      }
    );

    const { status, error_message, results } = response.data;
    return res.json({
      keyPreview,
      googleStatus: status,
      googleErrorMessage: error_message || null,
      resultCount: results?.length ?? 0,
      firstResult: results?.[0]
        ? { name: results[0].name, formatted_address: results[0].formatted_address, vicinity: results[0].vicinity }
        : null,
      ok: status === "OK",
    });
  } catch (err: any) {
    return res.json({ ok: false, keyPreview, networkError: err.message });
  }
});

// Diet-aware restaurant finder: scores nearby restaurants for a user's dietary identity
// POST /api/restaurants/find-nearby
// Body: { zipCode, diet, userId? }
router.post("/find-nearby", async (req, res) => {
  try {
    const { zipCode, diet, userId } = req.body;

    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      return res.status(400).json({ error: "Valid 5-digit ZIP code is required" });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Google Places API key not configured" });
    }

    const coords = await zipToCoordinates(zipCode);
    if (!coords) {
      return res.status(400).json({ error: `Could not resolve ZIP code ${zipCode}` });
    }

    const radiusMeters = Math.round(8 * 1609.34);
    const dietStr = (diet || "general").toString();

    async function searchPlaces(query: string): Promise<any[]> {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        {
          params: {
            query,
            location: `${coords!.lat},${coords!.lng}`,
            radius: radiusMeters,
            type: "restaurant",
            key: apiKey,
          },
          timeout: 10000,
        }
      );
      if (response.data.status === "OK") return response.data.results || [];
      return [];
    }

    const primaryQuery = buildDietQuery(dietStr, false);
    let places = await searchPlaces(primaryQuery);

    if (places.length < 3) {
      const fallbackPlaces = await searchPlaces(buildDietQuery(dietStr, true));
      const existing = new Set(places.map((p: any) => p.place_id));
      for (const p of fallbackPlaces) {
        if (!existing.has(p.place_id)) places.push(p);
        if (places.length >= 20) break;
      }
    }

    const scored = scoreRestaurantsForDiet(places.slice(0, 20), dietStr);

    const visible = scored.filter((r) => r.tier !== "BLOCKED");
    const highMatch = visible.filter((r) => r.tier === "HIGH_MATCH").sort((a, b) => b.score - a.score);
    const adaptable = visible.filter((r) => r.tier === "ADAPTABLE").sort((a, b) => b.score - a.score);

    console.log(
      `✅ [find-nearby] diet=${dietStr} zip=${zipCode} total=${places.length} high=${highMatch.length} adaptable=${adaptable.length} blocked=${scored.length - visible.length}`
    );

    return res.json({
      diet: dietStr,
      zipCode,
      highMatch,
      adaptable,
      totalScored: scored.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("find-nearby error:", error);
    return res.status(500).json({
      error: "Failed to find restaurants",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;