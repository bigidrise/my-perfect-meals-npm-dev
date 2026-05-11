// Meal Finder API Routes
// Endpoint: POST /api/meal-finder
// Finds nearby restaurants based on meal craving + ZIP code

import express from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '@shared/schema';
import { findMealsNearby } from '../services/mealFinderService';
import { getActiveNutritionContext } from '../services/nutritionContext/getActiveNutritionContext';

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
    if (userId) {
      try {
        const nutritionContext = await getActiveNutritionContext(userId);
        protocolBlock = nutritionContext.combinedBlock || undefined;
        builderBlock = nutritionContext.builderBlock || undefined;
        // Use DB user object for full health conditions / dietary data
        const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (dbUser) contextUser = dbUser;
        console.log(`🔒 [MEAL-FINDER] Nutrition context: diet=[${nutritionContext.diet.join(",")}] medical=[${nutritionContext.medical.length} flags] builder=${nutritionContext.builder ?? "none"}`);
      } catch (err) {
        console.warn('[MEAL-FINDER] Could not load nutrition context:', err);
      }
    }
    
    const bodyDietRestrictions = dietaryRestrictions
      ? (Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [dietaryRestrictions]).filter(Boolean)
      : [];

    // Find meals — pass cuisine preference from the DB user profile so the
    // restaurant search query is biased toward the user's preferred cuisine type
    const results = await findMealsNearby({
      mealQuery,
      zipCode,
      user: contextUser,
      dietaryRestrictions: bodyDietRestrictions.length > 0 ? bodyDietRestrictions : undefined,
      priceRange: Array.isArray(priceRange) && priceRange.length > 0 ? priceRange : undefined,
      protocolBlock,
      builderBlock,
      cuisinePreference: contextUser?.cuisinePreference ?? null,
    });
    
    return res.status(200).json({
      success: true,
      query: mealQuery,
      zipCode,
      results,
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
