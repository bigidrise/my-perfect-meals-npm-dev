// --- NEW: server/routes/fridge-rescue.ts ---
import express from "express";
import { z } from "zod";
import { db } from "../db";
import { mealInstances, userRecipes } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

const router = express.Router();

// Mock authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  req.user = { id: "mock-user-id" };
  next();
};

// Schema for fridge rescue generation
const fridgeRescueSchema = z.object({
  ingredients: z.union([z.array(z.string()), z.string()]).transform((val) => 
    typeof val === 'string' ? val.split(',').map(s => s.trim()) : val
  ),
  servings: z.number().min(1).max(8).default(2),
  mealtime: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).default('dinner'),
  dietaryRestrictions: z.array(z.string()).default([]),
});

// Schema for logging fridge rescue meal
const logMealSchema = z.object({
  recipePayload: z.object({
    title: z.string(),
    ingredients: z.any(),
    instructions: z.string(),
    nutrition: z.any().optional(),
  }),
  mealInstanceId: z.string().optional(),
  logNow: z.boolean().default(true),
  note: z.string().optional(),
});

// POST /api/fridge-rescue/generate - Generate recipe from available ingredients
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const input = fridgeRescueSchema.parse(req.body);

    // Mock AI recipe generation - replace with actual AI service
    const generatedRecipe = {
      title: `${input.mealtime.charAt(0).toUpperCase() + input.mealtime.slice(1)} Fridge Rescue`,
      ingredients: input.ingredients.map(ing => ({
        name: ing,
        amount: "1",
        unit: "portion"
      })),
      instructions: `1. Prepare ${input.ingredients.join(', ')}\n2. Cook according to preference\n3. Season to taste\n4. Serve hot`,
      nutrition: {
        calories: 350,
        protein: 20,
        carbs: 30,
        fat: 15,
        fiber: 8
      },
      servings: input.servings,
      prepTime: 20,
      cookTime: 25
    };

    res.json({
      success: true,
      recipe: generatedRecipe,
      source: 'fridge-rescue'
    });
  } catch (error) {
    console.error("Error generating fridge rescue recipe:", error);
    res.status(500).json({ error: "Failed to generate recipe" });
  }
});

// POST /api/fridge-rescue/log - Log fridge rescue meal (convenience wrapper)
router.post('/log', requireAuth, async (req, res) => {
  try {
    const input = logMealSchema.parse(req.body);
    const userId = req.user.id;

    // Save recipe to user_recipes  
    const [savedRecipe] = await db.insert(userRecipes).values({
      userId,
      title: input.recipePayload.title,
      ingredients: input.recipePayload.ingredients,
      instructions: input.recipePayload.instructions,
      nutrition: input.recipePayload.nutrition
    }).returning({ id: userRecipes.id });

    // If replacing an existing meal instance
    if (input.mealInstanceId) {
      // Use the replace-and-optional-log flow
      const response = await fetch(`/api/meals/${input.mealInstanceId}/replace-and-optional-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: savedRecipe.id,
          logNow: input.logNow,
          source: 'fridge-rescue',
          note: input.note
        })
      });

      if (!response.ok) {
        throw new Error('Failed to replace meal');
      }

      const result = await response.json();
      return res.json(result);
    } else {
      // Create new standalone meal instance
      const [newInstance] = await db.insert(mealInstances).values({
        userId,
        date: new Date().toISOString().split('T')[0], // today
        slot: 'dinner', // default slot
        recipeId: savedRecipe.id,
        source: 'fridge-rescue',
        status: input.logNow ? 'eaten' : 'planned',
        loggedAt: input.logNow ? sql`now()` : null,
        notes: input.note || null
      }).returning();

      res.json({
        success: true,
        mealInstance: newInstance,
        recipe: savedRecipe
      });
    }
  } catch (error) {
    console.error("Error logging fridge rescue meal:", error);
    res.status(500).json({ error: "Failed to log meal" });
  }
});

export default router;