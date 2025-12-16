// server/routes/mealImages.ts  
// API endpoints for meal image generation

import { Router } from 'express';
import { generateMealImage, generateMealImages, getCachedImage, getImageCacheStats } from '../services/mealImageGenerator';

export const mealImagesRouter = Router();

// Generate single meal image
mealImagesRouter.post('/meal-images/generate', async (req, res) => {
  try {
    const { mealName, ingredients, style, templateRef, mealType } = req.body;
    
    if (!mealName || !Array.isArray(ingredients)) {
      return res.status(400).json({ 
        error: 'mealName (string) and ingredients (array) are required' 
      });
    }
    
    const result = await generateMealImage({
      mealName,
      ingredients,
      style,
      templateRef,
      mealType // 🍎 Pass mealType to enable snack firewall
    });
    
    res.json({ 
      success: true,
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
mealImagesRouter.post('/meal-images/generate-batch', async (req, res) => {
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
    
    const results = await generateMealImages(requests);
    
    res.json({ 
      success: true,
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
mealImagesRouter.post('/meal-images/cached', (req, res) => {
  try {
    const { mealName, ingredients, style, mealType } = req.body;
    
    if (!mealName || !Array.isArray(ingredients)) {
      return res.status(400).json({ 
        error: 'mealName (string) and ingredients (array) are required' 
      });
    }
    
    const cached = getCachedImage({ mealName, ingredients, style, mealType });
    
    if (cached) {
      res.json({ 
        success: true,
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
mealImagesRouter.get('/meal-images/cache-stats', (req, res) => {
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
mealImagesRouter.post('/meal-images/hydrate-with-image', async (req, res) => {
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
    
    let imageUrl = validated.imageUrl;
    
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
        
        imageUrl = imageResult.url;
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