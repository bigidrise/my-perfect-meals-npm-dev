import express from "express";
import { getWeeklyPlan, upsertWeeklyPlan, deleteWeeklyPlan, checkPlanExpiry, generateImmediatePlan } from "../db/repo.weeklyPlan";
import { requireAuth } from "../middleware/requireAuth";
import { evaluateWholeFoodCandidate } from "../services/wholeFoodStandard";
// import { generateSingleMeal } from "../services/mealEngineService";

const router = express.Router();

// Legacy route removed - replaced by /api/meal-plan/current in mealPlans.routes.ts

// Save weekly plan with rolling dates
router.post("/meal-plan/save", requireAuth, async (req, res) => {
  try {
    const authUserId: string = (req as any).authUser.id;
    const { plan, params, planStartDate, planEndDate } = req.body;
    if (!plan) {
      return res.status(400).json({ error: "plan required" });
    }
    
    const startDate = planStartDate ? new Date(planStartDate) : new Date();
    const endDate = planEndDate ? new Date(planEndDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await upsertWeeklyPlan(authUserId, plan, params || {}, startDate, endDate);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error saving weekly plan:", error);
    res.status(500).json({ error: "Failed to save weekly plan" });
  }
});

// Regenerate weekly plan using previous parameters
router.post("/meal-plan/regenerate", requireAuth, async (req, res) => {
  try {
    const authUserId: string = (req as any).authUser.id;
    
    const existing = await getWeeklyPlan(authUserId);
    const seed: any = existing?.params || {};
    
    // For now, generate a simple response structure
    // TODO: Integrate with proper meal engine plan generation
    const plan = {
      meals: [],
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0
    };
    
    await upsertWeeklyPlan(authUserId, plan, {
      ...seed,
      regeneratedAt: new Date().toISOString(),
    });
    
    res.json({ plan });
  } catch (error) {
    console.error("Error regenerating weekly plan:", error);
    res.status(500).json({ error: "Failed to regenerate weekly plan" });
  }
});

// Delete weekly plan
router.post("/meal-plan/delete", requireAuth, async (req, res) => {
  try {
    const authUserId: string = (req as any).authUser.id;
    await deleteWeeklyPlan(authUserId);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting weekly plan:", error);
    res.status(500).json({ error: "Failed to delete weekly plan" });
  }
});

// Check if user's plan is expired and needs regeneration
router.get("/meal-plan/status", requireAuth, async (req, res) => {
  try {
    const authUserId: string = (req as any).authUser.id;
    const status = await checkPlanExpiry(authUserId);
    res.json(status);
  } catch (error) {
    console.error("Error checking plan status:", error);
    res.status(500).json({ error: "Failed to check plan status" });
  }
});

// Generate immediate plan for new user (called after onboarding)
// requireAuth ensures req.authUser is populated — userId is always the session owner.
router.post("/meal-plan/immediate", requireAuth, async (req, res) => {
  try {
    const { onboardingData } = req.body;

    // Use the authenticated session identity for ALL operations — generation,
    // GLP-1 resolution, and persistence.  Never trust a body-supplied userId
    // (IDOR: any caller could read or write another user's plan).
    const sessionUserId: string = (req as any).authUser.id;

    const planDetails = await generateImmediatePlan(sessionUserId, onboardingData || {});

    // ── GLP-1 canonical context ─────────────────────────────────────────────
    // Authenticated session identity is guaranteed above — use it directly.
    let glp1ImmediateActive = false;
    let glp1ImmediateTargets: import("../services/glp1/resolveGLP1MealTargets").ResolvedGLP1Targets | null = null;
    if (sessionUserId) {
      try {
        const { resolveGLP1GlobalContext } = await import("../services/glp1/resolveGLP1GlobalContext");
        const glp1Ctx = await resolveGLP1GlobalContext(
          sessionUserId,
          new Date().toISOString().split("T")[0],
          "lunch",
        );
        glp1ImmediateActive = glp1Ctx.isActive;
        glp1ImmediateTargets = glp1Ctx.resolvedTargets;
        if (glp1ImmediateActive) {
          console.log(
            `💊 [GLP-1/ImmediatePlan] Active — sources=[${glp1Ctx.activationSources.join(",")}]`,
          );
        }
      } catch (err) {
        console.warn("⚠️ [GLP-1/ImmediatePlan] Could not resolve context:", err);
      }
    }

    // Template meal base values (will be clamped below when GLP-1 is active).
    type TemplateMeal = {
      id: string; name: string; description: string;
      nutrition: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
      ingredients: { item: string; amount: number; unit: string }[];
      instructions: string[]; servings: number;
      compliance: { allergiesCleared: boolean; medicalCleared: boolean; unitsStandardized: boolean };
    };
    const templateMeals: TemplateMeal[] = [
      { id: '1', name: 'Welcome Breakfast', description: 'Your first meal to start the journey',
        nutrition: { calories: 350, protein_g: 20, carbs_g: 45, fat_g: 12 },
        ingredients: [{ item: 'eggs', amount: 2, unit: 'whole' }],
        instructions: ['Cook and enjoy'], servings: 1,
        compliance: { allergiesCleared: true, medicalCleared: true, unitsStandardized: true } },
      { id: '2', name: 'Welcome Lunch', description: 'A nutritious midday meal',
        nutrition: { calories: 450, protein_g: 25, carbs_g: 50, fat_g: 15 },
        ingredients: [{ item: 'chicken', amount: 4, unit: 'oz' }],
        instructions: ['Prepare and serve'], servings: 1,
        compliance: { allergiesCleared: true, medicalCleared: true, unitsStandardized: true } },
      { id: '3', name: 'Welcome Dinner', description: 'A satisfying evening meal',
        nutrition: { calories: 500, protein_g: 30, carbs_g: 40, fat_g: 20 },
        ingredients: [{ item: 'salmon', amount: 6, unit: 'oz' }],
        instructions: ['Cook to perfection'], servings: 1,
        compliance: { allergiesCleared: true, medicalCleared: true, unitsStandardized: true } },
    ];

    // ── GLP-1 fail-closed validation ─────────────────────────────────────
    // Validate each template meal against GLP-1 targets and EXCLUDE any that
    // fail — do NOT clamp/mutate nutrition fields (that relabels a non-compliant
    // meal without changing its ingredients, which is clinically incorrect).
    // GLP-1 patients receive only meals that actually comply at template level.
    let planMeals: typeof templateMeals = templateMeals;
    if (glp1ImmediateActive && glp1ImmediateTargets) {
      const t = glp1ImmediateTargets;
      try {
        const { validateMealForDiet } = await import("../services/guardrails/index");
        const before = planMeals.length;
        planMeals = planMeals.filter(meal => {
          const ingList = meal.ingredients.map((i) => ({
            name: i.item, quantity: String(i.amount), unit: i.unit,
          }));
          const macros = {
            calories: meal.nutrition.calories,
            protein:  meal.nutrition.protein_g,
            fat:      meal.nutrition.fat_g,
            carbs:    meal.nutrition.carbs_g,
          };
          const vr = validateMealForDiet(
            { name: meal.name, ingredients: ingList, macros },
            "glp1", undefined, false, t,
          );
          if (!vr.isValid) {
            console.warn(
              `💊 [GLP-1/ImmediatePlan] Excluding "${meal.name}" (fails GLP-1 validation):`,
              vr.violations,
            );
          }
          return vr.isValid;
        });
        if (planMeals.length < before) {
          console.log(`💊 [GLP-1/ImmediatePlan] ${before - planMeals.length} non-compliant template meal(s) excluded from plan`);
        }
      } catch (err) {
        // Fail closed: validation module error means we cannot confirm compliance.
        // Exclude all templates rather than persisting unvalidated meals.
        console.warn("⚠️ [GLP-1/ImmediatePlan] Validation error — excluding all templates (fail closed):", err);
        planMeals = [];
      }
    }

    // These are static recommendation templates, so evaluate them at the
    // selection boundary before persisting or returning them.
    const wholeFoodPlanMeals = planMeals.flatMap((meal) => {
      const wholeFoodDecision = evaluateWholeFoodCandidate({
        name: meal.name,
        description: meal.description,
        ingredients: meal.ingredients.map((ingredient) => ingredient.item),
        instructions: meal.instructions,
      }, { recommendationSurface: "immediate_weekly_plan" });
      if (wholeFoodDecision.shouldBlock) {
        console.warn(`[ImmediatePlan] Excluding "${meal.name}" under ${wholeFoodDecision.policyVersion}: ${wholeFoodDecision.reason}`);
        return [];
      }
      return [{ ...meal, wholeFoodDecision }];
    });
    const mockPlan = { meals: wholeFoodPlanMeals };
    await upsertWeeklyPlan(sessionUserId, mockPlan, planDetails.params, planDetails.startDate, planDetails.endDate);
    
    res.json({ 
      ok: true, 
      plan: mockPlan, 
      startDate: planDetails.startDate, 
      endDate: planDetails.endDate,
    });
  } catch (error) {
    console.error("Error generating immediate plan:", error);
    res.status(500).json({ error: "Failed to generate immediate plan" });
  }
});

export default router;