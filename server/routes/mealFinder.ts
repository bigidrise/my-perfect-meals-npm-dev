// Meal Finder API Routes
// Endpoint: POST /api/meal-finder
// Finds nearby restaurants based on meal craving + ZIP code

import express from 'express';
import { findMealsNearby } from '../services/mealFinderService';

const router = express.Router();

/**
 * POST /api/meal-finder
 * Body: { mealQuery: string, zipCode: string }
 * Returns: Array of restaurant + meal recommendations
 */
router.post('/meal-finder', async (req, res) => {
  try {
    const { mealQuery, zipCode, dietaryRestrictions } = req.body;
    
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
    
    // Get user from session (if available)
    const user = (req as any).user;
    
    const bodyDietRestrictions = dietaryRestrictions
      ? (Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [dietaryRestrictions]).filter(Boolean)
      : [];

    // Find meals
    const results = await findMealsNearby({
      mealQuery,
      zipCode,
      user,
      dietaryRestrictions: bodyDietRestrictions.length > 0 ? bodyDietRestrictions : undefined
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
