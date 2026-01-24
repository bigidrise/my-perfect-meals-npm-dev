import { Router, Request, Response } from "express";
import { db } from "../db";
import { mealLibraryItems, mealLibraryUsage, mealGenerationJobs, type MealLibraryItem } from "../../shared/schema";
import { eq, and, sql, desc, notInArray } from "drizzle-orm";

const router = Router();

type StudioType = "craving" | "fridge" | "dessert";
type EngineType = "library" | "queue" | "legacy";

interface StudioGenerateRequest {
  studio: StudioType;
  intentText?: string;
  constraints?: {
    caloriesTarget?: number;
    proteinTarget?: number;
    carbTarget?: number;
    fatTarget?: number;
  };
  diet?: string[];
  allergies?: string[];
  exclusions?: string[];
  locale?: string;
  userId?: string;
  servings?: number;
  mealType?: string;
  safetyMode?: string;
  overrideToken?: string;
}

interface StudioGenerateResponse {
  success: boolean;
  source: EngineType;
  meal: {
    id: string;
    name: string;
    title?: string;
    description?: string;
    ingredients: Array<{
      name: string;
      quantity?: string;
      amount?: number;
      unit?: string;
      notes?: string;
    }>;
    instructions: string[];
    cookingInstructions?: string[];
    imageUrl?: string | null;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    nutrition?: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
    medicalBadges?: string[];
    flags?: string[];
    servingSize?: string;
    servings?: number;
    reasoning?: string;
    mealType?: string;
  };
}

function getEngineForStudio(studio: StudioType): EngineType {
  const envKey = `STUDIO_ENGINE_${studio.toUpperCase()}`;
  const engine = process.env[envKey] as EngineType | undefined;
  return engine || "library";
}

function matchesAllergens(meal: MealLibraryItem, userAllergies: string[]): boolean {
  if (!userAllergies.length) return true;
  const flags = meal.allergenFlagsJson as Record<string, boolean> || {};
  for (const allergy of userAllergies) {
    const normalizedAllergy = allergy.toLowerCase().replace(/[-_\s]/g, "");
    for (const [key, value] of Object.entries(flags)) {
      if (value && key.toLowerCase().replace(/[-_\s]/g, "").includes(normalizedAllergy)) {
        return false;
      }
    }
  }
  return true;
}

function matchesDiet(meal: MealLibraryItem, userDiets: string[]): boolean {
  if (!userDiets.length) return true;
  const flags = meal.dietFlagsJson as Record<string, boolean> || {};
  for (const diet of userDiets) {
    const normalizedDiet = diet.toLowerCase().replace(/[-_\s]/g, "");
    let found = false;
    for (const [key, value] of Object.entries(flags)) {
      if (key.toLowerCase().replace(/[-_\s]/g, "").includes(normalizedDiet) && value) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

function matchesMacros(meal: MealLibraryItem, constraints?: StudioGenerateRequest["constraints"]): boolean {
  if (!constraints) return true;
  const macros = meal.macrosJson as { calories?: number; protein?: number; carbs?: number; fat?: number } || {};
  if (constraints.caloriesTarget && macros.calories) {
    const tolerance = constraints.caloriesTarget * 0.15;
    if (Math.abs(macros.calories - constraints.caloriesTarget) > tolerance) return false;
  }
  if (constraints.proteinTarget && macros.protein) {
    const tolerance = constraints.proteinTarget * 0.20;
    if (Math.abs(macros.protein - constraints.proteinTarget) > tolerance) return false;
  }
  if (constraints.carbTarget && macros.carbs) {
    const tolerance = constraints.carbTarget * 0.20;
    if (Math.abs(macros.carbs - constraints.carbTarget) > tolerance) return false;
  }
  if (constraints.fatTarget && macros.fat) {
    const tolerance = constraints.fatTarget * 0.20;
    if (Math.abs(macros.fat - constraints.fatTarget) > tolerance) return false;
  }
  return true;
}

function scoreMeal(meal: MealLibraryItem, request: StudioGenerateRequest, recentMealIds: string[]): number {
  let score = meal.qualityScore || 50;
  if (recentMealIds.includes(meal.id)) {
    score -= 30;
  }
  if (request.intentText && meal.searchText) {
    const intentWords = request.intentText.toLowerCase().split(/\s+/);
    const searchText = meal.searchText.toLowerCase();
    for (const word of intentWords) {
      if (word.length > 2 && searchText.includes(word)) {
        score += 10;
      }
    }
  }
  const cravingTags = meal.cravingTagsJson as Record<string, number> || {};
  if (request.intentText) {
    const intent = request.intentText.toLowerCase();
    for (const [tag, weight] of Object.entries(cravingTags)) {
      if (intent.includes(tag.toLowerCase())) {
        score += weight * 20;
      }
    }
  }
  return score;
}

function transformMealToResponse(meal: MealLibraryItem, servings: number): StudioGenerateResponse["meal"] {
  const macros = meal.macrosJson as { calories?: number; protein?: number; carbs?: number; fat?: number } || {};
  const ingredients = (meal.ingredientsJson as any[]) || [];
  const steps = (meal.stepsJson as string[]) || [];
  const dietFlags = meal.dietFlagsJson as Record<string, boolean> || {};
  const medicalBadges: string[] = [];
  for (const [key, value] of Object.entries(dietFlags)) {
    if (value) {
      medicalBadges.push(key.replace(/([A-Z])/g, " $1").trim());
    }
  }
  return {
    id: meal.id,
    name: meal.title,
    title: meal.title,
    description: meal.description || undefined,
    ingredients: ingredients,
    instructions: steps,
    cookingInstructions: steps,
    imageUrl: meal.imageUrl,
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    nutrition: {
      calories: macros.calories || 0,
      protein: macros.protein || 0,
      carbs: macros.carbs || 0,
      fat: macros.fat || 0,
    },
    medicalBadges,
    flags: [],
    servingSize: `${servings} ${servings === 1 ? "serving" : "servings"}`,
    servings,
    reasoning: meal.description || undefined,
    mealType: meal.mealType,
  };
}

async function libraryEngine(request: StudioGenerateRequest): Promise<StudioGenerateResponse | null> {
  const userId = request.userId || "guest";
  const recentUsage = await db
    .select({ mealId: mealLibraryUsage.mealId })
    .from(mealLibraryUsage)
    .where(eq(mealLibraryUsage.userId, userId))
    .orderBy(desc(mealLibraryUsage.servedAt))
    .limit(20);
  const recentMealIds = recentUsage.map((u) => u.mealId);
  const allMeals = await db
    .select()
    .from(mealLibraryItems)
    .where(eq(mealLibraryItems.studio, request.studio));
  let candidates = allMeals.filter((meal) => {
    if (!matchesAllergens(meal, request.allergies || [])) return false;
    if (!matchesDiet(meal, request.diet || [])) return false;
    if (!matchesMacros(meal, request.constraints)) return false;
    return true;
  });
  if (candidates.length === 0) {
    return null;
  }
  const scored = candidates.map((meal) => ({
    meal,
    score: scoreMeal(meal, request, recentMealIds),
  }));
  scored.sort((a, b) => b.score - a.score);
  const selected = scored[0].meal;
  await db.insert(mealLibraryUsage).values({
    mealId: selected.id,
    userId,
    wasSwapped: 0,
  });
  return {
    success: true,
    source: "library",
    meal: transformMealToResponse(selected, request.servings || 2),
  };
}

async function queueEngine(request: StudioGenerateRequest): Promise<StudioGenerateResponse | null> {
  const userId = request.userId || "guest";
  const [job] = await db.insert(mealGenerationJobs).values({
    studio: request.studio,
    userId,
    requestJson: {
      intentText: request.intentText,
      constraints: request.constraints,
      diet: request.diet,
      allergies: request.allergies,
      exclusions: request.exclusions,
      servings: request.servings,
    },
    status: "queued",
  }).returning();
  const libraryFallback = await libraryEngine(request);
  if (libraryFallback) {
    return {
      ...libraryFallback,
      source: "queue",
    };
  }
  return null;
}

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const body = req.body as StudioGenerateRequest;
    if (!body.studio || !["craving", "fridge", "dessert"].includes(body.studio)) {
      return res.status(400).json({
        success: false,
        error: "Invalid or missing studio type",
      });
    }
    const engine = getEngineForStudio(body.studio);
    console.log(`[StudioGenerator] ${body.studio} using ${engine} engine`);
    let result: StudioGenerateResponse | null = null;
    switch (engine) {
      case "library":
        result = await libraryEngine(body);
        break;
      case "queue":
        result = await queueEngine(body);
        break;
      case "legacy":
        return res.status(501).json({
          success: false,
          error: "Legacy engine not implemented - use existing endpoints",
        });
      default:
        result = await libraryEngine(body);
    }
    if (!result) {
      return res.status(404).json({
        success: false,
        error: "No matching meals found in library. Please adjust your preferences.",
      });
    }
    return res.json(result);
  } catch (error) {
    console.error("[StudioGenerator] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

router.get("/library/count", async (req: Request, res: Response) => {
  try {
    const studio = req.query.studio as StudioType | undefined;
    let query = db.select({ count: sql<number>`count(*)` }).from(mealLibraryItems);
    if (studio) {
      query = query.where(eq(mealLibraryItems.studio, studio)) as any;
    }
    const [result] = await query;
    return res.json({ count: Number(result.count) });
  } catch (error) {
    return res.status(500).json({ error: "Failed to count library items" });
  }
});

export default router;
