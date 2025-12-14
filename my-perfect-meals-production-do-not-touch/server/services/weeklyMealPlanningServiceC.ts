// server/services/weeklyMealPlanningServiceC.ts
// Cafeteria-style goal-based template planning service

import { db } from "../db";
import { recipes } from "../../shared/schema";
import { selectTemplatesForUser, groupTemplatesByType, validateTemplateAvailability } from "./templateSelector";
import { assembleWeek, validateWeekPlan } from "./weekAssembler";
import { getUserMealPreferences } from "./templateAssign";
import type { PlanParams } from "./rulesEngine";

export interface CafeteriaParams extends PlanParams {
  userId?: string;
  goal?: "loss" | "maint" | "gain";
}

/**
 * Service C: Cafeteria-style goal-based meal planning
 * Uses the new goal-based template system with user preferences
 */
export const weeklyMealPlanningServiceC = {
  async generate(params: CafeteriaParams) {
    console.log(`🏪 Cafeteria Service: Generating plan for goal: ${params.goal || 'default'}`);
    
    try {
      // 1. Get user meal preferences (goal, likes, avoid, etc.)
      const userId = params.userId || "00000000-0000-0000-0000-000000000001";
      const userPrefs = await getUserMealPreferences(userId);
      
      console.log(`👤 User preferences:`, {
        goal: userPrefs?.goal || params.goal || 'maint',
        likes: userPrefs?.likes?.length || 0,
        avoid: userPrefs?.avoid?.length || 0,
        vegOptOut: userPrefs?.vegOptOut
      });

      // 2. Load all templates from recipes table
      const allTemplates = await db
        .select()
        .from(recipes);

      console.log(`📋 Loaded ${allTemplates.length} active templates`);

      // 3. Select and score templates based on user's goal and preferences
      const selectedTemplates = selectTemplatesForUser(allTemplates, {
        goal: userPrefs?.goal || params.goal || "maint",
        likes: userPrefs?.likes || [],
        avoid: userPrefs?.avoid || [],
        medicalFlags: params.medicalFlags || [],
        userAllergens: params.userAllergens || [],
        vegOptOut: userPrefs?.vegOptOut || false
      });

      // 4. Group templates by meal type
      const poolByType = groupTemplatesByType(selectedTemplates);

      // 5. Validate minimum template availability
      const { valid, issues } = validateTemplateAvailability(poolByType);
      if (!valid) {
        console.warn("⚠️ Template availability issues:", issues);
        // Continue anyway with available templates
      }

      // 6. Assemble the weekly plan
      const plan = assembleWeek({
        poolByType,
        mealsPerDay: params.mealsPerDay,
        snacksPerDay: params.snacksPerDay,
        targets: params.targets,
        scheduleTimes: {
          breakfast: "08:00",
          lunch: "12:30",
          dinner: "18:00",
          snack1: "15:00"
        }
      });

      // 7. Validate the assembled plan
      const validation = validateWeekPlan(plan, params.targets);
      console.log(`📊 Plan validation:`, validation);

      // 8. Calculate meta information
      const meta = {
        service: "C",
        planningMode: "cafeteria",
        goal: userPrefs?.goal || params.goal || "maint",
        templateCount: selectedTemplates.length,
        poolSizes: {
          breakfast: poolByType.breakfast.length,
          lunch: poolByType.lunch.length,
          dinner: poolByType.dinner.length,
          snack: poolByType.snack.length
        },
        validation: validation.valid,
        issues: validation.issues,
        totals: validation.totals,
        userPreferences: {
          likes: userPrefs?.likes?.length || 0,
          avoid: userPrefs?.avoid?.length || 0,
          vegOptOut: userPrefs?.vegOptOut || false
        }
      };

      console.log(`✅ Cafeteria plan generated successfully`);

      return {
        plan: { weeks: plan },
        meta
      };

    } catch (error) {
      console.error("❌ Cafeteria service error:", error);
      
      // Fallback to a minimal plan
      const fallbackPlan = generateFallbackCafeteriaPlan(params);
      
      return {
        plan: { weeks: fallbackPlan },
        meta: {
          service: "C",
          planningMode: "cafeteria-fallback",
          error: "Used fallback due to generation error",
          goal: params.goal || "maint"
        }
      };
    }
  }
};

/**
 * Fallback plan generator for when main cafeteria service fails
 */
function generateFallbackCafeteriaPlan(params: CafeteriaParams) {
  console.log("🚨 Using cafeteria fallback plan");
  
  // Fallback meals using real slugs that match uploaded images
  const fallbackMealLibrary = [
    // Breakfast options - matches Service A
    { 
      slug: "protein-oats", 
      name: "Protein Overnight Oats", 
      type: "breakfast",
      calories: 340, protein: 28, carbs: 35, fat: 8, fiber: 6, vegetables: 0 
    },
    { 
      slug: "veggie-scramble", 
      name: "Vegetable Scrambled Eggs", 
      type: "breakfast",
      calories: 320, protein: 24, carbs: 12, fat: 18, fiber: 4, vegetables: 1.5 
    },
    { 
      slug: "avocado-toast", 
      name: "Avocado Toast with Egg", 
      type: "breakfast",
      calories: 380, protein: 20, carbs: 28, fat: 22, fiber: 8, vegetables: 0.5 
    },
    
    // Lunch options - matches Service A
    { 
      slug: "quinoa-bowl", 
      name: "Mediterranean Quinoa Bowl", 
      type: "lunch",
      calories: 420, protein: 32, carbs: 48, fat: 12, fiber: 8, vegetables: 2.5 
    },
    { 
      slug: "chicken-salad", 
      name: "Grilled Chicken Caesar Salad", 
      type: "lunch",
      calories: 390, protein: 35, carbs: 18, fat: 20, fiber: 6, vegetables: 2 
    },
    { 
      slug: "turkey-wrap", 
      name: "Turkey and Veggie Wrap", 
      type: "lunch",
      calories: 410, protein: 30, carbs: 35, fat: 16, fiber: 7, vegetables: 2 
    },
    
    // Dinner options - matches Service A
    { 
      slug: "herb-salmon", 
      name: "Herb-Crusted Salmon with Vegetables", 
      type: "dinner",
      calories: 485, protein: 38, carbs: 22, fat: 26, fiber: 6, vegetables: 2 
    },
    { 
      slug: "chicken-stirfry", 
      name: "Chicken and Vegetable Stir-Fry", 
      type: "dinner",
      calories: 450, protein: 36, carbs: 28, fat: 18, fiber: 5, vegetables: 2.5 
    },
    { 
      slug: "beef-pasta", 
      name: "Lean Beef Pasta with Marinara", 
      type: "dinner",
      calories: 520, protein: 34, carbs: 55, fat: 16, fiber: 8, vegetables: 1.5 
    },
    
    // Snack options - matches Service A
    { 
      slug: "greek-yogurt-nuts", 
      name: "Greek Yogurt with Nuts", 
      type: "snack",
      calories: 180, protein: 15, carbs: 12, fat: 8, fiber: 3, vegetables: 0 
    },
    { 
      slug: "apple-peanut-butter", 
      name: "Apple Slices with Peanut Butter", 
      type: "snack",
      calories: 160, protein: 6, carbs: 18, fat: 8, fiber: 4, vegetables: 0 
    }
  ];

  function getRandomMealOfType(type: string) {
    const mealsOfType = fallbackMealLibrary.filter(meal => meal.type === type);
    return mealsOfType[Math.floor(Math.random() * mealsOfType.length)];
  }

  const days = Array.from({ length: 7 }, (_, d) => {
    const breakfast = getRandomMealOfType("breakfast");
    const lunch = getRandomMealOfType("lunch"); 
    const dinner = getRandomMealOfType("dinner");
    const snack = getRandomMealOfType("snack");

    return {
      day: d + 1,
      meals: [
        { 
          id: `fallback-b-${d}`, 
          slug: breakfast.slug,
          type: "breakfast",
          name: breakfast.name,
          calories: breakfast.calories,
          protein: breakfast.protein,
          carbs: breakfast.carbs,
          fat: breakfast.fat,
          fiber: breakfast.fiber,
          vegetables: breakfast.vegetables,
          imageUrl: `/meal-images/${breakfast.slug}.jpg`, // Use real slug for image
          ingredients: [
            { name: breakfast.name.includes("Oats") ? "Rolled oats" : breakfast.name.includes("Egg") ? "Large eggs" : "Main ingredient", amountOz: 4 },
            { name: "Protein powder or Greek yogurt", amountOz: 2 },
            { name: "Fresh berries or banana", amountOz: 3 }
          ],
          steps: [
            "Prepare your breakfast ingredients according to recipe guidelines",
            "Mix or cook as directed for optimal nutrition",
            "Serve immediately and enjoy your balanced breakfast"
          ],
          dietTags: ["balanced"],
          badges: ["fallback"],
          allergens: []
        },
        { 
          id: `fallback-l-${d}`, 
          slug: lunch.slug,
          type: "lunch",
          name: lunch.name,
          calories: lunch.calories,
          protein: lunch.protein,
          carbs: lunch.carbs,
          fat: lunch.fat,
          fiber: lunch.fiber,
          vegetables: lunch.vegetables,
          imageUrl: `/meal-images/${lunch.slug}.jpg`, // Use real slug for image
          ingredients: [
            { name: lunch.name.includes("Chicken") ? "Grilled chicken breast" : lunch.name.includes("Turkey") ? "Sliced turkey" : "Lean protein", amountOz: 5 },
            { name: "Mixed greens or quinoa", amountOz: 4 },
            { name: "Fresh vegetables", amountOz: 3 },
            { name: "Healthy dressing or olive oil", amountOz: 1 }
          ],
          steps: [
            "Prepare your protein according to cooking guidelines",
            "Assemble fresh vegetables and greens in a bowl",
            "Add dressing and toss gently, serve immediately"
          ],
          dietTags: ["balanced"],
          badges: ["fallback"],
          allergens: []
        },
        { 
          id: `fallback-d-${d}`, 
          slug: dinner.slug,
          type: "dinner",
          name: dinner.name,
          calories: dinner.calories,
          protein: dinner.protein,
          carbs: dinner.carbs,
          fat: dinner.fat,
          fiber: dinner.fiber,
          vegetables: dinner.vegetables,
          imageUrl: `/meal-images/${dinner.slug}.jpg`, // Use real slug for image
          ingredients: [
            { name: dinner.name.includes("Salmon") ? "Fresh salmon fillet" : dinner.name.includes("Chicken") ? "Chicken breast" : "Lean protein", amountOz: 6 },
            { name: "Complex carbs (rice, quinoa, or pasta)", amountOz: 4 },
            { name: "Fresh vegetables", amountOz: 4 },
            { name: "Healthy cooking oil", amountOz: 1 }
          ],
          steps: [
            "Season and cook your protein using preferred method",
            "Prepare your complex carbs according to package directions", 
            "Steam or sauté vegetables until tender-crisp",
            "Plate and serve hot for optimal enjoyment"
          ],
          dietTags: ["balanced"],
          badges: ["fallback"],
          allergens: []
        }
      ]
    };
  });

  return [{
    week: 1,
    days,
    scheduleTimes: {
      breakfast: "08:00",
      lunch: "12:30",
      dinner: "18:00"
    }
  }];
}