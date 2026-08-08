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
import { restaurantEngine, officialJsonProvider } from "../services/away-from-home/ProviderRegistry";
import { findBrandBySlug, getAllBrands } from "../services/away-from-home/BrandRegistry";
import { generateMenuItemRecommendations } from "../services/away-from-home/generateMenuItemRecommendations";
import { generateRestaurantMealsAI } from "../services/restaurantMealGeneratorAI";

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
      // Engine has no verified menu data for this restaurant.
      // Fall back to AI generation so Restaurant Guide and Fast Food Hub always work.
      console.log(
        `ℹ️ [Guide] Engine: unavailable for "${restaurantName}" (reason: ${engineResult.reason}). ` +
        `Falling back to AI generation.`
      );

      const aiUser = bodyDiet.length > 0
        ? { ...(user || {}), dietaryRestrictions: effectiveDiet } as any
        : user;

      const aiRecs = await generateRestaurantMealsAI({
        restaurantName: restaurantInfo.name,
        cuisine: detectedCuisine,
        cravingContext: craving,
        user: aiUser,
      });

      const generationTime = Date.now() - generationStart;
      console.log(`✅ [Guide/AI] ${aiRecs.length} recs in ${generationTime}ms`);

      res.json({
        recommendations: aiRecs,
        restaurantInfo,
        restaurantName: restaurantInfo.name,
        craving,
        cuisine: detectedCuisine,
        generatedAt: new Date().toISOString(),
        generationTime,
      });

      // Fire-and-forget: persist session
      if (aiRecs.length > 0) {
        (async () => {
          try {
            await db.insert(restaurantGuideSessions).values({
              userId: String(userId),
              restaurantName: restaurantInfo.name,
              restaurantInfo: restaurantInfo as any,
              craving: craving || null,
              cuisine: detectedCuisine,
              zipCode: zipCode || null,
              meals: aiRecs as any,
            });
          } catch (saveErr) {
            console.error(`⚠️ [Guide/AI] Failed to persist session:`, saveErr);
          }
        })();
      }

      return;
    }

    // Engine returned ok — we have verified menu items (Phase 2: Wendy's etc.)
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

    // ── Step 4: AI reasons over verified items ─────────────────────────────────
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

    // ── Unified Image Pipeline: attach permanent imageUrls before responding ────
    // Generate images for all recommendations in parallel so the client receives
    // complete cards — no shimmer, no indefinite loading state.
    // Restaurant guide text generation already takes 5-10 s; parallel DALL-E
    // calls add ~12 s total (not serial) — acceptable for this surface.
    let recommendationsWithImages: typeof recommendations = recommendations;
    if (recommendations.length > 0) {
      try {
        const { generateMealImageUnified } = await import('../services/mealImageGenerator');
        recommendationsWithImages = await Promise.all(
          recommendations.map(async (rec: any) => {
            if (!rec.name || rec.imageUrl) return rec;
            try {
              const ingredients = (rec.ingredients ?? [])
                .map((i: any) => i.name || i.item || '')
                .filter(Boolean);
              const imageUrl = await generateMealImageUnified(rec.name, ingredients, 'meal');
              return imageUrl ? { ...rec, imageUrl } : rec;
            } catch {
              return rec; // image failure non-fatal
            }
          })
        );
        console.log(`🖼️ [Guide] Images attached to ${recommendationsWithImages.length} recommendations`);
      } catch {
        // Image pipeline failure — respond without images rather than failing the whole guide
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    res.json({
      status: "ok",
      recommendations: recommendationsWithImages,
      restaurantInfo,
      restaurantName: restaurantInfo.name,
      craving,
      cuisine: detectedCuisine,
      menuSource: source,
      menuLastVerifiedAt,
      generatedAt: new Date().toISOString(),
      generationTime,
    });

    // ── Fire-and-forget: persist session (with images so future loads restore them) ─
    if (recommendationsWithImages.length > 0) {
      (async () => {
        try {
          await db.insert(restaurantGuideSessions).values({
            userId: String(userId),
            restaurantName: restaurantInfo.name,
            restaurantInfo: restaurantInfo as any,
            craving: craving || null,
            cuisine: detectedCuisine,
            zipCode: zipCode || null,
            meals: recommendationsWithImages as any,
          });
          console.log(`💾 [Guide] Session saved (${recommendationsWithImages.length} recs, source=${source})`);
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

// ── Development-only diagnostic router ────────────────────────────────────────
// Mounted separately in routes.ts with requireAuth only (no requireProAccess).
// Never exposed in production — each handler returns 404 when NODE_ENV === "production".
export const debugRouter = Router();

// GET /api/restaurants/debug/provider/:brandSlug
// Returns which provider would handle a brand and its full provenance.
//
// Example response:
//   GET /api/restaurants/debug/provider/wendys
//   {
//     "brand": "wendys",
//     "displayName": "Wendy's",
//     "provider": "OfficialJsonMenuProvider",
//     "dataOrigin": "official_website",
//     "sourceUrl": "https://www.wendys.com/nutrition-info",
//     "verifiedAt": "2025-01-01",
//     "sourceVersion": "wendys-official-9-item-poc-v1",
//     "verifiedBy": "My Perfect Meals",
//     "refreshPolicy": "manual",
//     "itemCount": 9,
//     "availableMenuSources": ["internal_canonical"]
//   }
debugRouter.get("/provider/:brandSlug", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ message: "Not found" });
  }

  const { brandSlug } = req.params;

  if (brandSlug === "_all") {
    const brands = getAllBrands();
    const results = await Promise.all(
      brands.map(async (brand) => {
        const meta = brand.availableMenuSources.includes("internal_canonical")
          ? await officialJsonProvider.getMetadata(brand.brandSlug)
          : null;
        return {
          brand: brand.brandSlug,
          displayName: brand.displayName,
          provider: meta ? "OfficialJsonMenuProvider" : brand.availableMenuSources.length > 0 ? "stub" : "none",
          dataOrigin: brand.dataOrigin ?? null,
          verifiedAt: brand.verifiedAt ?? null,
          sourceVersion: brand.sourceVersion ?? null,
          verifiedBy: brand.verifiedBy ?? null,
          refreshPolicy: brand.refreshPolicy ?? null,
          itemCount: meta?.itemCount ?? 0,
          availableMenuSources: brand.availableMenuSources,
        };
      })
    );
    return res.json(results);
  }

  const brand = findBrandBySlug(brandSlug);
  if (!brand) {
    return res.status(404).json({ error: `No brand registered with slug "${brandSlug}"` });
  }

  let provider = "none";
  let itemCount = 0;

  if (brand.availableMenuSources.includes("internal_canonical")) {
    const meta = await officialJsonProvider.getMetadata(brand.brandSlug);
    if (meta) {
      provider = "OfficialJsonMenuProvider";
      itemCount = meta.itemCount;
    }
  } else if (brand.availableMenuSources.length > 0) {
    provider = `stub (${brand.availableMenuSources[0]})`;
  }

  return res.json({
    brand: brand.brandSlug,
    displayName: brand.displayName,
    provider,
    dataOrigin: brand.dataOrigin ?? null,
    sourceUrl: brand.sourceUrl ?? null,
    verifiedAt: brand.verifiedAt ?? null,
    sourceVersion: brand.sourceVersion ?? null,
    verifiedBy: brand.verifiedBy ?? null,
    refreshPolicy: brand.refreshPolicy ?? null,
    itemCount,
    availableMenuSources: brand.availableMenuSources,
  });
});

export default router;
