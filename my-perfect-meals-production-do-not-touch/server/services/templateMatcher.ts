/**
 * Template Matcher Service
 * 
 * Finds matching meal templates from the catalog based on ingredients.
 * This provides the DETERMINISTIC baseline that always works without AI.
 */

import { BREAKFAST_TEMPLATES } from '../../shared/catalog/mealTemplates.catalog';
import { LUNCH_TEMPLATES } from '../../shared/catalog/lunchTemplates.catalog';
import { DINNER_TEMPLATES } from '../../shared/catalog/dinnerTemplates.catalog';
import { MealTemplate } from '../../shared/catalog/_types';
import { 
  createIngredientSignature, 
  calculateSignatureSimilarity,
  IngredientSignatureInput 
} from './ingredientSignature';

interface MatchResult {
  template: MealTemplate;
  score: number;
  matchType: 'exact' | 'partial' | 'category';
}

// Fallback images by meal type
const FALLBACK_IMAGES: Record<string, string> = {
  breakfast: '/images/cravings/protein-pancakes.jpg',
  lunch: '/images/cravings/mediterranean-hummus-plate.jpg',
  dinner: '/images/cravings/turkey-nacho-skillet.jpg',
  snack: '/images/cravings/protein-trailmix-clusters.jpg',
  default: '/images/cravings/satisfy-cravings.jpg'
};

// Map template imageKeys to actual available images
const IMAGE_KEY_MAP: Record<string, string> = {
  // Breakfast - Eggs
  'img_eggs_scrambled': '/images/cravings/protein-pancakes.jpg',
  'img_eggs_fried': '/images/cravings/protein-pancakes.jpg',
  'img_eggs_boiled': '/images/cravings/protein-pancakes.jpg',
  'img_eggs_poached': '/images/cravings/protein-pancakes.jpg',
  'img_egg_whites_scrambled': '/images/cravings/protein-pancakes.jpg',
  
  // Breakfast - Proteins
  'img_turkey_sausage_pan_seared': '/images/cravings/protein-pancakes.jpg',
  'img_chicken_breast_grilled': '/images/cravings/chicken-tenders.jpg',
  'img_ground_turkey_pan_seared': '/images/cravings/protein-pancakes.jpg',
  
  // Breakfast - Dairy
  'img_greek_yogurt': '/images/cravings/coconut-chia-pudding.jpg',
  'img_cottage_cheese': '/images/cravings/coconut-chia-pudding.jpg',
  
  // Breakfast - Oats/Carbs
  'img_oatmeal': '/images/cravings/cinnamon-roll-oats.jpg',
  'img_oats_boiled': '/images/cravings/cinnamon-roll-oats.jpg',
  
  // Lunch proteins
  'img_chickenbreast_grilled': '/images/cravings/chicken-tenders.jpg',
  'img_turkey_pan_seared': '/images/cravings/chicken-tenders.jpg',
  'img_salmon_baked': '/images/cravings/mediterranean-hummus-plate.jpg',
  'img_steak_grilled': '/images/cravings/turkey-nacho-skillet.jpg',
  'img_shrimp_pan_seared': '/images/cravings/mediterranean-hummus-plate.jpg',
  
  // Dinner combos
  'img_chicken_sweetpotato_broccoli': '/images/cravings/chicken-tenders.jpg',
  'img_salmon_rice_greenbeans': '/images/cravings/mediterranean-hummus-plate.jpg',
  'img_beef_rice_asparagus': '/images/cravings/turkey-nacho-skillet.jpg',
};

/**
 * Resolve template imageKey to actual image URL
 */
function resolveImageKey(imageKey: string | undefined, mealType: string): string {
  if (!imageKey) {
    return FALLBACK_IMAGES[mealType] || FALLBACK_IMAGES.default;
  }
  
  // Check direct mapping
  if (IMAGE_KEY_MAP[imageKey]) {
    return IMAGE_KEY_MAP[imageKey];
  }
  
  // Fallback by meal type
  return FALLBACK_IMAGES[mealType] || FALLBACK_IMAGES.default;
}

/**
 * Get all templates from all catalogs
 */
function getAllTemplates(): MealTemplate[] {
  return [
    ...BREAKFAST_TEMPLATES,
    ...LUNCH_TEMPLATES,
    ...DINNER_TEMPLATES,
  ];
}

/**
 * Find templates that match the given ingredients
 */
export function findMatchingTemplates(
  input: IngredientSignatureInput,
  maxResults: number = 3
): MatchResult[] {
  const inputSignature = createIngredientSignature(input);
  const templates = getAllTemplates().filter(t => t.mealType === input.mealType);
  
  const scored: MatchResult[] = templates.map(template => {
    const templateIngredients = template.ingredients.map(i => i.ingredientId);
    const templateSignature = createIngredientSignature({
      ingredients: templateIngredients,
      mealType: template.mealType,
      cookingMethods: template.defaultCookingMethods as Record<string, string>
    });
    
    const score = calculateSignatureSimilarity(inputSignature, templateSignature);
    
    let matchType: 'exact' | 'partial' | 'category' = 'category';
    if (score === 1) matchType = 'exact';
    else if (score >= 0.5) matchType = 'partial';
    
    return { template, score, matchType };
  });
  
  return scored
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Get a deterministic fallback meal when no template matches
 * Selection is stable: always returns the same template for the same meal type
 */
export function getDeterministicFallback(
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  requestedIngredients: string[]
): {
  id: string;
  name: string;
  description: string;
  ingredients: Array<{ name: string; quantity: string; unit: string }>;
  instructions: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl: string;
  source: 'template';
} {
  const templates = getAllTemplates().filter(t => t.mealType === mealType);
  
  if (templates.length > 0) {
    // Deterministic selection: use ingredient hash to pick template
    const ingredientStr = requestedIngredients.sort().join('');
    let hash = 0;
    for (let i = 0; i < ingredientStr.length; i++) {
      hash = ((hash << 5) - hash) + ingredientStr.charCodeAt(i);
      hash = hash & hash;
    }
    const index = Math.abs(hash) % templates.length;
    const template = templates[index];
    
    // Use stable ID based on template + ingredients hash
    const stableId = `fallback-${template.id}-${Math.abs(hash).toString(36)}`;
    
    return {
      id: stableId,
      name: template.name,
      description: `A delicious ${mealType} featuring ${template.ingredients.map(i => i.ingredientId.replace(/_/g, ' ')).join(', ')}`,
      ingredients: template.ingredients.map(i => ({
        name: i.ingredientId.replace(/_/g, ' '),
        quantity: String(i.grams),
        unit: 'g'
      })),
      instructions: template.baseInstructions || `Prepare the ${template.name} using standard cooking methods.`,
      calories: 350,
      protein: 25,
      carbs: 30,
      fat: 12,
      imageUrl: resolveImageKey(template.imageKey, mealType),
      source: 'template'
    };
  }
  
  // Generic fallback with stable ID based on ingredients
  const ingredientStr = requestedIngredients.sort().join('');
  let hash = 0;
  for (let i = 0; i < ingredientStr.length; i++) {
    hash = ((hash << 5) - hash) + ingredientStr.charCodeAt(i);
    hash = hash & hash;
  }
  const stableId = `fallback-generic-${mealType}-${Math.abs(hash).toString(36)}`;
  
  return {
    id: stableId,
    name: `Healthy ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`,
    description: `A nutritious ${mealType} with balanced macros`,
    ingredients: requestedIngredients.map(ing => ({
      name: ing,
      quantity: 'as needed',
      unit: ''
    })),
    instructions: 'Prepare ingredients and cook to your preference.',
    calories: 350,
    protein: 25,
    carbs: 30,
    fat: 12,
    imageUrl: FALLBACK_IMAGES[mealType] || FALLBACK_IMAGES.default,
    source: 'template'
  };
}

/**
 * Convert a template to a meal-ready format
 * Uses stable ID based on template ID
 */
export function templateToMeal(
  template: MealTemplate,
  overrides?: Partial<{ calories: number; protein: number; carbs: number; fat: number }>,
  index: number = 0
) {
  // Use stable ID: template ID + index for uniqueness in multi-meal responses
  const stableId = `template-${template.id}${index > 0 ? `-${index}` : ''}`;
  
  return {
    id: stableId,
    name: template.name,
    description: `A delicious ${template.mealType} featuring ${template.ingredients.map(i => i.ingredientId.replace(/_/g, ' ')).join(', ')}`,
    ingredients: template.ingredients.map(i => ({
      name: i.ingredientId.replace(/_/g, ' '),
      quantity: String(i.grams),
      unit: 'g'
    })),
    instructions: template.baseInstructions || `Prepare the ${template.name} using the selected cooking methods.`,
    calories: overrides?.calories || 350,
    protein: overrides?.protein || 25,
    carbs: overrides?.carbs || 30,
    fat: overrides?.fat || 12,
    imageUrl: resolveImageKey(template.imageKey, template.mealType),
    source: 'template' as const
  };
}
