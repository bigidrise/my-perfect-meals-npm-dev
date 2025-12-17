// Meal Finder API Routes
// Endpoint: POST /api/meal-finder
// Finds nearby restaurants based on meal craving + location (coords or ZIP)

import express from 'express';
import { findMealsNearby } from '../services/mealFinderService';

const router = express.Router();

/**
 * POST /api/meal-finder
 * Body: { mealQuery: string, zipCode?: string, lat?: number, lng?: number }
 * Returns: Array of restaurant + meal recommendations
 * Accepts either lat/lng coordinates OR zipCode for location
 */
router.post('/meal-finder', async (req, res) => {
  try {
    const { mealQuery, zipCode, lat, lng } = req.body;
    
    // Validate request
    if (!mealQuery || typeof mealQuery !== 'string') {
      return res.status(400).json({ 
        error: 'mealQuery is required and must be a string' 
      });
    }
    
    // Accept either lat/lng OR zipCode
    const hasCoords = typeof lat === 'number' && typeof lng === 'number';
    const hasZip = zipCode && typeof zipCode === 'string' && /^\d{5}$/.test(zipCode);
    
    if (!hasCoords && !hasZip) {
      return res.status(400).json({ 
        error: 'Either coordinates (lat/lng) or a valid 5-digit ZIP code is required' 
      });
    }
    
    const locationDesc = hasCoords ? `(${lat.toFixed(4)}, ${lng.toFixed(4)})` : `ZIP ${zipCode}`;
    console.log(`📍 Meal Finder request: "${mealQuery}" near ${locationDesc}`);
    
    // Get user from session (if available)
    const user = (req as any).user;
    
    // Find meals
    const results = await findMealsNearby({
      mealQuery,
      zipCode: hasZip ? zipCode : undefined,
      lat: hasCoords ? lat : undefined,
      lng: hasCoords ? lng : undefined,
      user
    });
    
    if (results.length === 0) {
      return res.status(404).json({
        error: 'No restaurants found',
        message: `Could not find restaurants serving "${mealQuery}" near ${hasCoords ? 'your location' : 'ZIP ' + zipCode}. Try a different search.`
      });
    }
    
    return res.json({
      success: true,
      query: mealQuery,
      location: hasCoords ? { lat, lng } : { zipCode },
      results
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
