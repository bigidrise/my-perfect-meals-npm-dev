import { Router } from 'express';
import { hydrateMeal } from '../services/mealInstructionResolver';
import { validateAndFixMeal } from '../services/mealValidation';

export const cookingRouter = Router();

// Hydrate a single meal (used by Weekly Calendar UI) with validation guardrails
cookingRouter.post('/cooking/hydrate-meal', (req, res) => {
  try {
    const meal = req.body?.meal;
    if (!meal || !Array.isArray(meal.ingredients)) {
      return res.status(400).json({ error: 'meal with ingredients[] required' });
    }
    
    // Apply guardrails: ensure no blank amounts or missing instructions
    const { meal: validated, validation } = validateAndFixMeal(meal);
    
    if (!validation.isValid) {
      console.error('Meal validation failed:', validation.errors);
      return res.status(400).json({ 
        error: 'Meal validation failed', 
        details: validation.errors 
      });
    }
    
    return res.json({ 
      meal: validated, 
      validation: {
        warnings: validation.warnings
      }
    });
  } catch (e) {
    console.error('hydrate-meal error', e);
    return res.status(500).json({ error: 'failed to hydrate meal' });
  }
});

// Batch: repair an entire weekly plan in place (server saves result)
// Expects your own getPlan/savePlan implementations
cookingRouter.post('/weekly-plans/:planId/repair-instructions', async (req, res) => {
  const { planId } = req.params;
  try {
    // This would need to be implemented with actual plan storage
    // const plan = await (req as any).db.getPlan(planId);
    // if (!plan) return res.status(404).json({ error: 'plan not found' });
    // plan.days = plan.days.map((d: any) => ({
    //   ...d,
    //   meals: d.meals.map((m: any) => hydrateMeal(m)),
    // }));
    // await (req as any).db.savePlan(planId, plan);
    return res.json({ ok: true, message: 'Plan repair not implemented yet' });
  } catch (e) {
    console.error('repair-instructions error', e);
    return res.status(500).json({ error: 'failed to repair plan' });
  }
});