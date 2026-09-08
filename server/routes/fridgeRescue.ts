// 🔒 LOCKED: Deterministic Fridge Rescue API - DO NOT MODIFY
// This endpoint works perfectly with the new rule-based engine
// User confirmed it's working right - any changes will break functionality
import { Router } from 'express';
import { z } from 'zod';
import { generateFridgeMeals } from '../services/fridgeRescueEngine';
import { requireAuth } from '../middleware/requireAuth';
import { requireActiveAccess } from '../middleware/requireActiveAccess';
import { createHumanFoodRequestScope } from '../services/humanFoodContext/requestScope';
import { validateHumanFoodCandidate } from '../services/humanFoodContext/finalValidation';
import { validateMealForDiet } from '../services/guardrails';

const router = Router();

const GenerateRequestSchema = z.object({
  items: z.array(z.string().min(1)).min(1, 'At least one item is required'),
  servings: z.number().int().min(1).max(12).default(2),
  dietFlags: z.array(z.string()).default([]),
});

router.post('/fridge-rescue/generate', requireAuth, requireActiveAccess, async (req, res) => {
  console.log('🔧 New deterministic fridge rescue request');
  
  try {
    const parsed = GenerateRequestSchema.safeParse(req.body);
    
    if (!parsed.success) {
      console.error('❌ Validation failed:', parsed.error.flatten());
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: parsed.error.flatten().fieldErrors 
      });
    }

    const { items, servings } = parsed.data;
    const userId = (req as any).authUser?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    // The submitted diet flags are a display/request hint only.  Resolve the
    // authoritative food context from the authenticated user; in particular,
    // never accept a client supplied glucose produce allowlist.
    const foodScope = createHumanFoodRequestScope({
      actorUserId: userId,
      subjectUserId: userId,
      creator: "fridge_rescue",
      correlationId: (req as any).id,
      actionRequest: items.join(", "),
      authorizationAction: "fridge_rescue",
      advisoryOverrideToken: typeof req.body?.advisoryOverrideToken === "string"
        ? req.body.advisoryOverrideToken
        : undefined,
    });
    const foodContext = await foodScope.resolve();
    if (foodContext.status === "blocked" || foodContext.status === "review_required") {
      await foodScope.releaseAuthorization();
      return res.status(409).json({
        code: "HUMAN_FOOD_CONTEXT_UNRESOLVED",
        status: foodContext.status,
        message: foodContext.notices[0] || "Required food context could not be resolved safely.",
      });
    }
    
    const meals = generateFridgeMeals({ 
      items, 
      servings, 
      dietFlags: foodContext.diet.effective as any[],
    });
    const diabetesActive = foodContext.safety.healthConditions.some((condition) =>
      /diabet/i.test(String(condition)),
    );
    const validatedMeals = meals.map((meal: any) => {
      const ingredients = (meal.ingredients ?? []).map((ingredient: any) => ({
        name: typeof ingredient === "string" ? ingredient : ingredient.name,
      }));
      const diabetesCompliant = !diabetesActive || validateMealForDiet({
        name: meal.title,
        ingredients,
        instructions: meal.instructions,
        macros: meal.nutrition,
      }, "diabetic").isValid;
      const validation = validateHumanFoodCandidate({
        name: meal.title,
        ingredients,
        instructions: meal.instructions,
        nutrition: meal.nutrition,
        evidence: {
          sourceType: "generated_recipe",
          ingredientEvidence: "structured_generation",
          preparationEvidence: "structured_generation",
          nutritionEvidence: "structured_generation",
          diabetesCompliant,
        },
      }, foodContext, { executionState: foodScope.executionState, requestedDish: items.join(", ") });
      return { ...meal, humanFoodValidation: validation };
    });
    const safeMeals = validatedMeals.filter((meal: any) => meal.humanFoodValidation.outcome === "pass");
    if (safeMeals.length === 0) {
      await foodScope.releaseAuthorization();
      return res.status(422).json({
        code: "FRIDGE_RESCUE_CANDIDATES_REJECTED",
        message: "No generated meal safely satisfies your active food context.",
        validation: validatedMeals.map((meal: any) => meal.humanFoodValidation),
      });
    }
    await foodScope.completeAuthorization();
    
    console.log(`✅ Generated ${safeMeals.length} validated meals successfully`);
    
    res.json({ meals: safeMeals });
  } catch (error: any) {
    console.error('❌ Fridge rescue engine error:', error);
    res.status(500).json({ 
      error: 'Failed to generate meals',
      message: error.message 
    });
  }
});

export { router as fridgeRescueRouter };