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
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";

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
    const protocolEnvelope = await loadUserProtocolEnvelope(userId);
    if (!protocolEnvelope) {
      return res.status(503).json({ error: "Nutrition guidance is temporarily unavailable. Please try again.", retryable: true });
    }

    // ── GLP-1 canonical context — fail closed ─────────────────────────────────
    const todayISO = new Date().toISOString().slice(0, 10);
    const glp1Ctx = await resolveGLP1GlobalContext(userId, todayISO).catch(() => null);
    if (glp1Ctx === null) {
      return res.status(503).json({ error: "Clinical guidance temporarily unavailable. Please try again.", retryable: true });
    }
    if (glp1Ctx.isActive && !glp1Ctx.resolvedTargets) {
      return res.status(503).json({ error: "GLP-1 clinical targets temporarily unavailable. Please try again.", retryable: true });
    }

    let remainingMacrosBlock = "";
    let glp1Block = "";
    const [dailyState] = await Promise.all([
      resolveDailyNutritionState(userId, todayISO).catch(() => null),
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
      protocolEnvelope,
    });

    // ── GLP-1 post-gen plate filtering ────────────────────────────────────────
    // Buffet plates include estimatedCalories, estimatedProteinGrams, and
    // estimatedFatGrams. Filter any plate whose estimated fat exceeds the patient-
    // specific ceiling before returning recommendations — prompt guidance alone
    // cannot guarantee the AI respected the ceiling.
    let filtered = recommendations;
    if (glp1Ctx.isActive && glp1Ctx.resolvedTargets) {
      const t = glp1Ctx.resolvedTargets;
      const before = recommendations.length;
      filtered = recommendations.filter((rec: any) => {
        const fat = rec.meal?.fatGrams;
        const cal = rec.meal?.calories;
        if (typeof fat === "number" && fat > t.maximumToleratedFatGrams) {
          console.warn(
            `[BUFFET/GLP-1] Filtered plate "${rec.meal?.name}" — fat ${fat}g > ceiling ${t.maximumToleratedFatGrams}g`
          );
          return false;
        }
        if (typeof cal === "number" && cal > t.resolvedMealCalories * 1.25) {
          // 25 % headroom for estimate imprecision
          console.warn(
            `[BUFFET/GLP-1] Filtered plate "${rec.meal?.name}" — cal ${cal} > ceiling ${t.resolvedMealCalories * 1.25}`
          );
          return false;
        }
        return true;
      });
      if (filtered.length === 0 && before > 0) {
        // All plates were non-compliant — fail closed rather than sending bad food
        console.error("[BUFFET/GLP-1] All plates exceeded clinical limits — returning 503");
        return res.status(503).json({
          error: "All buffet recommendations exceeded your GLP-1 clinical fat limit. Please describe lower-fat options available.",
          retryable: true,
        });
      }
      if (filtered.length < before) {
        console.log(`[BUFFET/GLP-1] Filtered ${before - filtered.length} non-compliant plates; returning ${filtered.length}`);
      }
    }

    return res.json({ recommendations: filtered });
  } catch (err) {
    console.error("[Buffet] Error:", err);
    return res.status(500).json({
      error: "Failed to generate buffet recommendations.",
      details: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
