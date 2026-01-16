// --- NEW: server/routes/craving-creator.ts ---
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

// Schema for craving generation
const cravingSchema = z.object({
  craving: z.string(),
  servings: z.number().min(1).max(8).default(2),
  mealtime: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).default('dinner'),
  dietaryRestrictions: z.array(z.string()).default([]),
  healthConditions: z.array(z.string()).default([]),
});

// Schema for logging craving meal
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

// POST /api/craving-creator/generate - Generate recipe based on craving
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { craving, mealType = 'dinner', userId = '1', macroTargets, servings = 2 } = req.body;
    
    console.log('🍳 Craving Creator generating meal:', { craving, mealType, userId, servings });
    
    // Import the actual AI meal generator
    const { generateCravingMeal } = await import('../services/stableMealGenerator');
    const { users } = await import('@shared/schema');
    const { db } = await import('../db');
    const { eq } = await import('drizzle-orm');
    
    // Get user data for medical personalization
    let user = null;
    if (userId) {
      try {
        const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        user = dbUser || null;
      } catch (error) {
        console.log("Could not fetch user for craving creator personalization:", error);
      }
    }

    // Generate the meal using AI (include servings in the craving text for scaling)
    const cravingWithServings = servings > 1 
      ? `${craving} (for ${servings} servings)` 
      : craving;
    
    const generatedMeal = await generateCravingMeal(
      mealType,
      cravingWithServings,
      {
        userId: userId?.toString() || "1",
        dietaryRestrictions: user?.dietaryRestrictions || [],
        allergies: user?.allergies || [],
        medicalFlags: user?.healthConditions || [],
        macroTargets: macroTargets || undefined
      }
    );

    // Validate that we got a meal back
    if (!generatedMeal || !generatedMeal.name) {
      console.error('❌ Craving Creator: generateCravingMeal returned empty/invalid:', generatedMeal);
      return res.status(500).json({ error: "AI meal generation failed - no meal returned" });
    }

    // Add servings info to the meal response
    const mealWithServings = {
      ...generatedMeal,
      servingSize: `${servings} ${servings === 1 ? 'serving' : 'servings'}`,
      servings: servings
    };

    console.log('✅ Craving Creator generated:', generatedMeal.name);
    console.log('🏥 Medical badges:', generatedMeal.medicalBadges?.length || 0);
    console.log('🍽️ Servings:', servings);

    res.json({ meal: mealWithServings });
  } catch (error) {
    console.error("❌ Craving Creator error:", error);
    res.status(500).json({ error: "Failed to generate craving meal" });
  }
});

// POST /api/craving-creator/log - Log craving meal (convenience wrapper)
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
          source: 'craving',
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
        source: 'craving',
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
    console.error("Error logging craving meal:", error);
    res.status(500).json({ error: "Failed to log meal" });
  }
});

export default router;