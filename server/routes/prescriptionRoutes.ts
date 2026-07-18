/**
 * Daily Nutrition Prescription API
 *
 * GET /api/prescription/:dateISO
 *   Returns the resolved DailyNutritionPrescription for the authenticated user
 *   on the given date.
 *
 * Query params:
 *   starchyConsumed  — grams of starchy carbs already eaten today (integer)
 *   starchMealsUsed  — number of starch meals already logged today (integer)
 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { resolveDailyNutritionPrescription } from "../services/prescriptionResolver";

const router = Router();

router.get("/:dateISO", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { dateISO } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    const starchyConsumed = parseInt((req.query.starchyConsumed as string) ?? "0", 10) || 0;
    const starchMealsUsed = parseInt((req.query.starchMealsUsed as string) ?? "0", 10) || 0;

    const prescription = await resolveDailyNutritionPrescription({
      userId,
      dateISO,
      consumed: { starchyCarbs: starchyConsumed, starchMealsUsed },
    });

    return res.json(prescription);
  } catch (err) {
    console.error("[prescriptionRoutes] Error resolving prescription:", err);
    return res.status(500).json({ error: "Failed to resolve prescription" });
  }
});

export default router;
