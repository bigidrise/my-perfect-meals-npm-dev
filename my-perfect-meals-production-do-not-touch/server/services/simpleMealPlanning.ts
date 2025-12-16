import { db } from "../db";
import { sql } from "drizzle-orm";

interface MealTemplate {
  id: string;
  name: string;
  type: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTime: number;
  cookTime: number;
  servings: number;
}

interface SimplePlanParams {
  userId: string;
  weeks: number;
  mealsPerDay: number;
  snacksPerDay?: number;
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

// Simple template loader - fast and reliable
async function loadActiveTemplates(): Promise<MealTemplate[]> {
  try {
    const result = await db.execute(sql`
      SELECT id, name, category as type, 
             COALESCE(kcal, 400) as calories, 
             COALESCE(protein, 25) as protein, 
             COALESCE(carbs, 30) as carbs, 
             COALESCE(fat, 15) as fat,
             prep_minutes as "prepTime", cook_minutes as "cookTime", servings
      FROM meal_templates 
      WHERE is_active = true AND category IS NOT NULL
      ORDER BY name
    `);
    return result.rows as MealTemplate[];
  } catch (error) {
    console.log("Database templates not available, using fallback");
    return [];
  }
}

// Simple template selection by category
function selectTemplatesByCategory(templates: MealTemplate[], category: string, count: number): MealTemplate[] {
  const categoryTemplates = templates.filter(t => t.type === category);
  if (categoryTemplates.length === 0) return [];
  
  const selected: MealTemplate[] = [];
  for (let i = 0; i < count; i++) {
    const index = i % categoryTemplates.length;
    selected.push(categoryTemplates[index]);
  }
  return selected;
}

// Generate simple meal plan - fast and predictable
export const simpleMealPlanning = {
  async generate(params: SimplePlanParams) {
    const startTime = Date.now();
    console.log(`[Simple] Starting meal plan generation for ${params.weeks} weeks`);
    
    // Load templates quickly
    const templates = await loadActiveTemplates();
    if (templates.length === 0) {
      return {
        success: false,
        message: "No active templates available. Please add templates.",
        days: []
      };
    }
    
    console.log(`[Simple] Loaded ${templates.length} templates`);
    
    // Calculate totals needed
    const totalDays = params.weeks * 7;
    const mealsPerDay = params.mealsPerDay;
    const snacksPerDay = params.snacksPerDay || 0;
    
    // Get templates by category
    const breakfasts = selectTemplatesByCategory(templates, 'breakfast', totalDays);
    const lunches = selectTemplatesByCategory(templates, 'lunch', totalDays);
    const dinners = selectTemplatesByCategory(templates, 'dinner', totalDays);
    const snacks = selectTemplatesByCategory(templates, 'snack', totalDays * snacksPerDay);
    
    // Build days
    const days = [];
    for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
      const dayMeals = [];
      
      // Add breakfast if requested
      if (mealsPerDay >= 1 && breakfasts[dayIndex]) {
        dayMeals.push({
          id: `day-${dayIndex + 1}-breakfast`,
          template: breakfasts[dayIndex],
          meal_type: 'breakfast',
          day_number: dayIndex + 1
        });
      }
      
      // Add lunch if requested
      if (mealsPerDay >= 2 && lunches[dayIndex]) {
        dayMeals.push({
          id: `day-${dayIndex + 1}-lunch`,
          template: lunches[dayIndex],
          meal_type: 'lunch',
          day_number: dayIndex + 1
        });
      }
      
      // Add dinner if requested
      if (mealsPerDay >= 3 && dinners[dayIndex]) {
        dayMeals.push({
          id: `day-${dayIndex + 1}-dinner`,
          template: dinners[dayIndex],
          meal_type: 'dinner',
          day_number: dayIndex + 1
        });
      }
      
      // Add snacks if requested
      for (let s = 0; s < snacksPerDay; s++) {
        const snackIndex = dayIndex * snacksPerDay + s;
        if (snacks[snackIndex]) {
          dayMeals.push({
            id: `day-${dayIndex + 1}-snack-${s + 1}`,
            template: snacks[snackIndex],
            meal_type: 'snack',
            day_number: dayIndex + 1
          });
        }
      }
      
      days.push({
        day_number: dayIndex + 1,
        meals: dayMeals
      });
    }
    
    const elapsedTime = Date.now() - startTime;
    console.log(`[Simple] Generated meal plan in ${elapsedTime}ms`);
    
    return {
      success: true,
      days,
      generation_time_ms: elapsedTime,
      stats: {
        total_days: totalDays,
        templates_used: templates.length,
        breakfasts: breakfasts.length,
        lunches: lunches.length,
        dinners: dinners.length,
        snacks: snacks.length
      }
    };
  }
};