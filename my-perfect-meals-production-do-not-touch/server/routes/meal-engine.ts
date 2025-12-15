// server/routes/meal-engine.ts
import express from "express";
import { z } from "zod";
import { generateMeal } from "../services/mealEngineService";

const router = express.Router();

const GenerateMealRequest = z.object({
  source: z.string().optional().default("craving"),
  cravingInput: z.string().min(2, "Please describe your craving"),
  dietaryRestrictions: z.string().optional().default(""),
  useOnboarding: z.boolean().optional().default(true),
  userId: z.string().optional().default("1"),
  servings: z.number().int().min(1).max(8).optional().default(2),
  // NEW: healthy transform contract
  goal: z
    .enum(["make_healthy_version", "literal"])
    .optional()
    .default("make_healthy_version"),
  healthTransform: z
    .enum(["always", "if_unhealthy"])
    .optional()
    .default("always"),
  nutritionTargets: z
    .object({
      maxCaloriesPerServing: z
        .number()
        .int()
        .min(200)
        .max(1200)
        .optional()
        .default(600),
      minProteinPerServing_g: z
        .number()
        .int()
        .min(10)
        .max(100)
        .optional()
        .default(25),
      maxAddedSugar_g: z.number().int().min(0).max(40).optional().default(8),
      maxSodium_mg: z.number().int().min(200).max(2000).optional().default(700),
      preferLowGI: z.boolean().optional().default(true),
    })
    .optional()
    .default({}),
  cookingRules: z
    .object({
      avoidDeepFry: z.boolean().optional().default(true),
      preferBakeAirFryGrill: z.boolean().optional().default(true),
      wholeGrainSwap: z.boolean().optional().default(true),
      leanProteinSwap: z.boolean().optional().default(true),
      reduceButterCream: z.boolean().optional().default(true),
    })
    .optional()
    .default({}),
});

router.post("/api/meal-engine/generate", async (req, res) => {
  const parsed = GenerateMealRequest.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid payload", issues: parsed.error.flatten() });
  }
  const input = parsed.data;

  try {
    const meal = await generateMeal(input);
    return res.json(meal); // STABLE Craving Creator expects a single meal object
  } catch (err: any) {
    console.error("[meal-engine] generation failed:", err?.stack || err);
    return res.status(500).json({ error: "Generation failed" });
  }
});

export default router;