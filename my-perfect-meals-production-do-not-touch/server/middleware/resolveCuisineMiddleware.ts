// Cuisine resolution middleware
// Enriches restaurant requests with real cuisine data from Google Places API
import { Request, Response, NextFunction } from 'express';
import { resolveCuisine } from '../services/googlePlacesService';

/**
 * Middleware to resolve and enrich cuisine type for restaurant requests
 * 
 * This middleware runs BEFORE the locked restaurant routes and enriches
 * req.body.cuisine with real Google Places API data. If the API fails,
 * it falls back gracefully to the original cuisine value.
 * 
 * This approach allows us to enhance the system without modifying locked files.
 */
export async function resolveCuisineMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Only process if this is a restaurant analyze request
    if (req.path !== '/analyze-menu' || req.method !== 'POST') {
      return next();
    }

    const { restaurantName, cuisine } = req.body;

    // If no restaurant name provided, skip enrichment
    if (!restaurantName) {
      return next();
    }

    // If cuisine is already specific (not "American" or generic), skip enrichment
    // This allows manual overrides to work
    const genericCuisines = ['american', 'restaurant', 'food', 'dining'];
    const isGeneric = genericCuisines.includes((cuisine || '').toLowerCase().trim());

    if (!isGeneric && cuisine) {
      console.log(`ℹ️ Skipping Google Places lookup - specific cuisine already provided: ${cuisine}`);
      return next();
    }

    // Resolve cuisine using Google Places API
    console.log(`🔍 Middleware: Resolving cuisine for ${restaurantName}`);
    const resolvedCuisine = await resolveCuisine(restaurantName, cuisine || 'American');

    // Enrich the request body with resolved cuisine
    req.body.cuisine = resolvedCuisine;
    console.log(`✅ Middleware: Enriched cuisine for ${restaurantName} → ${resolvedCuisine}`);

    next();
  } catch (error) {
    // If middleware fails, log error but continue with original cuisine
    console.error('❌ Cuisine resolution middleware error:', error);
    next();
  }
}
