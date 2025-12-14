// 🔒 LOCKDOWN PROTECTED: DALL-E image generation system - DO NOT MODIFY
import OpenAI from 'openai';
import { buildMealImageCacheKey } from '../lib/mealImageCacheKey';
import { checkImageExists, uploadImageToPermanentStorage } from './permanentImageStorage';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// 🔒 PROTECTED: Image cache to avoid regenerating the same images
const imageCache = new Map<string, string>();

interface ImageGenerationOptions {
  name: string;
  description?: string;
  type: 'meal' | 'beverage';
  style?: string;
  ingredients?: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

// Main function used by stableMealGenerator
export async function generateRecipeImage(recipeName: string): Promise<string | null> {
  return generateImage({
    name: recipeName,
    type: 'meal',
    style: 'appetizing food photography'
  });
}

// 🔒 LOCKDOWN PROTECTED: Main image generation function - DO NOT MODIFY
export async function generateImage(options: ImageGenerationOptions): Promise<string | null> {
  try {
    // Generate deterministic hash for both in-memory and persistent cache
    const imageHash = buildMealImageCacheKey({
      name: options.name,
      ingredients: options.ingredients,
      calories: options.calories,
      protein: options.protein,
      carbs: options.carbs,
      fat: options.fat,
      description: options.description,
    });
    
    const cacheKey = `${options.type}-${imageHash}`;
  
    // 🔒 PROTECTED: Check in-memory cache first - critical for performance
    if (imageCache.has(cacheKey)) {
      console.log(`📸 Using in-memory cached image for: ${options.name}`);
      return imageCache.get(cacheKey)!;
    }

    // Check if image exists in permanent storage
    const existingImageUrl = await checkImageExists(imageHash);
    if (existingImageUrl) {
      console.log(`💾 Using persistent cached image for: ${options.name}`);
      imageCache.set(cacheKey, existingImageUrl);
      return existingImageUrl;
    }

    console.log(`🎨 Generating new image for: ${options.name}`);
    
    // Use DALL-E 3 for high-quality, authentic food images
    if (process.env.OPENAI_API_KEY) {
      const dalleUrl = await generateDalleImage(options);
      if (dalleUrl) {
        // Upload to permanent storage
        try {
          const { permanentUrl } = await uploadImageToPermanentStorage({
            imageUrl: dalleUrl,
            mealName: options.name,
            imageHash,
          });
          
          // Cache the permanent URL (not the temporary DALL-E URL)
          imageCache.set(cacheKey, permanentUrl);
          console.log(`🤖 Generated and stored DALL-E image for: ${options.name}`);
          return permanentUrl;
        } catch (uploadError) {
          console.error(`⚠️ Failed to upload to permanent storage, using temporary URL:`, uploadError);
          // Fallback to temporary DALL-E URL if upload fails
          imageCache.set(cacheKey, dalleUrl);
          return dalleUrl;
        }
      }
    } else {
      console.log(`⚠️ No OpenAI API key available for DALL-E generation`);
    }

    console.log(`⚠️ No image generated for: ${options.name}`);
    return null;
  } catch (error) {
    console.error(`❌ Image generation failed for ${options.name}:`, error);
    return null;
  }
}

async function generateDalleImage(options: ImageGenerationOptions): Promise<string | null> {
  try {
    const prompt = createImagePrompt(options);
    
    const response = await getOpenAI().images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural"
    });

    return response.data?.[0]?.url || null;
  } catch (error) {
    console.error('DALL-E generation error:', error);
    return null;
  }
}

function createImagePrompt(options: ImageGenerationOptions): string {
  const { name, description, type, style } = options;
  
  if (type === 'beverage') {
    return `A professional, appetizing photo of ${name}${description ? `, ${description}` : ''}. Beautiful drink photography, elegant glassware, perfect lighting, restaurant quality presentation. High resolution, food photography style.`;
  }

  // Meal prompt
  const basePrompt = `A professional, appetizing photo of ${name}${description ? `, ${description}` : ''}. Beautiful food photography, elegant plating, perfect lighting, restaurant quality presentation.`;
  
  if (style) {
    return `${basePrompt} ${style} style cooking. High resolution, food photography.`;
  }
  
  return `${basePrompt} High resolution, food photography, appetizing and realistic.`;
}

// API endpoint for image generation
export async function handleImageGeneration(req: any, res: any) {
  try {
    const { name, description, type, style, ingredients, calories, protein, carbs, fat } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    // Generate deterministic hash for cache key (same as generateImage)
    const imageHash = buildMealImageCacheKey({
      name,
      ingredients,
      calories,
      protein,
      carbs,
      fat,
      description,
    });
    const cacheKey = `${type}-${imageHash}`;

    const imageUrl = await generateImage({ 
      name, 
      description, 
      type, 
      style,
      ingredients,
      calories,
      protein,
      carbs,
      fat,
    });
    
    if (imageUrl) {
      res.json({ imageUrl, cached: imageCache.has(cacheKey) });
    } else {
      res.status(500).json({ error: 'Failed to generate image' });
    }
  } catch (error) {
    console.error('Image generation endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Clear cache periodically to free memory
setInterval(() => {
  if (imageCache.size > 1000) {
    console.log('🧹 Clearing image cache...');
    imageCache.clear();
  }
}, 60 * 60 * 1000); // Clear every hour if cache gets too large