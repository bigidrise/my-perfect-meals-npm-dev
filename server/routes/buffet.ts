/**
 * My Perfect Buffet — backend route
 *
 * POST /api/buffet/recommend
 *   Body: { foodsDescription: string, categories?: {...} }
 *   Auth: requireAuth (no Google Places, no Restaurant Intelligence Engine)
 *
 * See ADR-003 (Away From Home Domain Model) for contract.
 */

import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { getActiveNutritionContext } from "../services/nutritionContext/getActiveNutritionContext";
import { generateBuffetRecommendation } from "../services/buffetRecommendationAI";

const router = Router();

router.post("/recommend", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { foodsDescription, categories } = req.body as {
      foodsDescription?: string;
      categories?: {
        proteins?: string;
        vegetables?: string;
        starches?: string;
        sauces?: string;
        desserts?: string;
        beverages?: string;
      };
    };

    if (!foodsDescription?.trim() && !categories) {
      return res.status(400).json({ error: "Describe the foods available at the buffet." });
    }

    const nutritionContext = await getActiveNutritionContext(userId);

    const recommendation = await generateBuffetRecommendation({
      foodsDescription: foodsDescription ?? "",
      categories,
      nutritionContext,
    });

    return res.json({ recommendation });
  } catch (err) {
    console.error("[Buffet] Error:", err);
    return res.status(500).json({
      error: "Failed to generate buffet recommendation.",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
