// client/src/utils/weekGenerator.ts
// Pure functions for generating balanced weekly meal plans
// Uses existing templates, scaling, and target computation utilities

import type { MealTemplateBase, MealType, NutritionInfo } from "@/data/models";
import type { MacroTargets } from "@/utils/computeTargets";
import { TEMPLATES_SEED } from "@/data/templates.seed";
import { scaleTemplateToTargets } from "@/utils/scaler";
import type { WeekBoard } from "@/lib/boardApi";

// Types matching the specification
export type DietMode = "any" | "vegetarian" | "vegan";
export type TimePerMeal = "quick" | "normal";

export type Staples = {
  proteins?: string[]; // e.g. ["chicken","tofu","eggs","salmon"]
  carbs?: string[];    // e.g. ["rice","tortillas","pasta","potatoes"]
  produce?: string[];  // e.g. ["broccoli","peppers","spinach","berries"]
};

export type GenerateInputs = {
  weekStartISO: string;        // Monday ISO (YYYY-MM-DD)
  diet: DietMode;              // from onboarding
  exclusions: string[];        // allergens/dislikes from onboarding
  staples?: Staples;           // optional chips picked in the builder
  snacksPerDay?: 0 | 1 | 2 | 3;
  timePerMeal?: TimePerMeal;   // "quick" or "normal"
  rounding?: "tenth" | "half" | "whole";
};

// Template type alias for compatibility
export type Template = MealTemplateBase & {
  proteinTag?: string; // optional, helps rotation (e.g., "chicken","tofu")
  technique?: string;  // e.g., "air-fryer","bake","stovetop"
};

export type Targets = MacroTargets;

// Helper to filter templates by dietary preferences
function filterTemplatesByDiet(templates: Template[], diet: DietMode): Template[] {
  if (diet === 'any') return templates;
  
  return templates.filter(template => {
    const badges = template.badges || [];
    if (diet === 'vegan') {
      return badges.some(badge => badge.toLowerCase().includes('vegan'));
    }
    if (diet === 'vegetarian') {
      return badges.some(badge => 
        badge.toLowerCase().includes('vegan') || 
        badge.toLowerCase().includes('vegetarian')
      );
    }
    return true;
  });
}

// Helper to filter out allergens and exclusions
function filterTemplatesByAllergies(templates: Template[], exclusions: string[]): Template[] {
  if (exclusions.length === 0) return templates;
  
  const allExclusions = exclusions.map(item => item.toLowerCase());
  
  return templates.filter(template => {
    // Check allergens field
    if (template.allergens) {
      const hasAllergen = template.allergens.some(allergen => 
        allExclusions.some(exclusion => allergen.toLowerCase().includes(exclusion))
      );
      if (hasAllergen) return false;
    }
    
    // Check ingredients
    const hasExcludedIngredient = template.ingredients?.some(ingredient => 
      allExclusions.some(exclusion => ingredient.name.toLowerCase().includes(exclusion))
    ) || false;
    
    // Check name and badges
    const nameHasExclusion = allExclusions.some(exclusion => 
      template.name.toLowerCase().includes(exclusion)
    );
    
    const badgeHasExclusion = template.badges?.some(badge =>
      allExclusions.some(exclusion => badge.toLowerCase().includes(exclusion))
    ) || false;
    
    return !hasExcludedIngredient && !nameHasExclusion && !badgeHasExclusion;
  });
}

// Helper to get templates by meal type
function getTemplatesByMealType(templates: Template[], mealType: MealType): Template[] {
  return templates.filter(template => template.mealType === mealType);
}

// Helper to select diverse templates avoiding repeats
function selectDiverseTemplates(
  templates: Template[], 
  count: number, 
  usedIds: Set<string> = new Set(),
  staples?: Staples,
  timePerMeal?: TimePerMeal
): Template[] {
  let available = templates.filter(t => !usedIds.has(t.id));
  
  if (available.length === 0) {
    // If we've used all templates, reset and allow repeats
    available = templates;
  }
  
  // Filter by time preference if specified
  if (timePerMeal === 'quick') {
    const quickTemplates = available.filter(template =>
      template.badges?.some(badge => badge.toLowerCase().includes('quick'))
    );
    if (quickTemplates.length > 0) {
      available = quickTemplates;
    }
  }
  
  // Prefer templates with staple ingredients if specified
  if (staples) {
    const allStaples = [...(staples.proteins || []), ...(staples.carbs || []), ...(staples.produce || [])];
    if (allStaples.length > 0) {
      const withStaples = available.filter(template =>
        template.ingredients?.some(ing => 
          allStaples.some(staple => 
            ing.name.toLowerCase().includes(staple.toLowerCase())
          )
        )
      );
      
      if (withStaples.length > 0) {
        available = [...withStaples, ...available.filter(t => !withStaples.includes(t))];
      }
    }
  }
  
  // Shuffle for variety and take the count we need
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Helper to create simple snacks when template snacks aren't available
function createSimpleSnacks(count: number, targets: Targets): Template[] {
  const simpleSnacks: Template[] = [];
  
  for (let i = 0; i < count; i++) {
    simpleSnacks.push({
      id: `simple-snack-${Date.now()}-${i}`,
      name: "Simple Snack",
      archetype: "Balanced",
      mealType: "snack",
      baseServings: 1,
      ingredients: [],
      instructions: ["Quick snack"],
      nutritionPerServing: { 
        calories: 150, 
        protein: 8, 
        carbs: 15, 
        fat: 6 
      },
      source: "template"
    });
  }
  
  return simpleSnacks;
}

// Public API function to pick a template for a specific slot
export function pickTemplateForSlot(
  mealType: MealType,
  inputs: GenerateInputs,
  templates: Template[],
  usedIds: Set<string>
): Template | null {
  const { diet, exclusions, staples, timePerMeal } = inputs;
  
  // Filter templates
  let availableTemplates = filterTemplatesByDiet(templates, diet);
  availableTemplates = filterTemplatesByAllergies(availableTemplates, exclusions);
  
  // Get templates for the specific meal type
  const mealTemplates = getTemplatesByMealType(availableTemplates, mealType);
  
  // Select one template
  const selected = selectDiverseTemplates(mealTemplates, 1, usedIds, staples, timePerMeal);
  
  return selected.length > 0 ? selected[0] : null;
}

// Main function to generate a complete week plan
export function generateWeekFromOnboarding(
  inputs: GenerateInputs,
  templates: Template[],
  targets: Targets
): WeekBoard {
  const { diet, exclusions, staples, snacksPerDay = 1, timePerMeal = 'normal', weekStartISO } = inputs;
  
  // Filter templates based on dietary preferences and allergies
  let availableTemplates = filterTemplatesByDiet(templates, diet);
  availableTemplates = filterTemplatesByAllergies(availableTemplates, exclusions);
  
  // Get templates by meal type
  const breakfastTemplates = getTemplatesByMealType(availableTemplates, 'breakfast');
  const lunchTemplates = getTemplatesByMealType(availableTemplates, 'lunch');
  const dinnerTemplates = getTemplatesByMealType(availableTemplates, 'dinner');
  const snackTemplates = getTemplatesByMealType(availableTemplates, 'snack');
  
  // Track used templates for variety
  const usedIds = new Set<string>();
  
  // Generate 7 days of meals
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const weekBoard: WeekBoard = {
    id: `week-${weekStartISO}`,
    version: 1,
    lists: {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: []
    },
    days: {},
    meta: {
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString()
    }
  };
  
  // Generate meals for each day
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dateISO = new Date(weekStartISO);
    dateISO.setDate(dateISO.getDate() + dayIndex);
    const dayDateISO = dateISO.toISOString().split('T')[0];
    
    // Generate breakfast
    const breakfast = selectDiverseTemplates(breakfastTemplates, 1, usedIds, staples, timePerMeal);
    
    // Generate lunch  
    const lunch = selectDiverseTemplates(lunchTemplates, 1, usedIds, staples, timePerMeal);
    
    // Generate dinner
    const dinner = selectDiverseTemplates(dinnerTemplates, 1, usedIds, staples, timePerMeal);
    
    // Generate snacks
    let snacks: Template[] = [];
    if (snacksPerDay > 0) {
      if (snackTemplates.length > 0) {
        snacks = selectDiverseTemplates(snackTemplates, snacksPerDay, usedIds, staples, timePerMeal);
      }
      
      // Fill remaining snacks with simple options if needed
      if (snacks.length < snacksPerDay) {
        const additionalSnacks = createSimpleSnacks(snacksPerDay - snacks.length, targets);
        snacks = [...snacks, ...additionalSnacks];
      }
    }
    
    // Track usage for variety
    [...breakfast, ...lunch, ...dinner, ...snacks].forEach(meal => {
      usedIds.add(meal.id);
    });
    
    // Convert templates to meals and add to board
    const convertToMeal = (template: Template) => ({
      id: template.id,
      title: template.name,
      servings: 1,
      ingredients: (template.ingredients || []).map(ing => ({
        item: ing.name,
        amount: `${ing.amount} ${ing.unit}`
      })),
      instructions: template.instructions || [],
      nutrition: template.nutritionPerServing,
      source: template.source
    });
    
    weekBoard.days![dayDateISO] = {
      breakfast: breakfast.map(convertToMeal),
      lunch: lunch.map(convertToMeal),
      dinner: dinner.map(convertToMeal),
      snacks: snacks.map(convertToMeal)
    };
  }
  
  return weekBoard;
}

// Function to regenerate a single day
export function regenerateDay(
  board: WeekBoard,
  dateISO: string,
  inputs: GenerateInputs,
  templates: Template[],
  targets: Targets
): WeekBoard {
  const updatedBoard = { ...board };
  
  // Generate new meals for this day
  const { diet, exclusions, staples, snacksPerDay = 1, timePerMeal = 'normal' } = inputs;
  
  // Filter templates
  let availableTemplates = filterTemplatesByDiet(templates, diet);
  availableTemplates = filterTemplatesByAllergies(availableTemplates, exclusions);
  
  // Get templates by meal type
  const breakfastTemplates = getTemplatesByMealType(availableTemplates, 'breakfast');
  const lunchTemplates = getTemplatesByMealType(availableTemplates, 'lunch');
  const dinnerTemplates = getTemplatesByMealType(availableTemplates, 'dinner');
  const snackTemplates = getTemplatesByMealType(availableTemplates, 'snack');
  
  // Create a set of used IDs from other days to maintain variety
  const usedIds = new Set<string>();
  if (board.days) {
    Object.entries(board.days).forEach(([dayDate, dayMeals]) => {
      if (dayDate !== dateISO) {
        Object.values(dayMeals).flat().forEach(meal => usedIds.add(meal.id));
      }
    });
  }
  
  // Generate new meals
  const breakfast = selectDiverseTemplates(breakfastTemplates, 1, usedIds, staples, timePerMeal);
  const lunch = selectDiverseTemplates(lunchTemplates, 1, usedIds, staples, timePerMeal);
  const dinner = selectDiverseTemplates(dinnerTemplates, 1, usedIds, staples, timePerMeal);
  
  let snacks: Template[] = [];
  if (snacksPerDay > 0) {
    if (snackTemplates.length > 0) {
      snacks = selectDiverseTemplates(snackTemplates, snacksPerDay, usedIds, staples, timePerMeal);
    }
    if (snacks.length < snacksPerDay) {
      const additionalSnacks = createSimpleSnacks(snacksPerDay - snacks.length, targets);
      snacks = [...snacks, ...additionalSnacks];
    }
  }
  
  // Convert to meals and update board
  const convertToMeal = (template: Template) => ({
    id: template.id,
    title: template.name,
    servings: 1,
    ingredients: (template.ingredients || []).map(ing => ({
      item: ing.name,
      amount: `${ing.amount} ${ing.unit}`
    })),
    instructions: template.instructions || [],
    nutrition: template.nutritionPerServing,
    source: template.source
  });
  
  if (!updatedBoard.days) updatedBoard.days = {};
  updatedBoard.days[dateISO] = {
    breakfast: breakfast.map(convertToMeal),
    lunch: lunch.map(convertToMeal),
    dinner: dinner.map(convertToMeal),
    snacks: snacks.map(convertToMeal)
  };
  
  return updatedBoard;
}

// Function to swap a single meal in a day
export function swapMeal(
  board: WeekBoard,
  dateISO: string,
  slot: MealType,
  inputs: GenerateInputs,
  templates: Template[],
  targets: Targets
): WeekBoard {
  const updatedBoard = { ...board };
  
  if (!board.days || !board.days[dateISO]) {
    return board;
  }
  
  const { diet, exclusions, staples, timePerMeal = 'normal' } = inputs;
  
  // Filter templates
  let availableTemplates = filterTemplatesByDiet(templates, diet);
  availableTemplates = filterTemplatesByAllergies(availableTemplates, exclusions);
  
  // Get templates for the specific slot
  const slotTemplates = getTemplatesByMealType(availableTemplates, slot);
  
  // Get currently used IDs (excluding the slot we're replacing)
  const usedIds = new Set<string>();
  if (board.days) {
    Object.entries(board.days).forEach(([dayDate, dayMeals]) => {
      Object.entries(dayMeals).forEach(([mealSlot, meals]) => {
        if (dayDate !== dateISO || mealSlot !== slot) {
          meals.forEach(meal => usedIds.add(meal.id));
        }
      });
    });
  }
  
  // Select a new template
  const newTemplates = selectDiverseTemplates(slotTemplates, 1, usedIds, staples, timePerMeal);
  
  if (newTemplates.length > 0) {
    const convertToMeal = (template: Template) => ({
      id: template.id,
      title: template.name,
      servings: 1,
      ingredients: (template.ingredients || []).map(ing => ({
        item: ing.name,
        amount: `${ing.amount} ${ing.unit}`
      })),
      instructions: template.instructions || [],
      nutrition: template.nutritionPerServing,
      source: template.source
    });
    
    if (!updatedBoard.days) updatedBoard.days = {};
    if (!updatedBoard.days[dateISO]) updatedBoard.days[dateISO] = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    
    if (slot === 'snack') {
      updatedBoard.days[dateISO].snacks = newTemplates.map(convertToMeal);
    } else {
      updatedBoard.days[dateISO][slot] = newTemplates.map(convertToMeal);
    }
  }
  
  return updatedBoard;
}