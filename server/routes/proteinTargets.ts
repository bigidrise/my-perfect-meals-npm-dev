import { Router } from "express";
import { z } from "zod";

const router = Router();

const saveSchema = z.object({
  userId: z.string(),
  goal: z.enum(["loss","maintain","gain"]),
  unit: z.enum(["lb","kg"]),
  weight: z.number(),
  dailyTargetGrams: z.number().int().min(20).max(400),
  rangeUnitLabel: z.enum(["g/kg","g/lb"]),
  minFactor: z.number().min(0.5).max(4),
  maxFactor: z.number().min(0.5).max(4),
});

// POST /api/users/:userId/macros/protein-target
router.post("/users/:userId/macros/protein-target", async (req, res) => {
  const parsed = saveSchema.safeParse({ ...req.body, userId: req.params.userId });
  if (!parsed.success) return res.status(400).send(parsed.error.message);
  const { userId, dailyTargetGrams, goal, unit, weight, rangeUnitLabel, minFactor, maxFactor } = parsed.data;

  // For now, just return success - you can connect to database later
  console.log(`Saving protein target for user ${userId}: ${dailyTargetGrams}g/day (${goal}, ${unit}, ${weight}${unit})`);
  
  res.json({ 
    ok: true, 
    saved: {
      userId,
      dailyTargetGrams,
      goal,
      unit,
      weight,
      rangeUnitLabel,
      minFactor,
      maxFactor
    }
  });
});

const distSchema = z.object({
  userId: z.string(),
  weekStartISO: z.string(),
  dailyTargetGrams: z.number().int().min(20).max(400).optional(),
  dailyTargetCalories: z.number().int().min(50).max(4000).optional(),
  mealsPerDay: z.number().int().min(3).max(6),
  goal: z.enum(["loss","maintain","gain"]),
}).refine((data) => data.dailyTargetGrams || data.dailyTargetCalories, {
  message: "Either dailyTargetGrams or dailyTargetCalories must be provided"
});

// POST /api/users/:userId/meal-plan/distribute-protein
router.post("/users/:userId/meal-plan/distribute-protein", async (req, res) => {
  const parsed = distSchema.safeParse({ ...req.body, userId: req.params.userId });
  if (!parsed.success) {
    console.error('❌ Protein distribution validation failed:', {
      body: req.body,
      errors: parsed.error.issues
    });
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: parsed.error.issues,
      received: req.body
    });
  }

  const data = parsed.data;
  const { userId, weekStartISO, mealsPerDay } = data;

  // Handle both grams and calories input
  let dailyTargetGrams: number;
  if (data.dailyTargetGrams) {
    dailyTargetGrams = data.dailyTargetGrams;
  } else if (data.dailyTargetCalories) {
    // Convert protein calories to grams (4 calories per gram of protein)
    dailyTargetGrams = Math.round(data.dailyTargetCalories / 4);
  } else {
    return res.status(400).json({ error: 'Either dailyTargetGrams or dailyTargetCalories required' });
  }

  // Ensure we stay within reasonable bounds
  dailyTargetGrams = Math.min(400, Math.max(20, dailyTargetGrams));
  
  const perMeal = Math.round((dailyTargetGrams / mealsPerDay) * 10) / 10;

  console.log(`✅ Distributing ${dailyTargetGrams}g protein across ${mealsPerDay} meals (${perMeal}g each) for user ${userId}, week ${weekStartISO}`);

  res.json({ 
    ok: true, 
    distributed: {
      userId,
      weekStartISO,
      dailyTargetGrams,
      mealsPerDay,
      perMeal
    }
  });
});

export default router;