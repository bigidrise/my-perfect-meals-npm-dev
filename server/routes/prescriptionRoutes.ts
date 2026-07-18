/**
 * Daily Nutrition Prescription API
 *
 * GET /api/prescription/:dateISO
 *   Returns the resolved DailyNutritionPrescription for the authenticated user
 *   on the given date.
 *
 *   Query params:
 *     starchyConsumed  — grams of STARCHY carbs already eaten today (integer, not total carbs)
 *     starchMealsUsed  — number of starch meals already logged today (integer)
 *
 * PATCH /api/prescription/starch-preferences
 *   Persists the user's starch meal preference and distribution strategy to the DB.
 *   Body: { defaultStarchMealsPerDay?: number, starchDistributionStrategy?: string }
 *
 *   This is the authoritative save path — not localStorage, not inferred from carb ratios.
 *   Professionals can also write to this endpoint on behalf of their clients via ProCare.
 */

import { Router } from "express";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { resolveDailyNutritionPrescription } from "../services/prescriptionResolver";

const VALID_DISTRIBUTION_STRATEGIES = ["even", "workout", "morning", "evening", "ai"] as const;
type DistributionStrategy = typeof VALID_DISTRIBUTION_STRATEGIES[number];

const router = Router();

// ── GET prescription for a date ──────────────────────────────────────────────

router.get("/:dateISO", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { dateISO } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    // starchyConsumed must be STARCHY carbs only — not total carbs
    const starchyConsumed = Math.max(0, parseInt((req.query.starchyConsumed as string) ?? "0", 10) || 0);
    const starchMealsUsed = Math.max(0, parseInt((req.query.starchMealsUsed as string) ?? "0", 10) || 0);

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

// ── PATCH starch preferences (persisted, authoritative) ───────────────────────

router.patch("/starch-preferences", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { defaultStarchMealsPerDay, starchDistributionStrategy } = req.body;

    // Validate starch meals count
    if (
      defaultStarchMealsPerDay !== undefined &&
      (typeof defaultStarchMealsPerDay !== "number" ||
        !Number.isInteger(defaultStarchMealsPerDay) ||
        defaultStarchMealsPerDay < 0 ||
        defaultStarchMealsPerDay > 8)
    ) {
      return res.status(400).json({
        error: "defaultStarchMealsPerDay must be an integer between 0 and 8",
      });
    }

    // Validate distribution strategy
    if (
      starchDistributionStrategy !== undefined &&
      !VALID_DISTRIBUTION_STRATEGIES.includes(starchDistributionStrategy as DistributionStrategy)
    ) {
      return res.status(400).json({
        error: `starchDistributionStrategy must be one of: ${VALID_DISTRIBUTION_STRATEGIES.join(", ")}`,
      });
    }

    if (defaultStarchMealsPerDay === undefined && starchDistributionStrategy === undefined) {
      return res.status(400).json({ error: "Nothing to update. Provide at least one field." });
    }

    const updates: Record<string, unknown> = {};
    if (defaultStarchMealsPerDay !== undefined) {
      updates.defaultStarchMealsPerDay = defaultStarchMealsPerDay;
      updates.starchPlanDefined = true;
    }
    if (starchDistributionStrategy !== undefined) {
      updates.starchDistributionStrategy = starchDistributionStrategy;
    }

    await db.update(users).set(updates).where(eq(users.id, userId));

    return res.json({
      ok: true,
      saved: {
        defaultStarchMealsPerDay: defaultStarchMealsPerDay ?? null,
        starchDistributionStrategy: starchDistributionStrategy ?? null,
      },
    });
  } catch (err) {
    console.error("[prescriptionRoutes] Error saving starch preferences:", err);
    return res.status(500).json({ error: "Failed to save starch preferences" });
  }
});

export default router;
