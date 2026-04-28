// --- NEW: server/routes/craving-creator.ts ---
import express from "express";
import { z } from "zod";
import { db } from "../db";
import { mealInstances, userRecipes, users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { 
  preCheckRequest, 
  extractSafetyProfile, 
  getSafeSubstitute,
  logSafetyEnforcement,
  getPrimaryDiet
} from "../services/allergyGuardrails";
import { runEnforcement } from "../services/enforcementGateway";
import { sanitizeMealName } from "../utils/mealNameSanitizer";
import { resolveActiveSystem } from "../services/creatorSystems/resolver";
import { applyCreatorTransformation } from "../services/creatorSystems/applyCreatorTransformation";

const router = express.Router();

function resolveUserId(req: any): string | undefined {
  return req.authUser?.id
    || (req.session as any)?.userId
    || (req.user?.id !== "mock-user-id" ? req.user?.id : undefined);
}

const requireAuth = async (req: any, res: any, next: any) => {
  const token = req.headers["x-auth-token"] as string | undefined;
  if (token) {
    try {
      const [tokenUser] = await db.select({ id: users.id }).from(users).where(eq(users.authToken, token)).limit(1);
      if (tokenUser) { req.user = { id: tokenUser.id }; }
    } catch { }
  }
  if (!req.user) req.user = {};
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
    const { craving, mealType = 'dinner', macroTargets, servings = 2 } = req.body;
    const userId = resolveUserId(req) || req.body.userId || '1';
    
    console.log('🔥 CRAVING ROUTE HIT', Date.now());
    console.log('🍳 Craving Creator generating meal:', { craving, mealType, userId, servings });
    
    // Import the actual AI meal generator
    const { generateCravingMeal } = await import('../services/stableMealGenerator');
    
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

    // 🚨 CRITICAL SAFETY CHECK: Block requests that ask for forbidden ingredients
    if (user) {
      const safetyProfile = extractSafetyProfile(user);
      const preCheck = preCheckRequest(craving, safetyProfile);
      
      if (preCheck.blocked) {
        console.log(`🚫 [ALLERGY SAFETY] Blocked request from user ${userId}: "${craving}" contains ${preCheck.violations.join(", ")}`);
        logSafetyEnforcement(userId, craving, preCheck.violations, 'blocked');
        
        // Suggest safe alternatives
        const suggestions = preCheck.violations.map(v => `${v} → ${getSafeSubstitute(v)}`).join("; ");
        
        return res.status(400).json({
          error: "ALLERGY_SAFETY_BLOCK",
          message: preCheck.message,
          violations: preCheck.violations,
          suggestions: `Try these safe alternatives: ${suggestions}`,
          blocked: true
        });
      }
    }

    // Generate the meal using AI (include servings in the craving text for scaling)
    const cravingWithServings = servings > 1 
      ? `${craving} (for ${servings} servings)` 
      : craving;
    
    let generatedMeal = await generateCravingMeal(
      mealType,
      cravingWithServings,
      {
        userId: userId?.toString() || "1",
        dietaryRestrictions: user?.dietaryRestrictions || [],
        allergies: user?.allergies || [],
        avoidIngredients: [...(user?.dislikedFoods || []), ...(user?.avoidedFoods || [])],
        medicalFlags: user?.healthConditions || [],
        macroTargets: macroTargets || undefined
      }
    );

    // Validate that we got a meal back
    if (!generatedMeal || !generatedMeal.name) {
      return res.status(500).json({ error: "AI meal generation failed - no meal returned" });
    }

    // ── Post-generation avoidance enforcement ─────────────────────────────────
    // Safety net: even if the AI prompt included the avoid list, this catches
    // any violations before the meal reaches the user.
    if (userId) {
      const postCheck = await runEnforcement({
        userId: userId.toString(),
        builderType: "craving_creator",
        phase: "post_generation",
        generatedMeal: {
          name: generatedMeal.name,
          description: generatedMeal.description,
          ingredients: generatedMeal.ingredients || [],
          instructions: generatedMeal.instructions || [],
        },
      });

      if (postCheck.decision === "BLOCK" && postCheck.primaryBlock?.reasonCode === "AVOID_INGREDIENT_FOUND") {
        console.log(`🚫 [PostGen Avoidance] Blocked meal "${generatedMeal.name}" — contains "${postCheck.primaryBlock.blockingIngredient}"`);
        return res.status(400).json({
          error: "AVOID_INGREDIENT_FOUND",
          message: postCheck.primaryBlock.message,
          blockedIngredient: postCheck.primaryBlock.blockingIngredient,
          suggestion: postCheck.primaryBlock.suggestedSubstitute,
          retryable: true,
        });
      }
    }

    // ── Name consistency check (post-generation) ─────────────────────────────
    // If the AI returned a name with misleading concept words that conflict with
    // the user's diet (e.g. "Chicken Salad" for a carnivore), rename it now.
    const userDiet = getPrimaryDiet((user?.dietaryRestrictions as string[]) || []);
    if (userDiet) {
      const ingredientNames = (generatedMeal.ingredients || []).map((ing: any) =>
        typeof ing === "string" ? ing : ing?.name || ""
      );
      const sanitized = sanitizeMealName(generatedMeal.name, userDiet, ingredientNames);
      if (sanitized !== generatedMeal.name) {
        console.log(`✏️ [NameSanitizer] "${generatedMeal.name}" → "${sanitized}" (diet: ${userDiet})`);
        (generatedMeal as any).name = sanitized;
      }
    }

    // Creator System 2-pass transformation — runs AFTER all safety/avoidance checks.
    // Uses the already-fetched user object to resolve system — no extra DB query.
    if (user) {
      const creatorSystem = resolveActiveSystem(user);
      generatedMeal = await applyCreatorTransformation(generatedMeal, creatorSystem, "meal");
    }

    // Add servings info to the meal response
    const mealWithServings = {
      ...generatedMeal,
      servingSize: `${servings} ${servings === 1 ? 'serving' : 'servings'}`,
      servings: servings
    };

    console.log('✅ CRAVING ROUTE COMPLETE', Date.now());
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
router.post('/log', requireAuth, async (req: any, res) => {
  try {
    const input = logMealSchema.parse(req.body);
    const userId = req.user?.id || "1";

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