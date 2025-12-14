import express from "express";
import { z } from "zod";

const router = express.Router();

// Schema for dinner meal acceptance
const DinnerAcceptSchema = z.object({
  meal: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    baseServings: z.number(),
    template: z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string(),
      healthBadges: z.array(z.string()),
      ingredients: z.array(z.object({
        item: z.string(),
        quantity: z.number(),
        unit: z.string()
      })),
      instructions: z.array(z.string())
    })
  }),
  servings: z.number().min(1).max(12),
  source: z.string().optional().default("dinner")
});

// POST /api/dinner/accept - Accept a dinner meal template
router.post("/accept", async (req, res) => {
  try {
    const parsed = DinnerAcceptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid dinner meal data",
        issues: parsed.error.flatten()
      });
    }

    const { meal, servings, source } = parsed.data;
    
    // Scale ingredients based on servings
    const scalingFactor = servings / meal.baseServings;
    const scaledIngredients = meal.template.ingredients.map(ing => ({
      ...ing,
      quantity: Math.round(ing.quantity * scalingFactor * 10) / 10
    }));

    // Create standardized meal object for weekly plan
    const plannedMeal = {
      id: `${meal.id}-${meal.template.slug}-${Date.now()}`,
      name: `${meal.name} - ${meal.template.name}`,
      servings: servings,
      ingredients: scaledIngredients.map(ing => `${ing.quantity} ${ing.unit} ${ing.item}`),
      instructions: meal.template.instructions,
      nutritionPerServing: null, // Could be calculated if needed
      source: source,
      healthBadges: meal.template.healthBadges,
      description: meal.template.description,
      baseServings: meal.baseServings,
      createdAt: new Date().toISOString()
    };

    // Log the acceptance for analytics/history if needed
    console.log(`✅ Dinner meal accepted: ${meal.name} - ${meal.template.name} (${servings} servings)`);

    // Return success with the prepared meal object
    res.json({
      success: true,
      message: `${meal.template.name} saved successfully`,
      meal: plannedMeal,
      servings: servings
    });

  } catch (error) {
    console.error("Error accepting dinner meal:", error);
    res.status(500).json({
      error: "Failed to save dinner meal",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;