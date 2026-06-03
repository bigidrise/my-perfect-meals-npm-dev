/**
 * resolveProtocolFromLabs — Phase 5
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
 * Additive modifier resolvers (run independently, always return a signal struct):
 *   resolveThyroidFromLabs()  → thyroid-support + subtypes (hypothyroid/hyperthyroid/hashimotos)
 *   resolveHormoneFromLabs()  → hormone-optimization / menopause / perimenopause
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
  type HormoneLabSignal,
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
  // Thyroid panel — Phase 1 + Phase 5 (rT3)
  tsh?: string | number | null;
  freeT4?: string | number | null;
  freeT3?: string | number | null;
  tpoAntibodies?: string | number | null;
  thyroglobulinAntibodies?: string | number | null;
  reverseT3?: string | number | null;       // Phase 5 — T4→T3 conversion marker
  // Metabolic / Insulin Resistance — Phase 4
  a1c?: string | number | null;
  glucose?: string | number | null;         // fasting glucose, mg/dL
  fastingInsulin?: string | number | null;  // µIU/mL
  triglycerides?: string | number | null;   // mg/dL
  // Inflammation — Phase 4
  crp?: string | number | null;             // mg/L
  // Hormonal / Stress — Phase 4
  cortisol?: string | number | null;        // µg/dL
  // Sex hormones — Phase 5 (drive hormone-optimization / menopause / perimenopause)
  totalTestosterone?: string | number | null;  // ng/dL
  freeTestosterone?: string | number | null;   // pg/mL
  estradiol?: string | number | null;          // pg/mL
  progesterone?: string | number | null;       // ng/mL
  shbg?: string | number | null;              // nmol/L (informational; no threshold trigger yet)
  lh?: string | number | null;               // mIU/mL
  fsh?: string | number | null;              // mIU/mL
  dheaS?: string | number | null;            // µg/dL
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
    const rT3    = safeNum(labs.reverseT3);

    const anyThyroidEntered = [tsh, freeT4, freeT3, tpo, tgab, rT3].some(v => v !== null);

    if (anyThyroidEntered) {
      const hasAbnormal =
        (tsh  !== null && (tsh > t.thyroid.tshHigh || tsh < t.thyroid.tshLow)) ||
        (freeT4 !== null && freeT4 < t.thyroid.freeT4Low)                      ||
        (freeT3 !== null && freeT3 < t.thyroid.freeT3Low)                      ||
        (tpo    !== null && tpo    > t.thyroid.tpoAntibodiesHigh)               ||
        (tgab   !== null && tgab   > t.thyroid.thyroglobulinAntibodiesHigh)     ||
        (rT3    !== null && rT3    > t.thyroidSubtype.reverseT3High);

      if (!hasAbnormal) {
        const normalFields: string[] = [];
        if (tsh    !== null) normalFields.push('tsh');
        if (freeT4 !== null) normalFields.push('free_t4');
        if (freeT3 !== null) normalFields.push('free_t3');
        if (tpo    !== null) normalFields.push('tpo_antibodies');
        if (tgab   !== null) normalFields.push('thyroglobulin_antibodies');
        if (rT3    !== null) normalFields.push('reverse_t3');

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
            'Your C-Reactive Protein (CRP) is now within the normal reference range, suggesting ' +
            'systemic inflammation has reduced. Based on your updated values, you may be ready ' +
            'to transition back to the Anti-Inflammatory foundation. A physician would typically ' +
            'confirm sustained CRP normalization before stepping down. (AHA / CDC)',
        });
      }
    }
  }

  // ── Metabolic Stress downgrade ─────────────────────────────────────────────
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
            'updated markers, your nutrition plan may no longer require active Metabolic ' +
            'Stress Support modifications. A physician would typically reassess HPA axis ' +
            'function before stepping down from a cortisol-driven nutrition protocol. ' +
            '(Endocrine Society)',
        });
      }
    }
  }

  return signals;
}

/**
 * labSignalToSubtitle — returns a concise subtitle for the recommendation modal
 * based on the triggering fields of a LabProtocolSignal.
 */
export function labSignalToSubtitle(signal: LabProtocolSignal | null): string {
  if (!signal) return '';
  const fieldMap: Record<string, string> = {
    alt: 'ALT', ast: 'AST', bilirubin: 'Bilirubin', albumin: 'Albumin',
    creatinine: 'Creatinine', bun: 'BUN',
    ldl: 'LDL', blood_pressure_systolic: 'Systolic BP', ejection_fraction: 'Ejection Fraction',
    a1c: 'A1C', glucose: 'Glucose', fasting_insulin: 'Fasting Insulin',
    triglycerides: 'Triglycerides', tg_hdl_ratio: 'TG/HDL Ratio',
    crp: 'CRP',
    cortisol: 'Cortisol',
  };
  const labels = signal.triggerFields.map(f => fieldMap[f] ?? f).join(', ');
  return labels ? `Triggered by: ${labels}` : '';
}

/**
 * Resolve thyroid indicators from lab values — Phase 5.
 * Thyroid is an ADDITIVE MODIFIER — not a primary protocol override.
 * It can co-exist with any primary protocol.
 *
 * Phase 5 additions:
 *   - Reverse T3 (rT3) included in trigger evaluation
 *   - subtypeConditions returned for hashimotos / hypothyroid / hyperthyroid
 *
 * Subtype logic:
 *   hashimotos:  TPO Ab > 9 IU/mL OR TgAb > 1 IU/mL (autoimmune antibody pattern)
 *   hypothyroid: TSH > 4.5 AND (Free T4 < 0.8 OR Free T3 < 2.3 OR rT3 > 25)
 *   hyperthyroid: TSH < 0.4 AND (Free T4 > 1.8 OR Free T3 > 4.2)
 *
 * Sources: ATA, AACE, Endocrine Society clinical practice guidelines.
 */
export function resolveThyroidFromLabs(
  labs: Pick<LabInputForProtocol,
    'tsh' | 'freeT4' | 'freeT3' | 'tpoAntibodies' | 'thyroglobulinAntibodies' | 'reverseT3'>,
): ThyroidLabSignal {
  const t = LAB_THRESHOLDS.thyroid;
  const ts = LAB_THRESHOLDS.thyroidSubtype;

  const tsh    = safeNum(labs.tsh);
  const freeT4 = safeNum(labs.freeT4);
  const freeT3 = safeNum(labs.freeT3);
  const tpo    = safeNum(labs.tpoAntibodies);
  const tgab   = safeNum(labs.thyroglobulinAntibodies);
  const rT3    = safeNum(labs.reverseT3);

  const triggers: string[] = [];
  let isAutoimmune = false;

  if (tsh !== null && tsh > t.tshHigh)   triggers.push('tsh_high');
  if (tsh !== null && tsh < t.tshLow)    triggers.push('tsh_low');
  if (freeT4 !== null && freeT4 < t.freeT4Low)  triggers.push('free_t4_low');
  if (freeT3 !== null && freeT3 < t.freeT3Low)  triggers.push('free_t3_low');
  if (freeT4 !== null && freeT4 > ts.freeT4High) triggers.push('free_t4_high');
  if (freeT3 !== null && freeT3 > ts.freeT3High) triggers.push('free_t3_high');
  if (rT3    !== null && rT3    > ts.reverseT3High) triggers.push('reverse_t3_high');
  if (tpo    !== null && tpo    > t.tpoAntibodiesHigh)           { triggers.push('tpo_antibodies'); isAutoimmune = true; }
  if (tgab   !== null && tgab   > t.thyroglobulinAntibodiesHigh) { triggers.push('thyroglobulin_antibodies'); isAutoimmune = true; }

  if (triggers.length === 0) {
    return {
      hasThyroidIndicators: false,
      subtypeConditions: [],
      reason: '',
      triggerFields: [],
      confidence: 'low',
      isAutoimmune: false,
    };
  }

  // ── Subtype detection ────────────────────────────────────────────────────
  const subtypeConditions: Array<'hypothyroid' | 'hyperthyroid' | 'hashimotos'> = [];

  // Hashimoto's: antibody-driven autoimmune pattern
  if (isAutoimmune) {
    subtypeConditions.push('hashimotos');
  }

  // Hypothyroid: TSH high + at least one low hormone marker OR rT3 elevated
  const tshHigh = tsh !== null && tsh > t.tshHigh;
  const lowHormoneSignal =
    (freeT4 !== null && freeT4 < t.freeT4Low) ||
    (freeT3 !== null && freeT3 < t.freeT3Low) ||
    (rT3    !== null && rT3    > ts.reverseT3High);
  if (tshHigh && lowHormoneSignal) {
    subtypeConditions.push('hypothyroid');
  } else if (tshHigh && tpo === null && tgab === null) {
    // TSH high alone (no antibodies, no T4/T3) — still suggest hypothyroid pattern
    subtypeConditions.push('hypothyroid');
  }

  // Hyperthyroid: TSH low + at least one elevated hormone marker
  const tshLow = tsh !== null && tsh < t.tshLow;
  const highHormoneSignal =
    (freeT4 !== null && freeT4 > ts.freeT4High) ||
    (freeT3 !== null && freeT3 > ts.freeT3High);
  if (tshLow && highHormoneSignal) {
    subtypeConditions.push('hyperthyroid');
  } else if (tshLow && freeT4 === null && freeT3 === null) {
    // TSH low alone — suggest hyperthyroid pattern
    subtypeConditions.push('hyperthyroid');
  }

  const hasHormoneSignal  = triggers.some(f => ['tsh_high', 'tsh_low', 'free_t4_low', 'free_t3_low', 'free_t4_high', 'free_t3_high', 'reverse_t3_high'].includes(f));
  const hasAntibodySignal = isAutoimmune;

  // ── Reason string ────────────────────────────────────────────────────────
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
  } else if (triggers.includes('reverse_t3_high')) {
    reason =
      'Your Reverse T3 is elevated, which may suggest impaired conversion of T4 to active T3. ' +
      'A Thyroid Support nutritional approach emphasizing selenium-rich foods, anti-inflammatory ' +
      'eating, and stress-reduction meal patterns may be beneficial. (ATA / Endocrine Society)';
  } else {
    reason =
      'One or more of your thyroid markers — TSH, Free T4, Free T3, or Reverse T3 — suggests your ' +
      'thyroid function may benefit from adaptive nutritional support. A Thyroid Support approach ' +
      'emphasizes selenium-rich foods, anti-inflammatory eating, and medication timing awareness. ' +
      '(ATA / AACE / Endocrine Society)';
  }

  const confidence: 'high' | 'moderate' | 'low' =
    triggers.length >= 3 ? 'high' :
    triggers.length >= 2 ? 'moderate' :
    'low';

  return {
    hasThyroidIndicators: true,
    subtypeConditions,
    reason,
    triggerFields: triggers,
    confidence,
    isAutoimmune,
  };
}

/**
 * Resolve hormone indicators from lab values — Phase 5.
 * Hormone is an ADDITIVE MODIFIER — not a primary protocol override.
 *
 * Drives three conditions:
 *   hormone-optimization: low testosterone (total < 300 ng/dL OR free < 5 pg/mL)
 *                         OR low DHEA-S (< 70 µg/dL)
 *   menopause:            FSH > 40 mIU/mL AND Estradiol < 20 pg/mL (postmenopausal range)
 *   perimenopause:        FSH 10–40 mIU/mL OR Estradiol 20–50 pg/mL OR
 *                         Progesterone < 2 ng/mL (anovulatory/peri pattern)
 *
 * SHBG and LH are informational — they increase signal confidence but do not
 * independently trigger a condition without at least one primary marker.
 *
 * Sources: AUA (testosterone), Endocrine Society (DHEA-S, testosterone),
 *          NAMS / ACOG / Endocrine Society (menopause/perimenopause).
 */
export function resolveHormoneFromLabs(
  labs: Pick<LabInputForProtocol,
    'totalTestosterone' | 'freeTestosterone' | 'dheaS' |
    'estradiol' | 'progesterone' | 'lh' | 'fsh' | 'shbg'>,
): HormoneLabSignal {
  const th = LAB_THRESHOLDS.testosterone;
  const tm = LAB_THRESHOLDS.menopause;

  const totalT   = safeNum(labs.totalTestosterone);
  const freeT    = safeNum(labs.freeTestosterone);
  const dheaS    = safeNum(labs.dheaS);
  const estradiol = safeNum(labs.estradiol);
  const progesterone = safeNum(labs.progesterone);
  const lh       = safeNum(labs.lh);
  const fsh      = safeNum(labs.fsh);
  // shbg: informational only — used for context in reason string, no independent trigger

  const conditions: Array<'hormone-optimization' | 'menopause' | 'perimenopause'> = [];
  const triggerFields: string[] = [];

  // ── Hormone Optimization: low testosterone or DHEA-S ─────────────────────
  if (totalT !== null && totalT < th.totalTestosteroneLow) {
    triggerFields.push('total_testosterone');
  }
  if (freeT !== null && freeT < th.freeTestosteroneLow) {
    triggerFields.push('free_testosterone');
  }
  if (dheaS !== null && dheaS < th.dheaSLow) {
    triggerFields.push('dhea_s');
  }
  const hasHormoneOptTrigger = triggerFields.some(f =>
    ['total_testosterone', 'free_testosterone', 'dhea_s'].includes(f)
  );
  if (hasHormoneOptTrigger) {
    conditions.push('hormone-optimization');
  }

  // ── Menopause: FSH > 40 + Estradiol < 20 ─────────────────────────────────
  const fshMenopause   = fsh       !== null && fsh       >  tm.fshMenopauseHigh;
  const e2Menopause    = estradiol  !== null && estradiol <  tm.estradiolMenopauseLow;

  if (fshMenopause && e2Menopause) {
    conditions.push('menopause');
    if (!triggerFields.includes('fsh')) triggerFields.push('fsh');
    triggerFields.push('estradiol');
  } else {
    // ── Perimenopause: FSH 10–40 OR E2 20–50 OR Progesterone < 2 ──────────
    const fshPeri        = fsh        !== null && fsh        >= tm.fshPeriLow && fsh <= tm.fshMenopauseHigh;
    const e2Peri         = estradiol   !== null && estradiol  >= tm.estradiolMenopauseLow && estradiol < tm.estradiolPeriLow;
    const progesteronePeri = progesterone !== null && progesterone < tm.progesteroneLow;
    const lhElevated     = lh          !== null && lh          >  tm.lhElevated;

    const periTriggers: string[] = [];
    if (fshPeri)          periTriggers.push('fsh');
    if (e2Peri)           periTriggers.push('estradiol');
    if (progesteronePeri) periTriggers.push('progesterone');
    if (lhElevated && (fshPeri || e2Peri)) periTriggers.push('lh'); // LH only additive with other peri markers

    if (periTriggers.length > 0) {
      conditions.push('perimenopause');
      for (const f of periTriggers) {
        if (!triggerFields.includes(f)) triggerFields.push(f);
      }
    }
  }

  if (conditions.length === 0) {
    return {
      hasHormoneIndicators: false,
      conditions: [],
      reason: '',
      triggerFields: [],
      confidence: 'low',
    };
  }

  // ── Reason string ────────────────────────────────────────────────────────
  const parts: string[] = [];

  if (conditions.includes('menopause')) {
    parts.push(
      'Your FSH and estradiol levels suggest a postmenopausal hormonal pattern. ' +
      'A Menopause Support nutritional approach may benefit you by emphasizing ' +
      'phytoestrogen-containing foods, bone-supportive calcium and vitamin D sources, ' +
      'and anti-inflammatory eating patterns. (NAMS / ACOG / Endocrine Society)'
    );
  }

  if (conditions.includes('perimenopause')) {
    parts.push(
      'Your hormone markers suggest a perimenopausal transition pattern. ' +
      'A Perimenopause Support approach may benefit you by emphasizing ' +
      'blood-sugar-stabilizing meals, phytoestrogen-rich foods, magnesium-supportive ' +
      'nutrition, and reduced inflammatory load to support the hormonal transition. ' +
      '(NAMS / Endocrine Society)'
    );
  }

  if (conditions.includes('hormone-optimization')) {
    const triggers = triggerFields.filter(f => ['total_testosterone', 'free_testosterone', 'dhea_s'].includes(f));
    parts.push(
      'Your ' + triggers.map(f => f === 'dhea_s' ? 'DHEA-S' : f === 'total_testosterone' ? 'total testosterone' : 'free testosterone').join(' and ') +
      ' levels suggest hormone optimization support may be beneficial. ' +
      'A Hormone Optimization approach emphasizes zinc-rich proteins, healthy fats, ' +
      'omega-3 sources, and nutrients that support androgen and adrenal health. ' +
      '(AUA / Endocrine Society)'
    );
  }

  const reason = parts.join(' ');

  const confidence: 'high' | 'moderate' | 'low' =
    triggerFields.length >= 3 ? 'high' :
    triggerFields.length >= 2 ? 'moderate' :
    'low';

  return {
    hasHormoneIndicators: true,
    conditions,
    reason,
    triggerFields,
    confidence,
  };
}
