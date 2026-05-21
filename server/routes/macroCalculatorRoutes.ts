/**
 * POST /api/macro-calculator/compute
 *
 * [P3.2] Server-side macro calculation API.
 * The intelligence layer (Mifflin-St Jeor + adaptive pipeline) lives exclusively
 * in server/services/macroCalculatorEngine.ts — never exposed to the client bundle.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  computeMacros,
  resolvePerformanceMacroStrategy,
  type MacroComputeInput,
  type PerformanceOverlay,
} from "../services/macroCalculatorEngine";

const router = Router();

const VALID_GOALS = new Set(["loss", "maint", "gain"]);
const VALID_SEX = new Set(["male", "female"]);
const VALID_BODY_TYPE = new Set(["ecto", "meso", "endo"]);
const VALID_USER_TYPE = new Set(["general", "committed", "athlete"]);
const VALID_CUT_INTENSITY = new Set(["hard", "moderate", "none"]);
const VALID_CUT_STYLE = new Set(["balanced", "lowCarb"]);
const VALID_ACTIVITY = new Set(["sedentary", "light", "moderate", "very", "extra"]);
const VALID_OVERLAY = new Set<PerformanceOverlay>(["standard", "performance", "competition_prep", "recovery", "recomp"]);

router.post("/macro-calculator/compute", requireAuth, (req, res) => {
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
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[macro-calculator/compute]", err);
    return res.status(500).json({ ok: false, error: "Computation failed" });
  }
});

export default router;
