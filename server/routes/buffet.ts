/**
 * My Perfect Buffet — backend route
 *
 * POST /api/buffet/recommend
 *   Body: { foodsDescription: string, categories?: {...} }
 *   Auth: requireAuth (no Google Places, no Restaurant Intelligence Engine)
 *   Returns: { recommendations: AwayFromHomeRecommendation[] }  (3 distinct plates)
 *
 * See ADR-003 (Away From Home Domain Model) for contract.
 */

import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { getActiveNutritionContext } from "../services/nutritionContext/getActiveNutritionContext";
import { generateBuffetRecommendations } from "../services/buffetRecommendationAI";
import { resolveDailyNutritionState } from "../services/nutritionStateService";
import { buildRemainingMacrosBlock } from "../services/restaurantMealGeneratorAI";
import { resolveGLP1GlobalContext, buildGLP1RecommendationBlock } from "../services/glp1/resolveGLP1GlobalContext";

const router = Router();

router.post("/recommend", async (req, res) => {
  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const { foodsDescription, categories, requestedFood } = req.body as {
      foodsDescription?: string;
      requestedFood?: string;
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

    // ── Remaining macros + GLP-1 canonical context in parallel ─────────────
    const todayISO = new Date().toISOString().slice(0, 10);
    let remainingMacrosBlock = "";
    let glp1Block = "";
    const [dailyState, glp1Ctx] = await Promise.all([
      resolveDailyNutritionState(userId, todayISO).catch(() => null),
      resolveGLP1GlobalContext(userId, todayISO).catch(() => null),
    ]);
    if (dailyState) remainingMacrosBlock = buildRemainingMacrosBlock(dailyState.remaining);
    if (glp1Ctx) glp1Block = buildGLP1RecommendationBlock(glp1Ctx);

    const recommendations = await generateBuffetRecommendations({
      foodsDescription: foodsDescription ?? "",
      categories,
      nutritionContext,
      requestedFood: requestedFood ?? undefined,
      remainingMacrosBlock: remainingMacrosBlock || undefined,
      glp1RecommendationBlock: glp1Block || undefined,
    });

    return res.json({ recommendations });
  } catch (err) {
    console.error("[Buffet] Error:", err);
    return res.status(500).json({
      error: "Failed to generate buffet recommendations.",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
