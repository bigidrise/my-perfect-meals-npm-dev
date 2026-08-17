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
import {
  validateImageAgainstRecipe,
  buildRetryExclusionAddendum,
  computeRecipeSignature,
  type ValidationResult,
} from './mealImageValidator';

// ─────────────────────────────────────────────────────────────────────────────
// URL TYPE HELPERS — enforce hard boundaries on what enters the cache
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true ONLY for URLs on the active object-storage path (/public-objects/).
 *
 * Intentionally excludes all amazonaws.com URLs — the old `my-perfect-meals-images`
 * bucket returns 403 and would be served as "permanent" without this guard.
 * Any non-/public-objects/ URL (including amazonaws.com) is treated as a stale
 * temp URL and evicted so the cache re-generates a fresh image.
 */
function isPermanentUrl(url: string): boolean {
  return url.startsWith('/public-objects/');
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
  /**
   * Non-negotiable physical form of the dish — what the food must structurally
   * look like in the image. Governs dish shape/form only, not ingredients.
   * Cannot be overridden by ingredient restrictions.
   */
  structuralIdentity: string;
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
    return { type: "beverage", presentation: "in a tall glass", textureDescription: "blended or chilled beverage with vibrant color, finished and ready to drink", structuralIdentity: "a drink in a tall glass or cup — NOT solid food on a plate, NOT a bowl of food." };
  }
  // Salads
  if (lastWord === 'salad' || lastTwo === 'grain salad' || lastTwo === 'kale salad' || lastTwo === 'chopped salad') {
    return { type: "salad", presentation: "wide bowl or plate with fresh layered ingredients", textureDescription: "fresh, vibrant, crisp vegetables and toppings, finished dish", structuralIdentity: "fresh ingredients arranged in a wide shallow bowl or flat plate — NOT a hot entrée, NOT a soup, NOT a stir-fry." };
  }
  // Soups
  if (['soup', 'bisque', 'chowder', 'broth', 'ramen', 'pho', 'gazpacho'].includes(lastWord)) {
    return { type: "bowl dish", presentation: "bowl filled with soup and steam rising", textureDescription: "hot liquid-based dish with vegetables and protein, finished dish", structuralIdentity: "hot liquid filling a deep bowl with steam rising — the primary subject is a bowl of soup. NOT a plate, NOT a salad." };
  }
  // Stews / chili / curry
  if (['stew', 'chili', 'curry', 'ragù', 'ragu'].includes(lastWord)) {
    return { type: "bowl dish", presentation: "deep rustic bowl filled with the dish", textureDescription: "thick, hearty, spoonable dish, finished and ready to eat", structuralIdentity: "a thick hearty stew or curry filling a deep bowl — NOT a flat plate, NOT a salad, NOT a thin soup." };
  }
  // Pasta / noodles
  if (['pasta', 'noodles', 'spaghetti', 'linguine', 'penne', 'fettuccine', 'rigatoni', 'orzo', 'udon', 'ramen'].includes(lastWord)) {
    return { type: "pasta dish", presentation: "wide plate or bowl with pasta and sauce", textureDescription: "coated noodles with sauce, protein, and herbs, finished dish", structuralIdentity: "noodles visibly coated in sauce in a wide plate or shallow bowl — NOT a salad, NOT a stir-fry, NOT a soup with noodles submerged in broth." };
  }
  // Baked goods — cookies
  if (['cookies', 'cookie', 'biscotti', 'shortbread'].includes(lastWord)) {
    return { type: "baked dessert", presentation: "freshly baked cookies arranged on a plate or cooling rack", textureDescription: "golden brown baked cookies, finished dessert", structuralIdentity: "individual cookies arranged on a plate or cooling rack — NOT a cake slice, NOT a brownie square, NOT a muffin." };
  }
  // Baked goods — brownies / bars
  if (['brownies', 'brownie', 'blondies', 'blondie', 'bars', 'bar'].includes(lastWord)) {
    return { type: "baked dessert", presentation: "cut squares arranged on a plate", textureDescription: "fudgy baked bars, finished dessert", structuralIdentity: "cut square bars arranged on a plate or board — NOT a cookie, NOT a slice of cake, NOT a muffin." };
  }
  // Baked goods — muffins / cupcakes
  if (['muffins', 'muffin', 'cupcakes', 'cupcake'].includes(lastWord)) {
    return { type: "baked dessert", presentation: "freshly baked muffins on a plate", textureDescription: "domed golden-topped baked goods, finished dessert", structuralIdentity: "individual dome-topped baked goods standing upright on a plate or in a tray — NOT a flat cookie, NOT a brownie square." };
  }
  // Baked goods — bread / loaf
  if (['bread', 'loaf', 'rolls', 'roll', 'baguette', 'scone', 'scones'].includes(lastWord) || lastTwo === 'banana bread' || lastTwo === 'corn bread') {
    return { type: "baked good", presentation: "sliced loaf on a cutting board or plate", textureDescription: "golden-crusted bread with moist interior, finished baked good", structuralIdentity: "a sliced or whole loaf of bread on a cutting board or plate — NOT a sandwich, NOT a cake." };
  }
  // Cake / pie / tart — note: cheesecake gets specific filling description
  if (['cheesecake'].includes(lastWord)) {
    return { type: "baked dessert", presentation: "sliced cheesecake on a plate", textureDescription: "thick creamy filling on a crust base, finished dessert", structuralIdentity: "thick creamy filling on a visible crust base, whole or sliced on a plate — NOT a cookie, NOT a brownie, NOT a muffin, NOT a layer cake." };
  }
  if (['cake', 'torte'].includes(lastWord)) {
    return { type: "baked dessert", presentation: "sliced cake on a plate", textureDescription: "layered or whole cake, finished dessert", structuralIdentity: "a layered or whole cake, sliced to show layers, on a plate — NOT a cookie, NOT a brownie, NOT a muffin." };
  }
  if (['pie', 'tart', 'cobbler', 'crisp', 'crumble', 'galette'].includes(lastWord)) {
    return { type: "baked dessert", presentation: "sliced or whole pie or tart on a plate", textureDescription: "golden pastry crust with filling, finished dessert", structuralIdentity: "a golden pastry crust with visible filling, sliced or whole on a plate — NOT a cake, NOT a cookie, NOT a muffin." };
  }
  // Tacos — specific structural identity: tortilla shells, NOT a bowl or salad
  if (['taco', 'tacos'].includes(lastWord)) {
    return { type: "handheld", presentation: "on a plate", textureDescription: "assembled tacos with tortilla shells folded around the filling, finished dish", structuralIdentity: "two or three assembled tacos — soft or hard tortilla shells folded around the filling — each taco upright and individually visible on a plate. NOT a salad, NOT a bowl, NOT a burrito, NOT a wrap." };
  }
  // Burrito — tightly rolled, seam-side down
  if (lastWord === 'burrito') {
    return { type: "handheld", presentation: "on a plate", textureDescription: "a large flour tortilla tightly rolled around the filling, seam-side down, finished dish", structuralIdentity: "a large flour tortilla rolled tightly and sealed around the filling, seam-side down on a plate. NOT a taco, NOT a quesadilla, NOT a bowl." };
  }
  // Quesadilla — flat, pressed, cut into wedges
  if (lastWord === 'quesadilla') {
    return { type: "handheld", presentation: "flat on a plate, cut into wedges", textureDescription: "a flat pressed tortilla cut into wedges, melted filling visible at the edges, finished dish", structuralIdentity: "a flat flour tortilla pressed flat and cut into wedges, melted filling visible at the cut edges. NOT a taco, NOT a burrito, NOT a wrap." };
  }
  // Wrap — compact roll, sliced diagonally
  if (lastWord === 'wrap') {
    return { type: "handheld", presentation: "on a plate, sliced in half", textureDescription: "a compact flatbread rolled tightly around filling, sliced to show cross-section, finished dish", structuralIdentity: "a compact flatbread rolled tightly around the filling, sliced in half diagonally to reveal the cross-section. NOT a taco, NOT a burrito." };
  }
  // Sandwiches
  if (['sandwich', 'sub', 'hoagie', 'panini'].includes(lastWord)) {
    return { type: "sandwich", presentation: "on a plate, sliced in half to show filling", textureDescription: "two slices of bread enclosing the filling, finished dish", structuralIdentity: "two slices of bread (or a split roll) enclosing the filling, sliced in half to reveal the cross-section. NOT a wrap, NOT a taco, NOT a bowl." };
  }
  // Burger
  if (lastWord === 'burger' || lastTwo === 'burger bowl') {
    return { type: "burger", presentation: "on a plate or board", textureDescription: "stacked burger with visible layers, finished dish", structuralIdentity: "a burger bun (top and bottom) enclosing the patty and fillings, stacked with visible layers from the side. NOT a sandwich with sliced bread, NOT a wrap." };
  }
  // Bowl
  if (lastWord === 'bowl') {
    return { type: "bowl dish", presentation: "served in a bowl", textureDescription: "composed bowl with protein, grains, and vegetables, finished dish", structuralIdentity: "ingredients arranged over a grain or vegetable base in a deep bowl — NOT a plate, NOT a salad." };
  }
  // Pizza / flatbread
  if (lastWord === 'pizza' || lastWord === 'flatbread') {
    return { type: "pizza", presentation: "flat circular pizza on a wooden board or plate", textureDescription: "topped pizza with toppings on a flat crust, finished dish", structuralIdentity: "a flat round crust with sauce and toppings distributed across the surface, whole or sliced into pieces. NOT a calzone, NOT a sandwich, NOT a wrap." };
  }
  // Stir fry
  if (lastWord === 'fry' && lastTwo === 'stir fry') {
    return { type: "stir-fry", presentation: "plate or shallow bowl with sautéed ingredients", textureDescription: "sautéed ingredients with slight gloss, finished dish", structuralIdentity: "sautéed ingredients with a glossy sauce in a wide plate or shallow bowl — NOT a raw salad, NOT a soup." };
  }
  // Oatmeal / porridge
  if (['oatmeal', 'porridge', 'oats', 'congee'].includes(lastWord)) {
    return { type: "bowl dish", presentation: "bowl of oatmeal with toppings", textureDescription: "creamy thick porridge with visible toppings, finished dish", structuralIdentity: "creamy thick porridge filling a bowl with toppings on top. NOT a plate, NOT a smoothie, NOT a drink." };
  }
  // Pudding / mousse
  if (['pudding', 'mousse', 'custard', 'flan', 'parfait'].includes(lastWord)) {
    return { type: "dessert", presentation: "served in a glass or bowl, garnished", textureDescription: "creamy set dessert, finished and plated", structuralIdentity: "a smooth creamy dessert in a glass or small bowl, garnished on top. NOT a cake, NOT a cookie, NOT a plate of solid food." };
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
    return { type: "bowl dish", presentation: "deep rustic bowl filled with the dish", textureDescription: "thick, hearty, spoonable chili with visible protein and beans", structuralIdentity: "a thick chili filling a deep rustic bowl. NOT a plate, NOT a salad." };
  }
  if (lower.includes("soup") || lower.includes("bisque") || lower.includes("broth") || lower.includes("chowder")) {
    return { type: "bowl dish", presentation: "bowl filled with soup and steam rising", textureDescription: "hot liquid-based dish with vegetables and protein", structuralIdentity: "hot liquid filling a deep bowl with steam rising — the primary subject is a bowl of soup. NOT a plate, NOT a salad." };
  }
  if (lower.includes("stew") || lower.includes("ragù") || lower.includes("ragu")) {
    return { type: "bowl dish", presentation: "deep bowl filled with hearty stew", textureDescription: "thick, rich stew with chunks of vegetables and meat", structuralIdentity: "a thick hearty stew filling a deep bowl. NOT a flat plate, NOT a salad, NOT a thin soup." };
  }
  if (lower.includes("curry")) {
    return { type: "bowl dish", presentation: "bowl of curry served with rice on the side", textureDescription: "rich, saucy curry with vibrant color from spices", structuralIdentity: "a rich saucy curry in a bowl, served with rice visible alongside or underneath. NOT a dry plate, NOT a salad." };
  }
  if (lower.includes("oatmeal") || lower.includes("porridge") || lower.includes("congee")) {
    return { type: "bowl dish", presentation: "bowl of oatmeal with toppings", textureDescription: "creamy, thick porridge with visible toppings", structuralIdentity: "creamy thick porridge filling a bowl with toppings on top. NOT a plate, NOT a smoothie." };
  }
  if (lower.includes("stir") || lower.includes("stir-fry") || lower.includes("fried rice")) {
    return { type: "stir-fry", presentation: "plate or shallow bowl with sautéed ingredients", textureDescription: "sautéed ingredients with slight gloss and charred texture", structuralIdentity: "sautéed ingredients with a glossy sauce in a wide plate or shallow bowl. NOT a raw salad, NOT a soup." };
  }
  if (lower.includes("salad")) {
    return { type: "salad", presentation: "wide bowl or plate with fresh layered ingredients", textureDescription: "fresh, vibrant, crisp vegetables and toppings", structuralIdentity: "fresh ingredients arranged in a wide shallow bowl or flat plate. NOT a hot entrée, NOT a soup, NOT a stir-fry." };
  }
  if (lower.includes("pasta") || lower.includes("noodle") || lower.includes("spaghetti") || lower.includes("linguine") || lower.includes("penne") || lower.includes("fettuccine")) {
    return { type: "pasta dish", presentation: "wide plate or bowl with pasta and sauce", textureDescription: "coated noodles with sauce, protein, and herbs", structuralIdentity: "noodles visibly coated in sauce in a wide plate or shallow bowl. NOT a salad, NOT a stir-fry, NOT a soup with noodles submerged in broth." };
  }
  // Tacos — check before generic "wrap" to catch "fish tacos", "street tacos", etc.
  if (lower.includes("taco")) {
    return { type: "handheld", presentation: "on a plate", textureDescription: "assembled tacos with tortilla shells folded around the filling, finished dish", structuralIdentity: "two or three assembled tacos — soft or hard tortilla shells folded around the filling — each taco upright and individually visible on a plate. NOT a salad, NOT a bowl, NOT a burrito, NOT a wrap." };
  }
  if (lower.includes("burrito")) {
    return { type: "handheld", presentation: "on a plate", textureDescription: "a large flour tortilla tightly rolled around the filling, seam-side down, finished dish", structuralIdentity: "a large flour tortilla rolled tightly and sealed around the filling, seam-side down on a plate. NOT a taco, NOT a quesadilla, NOT a bowl." };
  }
  if (lower.includes("quesadilla")) {
    return { type: "handheld", presentation: "flat on a plate, cut into wedges", textureDescription: "a flat pressed tortilla cut into wedges, melted filling visible at the edges, finished dish", structuralIdentity: "a flat flour tortilla pressed flat and cut into wedges, melted filling visible at the cut edges. NOT a taco, NOT a burrito, NOT a wrap." };
  }
  if (lower.includes("wrap")) {
    return { type: "handheld", presentation: "on a plate, sliced in half", textureDescription: "a compact flatbread rolled tightly around filling, finished dish", structuralIdentity: "a compact flatbread rolled tightly around the filling, sliced in half diagonally to reveal the cross-section. NOT a taco, NOT a burrito." };
  }
  if (lower.includes("sandwich") || lower.includes("sub") || lower.includes("hoagie") || lower.includes("panini")) {
    return { type: "sandwich", presentation: "on a plate, sliced in half to show filling", textureDescription: "stacked bread with visible fillings", structuralIdentity: "two slices of bread (or a split roll) enclosing the filling, sliced in half to reveal the cross-section. NOT a wrap, NOT a taco, NOT a bowl." };
  }
  if (lower.includes("burger")) {
    return { type: "burger", presentation: "on a plate or board", textureDescription: "stacked burger with visible layers", structuralIdentity: "a burger bun (top and bottom) enclosing the patty and fillings, stacked with visible layers from the side. NOT a sandwich with sliced bread, NOT a wrap." };
  }
  if (lower.includes("pizza")) {
    return { type: "pizza", presentation: "flat circular pizza on a wooden board or plate", textureDescription: "topped pizza with melted cheese and toppings", structuralIdentity: "a flat round crust with sauce and toppings distributed across the surface, whole or sliced into pieces. NOT a calzone, NOT a sandwich, NOT a wrap." };
  }
  if (lower.includes("bowl")) {
    return { type: "bowl dish", presentation: "served in a bowl", textureDescription: "composed bowl with protein, grains, and vegetables", structuralIdentity: "ingredients arranged over a grain or vegetable base in a deep bowl. NOT a plate, NOT a salad." };
  }
  if (lower.includes("breakfast") || lower.includes("eggs") || lower.includes("omelette") || lower.includes("omelet") || lower.includes("pancake") || lower.includes("waffle")) {
    return { type: "breakfast plate", presentation: "on a plate with breakfast presentation", textureDescription: "morning meal with eggs, proteins, or grains", structuralIdentity: "a plated breakfast with components arranged on a plate — eggs, protein, and/or grains visible. NOT a drink, NOT a salad." };
  }
  if (lower.includes("smoothie") || lower.includes("shake") || lower.includes("juice")) {
    return { type: "beverage", presentation: "in a tall glass", textureDescription: "blended beverage with vibrant color", structuralIdentity: "a drink in a tall glass or cup. NOT solid food on a plate." };
  }
  if (lower.includes("grilled") || lower.includes("roasted") || lower.includes("seared")) {
    return { type: "plated entree", presentation: "plated on a clean white plate", textureDescription: "cooked protein or vegetables with golden, caramelized exterior", structuralIdentity: "a plated entrée with the protein or vegetables as the central subject on a clean plate. NOT a bowl of soup, NOT a salad." };
  }
  if (lower.includes("cookie") || lower.includes("cookies") || lower.includes("biscotti") || lower.includes("shortbread")) {
    return { type: "baked dessert", presentation: "freshly baked cookies arranged on a plate or cooling rack", textureDescription: "golden brown baked cookies with visible chips or texture, finished dessert", structuralIdentity: "individual cookies arranged on a plate or cooling rack. NOT a cake, NOT a brownie square, NOT a muffin." };
  }
  if (lower.includes("brownie") || lower.includes("brownies") || lower.includes("blondie") || lower.includes("blondies")) {
    return { type: "baked dessert", presentation: "cut brownie or blondie squares arranged on a plate", textureDescription: "fudgy, dense baked bars with a crackly top, finished dessert", structuralIdentity: "cut square bars arranged on a plate or board. NOT a cookie, NOT a slice of cake, NOT a muffin." };
  }
  if (lower.includes("muffin") || lower.includes("muffins") || lower.includes("cupcake") || lower.includes("cupcakes")) {
    return { type: "baked dessert", presentation: "freshly baked muffins or cupcakes on a plate or in a tray", textureDescription: "domed, golden-topped baked goods, finished and ready to eat", structuralIdentity: "individual dome-topped baked goods standing upright on a plate or in a tray. NOT a flat cookie, NOT a brownie square." };
  }
  if (lower.includes("cake") || lower.includes("cheesecake") || lower.includes("bundt") || lower.includes("torte")) {
    return { type: "baked dessert", presentation: "sliced cake served on a plate", textureDescription: "layered or whole cake, finished dessert, plated and ready to serve", structuralIdentity: "a sliced or whole layered dessert. For cheesecake: thick creamy filling on a crust base. NOT a cookie, NOT a brownie, NOT a muffin." };
  }
  if (lower.includes("bread") || lower.includes("loaf") || lower.includes("banana bread")) {
    return { type: "baked good", presentation: "sliced loaf of bread on a cutting board or plate", textureDescription: "golden-crusted bread with a moist interior, finished baked good", structuralIdentity: "a sliced or whole loaf of bread on a cutting board or plate. NOT a sandwich, NOT a cake." };
  }
  if (lower.includes("scone") || lower.includes("biscuit") || lower.includes("roll")) {
    return { type: "baked good", presentation: "freshly baked scones or rolls on a plate", textureDescription: "golden, flaky baked goods, finished and ready to eat", structuralIdentity: "individual golden baked rolls or scones on a plate. NOT a sliced loaf, NOT a sandwich." };
  }
  if (lower.includes("pie") || lower.includes("tart") || lower.includes("cobbler") || lower.includes("crisp") || lower.includes("crumble") || lower.includes("galette")) {
    return { type: "baked dessert", presentation: "sliced or whole pie or tart served on a plate", textureDescription: "golden pastry crust with fruit or cream filling, finished dessert", structuralIdentity: "a golden pastry crust with visible filling, sliced or whole on a plate. NOT a cake, NOT a cookie, NOT a muffin." };
  }
  if (lower.includes("energy bar") || lower.includes("protein bar") || lower.includes("granola bar") || lower.includes("power bar")) {
    return { type: "snack bar", presentation: "energy bars sliced and arranged on a plate or board", textureDescription: "dense, chewy bars with visible nuts or seeds, finished snack", structuralIdentity: "dense rectangular bars arranged on a plate or board. NOT a cookie, NOT a brownie square." };
  }
  if (lower.includes("pudding") || lower.includes("mousse") || lower.includes("custard") || lower.includes("flan") || lower.includes("panna cotta")) {
    return { type: "dessert", presentation: "served in a glass or bowl, garnished", textureDescription: "creamy, set dessert with smooth texture, finished and plated", structuralIdentity: "a smooth creamy dessert in a glass or small bowl, garnished on top. NOT a cake, NOT a cookie, NOT a plate of solid food." };
  }
  if (lower.includes("baked")) {
    return { type: "baked dish", presentation: "plated on a clean white plate", textureDescription: "oven-baked dish with golden, caramelized exterior, finished and ready to eat", structuralIdentity: "an oven-baked dish with a golden exterior, plated on a clean plate. NOT a raw ingredient bowl, NOT a salad." };
  }

  return {
    type: "plated meal",
    presentation: "served on a plate",
    textureDescription: "balanced, composed cooked meal, finished and ready to eat",
    structuralIdentity: "a finished cooked meal arranged on a plate — the components are plated and ready to eat.",
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

// Maps resolver TextureClass values to explicit DALL-E visual instructions.
// These are the same texture classes defined in PediatricMealGenerationContext.
const TEXTURE_CLASS_VISUAL: Record<string, string> = {
  puree_only:       "TEXTURE RULE: completely smooth purée — no visible chunks, pieces, whole foods, or crunchy elements of any kind. The food must look fully blended and smooth.",
  mashed_soft:      "TEXTURE RULE: mashed or very soft — no hard pieces, no crunchy elements, no whole chunks. Food should look soft enough to squish between fingers.",
  soft_chopped:     "TEXTURE RULE: small soft pieces — nothing hard, nothing crunchy. All pieces bite-sized and clearly soft-textured.",
  family_modified:  "TEXTURE RULE: soft bite-sized pieces — modified family food, clearly not adult-sized chunks. Tender-looking, simply prepared.",
  family_table:     "TEXTURE RULE: regular family-style food, age-appropriate presentation.",
};

// Maps COND-XXXX protocol IDs to visual presentation adjustments.
// Only IDs with a meaningful visual impact on the image are listed.
const CONDITION_VISUAL_NOTES: Record<string, string> = {
  "COND-0004": "PORTION RULE: show a notably generous portion — this child needs extra calories (failure to thrive protocol). Do NOT show a small or dainty serving.",
  "COND-0005": "EMPHASIS RULE: visually highlight iron-rich components (dark leafy greens, lean meat, legumes) — make them prominent in the plating.",
};

function buildPediatricContextAddendum(ctx: PediatricImageContext): string {
  // Priority: textureClass lookup (most precise) → textureStrategy (human-readable resolver string)
  // → textureHint (legacy first-sentence fallback).
  const textureInstruction = (ctx.textureClass && TEXTURE_CLASS_VISUAL[ctx.textureClass])
    ? TEXTURE_CLASS_VISUAL[ctx.textureClass]
    : ctx.textureStrategy
      ? `TEXTURE REQUIREMENT: ${ctx.textureStrategy}`
      : `TEXTURE: ${ctx.textureHint || "soft, age-appropriate texture"}.`;

  const presentationLine = ctx.presentationStrategy
    ? `Plating: ${ctx.presentationStrategy}.`
    : "";

  // Condition-specific visual notes (e.g. larger portions for failure-to-thrive).
  const conditionNotes = (ctx.activeConditionIds ?? [])
    .map(id => CONDITION_VISUAL_NOTES[id])
    .filter(Boolean)
    .join("\n");

  return `
PEDIATRIC CONTEXT: This meal is for a ${ctx.stage} child (${ctx.ageRange}).
${textureInstruction}
The rendered food MUST visually match this texture — a purée stage must look smooth with no chunks; a toddler plate must show soft small pieces, not crunchy sticks.
PORTION: ${ctx.portionNote} — this is a child's serving, NOT a full adult restaurant plate.${presentationLine ? `\n${presentationLine}` : ""}
The food should look like what a parent would actually put on a small child's plate: appropriately sized, soft-looking if needed, simply presented.
Do NOT show adult-sized portions. Do NOT show elaborate restaurant plating. Do NOT show raw or hard-textured ingredients if the texture class is purée or mashed.${conditionNotes ? "\n" + conditionNotes : ""}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RECIPE INGREDIENT CONTRACT
// The canonical recipe ingredient list outranks the dish name, cuisine label,
// cultural convention, or the model's prior knowledge. Loaded dish names
// ("Niçoise", "Cobb", "Carbonara", ...) carry strong learned associations that
// make the image model add ingredients the recipe never included (e.g. eggs on
// a Niçoise that has none). We enforce the contract at prompt construction:
// the display name is presented as a LABEL ONLY, and the allow/deny list is
// derived automatically from the actual recipe ingredients at generation time.
// ─────────────────────────────────────────────────────────────────────────────

// The allow-list includes EVERY recipe ingredient — no cap. A partial list
// would contradict the deny clause ("any ingredient not in the required list"),
// making canonical recipe ingredients past the cutoff appear unauthorized.
function buildIngredientContract(mealName: string, ingredients: string[]): string {
  const authorized = ingredients
    .map(i => (i || "").trim())
    .filter(Boolean)
    .join(", ");

  if (!authorized) return "";

  // NOTE: This contract governs what goes INSIDE or ON the dish (filling,
  // toppings, composition). It does NOT override the dish's structural form,
  // which is locked in CONTRACT 1 (DISH IDENTITY) of the prompt.
  return `
INGREDIENT AUTHORIZATION — FILLING & COMPOSITION ONLY:
REQUIRED VISIBLE INGREDIENTS: ${authorized}
UNAUTHORIZED INGREDIENTS: Any ingredient not in the required list above. Do NOT add ingredients traditionally associated with "${mealName}" (or its cuisine) unless they appear in the required list. The ingredient list above is the only authority on what components appear inside or on this dish. The dish's structural form is defined by CONTRACT 1 (DISH IDENTITY) and cannot be overridden by this ingredient list.`;
}

function buildMealImagePrompt(mealName: string, ingredients: string[], sourceType?: ImageSourceType, pediatricContext?: PediatricImageContext): string {
  const pediatricAddendum = pediatricContext ? buildPediatricContextAddendum(pediatricContext) : "";
  const ingredientContract = buildIngredientContract(mealName, ingredients);
  const hasContract = ingredientContract.length > 0;

  // When sourceType is explicitly provided by the generator, use it as the
  // hard macro anchor. The name-based classifier refines presentation within
  // that category but cannot override the top-level type decision.
  if (sourceType && SOURCE_TYPE_ANCHORS[sourceType]) {
    const anchor = SOURCE_TYPE_ANCHORS[sourceType];
    const dish = detectDishType(mealName);

    return `${anchor.base}
DISPLAY NAME: ${mealName}

━━ CONTRACT 1: DISH IDENTITY (MANDATORY — cannot be overridden by ingredients) ━━
This image MUST show: ${dish.structuralIdentity}
Even if the filling or toppings differ from a traditional version, this structural form must remain recognizable.

━━ CONTRACT 2: INGREDIENT AUTHORIZATION ━━${hasContract ? `
${ingredientContract}` : `
No ingredient restriction — render the dish in its standard form.`}

━━ CONTRACT 3: PRESENTATION ━━
Presentation: ${dish.presentation}. ${dish.textureDescription}.
${anchor.rule}
CRITICAL: Show ONLY the finished, ready-to-eat item described above — NOT raw ingredients, NOT uncooked components, NOT ingredient bowls.
ABSOLUTE RULE: NO HUMANS. NO PEOPLE. NO PERSONS. NO HANDS. NO ARMS. NO BODIES. NO FACES. NO MODELS. Food only.

Style: cinematic, high-detail, natural lighting, realistic food photography.
Camera: 3/4 angle or overhead depending on dish type.
Background: clean, minimal, neutral surface, no clutter, no text, no logos, no humans.${pediatricAddendum}`;
  }

  // No sourceType — fall back to full name-based classifier (legacy path)
  const dish = detectDishType(mealName);

  return `A photorealistic finished dish, plated and ready to eat.
DISPLAY NAME: ${mealName}

━━ CONTRACT 1: DISH IDENTITY (MANDATORY — cannot be overridden by ingredients) ━━
This image MUST show: ${dish.structuralIdentity}
Even if the filling or toppings differ from a traditional version, this structural form must remain recognizable.

━━ CONTRACT 2: INGREDIENT AUTHORIZATION ━━${hasContract ? `
${ingredientContract}` : `
No ingredient restriction — render the dish as: ${mealName}. The dish must clearly look like ${mealName}. Do not generate any unrelated foods.`}

━━ CONTRACT 3: PRESENTATION ━━
Presentation: ${dish.presentation}. ${dish.textureDescription}.
CRITICAL: Show ONLY the finished, cooked, plated dish — NOT raw ingredients, NOT uncooked components, NOT ingredient bowls.
ABSOLUTE RULE: NO HUMANS. NO PEOPLE. NO PERSONS. NO HANDS. NO ARMS. NO BODIES. NO FACES. NO MODELS. Food only — zero human presence of any kind.

Style: cinematic, high-detail, natural lighting, realistic food photography.
Camera: 3/4 angle or overhead depending on dish type.
Subject: the food dish alone, centered on a clean surface. No hands holding it, no person serving it, no lifestyle scene.
Background: clean, minimal, neutral surface, no clutter, no text, no logos, no humans, no people, no hands.${pediatricAddendum}`;
}

// Exported for regression tests only — not part of the public generation API.
export const __testables = { buildMealImagePrompt, buildIngredientContract };

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
// v5: recipe-ingredient-contract prompt format (display name demoted to label;
//     allow/deny list derived from recipe ingredients) — flushes all v4 prompts.
// v6: cache key hashes ALL normalized ingredients (was top-5) so it fully
//     represents the prompt's allow/deny contract; flushes v5 entries keyed
//     on partial ingredient lists.
// v7: post-generation vision validation gate — a cache row now means
//     "generated for this recipe contract AND passed fidelity validation";
//     flushes v6 entries that were never validated.
// v8: three-contract prompt system — separate DISH IDENTITY (structural form,
//     cannot be overridden), INGREDIENT AUTHORIZATION (filling/composition only),
//     and PRESENTATION contracts. Fixes taco→salad form collapse. Flushes all
//     v7 images generated under the old "dish name is a label only" prompt.
const CACHE_VERSION = "v8";

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

export function buildStableCacheKey(mealName: string, ingredients: string[], sourceType?: string, contextTag?: string): string {
  const normalizedName = mealName.toLowerCase().trim();
  // FULL recipe signature — the cache identity must cover the entire recipe
  // contract the prompt's allow/deny list AND the validator check against,
  // not just a prefix. Recipes differing in later ingredients must never
  // share an image generated under a different contract.
  const normalizedIngredients = computeRecipeSignature(ingredients);
  // sourceType is part of the key so food/beverage/snack caches never collide.
  // Default to "meal" so food requests without explicit sourceType stay in the food bucket.
  const typeContext = (sourceType || "meal").toLowerCase();
  // contextTag (e.g. pediatric stage) ensures pediatric images cache separately from adult ones.
  const tag = contextTag ? `|${contextTag.toLowerCase().trim()}` : "";

  return crypto
    .createHash('sha256')
    .update(`${normalizedName}|${normalizedIngredients}|${typeContext}|${CACHE_VERSION}${tag}`)
    .digest('hex')
    .substring(0, 32);
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE (fast path, clears on restart — DB is the persistent layer)
// ─────────────────────────────────────────────────────────────────────────────

// Entries carry validation metadata so cache hits enforce the same fidelity
// gate as fresh generations — a hit is only servable if its recipe signature
// matches the current request and it was not a validation failure.
interface MemCacheEntry {
  url: string;
  validationStatus: string | null;   // PASS | SKIPPED | null (fallback/legacy)
  recipeSignature: string | null;
}
const memCache = new Map<string, MemCacheEntry>();

/**
 * Servability gate shared by memory + DB cache lookups.
 * A cached row may be served only when:
 *  - it was validated (PASS) or auditable-skipped (SKIPPED) — never FAIL, never
 *    a legacy NULL-validation row; and
 *  - its stored recipe signature matches the current request's signature.
 * Exported for the regression suite.
 */
export function isCacheRowServable(
  row: { validationStatus?: string | null; recipeSignature?: string | null },
  currentSignature: string
): boolean {
  const status = row.validationStatus ?? null;
  if (status !== "PASS" && status !== "SKIPPED") return false;
  return row.recipeSignature === currentSignature;
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-FLIGHT DEDUPLICATION
// If two callers request the same image while a DALL-E call is already running
// (e.g. server pre-warm + client request arriving in parallel), they share the
// single in-flight promise instead of spawning two DALL-E calls.
// Entries are removed when the promise settles (success or failure).
// ─────────────────────────────────────────────────────────────────────────────

const inflightRequests = new Map<string, Promise<string>>();

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

export interface PediatricImageContext {
  stage: string;             // e.g. "Preschool"
  ageRange: string;          // e.g. "4–5 years"
  portionNote: string;       // e.g. "small preschool portion"
  /** Legacy free-text fallback: first sentence of textureAndChokingPreparation */
  textureHint?: string;
  /** Resolver-derived texture class key, e.g. "puree_only" — maps to TEXTURE_CLASS_VISUAL */
  textureClass?: string;
  /** Resolver-derived human-readable texture string, e.g. "purée/smooth — no visible chunks" */
  textureStrategy?: string;
  /** Resolver-derived plating note, e.g. "small toddler plate with very soft pieces" */
  presentationStrategy?: string;
  /** COND-XXXX protocol IDs active for this child — drives condition-specific visual notes */
  activeConditionIds?: string[];
}

export interface MealImageRequest {
  mealName: string;
  ingredients: string[];
  style?: 'overhead' | 'plated' | 'rustic' | 'restaurant';
  templateRef?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  sourceType?: ImageSourceType;
  pediatricContext?: PediatricImageContext;
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
  const { ingredients, mealType, sourceType, pediatricContext } = request;
  const mealName = normalizedName;
  // sourceType + optional pediatric stage are both in the cache key so pediatric and
  // adult images for the same dish name never share a cache entry.
  const cacheKey = buildStableCacheKey(mealName, ingredients, sourceType, pediatricContext?.stage);
  const currentSignature = computeRecipeSignature(ingredients);

  // ── RECIPE CONTRACT REQUIRED — FAIL CLOSED ─────────────────────────────────
  // Without at least one usable ingredient there is no recipe contract to
  // validate fidelity against. Do NOT generate, do NOT cache — serve the
  // semantic fallback. This closes the bypass where a bare dish name would
  // get an unvalidated (SKIPPED) image permanently cached.
  const usableIngredients = ingredients.map(i => (i || "").trim()).filter(Boolean);
  if (usableIngredients.length === 0) {
    const fallback = getSemanticFallback(mealName);
    console.warn(`[IMG-VALIDATION-SKIP] No recipe contract (empty ingredients) — serving semantic fallback without caching | meal="${mealName}"`);
    return {
      url: fallback,
      prompt: `Fallback (no recipe contract): ${mealName}`,
      templateRef: request.templateRef,
      hash: cacheKey,
      createdAt: new Date().toISOString(),
    };
  }

  const _t0 = Date.now();
  // Unique trace ID per generation attempt — correlates all log lines for one request.
  const traceId = crypto.randomBytes(4).toString('hex');
  console.log(`[IMG-LIFECYCLE:${traceId}] START | meal="${mealName}" | sourceType="${sourceType ?? 'inferred'}" | cacheKey=${cacheKey}`);

  // ── LAYER 3: CHECK IN-MEMORY CACHE ─────────────────────────────────────────
  const memHit = memCache.get(cacheKey);
  if (memHit) {
    if (isTempUrl(memHit.url)) {
      console.warn(`[IMG-LIFECYCLE:${traceId}] MEM-CACHE EVICT (temp URL) | meal="${mealName}"`);
      memCache.delete(cacheKey);
    } else if (!isCacheRowServable(memHit, currentSignature)) {
      console.warn(`[IMG-LIFECYCLE:${traceId}] MEM-CACHE EVICT (unvalidated or signature mismatch) | status=${memHit.validationStatus} | meal="${mealName}"`);
      memCache.delete(cacheKey);
    } else {
      const urlType = memHit.url.startsWith('data:') ? 'base64-ephemeral' : isPermanentUrl(memHit.url) ? 'permanent' : 'unknown';
      console.log(`[IMG-LIFECYCLE:${traceId}] MEM-CACHE HIT | urlType=${urlType} | meal="${mealName}" | +${Date.now()-_t0}ms`);
      return {
        url: memHit.url,
        prompt: "(memory cache)",
        templateRef: request.templateRef,
        hash: cacheKey,
        createdAt: new Date().toISOString(),
      };
    }
  }

  // ── LAYER 3: CHECK DB CACHE ─────────────────────────────────────────────────
  console.log(`[IMG-LIFECYCLE:${traceId}] DB-CHECK | +${Date.now()-_t0}ms`);
  try {
    const [dbRow] = await db
      .select({
        imageUrl: mealImageCache.imageUrl,
        promptUsed: mealImageCache.promptUsed,
        validationStatus: mealImageCache.validationStatus,
        recipeSignature: mealImageCache.recipeSignature,
      })
      .from(mealImageCache)
      .where(eq(mealImageCache.cacheKey, cacheKey))
      .limit(1);

    if (dbRow) {
      if (!isCacheRowServable(dbRow, currentSignature)) {
        // Legacy NULL-validation row, FAIL row, or signature mismatch — never
        // serve it; evict and regenerate through the full validation gate.
        console.warn(`[IMG-LIFECYCLE:${traceId}] DB-CACHE EVICT (unvalidated or signature mismatch) | status=${dbRow.validationStatus} | meal="${mealName}"`);
        try {
          await db.delete(mealImageCache).where(eq(mealImageCache.cacheKey, cacheKey));
        } catch {}
      } else if (isPermanentUrl(dbRow.imageUrl)) {
        console.log(`[IMG-LIFECYCLE:${traceId}] DB-CACHE HIT (permanent, validated) | meal="${mealName}" | +${Date.now()-_t0}ms`);
        memCache.set(cacheKey, { url: dbRow.imageUrl, validationStatus: dbRow.validationStatus, recipeSignature: dbRow.recipeSignature });
        return {
          url: dbRow.imageUrl,
          prompt: dbRow.promptUsed || "(db cache)",
          templateRef: request.templateRef,
          hash: cacheKey,
          createdAt: new Date().toISOString(),
        };
      } else {
        console.warn(`[IMG-LIFECYCLE:${traceId}] DB-CACHE EVICT (stale temp URL) | meal="${mealName}"`);
        try {
          await db.delete(mealImageCache).where(eq(mealImageCache.cacheKey, cacheKey));
        } catch {}
      }
    }
  } catch (dbErr) {
    console.warn(`⚠️ DB cache read failed for "${mealName}":`, dbErr);
  }

  // ── LAYER 1: BUILD STRONG PROMPT ───────────────────────────────────────────
  const prompt = buildMealImagePrompt(mealName, ingredients, sourceType, pediatricContext);

  if (process.env.NODE_ENV === "development") {
    console.log(`📝 IMAGE PROMPT for "${mealName}":\n${prompt}`);
  } else {
    console.log(`🎨 Generating image for: ${mealName}`);
  }

  // ── LAYER 1: CALL DALL-E WITH TIMEOUT ──────────────────────────────────────
  const callDalle = async (dallePrompt: string): Promise<string | null> => {
    try {
      const response = await withTimeout(
        (getOpenAI().images.generate as any)({
          model: "gpt-image-1",
          prompt: dallePrompt,
          n: 1,
          size: "1024x1024",
          quality: "low",
        }),
        60000
      );
      const item = (response as any).data?.[0];
      if (item?.url) return item.url;
      if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
      return null;
    } catch (dalleErr: any) {
      console.warn(`⚠️ DALL-E failed for "${mealName}": ${dalleErr.message} +${Date.now()-_t0}ms`);
      return null;
    }
  };

  let imageUrl: string | null = null;
  console.log(`[IMG-LIFECYCLE:${traceId}] DALLE-START | +${Date.now()-_t0}ms`);
  imageUrl = await callDalle(prompt);
  const dalleUrlType = imageUrl?.startsWith('data:') ? 'base64' : imageUrl ? 'url' : 'null';
  console.log(`[IMG-LIFECYCLE:${traceId}] DALLE-DONE | urlType=${dalleUrlType} | +${Date.now()-_t0}ms`);

  // ── LAYER 4: FALLBACK — NEVER RETURN NULL ──────────────────────────────────
  if (!imageUrl) {
    const fallback = getSemanticFallback(mealName);
    console.log(`🛡️ Using semantic fallback for "${mealName}": ${fallback}`);
    memCache.set(cacheKey, { url: fallback, validationStatus: "SKIPPED", recipeSignature: currentSignature });
    return {
      url: fallback,
      prompt: `Fallback (generation failed): ${mealName}`,
      templateRef: request.templateRef,
      hash: cacheKey,
      createdAt: new Date().toISOString(),
    };
  }

  // ── RECIPE FIDELITY VALIDATION (between DALLE-DONE and STORAGE-START) ─────
  // The canonical recipe ingredient list outranks the dish name, cuisine label,
  // cultural convention, and model prior knowledge. Only images that pass this
  // vision check may enter the cache.
  let finalPrompt = prompt;
  console.log(`[IMG-LIFECYCLE:${traceId}] VALIDATE-START | +${Date.now()-_t0}ms`);
  const dishForValidation = detectDishType(mealName);
  let validation: ValidationResult = await validateImageAgainstRecipe(imageUrl, mealName, ingredients, {
    structuralIdentity: dishForValidation.structuralIdentity,
  });
  console.log(`[IMG-LIFECYCLE:${traceId}] VALIDATE-DONE | verdict=${validation.verdict}${validation.reason ? ` | reason=${validation.reason}` : ''} | +${Date.now()-_t0}ms`);

  if (validation.verdict === "FAIL") {
    // ONE targeted retry with a strengthened prompt naming the detected offender.
    const retryPrompt = prompt + buildRetryExclusionAddendum(mealName, validation.reason ?? "off-recipe ingredient", dishForValidation.structuralIdentity);
    console.log(`[IMG-LIFECYCLE:${traceId}] RETRY-START | excluding="${validation.reason}" | +${Date.now()-_t0}ms`);
    const retryUrl = await callDalle(retryPrompt);

    if (retryUrl) {
      const retryValidation = await validateImageAgainstRecipe(retryUrl, mealName, ingredients, {
        structuralIdentity: dishForValidation.structuralIdentity,
      });
      console.log(`[IMG-LIFECYCLE:${traceId}] RETRY-VALIDATE-DONE | verdict=${retryValidation.verdict}${retryValidation.reason ? ` | reason=${retryValidation.reason}` : ''} | +${Date.now()-_t0}ms`);
      if (retryValidation.verdict !== "FAIL") {
        imageUrl = retryUrl;
        finalPrompt = retryPrompt;
        validation = retryValidation;
      } else {
        validation = retryValidation;
      }
    }

    if (validation.verdict === "FAIL") {
      // FAIL CLOSED: never cache the bad image, never quietly show it.
      // Serve the semantic fallback and log full failure context.
      const fallback = getSemanticFallback(mealName);
      console.error(
        `[IMG-VALIDATION-FAIL:${traceId}] Recipe fidelity validation failed after retry — serving semantic fallback. ` +
        `meal="${mealName}" | ingredients=${JSON.stringify(ingredients)} | ` +
        `violation="${validation.reason}" | model=${validation.model} | ` +
        `recipeSignature=${computeRecipeSignature(ingredients)} | prompt=${JSON.stringify(finalPrompt)}`
      );
      // Deliberately NOT written to memCache or DB cache — next request retries fresh.
      return {
        url: fallback,
        prompt: `Fallback (validation failed: ${validation.reason}): ${mealName}`,
        templateRef: request.templateRef,
        hash: cacheKey,
        createdAt: new Date().toISOString(),
      };
    }
  }

  const recipeSignature = currentSignature;

  // ── FOREGROUND OBJECT STORAGE PERSIST ───────────────────────────────────
  // Upload to Object Storage synchronously before returning so the client
  // always receives a small, persistent /public-objects/ URL — never a
  // base64 blob. This is critical for localStorage persistence across
  // navigation (base64 is ~2MB and silently fails the localStorage quota
  // write, losing the image on next page load).
  console.log(`[IMG-LIFECYCLE:${traceId}] STORAGE-START | +${Date.now()-_t0}ms`);
  try {
    const ingestionResult = await ingestImageToPermanentStorage(imageUrl, mealName);
    if (ingestionResult.success && ingestionResult.permanentUrl) {
      const permanentUrl = ingestionResult.permanentUrl;
      try {
        const cacheRow = {
          cacheKey,
          imageUrl: permanentUrl,
          mealName,
          promptUsed: finalPrompt,
          validationStatus: validation.verdict,
          validationModel: validation.model,
          validationReason: validation.reason,
          recipeSignature,
        };
        await db
          .insert(mealImageCache)
          .values(cacheRow)
          .onConflictDoUpdate({
            target: mealImageCache.cacheKey,
            set: { ...cacheRow },
          });
        console.log(`✅ Object Storage URL cached in DB for: ${mealName} +${Date.now()-_t0}ms`);
      } catch (dbErr) {
        console.warn(`⚠️ DB write failed for "${mealName}":`, dbErr);
      }
      memCache.set(cacheKey, { url: permanentUrl, validationStatus: validation.verdict, recipeSignature });
      console.log(`[IMG-LIFECYCLE:${traceId}] STORAGE-DONE (permanent) | url=${permanentUrl.substring(0, 60)} | +${Date.now()-_t0}ms`);
      return {
        url: permanentUrl,
        prompt: finalPrompt,
        templateRef: request.templateRef,
        hash: cacheKey,
        createdAt: new Date().toISOString(),
      };
    } else {
      console.warn(`[IMG-LIFECYCLE:${traceId}] STORAGE-FAIL | reason=${ingestionResult.error ?? 'unknown'} | meal="${mealName}"`);
    }
  } catch (uploadErr: any) {
    console.warn(`[IMG-LIFECYCLE:${traceId}] STORAGE-THREW | msg=${uploadErr.message?.substring(0, 80)} | meal="${mealName}"`);
  }

  // Object Storage upload failed — image is EPHEMERAL (base64 in memCache only).
  // WARNING: On server restart or memCache eviction, the next request for this
  // meal will call DALL-E again and may return a different image.
  if (imageUrl.startsWith('data:')) {
    memCache.set(cacheKey, { url: imageUrl, validationStatus: validation.verdict, recipeSignature });
    console.warn(`[IMG-LIFECYCLE:${traceId}] STORAGE-FALLBACK | urlType=base64-ephemeral | meal="${mealName}" | +${Date.now()-_t0}ms — IMAGE WILL DIFFER AFTER SERVER RESTART`);
  } else {
    console.warn(`[IMG-LIFECYCLE:${traceId}] STORAGE-FALLBACK | urlType=ephemeral-url | meal="${mealName}" — skipping memCache, will regenerate on next request`);
  }
  return {
    url: imageUrl,
    prompt: finalPrompt,
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
  const entry = memCache.get(cacheKey);
  if (!entry) return null;
  if (!isCacheRowServable(entry, computeRecipeSignature(request.ingredients))) return null;
  return {
    url: entry.url,
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
// DO NOT call generateImage() directly from any other module.
// DO NOT pass raw AI descriptions as image prompts.
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMealImageUnified(
  mealName: string,
  ingredients: Array<string | Record<string, any>> = [],
  sourceType?: ImageSourceType,
  pediatricContext?: PediatricImageContext
): Promise<string> {
  if (!mealName || !mealName.trim()) {
    return getSemanticFallback("meal");
  }

  // NORMALIZATION — applied before cache key and prompt construction
  const normalizedName = normalizeMealName(mealName);

  const ingredientNames = ingredients
    .map(i => typeof i === "string" ? i : (i.name || i.item || ""))
    .map(i => (i || "").trim())
    .filter(Boolean);

  // FAIL CLOSED: no usable recipe contract → semantic fallback, never cached.
  if (ingredientNames.length === 0) {
    console.warn(`[IMG-VALIDATION-SKIP] generateMealImageUnified called without ingredients — semantic fallback | meal="${normalizedName}"`);
    return getSemanticFallback(normalizedName);
  }

  // IN-FLIGHT DEDUPLICATION: if an identical request is already running
  // (e.g. server pre-warm fired by the pipeline + client request arriving
  // moments later), join the existing promise instead of spawning a second
  // DALL-E call.
  const dedupeKey = buildStableCacheKey(normalizedName, ingredientNames, sourceType, pediatricContext?.stage);
  const existing = inflightRequests.get(dedupeKey);
  if (existing) {
    console.log(`⚡ [img-dedup] joining in-flight request for: ${normalizedName}`);
    return existing;
  }

  const work = generateMealImage({
    mealName: normalizedName,
    ingredients: ingredientNames,
    sourceType,
    pediatricContext,
  }).then(r => r.url).finally(() => {
    inflightRequests.delete(dedupeKey);
  });

  inflightRequests.set(dedupeKey, work);
  return work;
}
