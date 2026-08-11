/**
 * POST /api/macro-calculator/compute
 *
 * [P3.2] Server-side macro calculation API.
 * The intelligence layer (Mifflin-St Jeor + adaptive pipeline) lives exclusively
 * in server/services/macroCalculatorEngine.ts — never exposed to the client bundle.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  computeMacros,
  resolvePerformanceMacroStrategy,
  type MacroComputeInput,
  type PerformanceOverlay,
} from "../services/macroCalculatorEngine";

const router = Router();

const VALID_GOALS = new Set(["loss", "maint", "gain"]);
const VALID_SEX = new Set(["male", "female"]);
const VALID_BODY_TYPE = new Set(["ecto", "meso", "endo", "mix"]);
const VALID_USER_TYPE = new Set(["flexible", "consistent", "performance"]);
const VALID_CUT_INTENSITY = new Set(["hard", "moderate", "none"]);
const VALID_CUT_STYLE = new Set(["balanced", "lowCarb"]);
const VALID_ACTIVITY = new Set(["sedentary", "light", "moderate", "very", "extra"]);
const VALID_OVERLAY = new Set<PerformanceOverlay>(["standard", "performance", "competition_prep", "recovery", "recomp"]);

router.post("/macro-calculator/compute", requireAuth, async (req, res) => {
  try {
    const body = req.body as Partial<MacroComputeInput> & { performanceOverlay?: string };

    // ── Optional performance overlay ──────────────────────────────────────────
    // When provided, overlay defaults fill in any unset macro strategy fields.
    // Explicit values from the caller always win over overlay defaults.
    const rawOverlay = body.performanceOverlay ?? "standard";
    const overlay: PerformanceOverlay = VALID_OVERLAY.has(rawOverlay as PerformanceOverlay)
      ? (rawOverlay as PerformanceOverlay)
      : "standard";

    // Apply resolver: merges overlay defaults with explicit body values
    const b = resolvePerformanceMacroStrategy(body as Partial<MacroComputeInput>, overlay) as Partial<MacroComputeInput>;

    if (!VALID_SEX.has(b.sex as string)) {
      return res.status(400).json({ ok: false, error: "Invalid sex" });
    }
    if (!VALID_GOALS.has(b.goal as string)) {
      return res.status(400).json({ ok: false, error: "Invalid goal" });
    }
    if (!VALID_BODY_TYPE.has(b.bodyType as string)) {
      return res.status(400).json({ ok: false, error: "Invalid bodyType" });
    }
    if (!VALID_USER_TYPE.has(b.userType as string)) {
      return res.status(400).json({ ok: false, error: "Invalid userType" });
    }
    // "standard" is a legacy client alias for "none" — map it gracefully
    if ((b.cutIntensity as string) === "standard") {
      (b as any).cutIntensity = "none";
    }
    if (!VALID_CUT_INTENSITY.has(b.cutIntensity as string)) {
      (b as any).cutIntensity = "moderate";
    }
    if (!VALID_CUT_STYLE.has(b.cutStyle as string)) {
      (b as any).cutStyle = "balanced";
    }

    const kg = Number(b.kg);
    const cm = Number(b.cm);
    const age = Number(b.age);
    const mealsPerDay = Number(b.mealsPerDay) || 3;
    const fibrousCarbSafetyCap_g = Number(b.fibrousCarbSafetyCap_g) || 120;

    if (!Number.isFinite(kg) || kg <= 0 || kg > 450) {
      return res.status(400).json({ ok: false, error: "Invalid kg" });
    }
    if (!Number.isFinite(cm) || cm <= 0 || cm > 280) {
      return res.status(400).json({ ok: false, error: "Invalid cm" });
    }
    if (!Number.isFinite(age) || age < 10 || age > 120) {
      return res.status(400).json({ ok: false, error: "Invalid age" });
    }

    const activity = VALID_ACTIVITY.has(b.activity as string) ? (b.activity as string) : "moderate";

    const input: MacroComputeInput = {
      sex: b.sex!,
      kg,
      cm,
      age,
      activity,
      goal: b.goal!,
      userType: b.userType!,
      bodyType: b.bodyType!,
      highWaistRisk: !!b.highWaistRisk,
      menopause: !!b.menopause,
      insulinResistance: !!b.insulinResistance,
      highStress: !!b.highStress,
      mealsPerDay,
      fibrousCarbSafetyCap_g,
      cutIntensity: b.cutIntensity!,
      cutStyle: b.cutStyle!,
      starchyCarbCap_g: b.starchyCarbCap_g !== undefined ? Number(b.starchyCarbCap_g) || null : null,
      allowZeroStarchyOnLowDay: !!b.allowZeroStarchyOnLowDay,
      strictMode: !!b.strictMode,
    };

    const result = computeMacros(input);

    // Phase 3B: persist today's prescription so Coach's Corner can compute adherence.
    // Fire-and-forget — never block the calculator response.
    const userId = (req as any).authUser?.id;
    if (userId) {
      const prescDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const prescSource =
        overlay === "standard" || overlay === "recovery"
          ? "macro_calculator"
          : "performance_overlay";
      const prescDayType =
        overlay !== "standard" && overlay !== "recovery" ? overlay : null;
      db.execute(sql`
        INSERT INTO daily_nutrition_prescriptions (
          user_id, date,
          target_calories, target_protein, target_total_carbs,
          target_starchy_carbs, target_fibrous_carbs, target_fat,
          source, performance_day_type, updated_at
        ) VALUES (
          ${userId}, ${prescDate}::date,
          ${result.target}, ${result.macros.protein.g},
          ${result.macros.carbs.g}, ${result.macros.carbs.starchy}, ${result.macros.carbs.fibrous},
          ${result.macros.fat.g},
          ${prescSource}, ${prescDayType ?? null}, NOW()
        )
        ON CONFLICT (user_id, date) DO UPDATE SET
          target_calories      = EXCLUDED.target_calories,
          target_protein       = EXCLUDED.target_protein,
          target_total_carbs   = EXCLUDED.target_total_carbs,
          target_starchy_carbs = EXCLUDED.target_starchy_carbs,
          target_fibrous_carbs = EXCLUDED.target_fibrous_carbs,
          target_fat           = EXCLUDED.target_fat,
          source               = EXCLUDED.source,
          performance_day_type = EXCLUDED.performance_day_type,
          updated_at           = NOW()
      `).catch((err) =>
        console.error("[MacroCalculator] Prescription persist failed:", err.message)
      );
    }

    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[macro-calculator/compute]", err);
    return res.status(500).json({ ok: false, error: "Computation failed" });
  }
});

export default router;
