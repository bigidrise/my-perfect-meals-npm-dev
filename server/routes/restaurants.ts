// 🔒 RESTAURANT GUIDE BACKEND - SHARED RESOLVER + AI MEALS 🔒
// Refactored: Uses shared Restaurant Resolver (January 2026)
// Phase 2: Restaurant Intelligence Engine integration
import { Router } from "express";
import axios from "axios";
import { resolveRestaurantsByZip } from "../services/restaurantResolver";
import { coordsToZip } from "../services/zipToCoordsService";
import { db } from "../db";
import { users } from "@shared/schema";
import { restaurantGuideSessions } from "../db/schema/restaurantGuideSessions";
import { eq, desc } from "drizzle-orm";
import { getActiveNutritionContext } from "../services/nutritionContext/getActiveNutritionContext";
import { scoreRestaurantsForDiet, buildDietQuery } from "../services/restaurantScorer";
import { zipToCoordinates } from "../services/zipToCoordsService";
import { processMealImageForSave } from "../services/imageLifecycle";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { restaurantEngine } from "../services/away-from-home/ProviderRegistry";
import { generateMenuItemRecommendations } from "../services/away-from-home/generateMenuItemRecommendations";

const router = Router();

// Smart Restaurant Guide endpoint with craving + restaurant + ZIP code
// Phase 2: Routes through RestaurantIntelligenceEngine for verified menu data.
// When the engine has menu data → AI selects from real items.
// When the engine has no data → returns explicit unavailable state, no invention.
router.post("/guide", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { restaurantName, craving, cuisine, zipCode, dietaryRestrictions } = req.body;
    
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

    console.log(`🍽️ [Guide] "${craving}" at "${restaurantName}" near ZIP ${zipCode}`);
    
    const generationStart = Date.now();

    // ── Load user profile ──────────────────────────────────────────────────────
    let user: any = undefined;
    try {
      const [foundUser] = await db.select().from(users).where(eq(users.id, userId));
      if (foundUser) {
        user = foundUser;
        console.log(`👤 [Guide] User profile loaded`);
      }
    } catch (userError) {
      console.warn(`⚠️ [Guide] Could not fetch user profile:`, userError);
    }

    // Merge body-supplied dietary restrictions into user so engine pre-filter is constrained
    const bodyDiet: string[] = dietaryRestrictions
      ? (Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [dietaryRestrictions]).filter(Boolean)
      : [];
    const effectiveDiet: string[] = Array.from(
      new Set([...((user?.dietaryRestrictions as string[]) || []), ...bodyDiet])
    );
    const effectiveAllergies: string[] = (user?.allergies as string[]) || [];

    // ── Step 1: Resolve location (for display, not for engine routing) ─────────
    const resolverResult = await resolveRestaurantsByZip({
      query: restaurantName,
      zipCode,
      radiusMiles: 10,
      limit: 1,
      searchMode: 'restaurant'
    });

    let restaurantInfo: { name: string; address: string; rating?: number; photoUrl?: string };
    let detectedCuisine = cuisine || 'American';

    if (resolverResult.success && resolverResult.restaurants.length > 0) {
      const r = resolverResult.restaurants[0];
      detectedCuisine = r.cuisine;
      restaurantInfo = { name: r.name, address: r.address, rating: r.rating, photoUrl: r.photoUrl };
      console.log(`📍 [Guide] Resolver found: ${restaurantInfo.name} at ${restaurantInfo.address}`);
    } else {
      console.warn(`⚠️ [Guide] Resolver found nothing for "${restaurantName}" — using input name`);
      restaurantInfo = { name: restaurantName, address: `Near ${zipCode}` };
    }

    // ── Step 2: Restaurant Intelligence Engine ────────────────────────────────
    // The engine resolves the restaurant name to verified menu items.
    // If the engine returns "unavailable" we return that state to the client.
    // We NEVER fall back to menu invention on an "unavailable" result.
    const engineResult = await restaurantEngine.resolve({
      restaurantName,
      dietaryRestrictions: effectiveDiet,
      allergies: effectiveAllergies,
    });

    if (engineResult.status === "unavailable") {
      console.log(
        `ℹ️ [Guide] Engine: unavailable for "${restaurantName}" (reason: ${engineResult.reason}). ` +
        `Returning unavailable state — no menu invention.`
      );
      return res.json({
        status: "unavailable",
        reason: engineResult.reason,
        alternatives: engineResult.alternatives,
        restaurantInfo,
        restaurantName: restaurantInfo.name,
        craving,
        generatedAt: new Date().toISOString(),
      });
    }

    // Engine returned ok — we have verified menu items
    const { identity, items, source, menuLastVerifiedAt } = engineResult;
    console.log(
      `✅ [Guide] Engine resolved ${items.length} items for "${identity.displayName}" via source="${source}"`
    );

    // ── Step 3: Nutrition context (protocol + active builder) ─────────────────
    const guideContext = await getActiveNutritionContext(userId);
    console.log(
      `🔒 [Guide] Nutrition context: diet=[${guideContext.diet.join(",")}] ` +
      `medical=[${guideContext.medical.length} flags] builder=${guideContext.builder ?? "none"}`
    );

    // ── Step 4: AI reasons over verified items — no invention ──────────────────
    const aiUser = bodyDiet.length > 0
      ? { ...(user || {}), dietaryRestrictions: effectiveDiet } as any
      : user;

    const recommendations = await generateMenuItemRecommendations({
      restaurantName,
      restaurantIdentity: identity,
      restaurantInfo,
      menuItems: items,
      menuSource: source,
      menuLastVerifiedAt,
      craving,
      user: aiUser,
      protocolBlock: guideContext.combinedBlock,
      protocolEnvelope: guideContext.envelope,
      builderBlock: guideContext.builderBlock || undefined,
    });

    const generationTime = Date.now() - generationStart;
    console.log(`✅ [Guide] ${recommendations.length} recommendations in ${generationTime}ms`);

    // ── Respond immediately — do not block on DB save ──────────────────────────
    res.json({
      status: "ok",
      recommendations,
      restaurantInfo,
      restaurantName: restaurantInfo.name,
      craving,
      cuisine: detectedCuisine,
      menuSource: source,
      menuLastVerifiedAt,
      generatedAt: new Date().toISOString(),
      generationTime,
    });

    // ── Fire-and-forget: persist session ───────────────────────────────────────
    if (recommendations.length > 0) {
      (async () => {
        try {
          await db.insert(restaurantGuideSessions).values({
            userId: String(userId),
            restaurantName: restaurantInfo.name,
            restaurantInfo: restaurantInfo as any,
            craving: craving || null,
            cuisine: detectedCuisine,
            zipCode: zipCode || null,
            meals: recommendations as any,
          });
          console.log(`💾 [Guide] Session saved (${recommendations.length} recs, source=${source})`);
        } catch (saveErr) {
          console.error(`⚠️ [Guide] Failed to persist session:`, saveErr);
        }
      })();
    }

  } catch (error) {
    console.error("[Guide] Error:", error);
    return res.status(500).json({ 
      error: "Failed to generate restaurant recommendations",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Fetch the most recent restaurant guide session for the authenticated user
router.get("/latest-session", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const [session] = await db
      .select()
      .from(restaurantGuideSessions)
      .where(eq(restaurantGuideSessions.userId, userId))
      .orderBy(desc(restaurantGuideSessions.generatedAt))
      .limit(1);
    return res.json({ session: session ?? null });
  } catch (error) {
    console.error("[Guide] Failed to fetch latest session:", error);
    return res.json({ session: null });
  }
});

// ⛔ REMOVED: /analyze-menu — this endpoint invented plausible menu items for named restaurants.
// The Restaurant Intelligence Engine (/api/restaurants/guide) replaced it. No frontend code
// calls this endpoint. It is not mounted. Do not restore without engine integration.

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
// Body: { zipCode, diet }
router.post("/find-nearby", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { zipCode, diet } = req.body;

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

    // Load cuisine preference from authenticated user profile
    let cuisinePreference: string | null = null;
    try {
      const [foundUser] = await db.select({ cuisinePreference: users.cuisinePreference }).from(users).where(eq(users.id, userId)).limit(1);
      if (foundUser?.cuisinePreference) cuisinePreference = foundUser.cuisinePreference;
    } catch {}

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

    const CERT_REQUIRED_DIETS = ["kosher", "halal"];
    const isCertDiet = CERT_REQUIRED_DIETS.includes(dietStr);

    // Build primary diet query
    const primaryQuery = buildDietQuery(dietStr, false);

    // Run diet query + optional cuisine-biased query in parallel
    const queryPromises: Promise<any[]>[] = [searchPlaces(primaryQuery)];
    if (cuisinePreference && !isCertDiet) {
      const cuisineLabel = cuisinePreference.charAt(0).toUpperCase() + cuisinePreference.slice(1);
      const cuisineQuery = dietStr === "general"
        ? `${cuisineLabel} restaurants`
        : `${cuisineLabel} restaurants with ${dietStr} options`;
      console.log(`🍜 [find-nearby] Cuisine preference query: "${cuisineQuery}"`);
      queryPromises.push(searchPlaces(cuisineQuery));
    }

    const queryResults = await Promise.all(queryPromises);
    let places: any[] = [];
    const seenIds = new Set<string>();
    for (const batch of queryResults) {
      for (const p of batch) {
        if (!seenIds.has(p.place_id)) {
          places.push(p);
          seenIds.add(p.place_id);
        }
      }
    }

    if (places.length < 3 && !isCertDiet) {
      const fallbackPlaces = await searchPlaces(buildDietQuery(dietStr, true));
      for (const p of fallbackPlaces) {
        if (!seenIds.has(p.place_id)) {
          places.push(p);
          seenIds.add(p.place_id);
        }
        if (places.length >= 20) break;
      }
    }

    const scored = scoreRestaurantsForDiet(places.slice(0, 20), dietStr);

    const visible = scored.filter((r) => r.tier !== "BLOCKED");
    const highMatch = visible.filter((r) => r.tier === "HIGH_MATCH").sort((a, b) => b.score - a.score);
    const adaptable = isCertDiet
      ? []
      : visible.filter((r) => r.tier === "ADAPTABLE").sort((a, b) => b.score - a.score);

    console.log(
      `✅ [find-nearby] diet=${dietStr} cuisine=${cuisinePreference ?? "any"} zip=${zipCode} total=${places.length} high=${highMatch.length} adaptable=${adaptable.length} blocked=${scored.length - visible.length}`
    );

    if (isCertDiet && highMatch.length === 0) {
      const dietLabel = dietStr.charAt(0).toUpperCase() + dietStr.slice(1);
      return res.json({
        diet: dietStr,
        zipCode,
        highMatch: [],
        adaptable: [],
        totalScored: scored.length,
        noResultsMessage: `No ${dietLabel}-certified restaurants found in your area.`,
        generatedAt: new Date().toISOString(),
      });
    }

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
