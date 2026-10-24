// server/routes/mealImages.ts  
// API endpoints for meal image generation

import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { createApiRateLimit } from '../middleware/rateLimit';
import { generateMealImage, generateMealImages, getCachedImage, getImageCacheStats } from '../services/mealImageGenerator';
import { getMealImageRecoveryStatus } from '../services/mealImageRecovery';
import { isVerifiedPhotograph } from "../../shared/imageResult";
import { serializeGeneratedMealPhotograph } from "../services/developmentMealImageUrls";

const imageRateLimit = createApiRateLimit();

export const mealImagesRouter = Router();

// Keep the route contract, but fail closed even for stale clients or forged
// approval fields. Future controlled repair must be a server-owned workflow.
mealImagesRouter.post('/meal-images/recover', requireAuth, (_req, res) => {
  return res.status(403).json({
    accepted: false,
    reason: "Saved image recovery requires separately approved controlled repair",
    code: "CONTROLLED_IMAGE_REPAIR_REQUIRED",
  });
});

mealImagesRouter.get('/meal-images/recover/:recoveryId', requireAuth, async (req, res) => {
  const status = await getMealImageRecoveryStatus(req.params.recoveryId, req.authUser!.id);
  if (!status) return res.status(404).json({ error: "Image recovery was not found" });
  return res.json(status);
});

// Generate single meal image
mealImagesRouter.post('/meal-images/generate', requireAuth, imageRateLimit, async (req, res) => {
  try {
    const { mealName, ingredients, style, templateRef, mealType } = req.body;
    
    if (!mealName || !Array.isArray(ingredients)) {
      return res.status(400).json({ 
        error: 'mealName (string) and ingredients (array) are required' 
      });
    }
    
    const result = serializeGeneratedMealPhotograph(await generateMealImage({
      mealName,
      ingredients,
      style,
      templateRef,
      mealType // 🍎 Pass mealType to enable snack firewall
    }));
    
    res.json({ 
      success: isVerifiedPhotograph(result.imageResult),
      image: result
    });
    
  } catch (error: any) {
    console.error('Image generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate image',
      details: error.message 
    });
  }
});

// Batch generate images for meal plan
mealImagesRouter.post('/meal-images/generate-batch', requireAuth, imageRateLimit, async (req, res) => {
  try {
    const { meals } = req.body;
    
    if (!Array.isArray(meals)) {
      return res.status(400).json({ 
        error: 'meals array is required' 
      });
    }
    
    const requests = meals.map(meal => ({
      mealName: meal.name || meal.title,
      ingredients: meal.ingredients?.map((ing: any) => ing.name) || [],
      style: meal.style || 'overhead',
      templateRef: meal.id || meal.slug,
      mealType: meal.mealType // 🍎 Pass mealType to enable snack firewall
    }));
    
    const results = (await generateMealImages(requests)).map(result => serializeGeneratedMealPhotograph(result));
    
    res.json({ 
      success: results.every(result => isVerifiedPhotograph(result.imageResult)),
      images: results,
      count: results.length
    });
    
  } catch (error: any) {
    console.error('Batch image generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate images',
      details: error.message 
    });
  }
});

// Get cached image if available
mealImagesRouter.post('/meal-images/cached', requireAuth, imageRateLimit, (req, res) => {
  try {
    const { mealName, ingredients, style, mealType } = req.body;
    
    if (!mealName || !Array.isArray(ingredients)) {
      return res.status(400).json({ 
        error: 'mealName (string) and ingredients (array) are required' 
      });
    }
    
    const rawCached = getCachedImage({ mealName, ingredients, style, mealType });
    const cached = rawCached ? serializeGeneratedMealPhotograph(rawCached) : null;
    
    if (cached) {
      res.json({ 
        success: cached === rawCached || isVerifiedPhotograph(cached.imageResult),
        image: cached,
        cached: true
      });
    } else {
      res.json({ 
        success: false,
        message: 'No cached image found',
        cached: false
      });
    }
    
  } catch (error: any) {
    console.error('Cache lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to check cache',
      details: error.message 
    });
  }
});

// Get cache statistics (dev/debug endpoint)
mealImagesRouter.get('/meal-images/cache-stats', requireAuth, (req, res) => {
  try {
    const stats = getImageCacheStats();
    res.json({
      success: true,
      ...stats
    });
  } catch (error: any) {
    console.error('Cache stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get cache stats',
      details: error.message 
    });
  }
});

// Enhanced meal hydration with optional image generation
mealImagesRouter.post('/meal-images/hydrate-with-image', requireAuth, imageRateLimit, async (req, res) => {
  try {
    const { meal, generateImage = false } = req.body;
    
    if (!meal || !Array.isArray(meal.ingredients)) {
      return res.status(400).json({ 
        error: 'meal with ingredients[] required' 
      });
    }
    
    // Use existing hydration logic
    const { hydrateMeal } = await import('../services/mealInstructionResolver');
    const { validateAndFixMeal } = await import('../services/mealValidation');
    
    const { meal: validated } = validateAndFixMeal(meal);
    
    let imageUrl = (validated as any).imageUrl;
    
    // Generate image if requested and not already present
    if (generateImage && !imageUrl) {
      try {
        const imageResult = await generateMealImage({
          mealName: validated.title,
          ingredients: validated.ingredients.map((ing: any) => ing.name),
          style: 'overhead',
          templateRef: validated.id,
          mealType: (validated as any).mealType // 🍎 Pass mealType to enable snack firewall
        });
        
        const serialized = serializeGeneratedMealPhotograph(imageResult);
        imageUrl = serialized.url;
        // Recipe success and image success are independent.
        (validated as any).imageResult = serialized.imageResult;
      } catch (error) {
        console.warn('Image generation failed, using fallback:', error);
      }
    }
    
    res.json({
      success: true,
      meal: {
        ...validated,
        imageUrl
      } as any
    });
    
  } catch (error: any) {
    console.error('Hydrate with image error:', error);
    res.status(500).json({ 
      error: 'Failed to hydrate meal with image',
      details: error.message 
    });
  }
});