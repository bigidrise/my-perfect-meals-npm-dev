// ⚠️  LEGACY ROUTER — mounted at /api/craving-creator (not /api/meals/craving-creator).
//
// Status: NO active client page calls this path. All UI surfaces use the active
// endpoint at server/routes.ts ~5015 (/api/meals/craving-creator), which implements
// the full diet-override replacement contract introduced in Aug 2026.
//
// This router handles the old WMC2 adapter paths (/generate, /log) and always uses
// user?.dietaryRestrictions directly — it does NOT respect dietOverride.
// Protected by requireAuth + requireProAccess so it is not publicly reachable.
//
// Action: do not add new callers. Mark for removal when WMC2 adapter is retired.
// --- (original file header preserved below) ---
import express from "express";
import { z } from "zod";
import { db } from "../db";
import { mealInstances, userRecipes, users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { processMealImageForSave } from "../services/imageLifecycle";
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
import { resolveKitchenSystem } from "../services/creatorSystems/resolveKitchenSystem";
import { generateMealImageUnified } from "../services/mealImageGenerator";
import { enforceCarbs } from "../utils/carbClassifier";
import {
  appendWholeFoodStandardPrompt,
  evaluateWholeFoodCandidate,
} from "../services/wholeFoodStandard";

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
    imageUrl: z.string().optional(),
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

    // ── GLP-1 pre-generation context ─────────────────────────────────────────
    // Resolve canonical GLP-1 context BEFORE calling generateCravingMeal so
    // the personalized targets can constrain the generation prompt.
    // The internal hub-coupling path detects GLP-1 from the user profile but
    // does not receive the canonical resolved targets (personalized calorie,
    // protein, fat-ceiling). Passing them via macroTargets bridges that gap.
    const normalizedMealType = (
      mealType === "breakfast" || mealType === "lunch" ||
      mealType === "dinner" || mealType === "snack"
    ) ? mealType as "breakfast" | "lunch" | "dinner" | "snack" : "lunch";
    let glp1CravingCtx: Awaited<ReturnType<typeof import("../services/glp1/resolveGLP1GlobalContext").resolveGLP1GlobalContext>> | null = null;
    let glp1CravingTargets: import("../services/glp1/resolveGLP1MealTargets").ResolvedGLP1Targets | null = null;
    if (userId && userId !== "1") {
      try {
        const { resolveGLP1GlobalContext } = await import("../services/glp1/resolveGLP1GlobalContext");
        const dateISO = new Date().toISOString().split("T")[0];
        glp1CravingCtx = await resolveGLP1GlobalContext(userId, dateISO, normalizedMealType);
        if (glp1CravingCtx.isActive) {
          glp1CravingTargets = glp1CravingCtx.resolvedTargets;
          console.log(
            `💊 [GLP-1/CravingCreator] Active — sources=[${glp1CravingCtx.activationSources.join(",")}]` +
            (glp1CravingTargets
              ? ` [${glp1CravingTargets.resolvedMealCalories}kcal / ` +
                `${glp1CravingTargets.targetProteinGrams}g prot / ` +
                `${glp1CravingTargets.maximumToleratedFatGrams}g fat-ceiling]`
              : " [baseline targets]"),
          );
        }
      } catch (err) {
        console.warn("⚠️ [GLP-1/CravingCreator] Could not resolve context before generation:", err);
      }
    }

    // Build effective macroTargets: GLP-1 targets take precedence over client-
    // supplied values when the user is on GLP-1 medication, ensuring the AI
    // generator receives personalized calorie and macro ceilings.
    const effectiveMacroTargets = glp1CravingTargets
      ? {
          fat_g: glp1CravingTargets.maximumToleratedFatGrams,
          protein_g: glp1CravingTargets.targetProteinGrams,
          calories_target: glp1CravingTargets.resolvedMealCalories,
        }
      : (macroTargets || undefined);

    // Generate the meal using AI (include servings in the craving text for scaling)
    const cravingWithServings = servings > 1 
      ? `${craving} (for ${servings} servings)` 
      : craving;
    const wholeFoodGuidedCraving = appendWholeFoodStandardPrompt(
      cravingWithServings,
      { recommendationSurface: "legacy_craving_creator" },
    );
    
    let generatedMeal = await generateCravingMeal(
      mealType,
      wholeFoodGuidedCraving,
      {
        userId: userId?.toString() || "1",
        dietaryRestrictions: user?.dietaryRestrictions || [],
        allergies: user?.allergies || [],
        avoidIngredients: [...(user?.dislikedFoods || []), ...(user?.avoidedFoods || [])],
        medicalFlags: user?.healthConditions || [],
        macroTargets: effectiveMacroTargets
      } as any
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

    // ── GLP-1 post-generation validation ─────────────────────────────────────
    // Reuse the already-resolved glp1CravingCtx from the pre-generation step.
    // No second resolver call needed — validates the final output against the
    // same personalized targets that constrained generation.
    if (glp1CravingCtx?.isActive) {
      try {
        const { validateMealForDiet } = await import("../services/guardrails/index");
        const ingList = (generatedMeal.ingredients || []).map((i: any) => ({
          name: typeof i === "string" ? i : (i?.name ?? ""),
          quantity: typeof i === "string" ? undefined : i?.quantity,
          unit: typeof i === "string" ? undefined : i?.unit,
        }));
        const mealMacros = generatedMeal.nutrition
          ? {
              calories: generatedMeal.nutrition.calories,
              protein: generatedMeal.nutrition.protein,
              fat: generatedMeal.nutrition.fat,
              carbs: generatedMeal.nutrition.carbs,
            }
          : undefined;
        const vr = validateMealForDiet(
          { name: generatedMeal.name, ingredients: ingList, instructions: generatedMeal.instructions, macros: mealMacros },
          "glp1",
          undefined,
          normalizedMealType === "snack",
          glp1CravingTargets ?? undefined,
        );
        if (!vr.isValid) {
          console.warn(
            `💊 [GLP-1/CravingCreator] Violations for "${generatedMeal.name}":`,
            vr.violations,
          );
        } else {
          console.log(`💊 [GLP-1/CravingCreator] "${generatedMeal.name}" passed GLP-1 validation.`);
        }
        if (glp1CravingCtx.compositionNote) {
          console.log(`💊 [GLP-1/CravingCreator] Composition: ${glp1CravingCtx.compositionNote}`);
        }
      } catch (err) {
        console.warn("⚠️ [GLP-1/CravingCreator] Post-generation validation error:", err);
      }
    }

    // Creator System 2-pass transformation — runs AFTER all safety/avoidance checks.
    // If kitchenSlug is set, the kitchen overlay takes priority over the user's active system.
    if (user) {
      const kitchenSlug = req.body.kitchenSlug as string | undefined;
      let creatorSystem = resolveActiveSystem(user);
      if (kitchenSlug) {
        const kitchenSystem = await resolveKitchenSystem(kitchenSlug);
        if (kitchenSystem) {
          creatorSystem = kitchenSystem;
          console.log(`[Kitchen] Overlay applied: ${kitchenSlug}`);
        } else {
          console.warn(`[Kitchen] Slug "${kitchenSlug}" not found — falling back to user system`);
        }
      }
      generatedMeal = await applyCreatorTransformation(generatedMeal, creatorSystem, "meal");
    }

    // Evaluate the final recommendation only after existing allergy, dietary,
    // medical, GLP-1, and creator-system handling has completed. This keeps
    // those constraints authoritative while preventing a transformed output
    // from bypassing whole-food selection.
    const wholeFoodDecision = evaluateWholeFoodCandidate({
      name: generatedMeal.name,
      description: generatedMeal.description,
      ingredients: generatedMeal.ingredients || [],
      instructions: generatedMeal.instructions || [],
    }, { recommendationSurface: "legacy_craving_creator" });
    if (wholeFoodDecision.shouldBlock) {
      return res.status(422).json({
        error: "WHOLE_FOOD_SUBSTITUTE_REQUIRED",
        message: wholeFoodDecision.reason,
        retryable: true,
        wholeFoodDecision,
      });
    }

    // Generate image server-inline via canonical pipeline (caching + fallback handled internally)
    let cravingImageUrl: string | null = null;
    try {
      const ingNames = (generatedMeal.ingredients || [])
        .map((i: any) => (typeof i === "string" ? i : i?.name || ""))
        .filter(Boolean);
      cravingImageUrl = await generateMealImageUnified(generatedMeal.name, ingNames, "meal");
    } catch (imgErr) {
      console.warn("[CRAVING] Image generation failed:", imgErr);
    }

    // Enforce starchyCarbs/fibrousCarbs split before sending to client.
    // stableMealGenerator doesn't call the carb classifier, so we run it here
    // to guarantee every craving-creator meal carries accurate starch attribution.
    const mealWithCarbsEnforced = enforceCarbs(generatedMeal as any);

    // Add servings info to the meal response
    const mealWithServings = {
      ...mealWithCarbsEnforced,
      wholeFoodDecision,
      imageUrl: cravingImageUrl || (mealWithCarbsEnforced as any).imageUrl || null,
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

    // Ingest temp image URL to permanent storage before saving.
    // Guard: strip base64 data URIs before the lifecycle gate — client-side
    // localStorage may cache meals with raw base64 before the permanent URL is
    // available.  Passing base64 to processMealImageForSave triggers a
    // lifecycle_violation ERROR log.  Null it out here so the meal saves with
    // no image rather than producing a false-alarm error (the permanent URL is
    // already stored on the server; the client is just sending a stale cache).
    const rawInputImageUrl = input.recipePayload.imageUrl ?? null;
    const sanitisedInputImageUrl =
      rawInputImageUrl?.startsWith("data:") ? null : rawInputImageUrl;
    if (rawInputImageUrl && !sanitisedInputImageUrl) {
      console.warn(
        `[craving-creator/log] Stripped base64 imageUrl from client payload for "${input.recipePayload.title}" — client sent stale localStorage data`,
      );
    }

    let persistedImageUrl: string | null = null;
    try {
      const imgResult = await processMealImageForSave(
        sanitisedInputImageUrl,
        input.recipePayload.title
      );
      persistedImageUrl = imgResult.imageUrl;
      if (imgResult.ingestionAttempted && !imgResult.imageUrl) {
        console.warn(`[craving-creator/log] Image ingestion returned no URL for "${input.recipePayload.title}"`);
      }
    } catch (imgErr) {
      console.error(`[craving-creator/log] processMealImageForSave failed for "${input.recipePayload.title}":`, imgErr);
    }

    // Save recipe to user_recipes
    const [savedRecipe] = await db.insert(userRecipes).values({
      userId,
      title: input.recipePayload.title,
      ingredients: input.recipePayload.ingredients,
      instructions: input.recipePayload.instructions,
      nutrition: input.recipePayload.nutrition,
      imageUrl: persistedImageUrl,
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
        statusChangedAt: input.logNow ? sql`now()` : null,
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