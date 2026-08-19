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
import { resolveDailyNutritionState } from '../services/nutritionStateService';
import { buildRemainingMacrosBlock } from '../services/restaurantMealGeneratorAI';
import { resolveGLP1GlobalContext, buildGLP1RecommendationBlock } from '../services/glp1/resolveGLP1GlobalContext';

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

    // ── Resolve GLP-1 context FIRST — outside all catch-and-continue blocks ──
    // A resolver failure must return 503 and never fall through to unguarded
    // restaurant recommendations. Resolving inside the nutrition-context try/catch
    // would let a nutrition-load failure silently skip GLP-1 enforcement.
    const todayISO = new Date().toISOString().slice(0, 10);
    let mealFinderGlp1Ctx: Awaited<ReturnType<typeof resolveGLP1GlobalContext>> | null = null;
    if (userId) {
      mealFinderGlp1Ctx = await resolveGLP1GlobalContext(userId, todayISO).catch(() => null);
      if (mealFinderGlp1Ctx === null) {
        return res.status(503).json({ error: "Clinical guidance temporarily unavailable. Please try again.", retryable: true });
      }
      if (mealFinderGlp1Ctx.isActive && !mealFinderGlp1Ctx.resolvedTargets) {
        return res.status(503).json({ error: "GLP-1 clinical targets temporarily unavailable. Please try again.", retryable: true });
      }
    }

    // ── Load unified nutrition context (protocol + active builder) ─────────
    let protocolBlock: string | undefined;
    let builderBlock: string | undefined;
    let remainingMacrosBlock: string | undefined;
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

        // Load remaining macros (non-fatal — omitted on error)
        try {
          const [dailyState] = await Promise.all([
            resolveDailyNutritionState(userId, todayISO).catch(() => null),
          ]);
          if (dailyState) remainingMacrosBlock = buildRemainingMacrosBlock(dailyState.remaining);
          // Combine GLP-1 recommendation block with existing protocol block
          const glp1Block = mealFinderGlp1Ctx ? buildGLP1RecommendationBlock(mealFinderGlp1Ctx) : "";
          if (glp1Block) {
            protocolBlock = [protocolBlock, glp1Block].filter(Boolean).join("\n\n");
          }
        } catch {
          // Non-fatal — remaining macros block simply omitted
        }
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
      remainingMacrosBlock,
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

    // ── GLP-1 post-gen meal filtering ──────────────────────────────────────────
    // Filter any meal whose estimated fat or calorie value exceeds the patient-
    // specific ceiling so non-compliant restaurant meals never reach a GLP-1 patient.
    let glpFilteredResults = results;
    if (mealFinderGlp1Ctx?.isActive && mealFinderGlp1Ctx.resolvedTargets) {
      const t = mealFinderGlp1Ctx.resolvedTargets;
      glpFilteredResults = results.filter((r: any) => {
        const fat = Number(r.meal?.fatGrams ?? r.meal?.fat);
        const cal = Number(r.meal?.calories);
        if (Number.isFinite(fat) && fat > t.maximumToleratedFatGrams) {
          console.warn(`[MEAL-FINDER/GLP-1] Filtered "${r.meal?.name}" — fat ${fat}g > ceiling ${t.maximumToleratedFatGrams}g`);
          return false;
        }
        if (Number.isFinite(cal) && cal > t.resolvedMealCalories * 1.25) {
          console.warn(`[MEAL-FINDER/GLP-1] Filtered "${r.meal?.name}" — cal ${cal} > ceiling ${Math.round(t.resolvedMealCalories * 1.25)}`);
          return false;
        }
        return true;
      });
      if (glpFilteredResults.length < results.length) {
        console.log(`[MEAL-FINDER/GLP-1] Filtered ${results.length - glpFilteredResults.length} non-compliant meals`);
      }
    }

    // Image generation is deliberately client-owned and asynchronous. Returning
    // recommendation data now lets every card render its own shimmer immediately;
    // the client enriches each card independently through /api/meals/generate-image
    // after this response is sent.

    return res.status(200).json({
      success: true,
      query: mealQuery,
      zipCode,
      results: glpFilteredResults,
      count: glpFilteredResults.length,
      ...(glpFilteredResults.length === 0 && {
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
