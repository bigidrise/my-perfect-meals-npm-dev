/**
 * POST /api/macro-calculator/compute
 *
 * [P3.2] Server-side macro calculation API.
 * The intelligence layer (Mifflin-St Jeor + adaptive pipeline) lives exclusively
 * in server/services/macroCalculatorEngine.ts — never exposed to the client bundle.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { computeMacros, type MacroComputeInput } from "../services/macroCalculatorEngine";

const router = Router();

const VALID_GOALS = new Set(["loss", "maint", "gain"]);
const VALID_SEX = new Set(["male", "female"]);
const VALID_BODY_TYPE = new Set(["ecto", "meso", "endo"]);
const VALID_USER_TYPE = new Set(["general", "committed", "athlete"]);
const VALID_CUT_INTENSITY = new Set(["hard", "moderate", "none"]);
const VALID_CUT_STYLE = new Set(["balanced", "lowCarb"]);
const VALID_ACTIVITY = new Set(["sedentary", "light", "moderate", "very", "extra"]);

router.post("/macro-calculator/compute", requireAuth, (req, res) => {
  try {
    const b = req.body as Partial<MacroComputeInput>;

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
    if (!VALID_CUT_INTENSITY.has(b.cutIntensity as string)) {
      return res.status(400).json({ ok: false, error: "Invalid cutIntensity" });
    }
    if (!VALID_CUT_STYLE.has(b.cutStyle as string)) {
      return res.status(400).json({ ok: false, error: "Invalid cutStyle" });
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
