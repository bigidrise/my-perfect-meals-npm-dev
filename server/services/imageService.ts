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

// DEPRECATED: use generateMealImageUnified directly.
// Thin wrapper — delegates to the canonical pipeline so all generation flows
// share the same 4-layer cache (memory → DB → S3 → DALL-E). Not deleted yet;
// removal happens in a later cleanup task once smoke tests pass.
export async function generateImage(options: ImageGenerationOptions): Promise<string | null> {
  try {
    // Guard: warn when a named meal reaches generation without any ingredients.
    // Without ingredients the prompt falls back to name-driven generation, which
    // can depict ingredients the recipe never included. This log makes silent
    // unprotected generations visible so they can be investigated and fixed at
    // the call site.
    const ingredients = options.ingredients ?? [];
    if (ingredients.length === 0) {
      console.warn(
        `[img-contract] ⚠️ imageService.generateImage (deprecated wrapper) called with no ingredients — ` +
        `name-driven fallback active (no recipe contract enforced). ` +
        `name="${options.name}" type="${options.type ?? "meal"}"`
      );
    }

    const { generateMealImageUnified } = await import("./mealImageGenerator");
    const sourceType = options.type === "beverage" ? "beverage" : "meal";
    return await generateMealImageUnified(options.name, ingredients, sourceType);
  } catch (error) {
    console.error(`❌ [imageService.generateImage deprecated wrapper] failed for ${options.name}:`, error);
    return null;
  }
}

async function generateDalleImage(options: ImageGenerationOptions): Promise<string | null> {
  try {
    const prompt = createImagePrompt(options);
    
    const response = await (getOpenAI().images.generate as any)({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "low",
    });

    const item = response.data?.[0];
    if (item?.url) return item.url;
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    return null;
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