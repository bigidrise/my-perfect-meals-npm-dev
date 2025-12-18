/**
 * Normalizes meal plan outputs from different services to a consistent format
 * for the Weekly Planner frontend
 */

export interface NormalizedMeal {
  id: string;
  name: string;
  type: "breakfast" | "lunch" | "dinner" | "snack";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  servings?: number;
  ingredients?: Array<{
    item: string;
    amount: number;
    unit: string;
  }>;
  instructions?: string[];
  imageUrl?: string;
  badges?: string[];
  variety?: "low" | "medium" | "high";
}

export interface NormalizedWeeklyPlan {
  weeks: Array<{
    weekNumber: number;
    days: Array<{
      day: string;
      meals: {
        breakfast?: NormalizedMeal;
        lunch?: NormalizedMeal;
        dinner?: NormalizedMeal;
        snacks: NormalizedMeal[];
      };
    }>;
  }>;
}

export interface GenerationMeta {
  planType: "curated-templates" | "dynamic-ai";
  uniqueIngredients: number;
  macroTargetHit: number;
  totalMeals: number;
  [key: string]: any;
}

/**
 * Converts various meal generation outputs to the unified Weekly Planner format
 */
export function normalizeToWeeklyPlanner(plan: any, source: "A" | "B"): NormalizedWeeklyPlan {
  // If already in the correct format, return as-is
  if (plan.weeks && Array.isArray(plan.weeks)) {
    return plan;
  }

  // Handle array of meals (from meal engine service)
  if (Array.isArray(plan.meals)) {
    return normalizeMealsArrayToWeeks(plan.meals, source);
  }

  // Handle single week format
  if (plan.days && Array.isArray(plan.days)) {
    return {
      weeks: [{
        weekNumber: 1,
        days: plan.days.map((day: any) => ({
          day: day.day || day.name,
          meals: {
            breakfast: day.meals?.breakfast ? normalizeMeal(day.meals.breakfast, source) : undefined,
            lunch: day.meals?.lunch ? normalizeMeal(day.meals.lunch, source) : undefined,
            dinner: day.meals?.dinner ? normalizeMeal(day.meals.dinner, source) : undefined,
            snacks: Array.isArray(day.meals?.snacks) 
              ? day.meals.snacks.map((snack: any) => normalizeMeal(snack, source))
              : []
          }
        }))
      }]
    };
  }

  // Fallback: create a basic structure
  return createFallbackPlan(source);
}

function normalizeMeal(meal: any, source: "A" | "B"): NormalizedMeal {
  return {
    id: meal.id || `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: meal.name || "Generated Meal",
    type: meal.type || meal.mealType || "lunch",
    calories: Number(meal.calories || meal.nutrition?.calories || 400),
    protein: Number(meal.protein || meal.nutrition?.protein_g || meal.nutrition?.protein || 25),
    carbs: Number(meal.carbs || meal.nutrition?.carbs_g || meal.nutrition?.carbs || 40),
    fat: Number(meal.fat || meal.nutrition?.fat_g || meal.nutrition?.fat || 15),
    source: source === "A" ? "curated-template" : "dynamic-ai",
    servings: meal.servings || 1,
    ingredients: meal.ingredients || [],
    instructions: meal.instructions || [],
    imageUrl: meal.imageUrl || meal.image_url,
    badges: meal.badges || [],
    variety: meal.variety || (source === "B" ? "high" : "medium")
  };
}

function normalizeMealsArrayToWeeks(meals: any[], source: "A" | "B"): NormalizedWeeklyPlan {
  // Group meals by day and type
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const mealTypes = ["breakfast", "lunch", "dinner", "snack"];
  
  const weekDays = days.map((day, dayIndex) => {
    const dayMeals: any = { snacks: [] };
    
    mealTypes.forEach(type => {
      const mealIndex = dayIndex * mealTypes.length + mealTypes.indexOf(type);
      const meal = meals[mealIndex];
      
      if (meal) {
        const normalizedMeal = normalizeMeal(meal, source);
        if (type === "snack") {
          dayMeals.snacks.push(normalizedMeal);
        } else {
          dayMeals[type] = normalizedMeal;
        }
      }
    });
    
    return {
      day,
      meals: dayMeals
    };
  });

  return {
    weeks: [{
      weekNumber: 1,
      days: weekDays
    }]
  };
}

function createFallbackPlan(source: "A" | "B"): NormalizedWeeklyPlan {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  
  return {
    weeks: [{
      weekNumber: 1,
      days: days.map(day => ({
        day,
        meals: {
          breakfast: {
            id: `${source}-fallback-breakfast-${day.toLowerCase()}`,
            name: "Protein Breakfast",
            type: "breakfast" as const,
            calories: 350,
            protein: 25,
            carbs: 30,
            fat: 12,
            source: source === "A" ? "curated-template" : "dynamic-ai"
          },
          lunch: {
            id: `${source}-fallback-lunch-${day.toLowerCase()}`,
            name: "Balanced Lunch",
            type: "lunch" as const,
            calories: 450,
            protein: 35,
            carbs: 45,
            fat: 14,
            source: source === "A" ? "curated-template" : "dynamic-ai"
          },
          dinner: {
            id: `${source}-fallback-dinner-${day.toLowerCase()}`,
            name: "Healthy Dinner",
            type: "dinner" as const,
            calories: 500,
            protein: 40,
            carbs: 35,
            fat: 18,
            source: source === "A" ? "curated-template" : "dynamic-ai"
          },
          snacks: []
        }
      }))
    }]
  };
}