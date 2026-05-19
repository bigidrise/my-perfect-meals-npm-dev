/**
 * resolveProtocolFromLabs — Phase 4
 *
 * Evaluates a set of clinical lab values against the locked LAB_THRESHOLDS,
 * applies the canonical precedence order, and returns the highest-priority
 * LabProtocolSignal, or null when no threshold is crossed (patient stays on
 * the base anti-inflammatory protocol).
 *
 * Precedence (must match clinicalModeResolver.ts exactly):
 *   liver-disease > kidney-disease > heart-failure > liver-support >
 *   metabolic-support > inflammation-support > metabolic-stress > null
 *
 * Rules:
 *   - Every value passes through safeNum() before any comparison.
 *     NaN / null / blank NEVER trigger a protocol.
 *   - Reason strings are advisory only ("may benefit from", "suggests").
 *     They never make diagnostic claims ("you have", "you need").
 *   - Citations are embedded in the reason for modal display.
 *   - All thresholds come exclusively from LAB_THRESHOLDS. No magic numbers here.
 */

import {
  safeNum,
  LAB_THRESHOLDS,
  type LabProtocolSignal,
  type ThyroidLabSignal,
  type LabDowngradeSignal,
} from '../../shared/clinical/protocolDecision';

/**
 * Lab input shape accepted by the resolver.
 * Uses camelCase (Drizzle convention) for multi-word fields;
 * single-word fields are identical in all layers.
 * All fields are optional — missing fields simply don't trigger.
 */
export interface LabInputForProtocol {
  // Liver panel
  alt?: string | number | null;
  ast?: string | number | null;
  bilirubin?: string | number | null;
  albumin?: string | number | null;
  // Kidney
  creatinine?: string | number | null;
  bun?: string | number | null;
  // Cardiac
  ldl?: string | number | null;
  hdl?: string | number | null;
  bloodPressureSystolic?: string | number | null;
  ejectionFraction?: string | number | null;
  // Thyroid panel — Phase 1
  tsh?: string | number | null;
  freeT4?: string | number | null;
  freeT3?: string | number | null;
  tpoAntibodies?: string | number | null;
  thyroglobulinAntibodies?: string | number | null;
  // Metabolic / Insulin Resistance — Phase 4
  a1c?: string | number | null;
  glucose?: string | number | null;         // fasting glucose, mg/dL
  fastingInsulin?: string | number | null;  // µIU/mL
  triglycerides?: string | number | null;   // mg/dL
  // Inflammation — Phase 4
  crp?: string | number | null;             // mg/L
  // Hormonal / Stress — Phase 4
  cortisol?: string | number | null;        // µg/dL
}

export function resolveProtocolFromLabs(
  labs: LabInputForProtocol,
): LabProtocolSignal | null {
  const t = LAB_THRESHOLDS;

  // ── Normalize every field through safeNum ──────────────────────────────────
  const alt        = safeNum(labs.alt);
  const ast        = safeNum(labs.ast);
  const bilirubin  = safeNum(labs.bilirubin);
  const albumin    = safeNum(labs.albumin);
  const creatinine = safeNum(labs.creatinine);
  const bun        = safeNum(labs.bun);
  const ldl        = safeNum(labs.ldl);
  const hdl        = safeNum(labs.hdl);
  const bpSys      = safeNum(labs.bloodPressureSystolic);
  const ef         = safeNum(labs.ejectionFraction);
  const a1c        = safeNum(labs.a1c);
  const glucose    = safeNum(labs.glucose);
  const fastingInsulin = safeNum(labs.fastingInsulin);
  const triglycerides  = safeNum(labs.triglycerides);
  const crp        = safeNum(labs.crp);
  const cortisol   = safeNum(labs.cortisol);

  // TG/HDL ratio — insulin resistance marker (requires both values present)
  const tgHdlRatio = (triglycerides !== null && hdl !== null && hdl > 0)
    ? triglycerides / hdl
    : null;

  // ── 1. Liver Disease (highest precedence) ─────────────────────────────────
  {
    const triggers: string[] = [];
    if (alt       !== null && alt       > t.liverDisease.altHigh)       triggers.push('alt');
    if (ast       !== null && ast       > t.liverDisease.astHigh)       triggers.push('ast');
    if (bilirubin !== null && bilirubin > t.liverDisease.bilirubinHigh) triggers.push('bilirubin');
    if (albumin   !== null && albumin   < t.liverDisease.albuminLow)    triggers.push('albumin');

    if (triggers.length > 0) {
      return {
        protocol: 'liver-disease',
        reason:
          'One or more of your liver markers — ALT, AST, bilirubin, or albumin — suggests ' +
          'significant hepatic stress. A Liver Disease protocol may benefit you by emphasizing ' +
          'liver-protective foods (cruciferous vegetables, omega-3 sources, antioxidants) and ' +
          'strictly avoiding hepatotoxic ingredients such as alcohol and ultra-processed foods. ' +
          '(AASLD / EASL)',
        confidence: triggers.length >= 2 ? 'high' : 'moderate',
        triggerFields: triggers,
      };
    }
  }

  // ── 2. Kidney Disease ─────────────────────────────────────────────────────
  {
    const triggers: string[] = [];
    if (creatinine !== null && creatinine > t.kidney.creatinineHigh) triggers.push('creatinine');
    if (bun        !== null && bun        > t.kidney.bunHigh)        triggers.push('bun');

    if (triggers.length > 0) {
      return {
        protocol: 'kidney-disease',
        reason:
          'Your creatinine or BUN levels suggest your kidneys may be under increased load. ' +
          'A Kidney Disease protocol may benefit you by prioritizing low-potassium, ' +
          'low-phosphorus foods that reduce filtration demand and support renal function. ' +
          '(KDIGO / NKF)',
        confidence: triggers.length >= 2 ? 'high' : 'moderate',
        triggerFields: triggers,
      };
    }
  }

  // ── 3. Heart Failure / Cardiac Health ────────────────────────────────────
  {
    const triggers: string[] = [];
    if (ldl   !== null && ldl   >= t.cardiac.ldlHigh)             triggers.push('ldl');
    if (bpSys !== null && bpSys >  t.cardiac.bpSystolicHigh)      triggers.push('blood_pressure_systolic');
    if (ef    !== null && ef    <  t.cardiac.ejectionFractionLow)  triggers.push('ejection_fraction');

    if (triggers.length > 0) {
      return {
        protocol: 'heart-failure',
        reason:
          'One or more of your cardiac markers — LDL, systolic blood pressure, or ejection ' +
          'fraction — suggests your cardiovascular system may benefit from a heart-focused ' +
          'protocol. A Cardiac Health plan emphasizes sodium reduction, omega-3-rich foods, ' +
          'and whole-grain fiber to support healthy lipid levels and blood pressure. (ACC / AHA)',
        confidence: triggers.length >= 2 ? 'high' : 'moderate',
        triggerFields: triggers,
      };
    }
  }

  // ── 4. Liver Support ─────────────────────────────────────────────────────
  {
    const triggers: string[] = [];
    if (alt !== null && alt > t.liverSupport.altHigh) triggers.push('alt');
    if (ast !== null && ast > t.liverSupport.astHigh) triggers.push('ast');

    if (triggers.length > 0) {
      return {
        protocol: 'liver-support',
        reason:
          'Your ALT or AST values are mildly above the normal reference range, which may ' +
          'suggest low-level hepatic inflammation. A Liver Support protocol may benefit you ' +
          'by emphasizing anti-inflammatory, liver-supportive foods such as cruciferous ' +
          'vegetables, omega-3 sources, green tea, and coffee — without the stricter ' +
          'restrictions of a full Liver Disease protocol. (AASLD / NIH)',
        confidence: triggers.length >= 2 ? 'moderate' : 'low',
        triggerFields: triggers,
      };
    }
  }

  // ── 5. Metabolic Support — insulin resistance / diabetic-aware ───────────
  // Triggered by: A1C > 5.7%  OR  fasting glucose > 100  OR  fasting insulin > 15
  //               OR  TG/HDL ratio > 3.5  OR  triglycerides > 150
  // Sources: ADA Standards of Medical Care in Diabetes; AHA metabolic risk classification
  {
    const triggers: string[] = [];
    if (a1c            !== null && a1c            > t.metabolic.a1cHigh)             triggers.push('a1c');
    if (glucose        !== null && glucose        > t.metabolic.glucoseHigh)         triggers.push('glucose');
    if (fastingInsulin !== null && fastingInsulin > t.metabolic.fastingInsulinHigh)  triggers.push('fasting_insulin');
    if (triglycerides  !== null && triglycerides  > t.metabolic.triglyceridesHigh)   triggers.push('triglycerides');
    if (tgHdlRatio     !== null && tgHdlRatio     > t.metabolic.tgHdlRatioHigh)      triggers.push('tg_hdl_ratio');

    if (triggers.length > 0) {
      const hasRatioTrigger = triggers.includes('tg_hdl_ratio');
      return {
        protocol: 'metabolic-support',
        reason:
          'One or more of your metabolic markers — A1C, fasting glucose, fasting insulin, ' +
          'triglycerides' + (hasRatioTrigger ? ', or TG/HDL ratio' : '') + ' — ' +
          'suggests your body may benefit from metabolic-aware nutritional support. ' +
          'A Metabolic Support approach emphasizes fiber-rich complex carbohydrates, ' +
          'blood-sugar-stabilizing meal patterns, reduced refined carbohydrates, and ' +
          'protein-forward meals to support insulin sensitivity. (ADA / AHA)',
        confidence: triggers.length >= 2 ? 'high' : 'moderate',
        triggerFields: triggers,
      };
    }
  }

  // ── 6. Inflammation Support — CRP-driven ─────────────────────────────────
  // Triggered by: CRP > 3.0 mg/L (high cardiovascular inflammation risk)
  // Source: AHA / CDC Joint Scientific Statement on hsCRP (2003)
  {
    if (crp !== null && crp > t.inflammation.crpHigh) {
      return {
        protocol: 'inflammation-support',
        reason:
          'Your C-Reactive Protein (CRP) level suggests elevated systemic inflammation. ' +
          'An Inflammation Support approach may benefit you by emphasizing omega-3-rich ' +
          'foods, colorful vegetables, olive oil, and other anti-inflammatory patterns ' +
          'while reducing processed foods, refined sugars, and inflammatory oils. ' +
          '(AHA / CDC)',
        confidence: crp > 10 ? 'high' : 'moderate',
        triggerFields: ['crp'],
      };
    }
  }

  // ── 7. Metabolic Stress Support — cortisol-driven ─────────────────────────
  // Triggered by: cortisol > 20 µg/dL (above optimal AM range)
  // Source: Endocrine Society clinical practice guidelines; standard lab reference ranges
  {
    if (cortisol !== null && cortisol > t.metabolicStress.cortisolHigh) {
      return {
        protocol: 'metabolic-stress',
        reason:
          'Your cortisol level is above the optimal reference range, which may suggest ' +
          'elevated physiological or metabolic stress. A Metabolic Stress Support approach ' +
          'may benefit you by emphasizing balanced meal timing, blood-sugar-stabilizing ' +
          'foods, adequate protein, and nutrients that support adrenal and stress recovery ' +
          'such as magnesium, B vitamins, and omega-3 sources. (Endocrine Society)',
        confidence: cortisol > 30 ? 'high' : 'moderate',
        triggerFields: ['cortisol'],
      };
    }
  }

  // ── No thresholds crossed ─────────────────────────────────────────────────
  return null;
}

/**
 * Resolve downgrade signals — called when new labs are saved for a user
 * who is already on one or more clinical protocols.
 *
 * A downgrade signal fires when ALL of these are true:
 *   1. The user is currently on protocol X
 *   2. The new labs include at least one marker relevant to protocol X
 *   3. None of those entered markers exceed the activation thresholds for X
 *
 * Oncology is NEVER included here — it is physician-assigned.
 * Returns an array (may be empty) — one signal per protocol qualifying for step-down.
 * Never auto-removes anything; user must confirm via ProtocolDowngradeModal.
 */
export function resolveDowngradeSignals(
  labs: LabInputForProtocol,
  opts: {
    currentSpecialtyConditions: string[];
    /**
     * The primary clinical protocol the user was on BEFORE this lab save,
     * derived by running resolveProtocolFromLabs() on their previous lab record.
     */
    previousProtocol: string | null;
  },
): LabDowngradeSignal[] {
  const t = LAB_THRESHOLDS;
  const signals: LabDowngradeSignal[] = [];

  // ── Thyroid downgrade ────────────────────────────────────────────────────
  if (opts.currentSpecialtyConditions.includes('thyroid-support')) {
    const tsh    = safeNum(labs.tsh);
    const freeT4 = safeNum(labs.freeT4);
    const freeT3 = safeNum(labs.freeT3);
    const tpo    = safeNum(labs.tpoAntibodies);
    const tgab   = safeNum(labs.thyroglobulinAntibodies);

    const anyThyroidEntered = [tsh, freeT4, freeT3, tpo, tgab].some(v => v !== null);

    if (anyThyroidEntered) {
      const hasAbnormal =
        (tsh  !== null && (tsh > t.thyroid.tshHigh || tsh < t.thyroid.tshLow)) ||
        (freeT4 !== null && freeT4 < t.thyroid.freeT4Low)                      ||
        (freeT3 !== null && freeT3 < t.thyroid.freeT3Low)                      ||
        (tpo    !== null && tpo    > t.thyroid.tpoAntibodiesHigh)               ||
        (tgab   !== null && tgab   > t.thyroid.thyroglobulinAntibodiesHigh);

      if (!hasAbnormal) {
        const normalFields: string[] = [];
        if (tsh    !== null) normalFields.push('tsh');
        if (freeT4 !== null) normalFields.push('free_t4');
        if (freeT3 !== null) normalFields.push('free_t3');
        if (tpo    !== null) normalFields.push('tpo_antibodies');
        if (tgab   !== null) normalFields.push('thyroglobulin_antibodies');

        signals.push({
          protocol:      'thyroid-support',
          protocolLabel: 'Thyroid Support',
          normalFields,
          reason:
            'Your recent thyroid lab values now fall within the normal reference range. ' +
            'Based on your updated markers, your nutrition plan may no longer require ' +
            'active Thyroid Support modifications. A physician would typically reassess ' +
            'at this point and may recommend transitioning back to the Anti-Inflammatory ' +
            'foundation while continuing to monitor. (ATA / AACE / Endocrine Society)',
        });
      }
    }
  }

  // ── Cardiac (heart-failure) downgrade ────────────────────────────────────
  if (opts.previousProtocol === 'heart-failure' || opts.currentSpecialtyConditions.includes('heart-failure')) {
    const ldl   = safeNum(labs.ldl);
    const bpSys = safeNum(labs.bloodPressureSystolic);
    const ef    = safeNum(labs.ejectionFraction);

    const anyCardiacEntered = [ldl, bpSys, ef].some(v => v !== null);

    if (anyCardiacEntered) {
      const hasAbnormal =
        (ldl   !== null && ldl   >= t.cardiac.ldlHigh)            ||
        (bpSys !== null && bpSys >  t.cardiac.bpSystolicHigh)     ||
        (ef    !== null && ef    <  t.cardiac.ejectionFractionLow);

      if (!hasAbnormal) {
        const normalFields: string[] = [];
        if (ldl   !== null) normalFields.push('ldl');
        if (bpSys !== null) normalFields.push('blood_pressure_systolic');
        if (ef    !== null) normalFields.push('ejection_fraction');

        signals.push({
          protocol:      'heart-failure',
          protocolLabel: 'Cardiac Health',
          normalFields,
          reason:
            'Your recent cardiac markers — LDL, blood pressure, and/or ejection fraction — ' +
            'are now within the normal reference range. Based on your updated values, you may ' +
            'be ready to transition back to the Anti-Inflammatory foundation. A physician ' +
            'would typically reassess lipid and cardiovascular risk at this point before ' +
            'stepping down from a cardiac nutrition protocol. (ACC / AHA)',
        });
      }
    }
  }

  // ── Kidney Disease downgrade ──────────────────────────────────────────────
  if (opts.previousProtocol === 'kidney-disease' || opts.currentSpecialtyConditions.includes('kidney-disease')) {
    const creatinine = safeNum(labs.creatinine);
    const bun        = safeNum(labs.bun);

    const anyKidneyEntered = [creatinine, bun].some(v => v !== null);

    if (anyKidneyEntered) {
      const hasAbnormal =
        (creatinine !== null && creatinine > t.kidney.creatinineHigh) ||
        (bun        !== null && bun        > t.kidney.bunHigh);

      if (!hasAbnormal) {
        const normalFields: string[] = [];
        if (creatinine !== null) normalFields.push('creatinine');
        if (bun        !== null) normalFields.push('bun');

        signals.push({
          protocol:      'kidney-disease',
          protocolLabel: 'Kidney Support',
          normalFields,
          reason:
            'Your creatinine and/or BUN values are now within the normal reference range. ' +
            'Based on your updated kidney markers, you may be ready to transition back to ' +
            'the Anti-Inflammatory foundation. A physician would typically reassess renal ' +
            'function trends before stepping down from a kidney nutrition protocol. ' +
            '(KDIGO / NKF)',
        });
      }
    }
  }

  // ── Liver Disease downgrade ───────────────────────────────────────────────
  if (opts.previousProtocol === 'liver-disease' || opts.currentSpecialtyConditions.includes('liver-disease')) {
    const alt       = safeNum(labs.alt);
    const ast       = safeNum(labs.ast);
    const bilirubin = safeNum(labs.bilirubin);
    const albumin   = safeNum(labs.albumin);

    const anyLiverDxEntered = [alt, ast, bilirubin, albumin].some(v => v !== null);

    if (anyLiverDxEntered) {
      const hasAbnormal =
        (alt       !== null && alt       > t.liverDisease.altHigh)       ||
        (ast       !== null && ast       > t.liverDisease.astHigh)       ||
        (bilirubin !== null && bilirubin > t.liverDisease.bilirubinHigh) ||
        (albumin   !== null && albumin   < t.liverDisease.albuminLow);

      if (!hasAbnormal) {
        const normalFields: string[] = [];
        if (alt       !== null) normalFields.push('alt');
        if (ast       !== null) normalFields.push('ast');
        if (bilirubin !== null) normalFields.push('bilirubin');
        if (albumin   !== null) normalFields.push('albumin');

        signals.push({
          protocol:      'liver-disease',
          protocolLabel: 'Liver Disease',
          normalFields,
          reason:
            'Your liver markers — ALT, AST, bilirubin, and/or albumin — are now within the ' +
            'normal reference range. Based on your updated values, a step down to the ' +
            'Anti-Inflammatory foundation or Liver Support protocol may be appropriate. ' +
            'A physician would typically confirm hepatic stability before reducing protocol ' +
            'intensity. (AASLD / EASL)',
        });
      }
    }
  }

  // ── Liver Support downgrade ───────────────────────────────────────────────
  if (opts.previousProtocol === 'liver-support' || opts.currentSpecialtyConditions.includes('liver-support')) {
    const alt = safeNum(labs.alt);
    const ast = safeNum(labs.ast);

    const anyLiverSupportEntered = [alt, ast].some(v => v !== null);

    if (anyLiverSupportEntered) {
      const hasAbnormal =
        (alt !== null && alt > t.liverSupport.altHigh) ||
        (ast !== null && ast > t.liverSupport.astHigh);

      if (!hasAbnormal) {
        const normalFields: string[] = [];
        if (alt !== null) normalFields.push('alt');
        if (ast !== null) normalFields.push('ast');

        signals.push({
          protocol:      'liver-support',
          protocolLabel: 'Liver Support',
          normalFields,
          reason:
            'Your ALT and/or AST values are now within the normal reference range, which ' +
            'suggests the mild hepatic inflammation previously detected may have resolved. ' +
            'Based on your updated markers, you may be ready to return to the ' +
            'Anti-Inflammatory foundation. (AASLD / NIH)',
        });
      }
    }
  }

  // ── Metabolic Support downgrade ───────────────────────────────────────────
  if (opts.previousProtocol === 'metabolic-support' || opts.currentSpecialtyConditions.includes('metabolic-support')) {
    const a1c            = safeNum(labs.a1c);
    const glucose        = safeNum(labs.glucose);
    const fastingInsulin = safeNum(labs.fastingInsulin);
    const triglycerides  = safeNum(labs.triglycerides);
    const hdl            = safeNum(labs.hdl);
    const tgHdlRatio     = (triglycerides !== null && hdl !== null && hdl > 0) ? triglycerides / hdl : null;

    const anyMetabolicEntered = [a1c, glucose, fastingInsulin, triglycerides].some(v => v !== null);

    if (anyMetabolicEntered) {
      const hasAbnormal =
        (a1c            !== null && a1c            > t.metabolic.a1cHigh)            ||
        (glucose        !== null && glucose        > t.metabolic.glucoseHigh)        ||
        (fastingInsulin !== null && fastingInsulin > t.metabolic.fastingInsulinHigh) ||
        (triglycerides  !== null && triglycerides  > t.metabolic.triglyceridesHigh)  ||
        (tgHdlRatio     !== null && tgHdlRatio     > t.metabolic.tgHdlRatioHigh);

      if (!hasAbnormal) {
        const normalFields: string[] = [];
        if (a1c            !== null) normalFields.push('a1c');
        if (glucose        !== null) normalFields.push('glucose');
        if (fastingInsulin !== null) normalFields.push('fasting_insulin');
        if (triglycerides  !== null) normalFields.push('triglycerides');

        signals.push({
          protocol:      'metabolic-support',
          protocolLabel: 'Metabolic Support',
          normalFields,
          reason:
            'Your metabolic markers — A1C, fasting glucose, insulin, and/or triglycerides — ' +
            'are now within the normal reference range. Based on your updated values, you may ' +
            'be ready to transition back to the Anti-Inflammatory foundation. A physician ' +
            'would typically confirm metabolic stability before stepping down from a metabolic ' +
            'nutrition protocol. (ADA / AHA)',
        });
      }
    }
  }

  // ── Inflammation Support downgrade ────────────────────────────────────────
  if (opts.previousProtocol === 'inflammation-support' || opts.currentSpecialtyConditions.includes('inflammation-support')) {
    const crp = safeNum(labs.crp);

    if (crp !== null) {
      const hasAbnormal = crp > t.inflammation.crpHigh;

      if (!hasAbnormal) {
        signals.push({
          protocol:      'inflammation-support',
          protocolLabel: 'Inflammation Support',
          normalFields:  ['crp'],
          reason:
            'Your CRP level has returned to the normal reference range, suggesting ' +
            'reduced systemic inflammation. Based on your updated markers, you may ' +
            'be ready to transition back to the Anti-Inflammatory foundation. ' +
            '(AHA / CDC)',
        });
      }
    }
  }

  // ── Metabolic Stress downgrade ────────────────────────────────────────────
  if (opts.previousProtocol === 'metabolic-stress' || opts.currentSpecialtyConditions.includes('metabolic-stress')) {
    const cortisol = safeNum(labs.cortisol);

    if (cortisol !== null) {
      const hasAbnormal = cortisol > t.metabolicStress.cortisolHigh;

      if (!hasAbnormal) {
        signals.push({
          protocol:      'metabolic-stress',
          protocolLabel: 'Metabolic Stress Support',
          normalFields:  ['cortisol'],
          reason:
            'Your cortisol level is now within the normal reference range. Based on your ' +
            'updated values, you may be ready to transition back to the Anti-Inflammatory ' +
            'foundation. A physician would typically reassess adrenal and stress markers ' +
            'before stepping down from a metabolic stress protocol. (Endocrine Society)',
        });
      }
    }
  }

  return signals;
}

/**
 * Maps a LabProtocolSignal's protocol (or null) to the human-readable
 * subtitle shown in builder headers and dashboards.
 */
export function labSignalToSubtitle(signal: LabProtocolSignal | null): string {
  if (!signal) return 'Anti-Inflammatory';
  const labels: Record<string, string> = {
    'liver-disease':       'Liver Disease',
    'kidney-disease':      'Kidney Disease',
    'heart-failure':       'Cardiac Health',
    'liver-support':       'Liver Support',
    'metabolic-support':   'Metabolic Support',
    'inflammation-support':'Inflammation Support',
    'metabolic-stress':    'Metabolic Stress Support',
    'anti-inflammatory':   'Anti-Inflammatory',
  };
  return labels[signal.protocol] ?? 'Anti-Inflammatory';
}

/**
 * Resolve thyroid indicators from lab values.
 * Thyroid is an ADDITIVE MODIFIER — not a primary protocol override.
 * It can co-exist with any primary protocol.
 */
export function resolveThyroidFromLabs(
  labs: Pick<LabInputForProtocol, 'tsh' | 'freeT4' | 'freeT3' | 'tpoAntibodies' | 'thyroglobulinAntibodies'>,
): ThyroidLabSignal {
  const t = LAB_THRESHOLDS.thyroid;

  const tsh    = safeNum(labs.tsh);
  const freeT4 = safeNum(labs.freeT4);
  const freeT3 = safeNum(labs.freeT3);
  const tpo    = safeNum(labs.tpoAntibodies);
  const tgab   = safeNum(labs.thyroglobulinAntibodies);

  const triggers: string[] = [];
  let isAutoimmune = false;

  if (tsh !== null && tsh > t.tshHigh) triggers.push('tsh_high');
  if (tsh !== null && tsh < t.tshLow)  triggers.push('tsh_low');
  if (freeT4 !== null && freeT4 < t.freeT4Low) triggers.push('free_t4_low');
  if (freeT3 !== null && freeT3 < t.freeT3Low) triggers.push('free_t3_low');
  if (tpo  !== null && tpo  > t.tpoAntibodiesHigh)          { triggers.push('tpo_antibodies'); isAutoimmune = true; }
  if (tgab !== null && tgab > t.thyroglobulinAntibodiesHigh) { triggers.push('thyroglobulin_antibodies'); isAutoimmune = true; }

  if (triggers.length === 0) {
    return { hasThyroidIndicators: false, reason: '', triggerFields: [], confidence: 'low', isAutoimmune: false };
  }

  const hasHormoneSignal  = triggers.some(f => ['tsh_high', 'tsh_low', 'free_t4_low', 'free_t3_low'].includes(f));
  const hasAntibodySignal = isAutoimmune;

  let reason = '';
  if (hasAntibodySignal && hasHormoneSignal) {
    reason =
      'Your lab values suggest both thyroid hormone markers and thyroid antibodies that may ' +
      'benefit from a Thyroid Support nutritional approach. This includes anti-inflammatory eating, ' +
      'selenium-rich proteins, and meal timing awareness. (ATA / AACE / Endocrine Society)';
  } else if (hasAntibodySignal) {
    reason =
      'Your thyroid antibody markers — TPO antibodies and/or thyroglobulin antibodies — are ' +
      'above the normal reference range. This pattern is associated with autoimmune thyroid ' +
      'activity. A Thyroid Support approach emphasizing anti-inflammatory nutrition may be ' +
      'beneficial. (ATA / AACE)';
  } else {
    reason =
      'One or more of your thyroid markers — TSH, Free T4, or Free T3 — suggests your thyroid ' +
      'function may benefit from adaptive nutritional support. A Thyroid Support approach ' +
      'emphasizes selenium-rich foods, anti-inflammatory eating, and medication timing awareness. ' +
      '(ATA / AACE / Endocrine Society)';
  }

  const confidence: 'high' | 'moderate' | 'low' =
    triggers.length >= 3 ? 'high' :
    triggers.length >= 2 ? 'moderate' :
    'low';

  return { hasThyroidIndicators: true, reason, triggerFields: triggers, confidence, isAutoimmune };
}
