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

// ─────────────────────────────────────────────────────────────────────────────
// TERMINAL-WORD PRIORITY CLASSIFIER
// The LAST word(s) of a food name defines what it is.
// "Greenberry Power Smoothie" → last word "smoothie" → beverage (not a salad).
// This runs BEFORE the full keyword scan to avoid false collisions.
// ─────────────────────────────────────────────────────────────────────────────

function classifyByTerminalWords(lastWord: string, lastTwo: string): DishType | null {
  // Beverages — always a drink no matter what comes before
  if (['smoothie', 'shake', 'juice', 'lemonade', 'latte', 'frappe', 'coffee', 'tea', 'drink', 'beverage', 'agua', 'tonic', 'cider', 'kombucha'].includes(lastWord)) {
    return { type: "beverage", presentation: "in a tall glass", textureDescription: "blended or chilled beverage with vibrant color, finished and ready to drink" };
  }
  // Salads
  if (lastWord === 'salad' || lastTwo === 'grain salad' || lastTwo === 'kale salad' || lastTwo === 'chopped salad') {
    return { type: "salad", presentation: "wide bowl or plate with fresh layered ingredients", textureDescription: "fresh, vibrant, crisp vegetables and toppings, finished dish" };
  }
  // Soups
  if (['soup', 'bisque', 'chowder', 'broth', 'ramen', 'pho', 'gazpacho'].includes(lastWord)) {
    return { type: "bowl dish", presentation: "bowl filled with soup and steam rising", textureDescription: "hot liquid-based dish with vegetables and protein, finished dish" };
  }
  // Stews / chili / curry
  if (['stew', 'chili', 'curry', 'ragù', 'ragu'].includes(lastWord)) {
    return { type: "bowl dish", presentation: "deep rustic bowl filled with the dish", textureDescription: "thick, hearty, spoonable dish, finished and ready to eat" };
  }
  // Pasta / noodles
  if (['pasta', 'noodles', 'spaghetti', 'linguine', 'penne', 'fettuccine', 'rigatoni', 'orzo', 'udon', 'ramen'].includes(lastWord)) {
    return { type: "pasta dish", presentation: "wide plate or bowl with pasta and sauce", textureDescription: "coated noodles with sauce, protein, and herbs, finished dish" };
  }
  // Baked goods — cookies
  if (['cookies', 'cookie', 'biscotti', 'shortbread'].includes(lastWord)) {
    return { type: "baked dessert", presentation: "freshly baked cookies arranged on a plate or cooling rack", textureDescription: "golden brown baked cookies, finished dessert" };
  }
  // Baked goods — brownies / bars
  if (['brownies', 'brownie', 'blondies', 'blondie', 'bars', 'bar'].includes(lastWord)) {
    return { type: "baked dessert", presentation: "cut squares arranged on a plate", textureDescription: "fudgy baked bars, finished dessert" };
  }
  // Baked goods — muffins / cupcakes
  if (['muffins', 'muffin', 'cupcakes', 'cupcake'].includes(lastWord)) {
    return { type: "baked dessert", presentation: "freshly baked muffins on a plate", textureDescription: "domed golden-topped baked goods, finished dessert" };
  }
  // Baked goods — bread / loaf
  if (['bread', 'loaf', 'rolls', 'roll', 'baguette', 'scone', 'scones'].includes(lastWord) || lastTwo === 'banana bread' || lastTwo === 'corn bread') {
    return { type: "baked good", presentation: "sliced loaf on a cutting board or plate", textureDescription: "golden-crusted bread with moist interior, finished baked good" };
  }
  // Cake / pie / tart
  if (['cake', 'cheesecake', 'pie', 'tart', 'cobbler', 'crisp', 'crumble', 'galette', 'torte'].includes(lastWord)) {
    return { type: "baked dessert", presentation: "sliced or whole dessert served on a plate", textureDescription: "golden pastry with visible filling, finished dessert" };
  }
  // Sandwiches / wraps / handheld
  if (['sandwich', 'wrap', 'taco', 'tacos', 'burrito', 'quesadilla', 'sub', 'hoagie', 'panini'].includes(lastWord)) {
    return { type: "handheld", presentation: "on a plate, sliced or folded", textureDescription: "filled handheld food with visible ingredients, finished dish" };
  }
  // Burger
  if (lastWord === 'burger' || lastTwo === 'burger bowl') {
    return { type: "burger", presentation: "on a plate or board", textureDescription: "stacked burger with visible layers, finished dish" };
  }
  // Bowl
  if (lastWord === 'bowl') {
    return { type: "bowl dish", presentation: "served in a bowl", textureDescription: "composed bowl with protein, grains, and vegetables, finished dish" };
  }
  // Pizza
  if (lastWord === 'pizza' || lastWord === 'flatbread') {
    return { type: "pizza", presentation: "flat circular pizza on a wooden board or plate", textureDescription: "topped pizza with melted cheese and toppings, finished dish" };
  }
  // Stir fry
  if (lastWord === 'fry' && lastTwo === 'stir fry') {
    return { type: "stir-fry", presentation: "plate or shallow bowl with sautéed ingredients", textureDescription: "sautéed ingredients with slight gloss, finished dish" };
  }
  // Oatmeal / porridge
  if (['oatmeal', 'porridge', 'oats', 'congee'].includes(lastWord)) {
    return { type: "bowl dish", presentation: "bowl of oatmeal with toppings", textureDescription: "creamy thick porridge with visible toppings, finished dish" };
  }
  // Pudding / mousse
  if (['pudding', 'mousse', 'custard', 'flan', 'parfait'].includes(lastWord)) {
    return { type: "dessert", presentation: "served in a glass or bowl, garnished", textureDescription: "creamy set dessert, finished and plated" };
  }

  return null;
}

export function detectDishType(name: string): DishType {
  const lower = name.toLowerCase();

  // ── TERMINAL-WORD PRIORITY (right-to-left) ──────────────────────────────────
  // The last word(s) of a dish name define its type. Run this FIRST.
  const words = lower.trim().split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1] || '';
  const lastTwo = words.slice(-2).join(' ');
  const terminalResult = classifyByTerminalWords(lastWord, lastTwo);
  if (terminalResult) return terminalResult;
  // ── FALLBACK: keyword-anywhere scan ─────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE-TYPE ANCHORS
// Hard presentation rules keyed to the explicit sourceType from the generator.
// These run BEFORE the name-based classifier to prevent macro misclassification.
// The classifier still refines presentation style within the anchored category.
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_TYPE_ANCHORS: Record<string, { base: string; rule: string }> = {
  beverage: {
    base: "A photorealistic tall glass containing a finished drink — liquid visible, condensation on the glass if cold, steam if hot. No food on the plate.",
    rule: "THIS IS A BEVERAGE. Do NOT show any solid food. Do NOT show a plate with food. Show ONLY the drink in a glass or cup.",
  },
  snack: {
    base: "A photorealistic small portion snack, finished and ready to eat, on a small plate or board.",
    rule: "THIS IS A SNACK. Show a small, finished portion. Do NOT show a full dinner plate.",
  },
  dessert: {
    base: "A photorealistic plated dessert, finished and ready to eat.",
    rule: "THIS IS A DESSERT. Show only the finished dessert, plated. Do NOT show savory food.",
  },
  meal: {
    base: "A photorealistic finished meal, plated and ready to eat.",
    rule: "THIS IS A COOKED MEAL. Do NOT show a glass of liquid as the primary subject. Show a plated hot or warm dish.",
  },
};

function buildMealImagePrompt(mealName: string, ingredients: string[], sourceType?: ImageSourceType): string {
  const topIngredients = ingredients.slice(0, 5).join(", ");

  // When sourceType is explicitly provided by the generator, use it as the
  // hard macro anchor. The name-based classifier refines presentation within
  // that category but cannot override the top-level type decision.
  if (sourceType && SOURCE_TYPE_ANCHORS[sourceType]) {
    const anchor = SOURCE_TYPE_ANCHORS[sourceType];
    const dish = detectDishType(mealName);

    return `${anchor.base}
Food: ${mealName}.
${topIngredients ? `Made with: ${topIngredients}.` : ''}
Presentation: ${dish.presentation}. ${dish.textureDescription}.

${anchor.rule}
CRITICAL: Show ONLY the finished, ready-to-eat item described above — NOT raw ingredients, NOT uncooked components, NOT ingredient bowls.
ABSOLUTE RULE: NO HUMANS. NO PEOPLE. NO PERSONS. NO HANDS. NO ARMS. NO BODIES. NO FACES. NO MODELS. Food only.

Style: cinematic, high-detail, natural lighting, realistic food photography.
Camera: 3/4 angle or overhead depending on dish type.
Background: clean, minimal, neutral surface, no clutter, no text, no logos, no humans.`;
  }

  // No sourceType — fall back to full name-based classifier (legacy path)
  const dish = detectDishType(mealName);

  return `A photorealistic ${dish.presentation} of ${mealName}.
This is a finished dish, ready to eat, plated and served — ${dish.textureDescription}.
Made with ${topIngredients || "fresh whole ingredients"}.

CRITICAL: Show ONLY the finished, cooked, plated dish — NOT raw ingredients, NOT uncooked components, NOT ingredient bowls.
The dish must clearly look like ${mealName}. Do not generate any unrelated foods.
ABSOLUTE RULE: NO HUMANS. NO PEOPLE. NO PERSONS. NO HANDS. NO ARMS. NO BODIES. NO FACES. NO MODELS. Food only — zero human presence of any kind.

Style: cinematic, high-detail, natural lighting, realistic food photography.
Camera: 3/4 angle or overhead depending on dish type.
Subject: the food dish alone, centered on a clean surface. No hands holding it, no person serving it, no lifestyle scene.
Background: clean, minimal, neutral surface, no clutter, no text, no logos, no humans, no people, no hands.`;
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

// v4: sourceType is now part of the cache key — prevents drink/food cross-contamination.
// Bump to "v5", "v6" etc. to flush all cached images after major prompt changes.
const CACHE_VERSION = "v4";

// Map client-sent mealType values to canonical ImageSourceType strings.
// Called by the /api/meals/generate-image endpoint when sourceType is absent.
export function normalizeMealTypeToSourceType(mealType?: string): ImageSourceType | undefined {
  if (!mealType) return undefined;
  const t = mealType.toLowerCase();
  if (t === 'beverage' || t === 'beverages' || t === 'drink' || t === 'drinks') return 'beverage';
  if (t === 'snack') return 'snack';
  if (t === 'dessert') return 'dessert';
  // restaurant, breakfast, lunch, dinner, meal, course, snacks (plural) → food
  return 'meal';
}

export function buildStableCacheKey(mealName: string, ingredients: string[], sourceType?: string): string {
  const normalizedName = mealName.toLowerCase().trim();
  const normalizedIngredients = ingredients
    .slice(0, 5)
    .map(i => i.toLowerCase().trim())
    .sort()
    .join(",");
  // sourceType is part of the key so food/beverage/snack caches never collide.
  // Default to "meal" so food requests without explicit sourceType stay in the food bucket.
  const typeContext = (sourceType || "meal").toLowerCase();

  return crypto
    .createHash('sha256')
    .update(`${normalizedName}|${normalizedIngredients}|${typeContext}|${CACHE_VERSION}`)
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

// sourceType: explicit category from the generator — overrides name-based classifier
// for the macro-level decision (meal / beverage / snack / dessert).
// The classifier still runs for presentation style within that category.
export type ImageSourceType = 'meal' | 'beverage' | 'snack' | 'dessert';

export interface MealImageRequest {
  mealName: string;
  ingredients: string[];
  style?: 'overhead' | 'plated' | 'rustic' | 'restaurant';
  templateRef?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  sourceType?: ImageSourceType;
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
  const { ingredients, mealType, sourceType } = request;
  const mealName = normalizedName;
  // sourceType is included in the cache key so food/beverage/etc. never share entries.
  const cacheKey = buildStableCacheKey(mealName, ingredients, sourceType);

  // Snack firewall removed — all meal types now receive real AI-generated images.

  const _t0 = Date.now();
  console.log(`⏱️ [IMG] START ${mealName}`);

  // ── LAYER 3: CHECK IN-MEMORY CACHE ─────────────────────────────────────────
  const memHit = memCache.get(cacheKey);
  if (memHit) {
    // Guard: if a temp URL somehow made it into memCache, evict it and regenerate.
    // Temp URLs (openai.com, azure blob) expire in ~1 hour — serving them from
    // cache guarantees a broken image after expiry.
    if (isTempUrl(memHit)) {
      console.warn(`⚠️ Evicting stale temp URL from memCache for: ${mealName}`);
      memCache.delete(cacheKey);
    } else {
      console.log(`⚡ Memory cache hit for: ${mealName}`);
      return {
        url: memHit,
        prompt: "(memory cache)",
        templateRef: request.templateRef,
        hash: cacheKey,
        createdAt: new Date().toISOString(),
      };
    }
  }

  // ── LAYER 3: CHECK DB CACHE ─────────────────────────────────────────────────
  console.log(`⏱️ [IMG] DB-check start +${Date.now()-_t0}ms`);
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
  const prompt = buildMealImagePrompt(mealName, ingredients, sourceType);

  if (process.env.NODE_ENV === "development") {
    console.log(`📝 IMAGE PROMPT for "${mealName}":\n${prompt}`);
  } else {
    console.log(`🎨 Generating image for: ${mealName}`);
  }

  // ── LAYER 1: CALL DALL-E WITH TIMEOUT ──────────────────────────────────────
  let imageUrl: string | null = null;
  console.log(`⏱️ [IMG] OpenAI call start +${Date.now()-_t0}ms`);

  try {
    const response = await withTimeout(
      (getOpenAI().images.generate as any)({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "low",
      }),
      60000
    );

    const item = response.data?.[0];
    if (item?.url) imageUrl = item.url;
    else if (item?.b64_json) imageUrl = `data:image/png;base64,${item.b64_json}`;
    console.log(`⏱️ [IMG] OpenAI call done +${Date.now()-_t0}ms`);
  } catch (dalleErr: any) {
    console.warn(`⚠️ DALL-E failed for "${mealName}": ${dalleErr.message} +${Date.now()-_t0}ms`);
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

  // ── FOREGROUND S3 PERSIST ────────────────────────────────────────────────
  // Upload to S3 synchronously before returning so the client always receives
  // a small, persistent S3 URL — never a base64 blob. This is critical for
  // localStorage persistence across navigation (base64 is ~2MB and silently
  // fails the localStorage quota write, losing the image on next page load).
  console.log(`📦 Uploading to S3 for: ${mealName} +${Date.now()-_t0}ms`);
  try {
    const ingestionResult = await ingestImageToPermanentStorage(imageUrl, mealName);
    if (ingestionResult.success && ingestionResult.permanentUrl) {
      const s3Url = ingestionResult.permanentUrl;
      try {
        await db
          .insert(mealImageCache)
          .values({ cacheKey, imageUrl: s3Url, mealName, promptUsed: prompt })
          .onConflictDoUpdate({
            target: mealImageCache.cacheKey,
            set: { imageUrl: s3Url, mealName, promptUsed: prompt },
          });
        console.log(`✅ S3 URL cached in DB for: ${mealName} +${Date.now()-_t0}ms`);
      } catch (dbErr) {
        console.warn(`⚠️ DB write failed for "${mealName}":`, dbErr);
      }
      memCache.set(cacheKey, s3Url);
      return {
        url: s3Url,
        prompt,
        templateRef: request.templateRef,
        hash: cacheKey,
        createdAt: new Date().toISOString(),
      };
    } else {
      console.warn(`⚠️ S3 upload failed for "${mealName}" — returning base64 as fallback: ${ingestionResult.error ?? 'unknown'}`);
    }
  } catch (uploadErr: any) {
    console.warn(`⚠️ S3 upload threw for "${mealName}": ${uploadErr.message}`);
  }

  // S3 failed. Only cache base64 data URIs in memCache — they are self-contained and safe
  // to serve for the duration of this server process. Never cache ephemeral https:// URLs
  // from OpenAI/Azure: they expire in ~1 hour and would appear broken on next load.
  if (imageUrl.startsWith('data:')) {
    memCache.set(cacheKey, imageUrl);
  } else {
    console.warn(`⚠️ S3 failed and imageUrl is ephemeral for "${mealName}" — skipping memCache to force re-generation on next request`);
  }
  return {
    url: imageUrl,
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
          hash: buildStableCacheKey(req.mealName, req.ingredients, req.sourceType),
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
  const cacheKey = buildStableCacheKey(request.mealName, request.ingredients, request.sourceType);
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
  ingredients: Array<string | Record<string, any>> = [],
  sourceType?: ImageSourceType
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
    sourceType,
  });

  return result.url;
}
