// 🔒 LOCKED: Fridge Rescue Ingredient Mappings - DO NOT MODIFY
// This deterministic mapping system works perfectly - user confirmed
// Any changes will break the reliable ingredient categorization
import { Pantry } from '../types/fridge';

// Canonical mapping from user text → tags + slot buckets
// Keep small & opinionated for reliability. Expand over time.
export const CANONICAL_TAGS: Record<string, { tag: string; bucket: keyof Pantry }[]> = {
  // proteins
  'chicken': [{ tag: 'chicken', bucket: 'proteins' }],
  'chicken breast': [{ tag: 'chicken', bucket: 'proteins' }],
  'ground turkey': [{ tag: 'turkey', bucket: 'proteins' }],
  'turkey': [{ tag: 'turkey', bucket: 'proteins' }],
  'beef': [{ tag: 'beef', bucket: 'proteins' }],
  'steak': [{ tag: 'beef', bucket: 'proteins' }],
  'eggs': [{ tag: 'eggs', bucket: 'proteins' }],
  'egg': [{ tag: 'eggs', bucket: 'proteins' }],
  'tuna': [{ tag: 'tuna', bucket: 'proteins' }],
  'salmon': [{ tag: 'salmon', bucket: 'proteins' }],
  'shrimp': [{ tag: 'shrimp', bucket: 'proteins' }],
  'tofu': [{ tag: 'tofu', bucket: 'proteins' }],
  'tempeh': [{ tag: 'tempeh', bucket: 'proteins' }],
  'beans': [{ tag: 'beans', bucket: 'proteins' }],
  'lentils': [{ tag: 'lentils', bucket: 'proteins' }],
  // vegs
  'broccoli': [{ tag: 'broccoli', bucket: 'vegs' }],
  'spinach': [{ tag: 'spinach', bucket: 'vegs' }],
  'kale': [{ tag: 'kale', bucket: 'vegs' }],
  'bell pepper': [{ tag: 'bell_pepper', bucket: 'vegs' }],
  'peppers': [{ tag: 'bell_pepper', bucket: 'vegs' }],
  'onion': [{ tag: 'onion', bucket: 'aromas' }],
  'garlic': [{ tag: 'garlic', bucket: 'aromas' }],
  'tomato': [{ tag: 'tomato', bucket: 'vegs' }],
  'zucchini': [{ tag: 'zucchini', bucket: 'vegs' }],
  'carrot': [{ tag: 'carrot', bucket: 'vegs' }],
  'lettuce': [{ tag: 'lettuce', bucket: 'vegs' }],
  'cucumber': [{ tag: 'cucumber', bucket: 'vegs' }],
  'mushrooms': [{ tag: 'mushrooms', bucket: 'vegs' }],
  'cauliflower': [{ tag: 'cauliflower', bucket: 'vegs' }],
  'asparagus': [{ tag: 'asparagus', bucket: 'vegs' }],
  // carbs
  'rice': [{ tag: 'rice', bucket: 'carbs' }],
  'brown rice': [{ tag: 'rice', bucket: 'carbs' }],
  'quinoa': [{ tag: 'quinoa', bucket: 'carbs' }],
  'pasta': [{ tag: 'pasta', bucket: 'carbs' }],
  'tortilla': [{ tag: 'tortilla', bucket: 'carbs' }],
  'bread': [{ tag: 'bread', bucket: 'carbs' }],
  'potato': [{ tag: 'potato', bucket: 'carbs' }],
  'sweet potato': [{ tag: 'sweet_potato', bucket: 'carbs' }],
  'noodles': [{ tag: 'pasta', bucket: 'carbs' }],
  // fats
  'olive oil': [{ tag: 'olive_oil', bucket: 'fats' }],
  'avocado oil': [{ tag: 'avocado_oil', bucket: 'fats' }],
  'butter': [{ tag: 'butter', bucket: 'fats' }],
  'avocado': [{ tag: 'avocado', bucket: 'fats' }],
  'cheese': [{ tag: 'cheese', bucket: 'fats' }],
  'parmesan': [{ tag: 'cheese', bucket: 'fats' }],
  'mozzarella': [{ tag: 'cheese', bucket: 'fats' }],
  'nuts': [{ tag: 'nuts', bucket: 'fats' }],
  'coconut oil': [{ tag: 'coconut_oil', bucket: 'fats' }],
  // condiments
  'soy sauce': [{ tag: 'soy_sauce', bucket: 'condiments' as any }],
  'salsa': [{ tag: 'salsa', bucket: 'condiments' as any }],
  'tomato sauce': [{ tag: 'tomato_sauce', bucket: 'condiments' as any }],
  'pesto': [{ tag: 'pesto', bucket: 'condiments' as any }],
  'hot sauce': [{ tag: 'hot_sauce', bucket: 'condiments' as any }],
  'bbq sauce': [{ tag: 'bbq_sauce', bucket: 'condiments' as any }],
};