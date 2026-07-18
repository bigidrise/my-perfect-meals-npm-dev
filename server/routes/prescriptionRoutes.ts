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
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { resolveDailyNutritionPrescription } from "../services/prescriptionResolver";
import { getTierForLookupKey } from "../../shared/planFeatures";
import { deriveClinicalStatus } from "../../shared/dailyNutritionPrescription";
import { clinicalLabs } from "../db/schema/clinicalLabs";
import { companionProfiles } from "../db/schema/companionProfiles";

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

// ── GET clinical status (tier-aware, does not require macro targets to be set) ──────────

router.get("/clinical-status", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });

    const [labCountResult, companionResult] = await Promise.all([
      db.select({ count: count() }).from(clinicalLabs).where(eq(clinicalLabs.userId, userId)),
      db.select().from(companionProfiles).where(eq(companionProfiles.userId, userId)).limit(1),
    ]);

    const tier = getTierForLookupKey(user.planLookupKey);
    const hasLabs = (labCountResult[0]?.count ?? 0) > 0;
    const hasVerifiedMedications =
      Array.isArray(companionResult[0]?.medications) &&
      (companionResult[0]!.medications as string[]).length > 0;
    const selfReportedCategories = Array.isArray(user.clinicalContextCategories)
      ? (user.clinicalContextCategories as string[])
      : [];
    const hasScreeningResponse =
      user.clinicalContextResponse === "yes" && selfReportedCategories.length > 0;

    const clinicalPrecisionStatus = deriveClinicalStatus(
      tier, hasVerifiedMedications, hasLabs, hasScreeningResponse,
    );

    return res.json({
      clinicalPrecisionStatus,
      tier,
      hasLabs,
      hasVerifiedMedications,
      hasScreeningResponse,
    });
  } catch (err) {
    console.error("[prescriptionRoutes] Error fetching clinical status:", err);
    return res.status(500).json({ error: "Failed to fetch clinical status" });
  }
});

// ── PATCH clinical context (self-reported screening — authoritative, persisted to DB) ──

const VALID_CLINICAL_CONTEXT_RESPONSES = ["yes", "no", "unsure"] as const;
const VALID_CLINICAL_CATEGORIES = [
  "systemic_corticosteroid",
  "testosterone_therapy",
  "estrogen_or_progesterone",
  "thyroid_medication",
  "glp1_medication",
  "insulin_or_diabetes_medication",
  "cardiac_or_blood_pressure_medication",
  "diuretic",
  "peptide_or_growth_hormone_related",
  "other",
] as const;

router.patch("/clinical-context", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { clinicalContextResponse, selectedClinicalCategories } = req.body;

    if (!VALID_CLINICAL_CONTEXT_RESPONSES.includes(clinicalContextResponse)) {
      return res.status(400).json({
        error: `clinicalContextResponse must be one of: ${VALID_CLINICAL_CONTEXT_RESPONSES.join(", ")}`,
      });
    }

    // Validate categories — only allowed when response is "yes"
    const categories: string[] = [];
    if (clinicalContextResponse === "yes" && Array.isArray(selectedClinicalCategories)) {
      for (const cat of selectedClinicalCategories) {
        if (VALID_CLINICAL_CATEGORIES.includes(cat as any)) {
          categories.push(cat as string);
        }
      }
    }

    await db.update(users).set({
      clinicalContextResponse,
      clinicalContextCategories: categories,
      clinicalContextUpdatedAt: new Date(),
    }).where(eq(users.id, userId));

    return res.json({
      ok: true,
      saved: {
        clinicalContextResponse,
        selectedClinicalCategories: categories,
      },
    });
  } catch (err) {
    console.error("[prescriptionRoutes] Error saving clinical context:", err);
    return res.status(500).json({ error: "Failed to save clinical context" });
  }
});

export default router;
