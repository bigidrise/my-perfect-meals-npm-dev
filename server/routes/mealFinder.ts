// Meal Finder API Routes
// Endpoint: POST /api/meal-finder
// Finds nearby restaurants based on meal craving + ZIP code

import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { findMealsNearby } from '../services/mealFinderService';
import { getActiveNutritionContext } from '../services/nutritionContext/getActiveNutritionContext';
import { loadUserProtocolEnvelope } from '../services/protocolEnvelope';

const router = express.Router();

/**
 * POST /api/meal-finder
 * Body: { mealQuery: string, zipCode: string }
 * Returns: Array of restaurant + meal recommendations
 */
router.post('/meal-finder', async (req, res) => {
  try {
    const { mealQuery, zipCode, dietaryRestrictions, priceRange } = req.body;
    
    // Validate request
    if (!mealQuery || typeof mealQuery !== 'string') {
      return res.status(400).json({ 
        error: 'mealQuery is required and must be a string' 
      });
    }
    
    if (!zipCode || typeof zipCode !== 'string') {
      return res.status(400).json({ 
        error: 'zipCode is required and must be a string' 
      });
    }
    
    // Validate ZIP code format (5 digits)
    if (!/^\d{5}$/.test(zipCode)) {
      return res.status(400).json({ 
        error: 'zipCode must be a valid 5-digit US ZIP code' 
      });
    }
    
    console.log(`📍 Meal Finder request: "${mealQuery}" near ZIP ${zipCode}`);
    
    // ── Resolve userId from auth token header ──────────────────────────────
    let userId: string | undefined;
    const authToken = req.headers['x-auth-token'] as string | undefined;
    if (authToken) {
      try {
        const [tokenUser] = await db.select({ id: users.id }).from(users).where(eq(users.authToken, authToken)).limit(1);
        if (tokenUser) userId = tokenUser.id;
      } catch {}
    }
    // Fallback: session/req.user
    if (!userId) {
      const reqUser = (req as any).authUser || (req as any).user;
      if (reqUser?.id && reqUser.id !== 'mock-user-id') userId = reqUser.id;
    }

    // ── Load unified nutrition context (protocol + active builder) ─────────
    let protocolBlock: string | undefined;
    let builderBlock: string | undefined;
    let contextUser: any = (req as any).user;
    let protocolEnvelope: import('../services/protocolEnvelope').UserProtocolEnvelope | undefined;
    if (userId) {
      try {
        const nutritionContext = await getActiveNutritionContext(userId);
        protocolBlock = nutritionContext.combinedBlock || undefined;
        builderBlock = nutritionContext.builderBlock || undefined;
        // Use DB user object for full health conditions / dietary data
        const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (dbUser) contextUser = dbUser;
        // Load the full envelope — required for post-generation medical validation
        // (diabetic ingredient blocking, protocol post-scan, oncology/renal/cardiac rules).
        // getActiveNutritionContext only returns text blocks; we need the structured object.
        const envelope = await loadUserProtocolEnvelope(userId);
        if (envelope) protocolEnvelope = envelope;
        console.log(`🔒 [MEAL-FINDER] Nutrition context: diet=[${nutritionContext.diet.join(",")}] medical=[${nutritionContext.medical.length} flags] builder=${nutritionContext.builder ?? "none"} envelope=${protocolEnvelope ? "✓" : "✗"} hasDiabetes=${protocolEnvelope?.hasDiabetes ?? false}`);
      } catch (err) {
        console.warn('[MEAL-FINDER] Could not load nutrition context:', err);
      }
    }
    
    const bodyDietRestrictions = dietaryRestrictions
      ? (Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [dietaryRestrictions]).filter(Boolean)
      : [];

    // Find meals — pass cuisine preference from the DB user profile so the
    // restaurant search query is biased toward the user's preferred cuisine type
    const rawResults = await findMealsNearby({
      mealQuery,
      zipCode,
      user: contextUser,
      dietaryRestrictions: bodyDietRestrictions.length > 0 ? bodyDietRestrictions : undefined,
      priceRange: Array.isArray(priceRange) && priceRange.length > 0 ? priceRange : undefined,
      protocolBlock,
      builderBlock,
      cuisinePreference: contextUser?.cuisinePreference ?? null,
      protocolEnvelope,
    });

    // Hard cap: 3 restaurants max, 2 meals each (6 total)
    // This enforces the limit regardless of what the service returns.
    const seenRestaurants = new Set<string>();
    const mealCountByRestaurant = new Map<string, number>();
    const results = rawResults.filter((r) => {
      const name = r.restaurantName;
      const count = mealCountByRestaurant.get(name) ?? 0;
      if (seenRestaurants.size >= 3 && !seenRestaurants.has(name)) return false;
      if (count >= 2) return false;
      seenRestaurants.add(name);
      mealCountByRestaurant.set(name, count + 1);
      return true;
    });
    console.log(`✅ [ROUTE CAP] ${rawResults.length} raw → ${results.length} capped (${seenRestaurants.size} restaurants)`);

    // ── Unified Image Pipeline: attach permanent imageUrls to all meals ──────
    // Meals from findMealsNearby don't carry imageUrls — generate them server-side
    // so clients receive complete cards immediately (no shimmer, no second fetch).
    let resultsWithImages = results;
    if (results.length > 0) {
      try {
        const { generateMealImageUnified: _mfGenImg } = await import('../services/mealImageGenerator');
        resultsWithImages = await Promise.all(
          results.map(async (r: any) => {
            if (!r.meal?.name || r.meal.imageUrl) return r; // skip if already has image
            try {
              const ingredients = (r.meal.ingredients || [])
                .map((i: any) => i.name || i.item || '')
                .filter(Boolean);
              const imageUrl = await _mfGenImg(r.meal.name, ingredients, 'meal');
              return { ...r, meal: { ...r.meal, imageUrl } };
            } catch {
              return r; // image failure is non-fatal
            }
          })
        );
      } catch {
        // entire image generation pass failed — return without images
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    return res.status(200).json({
      success: true,
      query: mealQuery,
      zipCode,
      results: resultsWithImages,
      count: results.length,
      ...(results.length === 0 && {
        message: `No restaurants found serving "${mealQuery}" near ZIP ${zipCode}. Try a different search or ZIP code.`
      })
    });
    
  } catch (error) {
    console.error('❌ Meal Finder error:', error);
    return res.status(500).json({ 
      error: 'Failed to find meals',
      message: 'An error occurred while searching for meals. Please try again.'
    });
  }
});

export default router;
