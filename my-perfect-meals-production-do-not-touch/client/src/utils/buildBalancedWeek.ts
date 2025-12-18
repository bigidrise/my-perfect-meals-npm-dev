export interface NutritionTargets {
  dailyCalories: number;
  proteinPerMeal: number;
  carbRangeMin: number; // percentage
  carbRangeMax: number; // percentage
  vegetableCupsMin: number;
  vegetableCupsMax: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cuisine: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  vegetables: number; // cups
  allergens: string[];
  dietTags: string[];
  description?: string;
  imageUrl?: string;
}

export interface WeeklyPlanConstraints {
  dietaryPreferences: string[];
  allergens: string[];
  minBreakfasts: number;
  minLunches: number;
  minDinners: number;
  minSnacks: number;
  allowRounding: boolean;
}

export interface DayPlan {
  breakfast: MealTemplate;
  lunch: MealTemplate;
  dinner: MealTemplate;
  snacks: MealTemplate[];
}

export interface WeeklyPlan {
  monday: DayPlan;
  tuesday: DayPlan;
  wednesday: DayPlan;
  thursday: DayPlan;
  friday: DayPlan;
  saturday: DayPlan;
  sunday: DayPlan;
}

export interface BuildBalancedWeekOptions {
  targets: NutritionTargets;
  constraints: WeeklyPlanConstraints;
  templates: MealTemplate[];
}

/**
 * Builds a balanced weekly meal plan based on nutrition targets, dietary constraints, and available templates
 */
export function buildBalancedWeek(options: BuildBalancedWeekOptions): WeeklyPlan {
  const { targets, constraints, templates } = options;
  
  // Filter templates based on dietary preferences and allergens
  const filteredTemplates = filterTemplatesByConstraints(templates, constraints);
  
  // Separate templates by meal type
  const breakfasts = filteredTemplates.filter(t => t.type === 'breakfast');
  const lunches = filteredTemplates.filter(t => t.type === 'lunch');
  const dinners = filteredTemplates.filter(t => t.type === 'dinner');
  const snacks = filteredTemplates.filter(t => t.type === 'snack');
  
  // Validate we have enough unique options
  validateTemplateAvailability(breakfasts, lunches, dinners, snacks, constraints);
  
  // Generate weekly plan
  const weeklyPlan: WeeklyPlan = {
    monday: generateDayPlan(breakfasts, lunches, dinners, snacks, targets, 'monday'),
    tuesday: generateDayPlan(breakfasts, lunches, dinners, snacks, targets, 'tuesday'),
    wednesday: generateDayPlan(breakfasts, lunches, dinners, snacks, targets, 'wednesday'),
    thursday: generateDayPlan(breakfasts, lunches, dinners, snacks, targets, 'thursday'),
    friday: generateDayPlan(breakfasts, lunches, dinners, snacks, targets, 'friday'),
    saturday: generateDayPlan(breakfasts, lunches, dinners, snacks, targets, 'saturday'),
    sunday: generateDayPlan(breakfasts, lunches, dinners, snacks, targets, 'sunday'),
  };
  
  // Ensure diversity across the week
  ensureWeeklyDiversity(weeklyPlan, constraints);
  
  // Validate nutrition adherence
  validateNutritionAdherence(weeklyPlan, targets);
  
  return weeklyPlan;
}

function filterTemplatesByConstraints(
  templates: MealTemplate[], 
  constraints: WeeklyPlanConstraints
): MealTemplate[] {
  return templates.filter(template => {
    // Check dietary preferences
    const matchesDiet = constraints.dietaryPreferences.length === 0 || 
      constraints.dietaryPreferences.some(pref => template.dietTags.includes(pref));
    
    // Check allergens
    const hasAllergens = constraints.allergens.some(allergen => 
      template.allergens.includes(allergen)
    );
    
    return matchesDiet && !hasAllergens;
  });
}

function validateTemplateAvailability(
  breakfasts: MealTemplate[],
  lunches: MealTemplate[],
  dinners: MealTemplate[],
  snacks: MealTemplate[],
  constraints: WeeklyPlanConstraints
): void {
  if (breakfasts.length < constraints.minBreakfasts) {
    throw new Error(`Need at least ${constraints.minBreakfasts} breakfast options, found ${breakfasts.length}`);
  }
  if (lunches.length < constraints.minLunches) {
    throw new Error(`Need at least ${constraints.minLunches} lunch options, found ${lunches.length}`);
  }
  if (dinners.length < constraints.minDinners) {
    throw new Error(`Need at least ${constraints.minDinners} dinner options, found ${dinners.length}`);
  }
  if (snacks.length < constraints.minSnacks) {
    throw new Error(`Need at least ${constraints.minSnacks} snack options, found ${snacks.length}`);
  }
}

function generateDayPlan(
  breakfasts: MealTemplate[],
  lunches: MealTemplate[],
  dinners: MealTemplate[],
  snacks: MealTemplate[],
  targets: NutritionTargets,
  day: string
): DayPlan {
  // Select meals with some variety logic
  const breakfast = selectMealWithTargets(breakfasts, targets, 'breakfast');
  const lunch = selectMealWithTargets(lunches, targets, 'lunch');
  const dinner = selectMealWithTargets(dinners, targets, 'dinner');
  
  // Select 1-2 snacks
  const selectedSnacks = [selectMealWithTargets(snacks, targets, 'snack')];
  
  return {
    breakfast,
    lunch,
    dinner,
    snacks: selectedSnacks
  };
}

function selectMealWithTargets(
  options: MealTemplate[],
  targets: NutritionTargets,
  mealType: string
): MealTemplate {
  // Simple selection for now - could be enhanced with more sophisticated logic
  // that considers nutrition targets, cuisine rotation, etc.
  const randomIndex = Math.floor(Math.random() * options.length);
  return options[randomIndex];
}

function ensureWeeklyDiversity(weeklyPlan: WeeklyPlan, constraints: WeeklyPlanConstraints): void {
  // Collect all meals used in the week
  const days = Object.values(weeklyPlan);
  const breakfastsUsed = days.map(day => day.breakfast.id);
  const lunchesUsed = days.map(day => day.lunch.id);
  const dinnersUsed = days.map(day => day.dinner.id);
  
  // Count unique meals
  const uniqueBreakfasts = new Set(breakfastsUsed).size;
  const uniqueLunches = new Set(lunchesUsed).size;
  const uniqueDinners = new Set(dinnersUsed).size;
  
  // Ensure minimum diversity requirements are met
  if (uniqueBreakfasts < constraints.minBreakfasts) {
    console.warn(`Only ${uniqueBreakfasts} unique breakfasts in plan, target was ${constraints.minBreakfasts}`);
  }
  if (uniqueLunches < constraints.minLunches) {
    console.warn(`Only ${uniqueLunches} unique lunches in plan, target was ${constraints.minLunches}`);
  }
  if (uniqueDinners < constraints.minDinners) {
    console.warn(`Only ${uniqueDinners} unique dinners in plan, target was ${constraints.minDinners}`);
  }
}

function validateNutritionAdherence(weeklyPlan: WeeklyPlan, targets: NutritionTargets): void {
  const days = Object.values(weeklyPlan);
  
  days.forEach((day, index) => {
    const dayName = Object.keys(weeklyPlan)[index];
    
    // Calculate daily totals
    const totalCalories = day.breakfast.calories + day.lunch.calories + day.dinner.calories + 
      day.snacks.reduce((sum: number, snack: MealTemplate) => sum + snack.calories, 0);
    
    const totalProtein = day.breakfast.protein + day.lunch.protein + day.dinner.protein + 
      day.snacks.reduce((sum: number, snack: MealTemplate) => sum + snack.protein, 0);
    
    const totalVegetables = day.breakfast.vegetables + day.lunch.vegetables + day.dinner.vegetables + 
      day.snacks.reduce((sum: number, snack: MealTemplate) => sum + snack.vegetables, 0);
    
    // Check protein per meal (approximate)
    const avgProteinPerMeal = totalProtein / 3; // excluding snacks
    if (Math.abs(avgProteinPerMeal - targets.proteinPerMeal) > 5) {
      console.warn(`${dayName}: Protein per meal ${avgProteinPerMeal}g vs target ${targets.proteinPerMeal}g`);
    }
    
    // Check vegetable requirements
    if (totalVegetables < targets.vegetableCupsMin * 3) { // 3 main meals
      console.warn(`${dayName}: Only ${totalVegetables} cups vegetables vs target ${targets.vegetableCupsMin * 3}+ cups`);
    }
    
    // Check calorie adherence (±10% tolerance)
    const calorieVariance = Math.abs(totalCalories - targets.dailyCalories) / targets.dailyCalories;
    if (calorieVariance > 0.1) {
      console.warn(`${dayName}: Calories ${totalCalories} vs target ${targets.dailyCalories} (${(calorieVariance * 100).toFixed(1)}% variance)`);
    }
  });
}

// Default constraints for typical usage
export const DEFAULT_CONSTRAINTS: WeeklyPlanConstraints = {
  dietaryPreferences: [],
  allergens: [],
  minBreakfasts: 3,
  minLunches: 3,
  minDinners: 3,
  minSnacks: 2,
  allowRounding: true,
};

// Default targets based on common requirements
export const DEFAULT_TARGETS: NutritionTargets = {
  dailyCalories: 2200,
  proteinPerMeal: 35,
  carbRangeMin: 45,
  carbRangeMax: 65,
  vegetableCupsMin: 2,
  vegetableCupsMax: 3,
};