import { Router } from "express";
import { db } from "../db";
import { users, mealPlanRuns } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { normalizeToWeeklyPlanner, type GenerationMeta } from "../services/normalizeWeeklyPlan";
import { weeklyMealPlanningServiceA } from "../services/weeklyMealPlanningServiceA";
import { weeklyMealPlanningServiceB } from "../services/weeklyMealPlanningServiceB";
import { simpleMealPlanning } from "../services/simpleMealPlanning";
import { weeklyMealPlanningServiceC } from "../services/weeklyMealPlanningServiceC";

const router = Router();

// Request schema for meal plan generation
const generateMealPlanSchema = z.object({
  weeks: z.number().min(1).max(4),
  mealsPerDay: z.number().min(1).max(6),
  snacksPerDay: z.number().min(0).max(3),
  targets: z.object({
    calories: z.number().min(1000).max(5000),
    protein: z.number().min(50).max(300),
    carbs: z.number().optional(),
    fats: z.number().optional(),
  }),
  diet: z.string().optional(),
  medicalFlags: z.array(z.string()).optional(),
  variant: z.enum(["A", "B", "AUTO"]).optional().default("AUTO"),
  planningMode: z.enum(["STANDARD", "CAFETERIA"]).optional().default("STANDARD"),
});

// Unified meal plan generation endpoint with A/B switching
router.post("/api/meal-plans/generate", async (req, res) => {
  try {
    // For now, use a default user ID - in production this would come from authentication
    const userId = "00000000-0000-0000-0000-000000000001";
    
    const validatedData = generateMealPlanSchema.parse(req.body);
    const { weeks, mealsPerDay, snacksPerDay, targets, diet, medicalFlags, variant, planningMode } = validatedData;

    // Get user's A/B preference
    const user = await db.query.users.findFirst({ 
      where: eq(users.id, userId),
      columns: { mealPlanVariant: true }
    });

    // Determine which variant to use (A/B only for database)
    const chosen: "A" | "B" = 
      variant && variant !== "AUTO"
        ? variant as "A" | "B"
        : (user?.mealPlanVariant === "AUTO" 
            ? (Math.random() < 0.5 ? "A" : "B") 
            : (user?.mealPlanVariant ?? "A")) as "A" | "B";

    const params = { weeks, mealsPerDay, snacksPerDay, targets, diet, medicalFlags, userId };

    // Select service based on planning mode (not variant)
    let plan, meta;
    if (planningMode === "CAFETERIA") {
      ({ plan, meta } = await generateCafeteriaGoalBasedPlan(params));
    } else if (chosen === "A") {
      ({ plan, meta } = await generateCuratedTemplatePlan(params));
    } else {
      ({ plan, meta } = await generateDynamicAIPlan(params));
    }

    // Tag meta with source to distinguish Cafeteria runs
    const metaOut = { 
      ...meta, 
      source: planningMode === "CAFETERIA" ? "CAFETERIA" : "STANDARD",
      planningMode 
    };

    // Log the run for A/B analysis (always store A/B variant for database)
    await db.insert(mealPlanRuns).values({
      userId,
      variant: chosen,
      params: params as any,
      resultMeta: metaOut as any,
    });

    // Helper: ultra-simple fallback if template pool is empty
    function fallbackMeals(weekKey: string, mealsPerDay = 3) {
      const base = [
        { name: "Greek Yogurt & Berries", mealType: "breakfast" },
        { name: "Grilled Chicken Salad", mealType: "lunch" },
        { name: "Salmon, Quinoa & Greens", mealType: "dinner" },
      ];
      const out: any[] = [];
      for (let d = 0; d < 7; d++) {
        for (let i = 0; i < mealsPerDay; i++) {
          const t = base[i % base.length];
          out.push({
            id: `${weekKey}-${d}-${i}`,
            name: t.name,
            mealType: t.mealType,
            dayIndex: d,
            weekKey,
            macros: { calories: 500, protein: 35, carbs: 30, fat: 20 },
            badges: [],
            ingredients: [{ name: "Mixed ingredients", amountOz: 8 }],
            instructions: ["Prepare according to your preferences"]
          });
        }
      }
      return out;
    }

    // Convert plan to meals array for frontend compatibility
    let meals = Array.isArray(plan) ? plan.flat() : 
                plan?.days ? plan.days.flat() : 
                plan?.meals ? plan.meals : [];

    // Fallback if template pool was empty
    const weekKey = req.body.weekKey || "2025-W01";
    if (!Array.isArray(meals) || meals.length === 0) {
      meals = fallbackMeals(weekKey, mealsPerDay);
    }

    // Ensure every item has the minimal fields
    meals = meals.map((m: any, idx: number) => ({
      id: m.id ?? `${weekKey}-${idx}`,
      name: m.name || "Meal",
      mealType: m.mealType ?? "meal",
      dayIndex: m.dayIndex ?? (idx % 7),
      weekKey: m.weekKey ?? weekKey,
      macros: {
        calories: m.macros?.calories || m.calories || 500,
        protein: m.macros?.protein || m.protein || 30,
        carbs: m.macros?.carbs || m.carbs || 30,
        fat: m.macros?.fat || m.fat || 20,
      },
      badges: m.badges || [],
      ingredients: m.ingredients || [{ name: "Mixed ingredients", amountOz: 8 }],
      instructions: m.instructions || ["Prepare according to your preferences"],
      ...m,
    }));

    res.json({ meals });
  } catch (error) {
    console.error("Meal plan generation error:", error);
    res.status(500).json({ error: "Failed to generate meal plan" });
  }
});

// Option A: Curated Templates Service (Fast Simple Version)
async function generateCuratedTemplatePlan(params: any) {
  const result = await simpleMealPlanning.generate(params);
  if (!result.success) {
    throw new Error(result.message || "Failed to generate meal plan");
  }
  return { 
    plan: result.days, 
    meta: { 
      generationTime: result.generation_time_ms,
      templatesUsed: result.stats.templates_used,
      service: "SimpleMealPlanning-A"
    }
  };
}

// Option B: Dynamic AI Service (Fast Simple Version)
async function generateDynamicAIPlan(params: any) {
  const result = await simpleMealPlanning.generate(params);
  if (!result.success) {
    throw new Error(result.message || "Failed to generate meal plan");
  }
  return { 
    plan: result.days, 
    meta: { 
      generationTime: result.generation_time_ms,
      templatesUsed: result.stats.templates_used,
      service: "SimpleMealPlanning-B"
    }
  };
}

// Option C: Cafeteria Goal-Based Service
async function generateCafeteriaGoalBasedPlan(params: any) {
  const { plan, meta } = await weeklyMealPlanningServiceC.generate(params);
  return { plan, meta };
}

function getDayName(dayIndex: number): string {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return days[dayIndex];
}

export default router;