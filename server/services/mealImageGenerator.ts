// server/services/mealImageGenerator.ts
// 4-Layer Meal Image System
//
// Layer 1: Strong structured prompt (dish-type aware)
// Layer 2: Description sanitized — only dish-type hint, never raw AI text
// Layer 3: DB persistence (meal_image_cache) — survives server restarts
// Layer 4: Semantic fallback — never shows a wrong image, never returns null
//
// CRITICAL: Snacks use STATIC images ONLY (no DALL-E calls)

import OpenAI from 'openai';
import crypto from 'crypto';
import { db } from '../db';
import { mealImageCache } from '../db/schema/mealImageCache';
import { eq } from 'drizzle-orm';
import { getStaticSnackImage, isLikelySnack } from '../../shared/staticSnackMappings';
import { ingestImageToPermanentStorage } from './imageLifecycle';
import { normalizeMealName } from './mealNameNormalizer';

// ─────────────────────────────────────────────────────────────────────────────
// URL TYPE HELPERS — enforce hard boundaries on what enters the cache
// ─────────────────────────────────────────────────────────────────────────────
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'my-perfect-meals-images';

function isS3Url(url: string): boolean {
  return url.startsWith(`https://${S3_BUCKET}.s3.`) || url.includes('amazonaws.com');
}

const TEMP_PATTERNS = ['oaidalleapiprodscus', 'blob.core.windows.net', 'openai.com'];
function isTempUrl(url: string): boolean {
  return TEMP_PATTERNS.some(p => url.includes(p));
}

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

// ─────────────────────────────────────────────────────────────────────────────
// DISH TYPE DETECTOR
// Determines the visual form of the dish from the meal name.
// ─────────────────────────────────────────────────────────────────────────────

export interface DishType {
  type: string;
  presentation: string;
  textureDescription: string;
}

export function detectDishType(name: string): DishType {
  const lower = name.toLowerCase();

  if (lower.includes("chili")) {
    return {
      type: "bowl dish",
      presentation: "deep rustic bowl filled with the dish",
      textureDescription: "thick, hearty, spoonable chili with visible protein and beans",
    };
  }
  if (lower.includes("soup") || lower.includes("bisque") || lower.includes("broth") || lower.includes("chowder")) {
    return {
      type: "bowl dish",
      presentation: "bowl filled with soup and steam rising",
      textureDescription: "hot liquid-based dish with vegetables and protein",
    };
  }
  if (lower.includes("stew") || lower.includes("ragù") || lower.includes("ragu")) {
    return {
      type: "bowl dish",
      presentation: "deep bowl filled with hearty stew",
      textureDescription: "thick, rich stew with chunks of vegetables and meat",
    };
  }
  if (lower.includes("curry")) {
    return {
      type: "bowl dish",
      presentation: "bowl of curry served with rice on the side",
      textureDescription: "rich, saucy curry with vibrant color from spices",
    };
  }
  if (lower.includes("oatmeal") || lower.includes("porridge") || lower.includes("congee")) {
    return {
      type: "bowl dish",
      presentation: "bowl of oatmeal with toppings",
      textureDescription: "creamy, thick porridge with visible toppings",
    };
  }
  if (lower.includes("stir") || lower.includes("stir-fry") || lower.includes("fried rice")) {
    return {
      type: "stir-fry",
      presentation: "plate or shallow bowl with sautéed ingredients",
      textureDescription: "sautéed ingredients with slight gloss and charred texture",
    };
  }
  if (lower.includes("salad")) {
    return {
      type: "salad",
      presentation: "wide bowl or plate with fresh layered ingredients",
      textureDescription: "fresh, vibrant, crisp vegetables and toppings",
    };
  }
  if (lower.includes("pasta") || lower.includes("noodle") || lower.includes("spaghetti") || lower.includes("linguine") || lower.includes("penne") || lower.includes("fettuccine")) {
    return {
      type: "pasta dish",
      presentation: "wide plate or bowl with pasta and sauce",
      textureDescription: "coated noodles with sauce, protein, and herbs",
    };
  }
  if (lower.includes("wrap") || lower.includes("taco") || lower.includes("burrito") || lower.includes("quesadilla")) {
    return {
      type: "handheld",
      presentation: "on a plate, sliced or folded",
      textureDescription: "filled handheld food with visible ingredients inside",
    };
  }
  if (lower.includes("sandwich") || lower.includes("sub") || lower.includes("hoagie") || lower.includes("panini")) {
    return {
      type: "sandwich",
      presentation: "on a plate, sliced in half to show filling",
      textureDescription: "stacked bread with visible fillings",
    };
  }
  if (lower.includes("burger")) {
    return {
      type: "burger",
      presentation: "on a plate or board",
      textureDescription: "stacked burger with visible layers",
    };
  }
  if (lower.includes("pizza")) {
    return {
      type: "pizza",
      presentation: "flat circular pizza on a wooden board or plate",
      textureDescription: "topped pizza with melted cheese and toppings",
    };
  }
  if (lower.includes("bowl")) {
    return {
      type: "bowl dish",
      presentation: "served in a bowl",
      textureDescription: "composed bowl with protein, grains, and vegetables",
    };
  }
  if (lower.includes("breakfast") || lower.includes("eggs") || lower.includes("omelette") || lower.includes("omelet") || lower.includes("pancake") || lower.includes("waffle")) {
    return {
      type: "breakfast plate",
      presentation: "on a plate with breakfast presentation",
      textureDescription: "morning meal with eggs, proteins, or grains",
    };
  }
  if (lower.includes("smoothie") || lower.includes("shake") || lower.includes("juice")) {
    return {
      type: "beverage",
      presentation: "in a tall glass",
      textureDescription: "blended beverage with vibrant color",
    };
  }
  if (lower.includes("grilled") || lower.includes("roasted") || lower.includes("seared")) {
    return {
      type: "plated entree",
      presentation: "plated on a clean white plate",
      textureDescription: "cooked protein or vegetables with golden, caramelized exterior",
    };
  }
  if (lower.includes("cookie") || lower.includes("cookies") || lower.includes("biscotti") || lower.includes("shortbread")) {
    return {
      type: "baked dessert",
      presentation: "freshly baked cookies arranged on a plate or cooling rack",
      textureDescription: "golden brown baked cookies with visible chips or texture, finished dessert",
    };
  }
  if (lower.includes("brownie") || lower.includes("brownies") || lower.includes("blondie") || lower.includes("blondies")) {
    return {
      type: "baked dessert",
      presentation: "cut brownie or blondie squares arranged on a plate",
      textureDescription: "fudgy, dense baked bars with a crackly top, finished dessert",
    };
  }
  if (lower.includes("muffin") || lower.includes("muffins") || lower.includes("cupcake") || lower.includes("cupcakes")) {
    return {
      type: "baked dessert",
      presentation: "freshly baked muffins or cupcakes on a plate or in a tray",
      textureDescription: "domed, golden-topped baked goods, finished and ready to eat",
    };
  }
  if (lower.includes("cake") || lower.includes("cheesecake") || lower.includes("bundt") || lower.includes("torte")) {
    return {
      type: "baked dessert",
      presentation: "sliced cake served on a plate",
      textureDescription: "layered or whole cake, finished dessert, plated and ready to serve",
    };
  }
  if (lower.includes("bread") || lower.includes("loaf") || lower.includes("banana bread")) {
    return {
      type: "baked good",
      presentation: "sliced loaf of bread on a cutting board or plate",
      textureDescription: "golden-crusted bread with a moist interior, finished baked good",
    };
  }
  if (lower.includes("scone") || lower.includes("biscuit") || lower.includes("roll")) {
    return {
      type: "baked good",
      presentation: "freshly baked scones or rolls on a plate",
      textureDescription: "golden, flaky baked goods, finished and ready to eat",
    };
  }
  if (lower.includes("pie") || lower.includes("tart") || lower.includes("cobbler") || lower.includes("crisp") || lower.includes("crumble") || lower.includes("galette")) {
    return {
      type: "baked dessert",
      presentation: "sliced or whole pie or tart served on a plate",
      textureDescription: "golden pastry crust with fruit or cream filling, finished dessert",
    };
  }
  if (lower.includes("energy bar") || lower.includes("protein bar") || lower.includes("granola bar") || lower.includes("power bar")) {
    return {
      type: "snack bar",
      presentation: "energy bars sliced and arranged on a plate or board",
      textureDescription: "dense, chewy bars with visible nuts or seeds, finished snack",
    };
  }
  if (lower.includes("pudding") || lower.includes("mousse") || lower.includes("custard") || lower.includes("flan") || lower.includes("panna cotta")) {
    return {
      type: "dessert",
      presentation: "served in a glass or bowl, garnished",
      textureDescription: "creamy, set dessert with smooth texture, finished and plated",
    };
  }
  if (lower.includes("baked")) {
    return {
      type: "baked dish",
      presentation: "plated on a clean white plate",
      textureDescription: "oven-baked dish with golden, caramelized exterior, finished and ready to eat",
    };
  }

  return {
    type: "plated meal",
    presentation: "served on a plate",
    textureDescription: "balanced, composed cooked meal, finished and ready to eat",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISH TYPE HINT
// Returns a one-line visual anchor for use in image generation calls.
// This replaces raw AI description to prevent hallucination bleed.
// ─────────────────────────────────────────────────────────────────────────────

export function buildDishTypeHint(mealName: string): string {
  const dish = detectDishType(mealName);
  return `${dish.textureDescription}, ${dish.presentation}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRONG PROMPT BUILDER
// Layer 1: Structured prompt that tells DALL-E exactly what to render.
// ─────────────────────────────────────────────────────────────────────────────

function buildMealImagePrompt(mealName: string, ingredients: string[]): string {
  const dish = detectDishType(mealName);
  const topIngredients = ingredients.slice(0, 5).join(", ");

  return `A photorealistic ${dish.presentation} of ${mealName}.
This is a finished dish, ready to eat, plated and served — ${dish.textureDescription}.
Made with ${topIngredients || "fresh whole ingredients"}.

CRITICAL: Show ONLY the finished, cooked, plated dish — NOT raw ingredients, NOT uncooked components, NOT ingredient bowls.
The dish must clearly look like ${mealName}. Do not generate any unrelated foods.

Style: cinematic, high-detail, natural lighting, realistic food photography.
Camera: 3/4 angle or overhead depending on dish type.
Background: clean, minimal, neutral surface, no clutter, no text, no logos, no people, no hands.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEMANTIC FALLBACK
// Layer 4: Category-appropriate fallback — never shows the wrong image.
// ─────────────────────────────────────────────────────────────────────────────

export function getSemanticFallback(mealName: string): string {
  const lower = mealName.toLowerCase();

  if (lower.includes("chili") || lower.includes("stew") || lower.includes("ragù") || lower.includes("ragu")) {
    return "/images/fallback/chili-bowl.svg";
  }
  if (lower.includes("soup") || lower.includes("bisque") || lower.includes("broth") || lower.includes("chowder") || lower.includes("curry") || lower.includes("oatmeal") || lower.includes("porridge")) {
    return "/images/fallback/soup-bowl.svg";
  }
  if (lower.includes("salad")) {
    return "/images/fallback/salad.svg";
  }
  if (lower.includes("stir") || lower.includes("fried rice")) {
    return "/images/fallback/stir-fry.svg";
  }
  if (lower.includes("pasta") || lower.includes("noodle") || lower.includes("spaghetti")) {
    return "/images/fallback/pasta.svg";
  }
  if (lower.includes("breakfast") || lower.includes("eggs") || lower.includes("omelette") || lower.includes("omelet") || lower.includes("pancake")) {
    return "/images/fallback/breakfast.svg";
  }
  if (lower.includes("smoothie") || lower.includes("shake") || lower.includes("juice")) {
    return "/images/fallback/smoothie.svg";
  }
  if (lower.includes("wrap") || lower.includes("taco") || lower.includes("burrito") || lower.includes("sandwich") || lower.includes("burger")) {
    return "/images/fallback/handheld.svg";
  }

  return "/images/fallback/meal.svg";
}

// ─────────────────────────────────────────────────────────────────────────────
// STABLE CACHE KEY
// Version-tagged hash: mealName + top-5 sorted ingredients + version
// Bump "v2", "v3" etc. to invalidate all cached images after prompt changes.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_VERSION = "v2";

export function buildStableCacheKey(mealName: string, ingredients: string[]): string {
  const normalizedName = mealName.toLowerCase().trim();
  const normalizedIngredients = ingredients
    .slice(0, 5)
    .map(i => i.toLowerCase().trim())
    .sort()
    .join(",");

  return crypto
    .createHash('sha256')
    .update(`${normalizedName}|${normalizedIngredients}|${CACHE_VERSION}`)
    .digest('hex')
    .substring(0, 32);
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE (fast path, clears on restart — DB is the persistent layer)
// ─────────────────────────────────────────────────────────────────────────────

const memCache = new Map<string, string>();

// ─────────────────────────────────────────────────────────────────────────────
// DALL-E TIMEOUT HELPER
// ─────────────────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Image generation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE TYPES (kept for backward compatibility with mealImages route)
// ─────────────────────────────────────────────────────────────────────────────

export interface MealImageRequest {
  mealName: string;
  ingredients: string[];
  style?: 'overhead' | 'plated' | 'rustic' | 'restaurant';
  templateRef?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface GeneratedImage {
  url: string;
  prompt: string;
  templateRef?: string;
  hash: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN GENERATION FUNCTION — 4-Layer Pipeline
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMealImage(request: MealImageRequest): Promise<GeneratedImage> {
  // NORMALIZATION — must happen before cache key derivation and before prompt construction
  const normalizedName = normalizeMealName(request.mealName);
  const { ingredients, mealType } = request;
  const mealName = normalizedName;
  const cacheKey = buildStableCacheKey(mealName, ingredients);

  // ── SNACK FIREWALL ──────────────────────────────────────────────────────────
  const isSnackByType = mealType === 'snack';
  const isSnackByPattern = !mealType && isLikelySnack(mealName);

  if (isSnackByType || isSnackByPattern) {
    const staticImage = getStaticSnackImage(mealName);
    console.log(`🍎 SNACK FIREWALL: Static image for "${mealName}" → ${staticImage}`);
    return {
      url: staticImage,
      prompt: `Static snack image: ${mealName}`,
      templateRef: request.templateRef,
      hash: cacheKey,
      createdAt: new Date().toISOString(),
    };
  }

  // ── LAYER 3: CHECK IN-MEMORY CACHE ─────────────────────────────────────────
  const memHit = memCache.get(cacheKey);
  if (memHit) {
    console.log(`⚡ Memory cache hit for: ${mealName}`);
    return {
      url: memHit,
      prompt: "(memory cache)",
      templateRef: request.templateRef,
      hash: cacheKey,
      createdAt: new Date().toISOString(),
    };
  }

  // ── LAYER 3: CHECK DB CACHE ─────────────────────────────────────────────────
  try {
    const [dbRow] = await db
      .select({ imageUrl: mealImageCache.imageUrl, promptUsed: mealImageCache.promptUsed })
      .from(mealImageCache)
      .where(eq(mealImageCache.cacheKey, cacheKey))
      .limit(1);

    if (dbRow) {
      if (isS3Url(dbRow.imageUrl)) {
        console.log(`🗄️ DB cache hit (S3) for: ${mealName}`);
        memCache.set(cacheKey, dbRow.imageUrl);
        return {
          url: dbRow.imageUrl,
          prompt: dbRow.promptUsed || "(db cache)",
          templateRef: request.templateRef,
          hash: cacheKey,
          createdAt: new Date().toISOString(),
        };
      } else {
        console.warn(`⚠️ Stale temp URL in DB cache for "${mealName}" — deleting and regenerating`);
        try {
          await db.delete(mealImageCache).where(eq(mealImageCache.cacheKey, cacheKey));
        } catch {}
      }
    }
  } catch (dbErr) {
    console.warn(`⚠️ DB cache read failed for "${mealName}":`, dbErr);
  }

  // ── LAYER 1: BUILD STRONG PROMPT ───────────────────────────────────────────
  const prompt = buildMealImagePrompt(mealName, ingredients);

  if (process.env.NODE_ENV === "development") {
    console.log(`📝 IMAGE PROMPT for "${mealName}":\n${prompt}`);
  } else {
    console.log(`🎨 Generating image for: ${mealName}`);
  }

  // ── LAYER 1: CALL DALL-E WITH TIMEOUT ──────────────────────────────────────
  let imageUrl: string | null = null;

  try {
    const response = await withTimeout(
      getOpenAI().images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural",
      }),
      25000
    );

    imageUrl = response.data?.[0]?.url ?? null;
  } catch (dalleErr: any) {
    console.warn(`⚠️ DALL-E failed for "${mealName}": ${dalleErr.message}`);
  }

  // ── LAYER 4: FALLBACK — NEVER RETURN NULL ──────────────────────────────────
  if (!imageUrl) {
    const fallback = getSemanticFallback(mealName);
    console.log(`🛡️ Using semantic fallback for "${mealName}": ${fallback}`);
    memCache.set(cacheKey, fallback);
    return {
      url: fallback,
      prompt: `Fallback (generation failed): ${mealName}`,
      templateRef: request.templateRef,
      hash: cacheKey,
      createdAt: new Date().toISOString(),
    };
  }

  // ── LAYER 3: S3-FIRST PERSIST PIPELINE ────────────────────────────────────
  // Rule: Temp URLs NEVER enter the DB or memCache under any condition.
  // Only permanent S3 URLs are cached. If S3 fails, serve temp URL for this
  // session only and log loudly — do NOT cache anything.

  const tempUrl = imageUrl;

  // Race-condition guard: check if another request already wrote an S3 URL
  try {
    const [existing] = await db
      .select({ imageUrl: mealImageCache.imageUrl })
      .from(mealImageCache)
      .where(eq(mealImageCache.cacheKey, cacheKey))
      .limit(1);

    if (existing && isS3Url(existing.imageUrl)) {
      console.log(`✅ S3 URL already cached (race guard) for: ${mealName}`);
      memCache.set(cacheKey, existing.imageUrl);
      return {
        url: existing.imageUrl,
        prompt,
        templateRef: request.templateRef,
        hash: cacheKey,
        createdAt: new Date().toISOString(),
      };
    }
  } catch {}

  // Upload to S3 — fully awaited before any cache write
  console.log(`📦 Uploading to permanent S3 storage for: ${mealName}`);
  const ingestionResult = await ingestImageToPermanentStorage(tempUrl, mealName);

  if (ingestionResult.success && ingestionResult.permanentUrl) {
    const s3Url = ingestionResult.permanentUrl;

    // Write permanent S3 URL to DB — overwrite any stale temp row, never the reverse
    try {
      await db
        .insert(mealImageCache)
        .values({ cacheKey, imageUrl: s3Url, mealName, promptUsed: prompt })
        .onConflictDoUpdate({
          target: mealImageCache.cacheKey,
          set: { imageUrl: s3Url, mealName, promptUsed: prompt },
        });
      console.log(`✅ S3 URL cached in DB for: ${mealName}`);
    } catch (dbWriteErr) {
      console.warn(`⚠️ DB cache write failed for "${mealName}":`, dbWriteErr);
    }

    memCache.set(cacheKey, s3Url);
    return {
      url: s3Url,
      prompt,
      templateRef: request.templateRef,
      hash: cacheKey,
      createdAt: new Date().toISOString(),
    };
  }

  // S3 failed — serve temp URL for THIS REQUEST ONLY, nothing cached
  console.error(
    `🚨 S3 upload FAILED for "${mealName}" | url: ${tempUrl.substring(0, 80)}... | reason: ${ingestionResult.error ?? 'unknown'} — serving temp URL for current session only, NOT caching`
  );
  return {
    url: tempUrl,
    prompt,
    templateRef: request.templateRef,
    hash: cacheKey,
    createdAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH GENERATION
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMealImages(requests: MealImageRequest[]): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = [];
  const batchSize = 3;

  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(req =>
        generateMealImage(req).catch(err => ({
          url: getSemanticFallback(req.mealName),
          prompt: `Error: ${err.message}`,
          hash: buildStableCacheKey(req.mealName, req.ingredients),
          createdAt: new Date().toISOString(),
        }))
      )
    );
    results.push(...batchResults);
    if (i + batchSize < requests.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKWARD-COMPATIBLE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function getCachedImage(request: MealImageRequest): GeneratedImage | null {
  const cacheKey = buildStableCacheKey(request.mealName, request.ingredients);
  const url = memCache.get(cacheKey);
  if (!url) return null;
  return {
    url,
    prompt: "(memory cache)",
    templateRef: request.templateRef,
    hash: cacheKey,
    createdAt: new Date().toISOString(),
  };
}

export function clearImageCache(): void {
  memCache.clear();
  console.log('🗑️ In-memory image cache cleared');
}

export function getImageCacheStats(): { size: number; entries: string[] } {
  return {
    size: memCache.size,
    entries: Array.from(memCache.keys()),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED ENTRY POINT — every feature must go through this function.
// DO NOT call generateImage() from imageService directly.
// DO NOT pass raw AI descriptions as image prompts.
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMealImageUnified(
  mealName: string,
  ingredients: Array<string | Record<string, any>> = []
): Promise<string> {
  // DO NOT call image generation directly.
  // Use generateMealImageUnified only.

  if (!mealName || !mealName.trim()) {
    return getSemanticFallback("meal");
  }

  // NORMALIZATION — applied before cache key and prompt construction
  const normalizedName = normalizeMealName(mealName);

  const ingredientNames = ingredients
    .map(i => typeof i === "string" ? i : (i.name || i.item || ""))
    .filter(Boolean);

  const result = await generateMealImage({
    mealName: normalizedName,
    ingredients: ingredientNames,
  });

  return result.url;
}
