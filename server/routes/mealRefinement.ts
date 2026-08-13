/**
 * mealRefinement.ts — POST /api/meal-refinement/refine
 *
 * Universal meal refinement endpoint. Any builder can send its existing meal JSON
 * and a natural-language change instruction to receive an updated meal in the same
 * schema, validated against the user's full protocol context.
 *
 * Auth: requireAuth (every authenticated user can refine meals).
 * Clinical gates: enforced inside mealRefinementEngine via protocol envelope.
 */

import express from "express";
import { refineMeal, MealRefinementRetryableError } from "../services/mealRefinementEngine";

const router = express.Router();

function resolveUserId(req: any): string | undefined {
  return req.authUser?.id || (req.session as any)?.userId || req.user?.id;
}

/**
 * POST /api/meal-refinement/refine
 *
 * Body:
 *   existingMeal      {object}  — Full meal JSON from any builder.
 *   changeInstruction {string}  — Natural-language description of the change.
 *   mealType?         {string}  — "breakfast" | "lunch" | "dinner" | "snack" (default: "lunch")
 *   generatorName?    {string}  — Originating builder name for NDE audit (default: "meal_refinement")
 *
 * Response:
 *   updatedMeal       {object}  — Modified meal in the same schema as existingMeal.
 *   changesSummary    {string}  — What changed and why.
 *   protocolNote      {string|null} — Protocol note when a soft constraint was relevant.
 */
router.post("/refine", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { existingMeal, changeInstruction, mealType, generatorName } = req.body;

    if (!existingMeal || typeof existingMeal !== "object" || Array.isArray(existingMeal)) {
      return res.status(400).json({ error: "existingMeal must be a non-null object." });
    }

    if (!changeInstruction || typeof changeInstruction !== "string" || !changeInstruction.trim()) {
      return res.status(400).json({ error: "changeInstruction is required." });
    }

    const validMealTypes = ["breakfast", "lunch", "dinner", "snack"];
    const resolvedMealType = validMealTypes.includes(mealType) ? mealType : "lunch";

    const result = await refineMeal({
      userId,
      existingMeal: existingMeal as Record<string, unknown>,
      changeInstruction: changeInstruction.trim(),
      mealType: resolvedMealType as "breakfast" | "lunch" | "dinner" | "snack",
      generatorName: typeof generatorName === "string" ? generatorName : "meal_refinement",
    });

    return res.json(result);
  } catch (err: any) {
    const message: string = err?.message ?? "Meal refinement unavailable. Please try again.";

    // GLP-1 resolver temporarily unavailable — clients must retry, not treat as a user error
    if (err instanceof MealRefinementRetryableError) {
      return res.status(503).json({ error: message, retryable: true });
    }

    // PROTOCOL_VIOLATION — user-facing error with a specific action hint
    if (message.startsWith("PROTOCOL_VIOLATION")) {
      return res.status(400).json({
        error: "PROTOCOL_VIOLATION",
        message: message.replace(/^PROTOCOL_VIOLATION:\s*/, ""),
        retryable: true,
      });
    }

    // Hard protocol block — modification conflicts with active health protocol
    if (message.includes("conflicts with your active health protocol")) {
      return res.status(422).json({ error: message });
    }

    console.error("[MealRefinement] Error:", message);
    return res.status(500).json({ error: "Meal refinement unavailable. Please try again." });
  }
});

export default router;
