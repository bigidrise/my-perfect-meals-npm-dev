/**
 * resolveProtocolFromLabs — Phase 3
 *
 * Evaluates a set of clinical lab values against the locked LAB_THRESHOLDS,
 * applies the canonical precedence order, and returns the highest-priority
 * LabProtocolSignal, or null when no threshold is crossed (patient stays on
 * the base anti-inflammatory protocol).
 *
 * Precedence (must match clinicalModeResolver.ts exactly):
 *   liver-disease > kidney-disease > heart-failure > liver-support > null
 *
 * Rules:
 *   - Every value passes through safeNum() before any comparison.
 *     NaN / null / blank NEVER trigger a protocol.
 *   - Reason strings are advisory only ("may benefit from", "suggests").
 *     They never make diagnostic claims ("you have", "you need").
 *   - Citations are embedded in the reason for modal display (Phase 4).
 *   - All thresholds come exclusively from LAB_THRESHOLDS. No magic numbers here.
 */

import {
  safeNum,
  LAB_THRESHOLDS,
  type LabProtocolSignal,
  type ThyroidLabSignal,
} from '../../shared/clinical/protocolDecision';

/**
 * Lab input shape accepted by the resolver.
 * Uses camelCase (Drizzle convention) for multi-word fields;
 * single-word fields are identical in all layers.
 * All fields are optional — missing fields simply don't trigger.
 */
export interface LabInputForProtocol {
  alt?: string | number | null;
  ast?: string | number | null;
  bilirubin?: string | number | null;
  albumin?: string | number | null;
  creatinine?: string | number | null;
  bun?: string | number | null;
  ldl?: string | number | null;
  bloodPressureSystolic?: string | number | null;
  ejectionFraction?: string | number | null;
  // Thyroid panel — Phase 1
  tsh?: string | number | null;
  freeT4?: string | number | null;
  freeT3?: string | number | null;
  tpoAntibodies?: string | number | null;
  thyroglobulinAntibodies?: string | number | null;
}

export function resolveProtocolFromLabs(
  labs: LabInputForProtocol,
): LabProtocolSignal | null {
  const t = LAB_THRESHOLDS;

  // ── Normalize every field through safeNum ──────────────────────────────────
  // Returns null for null / undefined / '' / NaN / Infinity.
  // A null value NEVER triggers a threshold — the condition is simply skipped.
  const alt        = safeNum(labs.alt);
  const ast        = safeNum(labs.ast);
  const bilirubin  = safeNum(labs.bilirubin);
  const albumin    = safeNum(labs.albumin);
  const creatinine = safeNum(labs.creatinine);
  const bun        = safeNum(labs.bun);
  const ldl        = safeNum(labs.ldl);
  const bpSys      = safeNum(labs.bloodPressureSystolic);
  const ef         = safeNum(labs.ejectionFraction);

  // ── 1. Liver Disease (highest precedence) ─────────────────────────────────
  // Triggered by: ALT > 200 U/L  OR  AST > 200 U/L
  //               OR  Bilirubin > 1.2 mg/dL  OR  Albumin < 3.4 g/dL
  // Source: AASLD / EASL guidelines
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
  // Triggered by: Creatinine > 1.2 mg/dL  OR  BUN > 20 mg/dL
  // Source: KDIGO / NKF guidelines
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
  // Triggered by: LDL ≥ 130 mg/dL  OR  BP systolic > 130 mmHg
  //               OR  Ejection fraction < 50 %
  // Note: LDL uses >= (ACC/AHA 2019 threshold)
  // Source: ACC / AHA guidelines
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
  // Triggered by: ALT > 36 U/L  OR  AST > 33 U/L
  // (Upper end of normal — below liver-disease threshold)
  // Source: AASLD / NIH clinical reference ranges
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

  // ── No thresholds crossed ─────────────────────────────────────────────────
  // Returning null signals that base anti-inflammatory is the appropriate
  // protocol — no recommendation modal should be shown.
  return null;
}

/**
 * Maps a LabProtocolSignal's protocol (or null) to the human-readable
 * subtitle shown in builder headers and dashboards.
 *
 * This is the single authoritative subtitle source for lab-driven protocol
 * display. It intentionally mirrors resolveClinicalProtocolLabel() so that
 * flag-driven and lab-driven subtitles are always in sync.
 */
export function labSignalToSubtitle(signal: LabProtocolSignal | null): string {
  if (!signal) return 'Anti-Inflammatory';
  const labels: Record<string, string> = {
    'liver-disease':     'Liver Disease',
    'kidney-disease':    'Kidney Disease',
    'heart-failure':     'Cardiac Health',
    'liver-support':     'Liver Support',
    'anti-inflammatory': 'Anti-Inflammatory',
  };
  return labels[signal.protocol] ?? 'Anti-Inflammatory';
}

/**
 * Resolve thyroid indicators from lab values.
 *
 * Unlike resolveProtocolFromLabs(), this function returns a ThyroidLabSignal
 * rather than a LabProtocolSignal because thyroid is an ADDITIVE MODIFIER,
 * not a primary protocol override. It can co-exist with any primary protocol.
 *
 * Triggers on:
 *   - TSH > 4.5 mIU/L (hypothyroid range) or < 0.4 mIU/L (hyperthyroid range)
 *   - Free T4 < 0.8 ng/dL (low hormone level)
 *   - Free T3 < 2.3 pg/mL (low active thyroid hormone)
 *   - TPO antibodies > 9 IU/mL (autoimmune thyroid — Hashimoto's pattern)
 *   - Thyroglobulin antibodies > 1 IU/mL (autoimmune thyroid activity)
 *
 * Sources: ATA, AACE, Endocrine Society, NIH.
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

  // TSH out of range (either direction)
  if (tsh !== null && tsh > t.tshHigh) triggers.push('tsh_high');
  if (tsh !== null && tsh < t.tshLow)  triggers.push('tsh_low');

  // Low thyroid hormone levels
  if (freeT4 !== null && freeT4 < t.freeT4Low) triggers.push('free_t4_low');
  if (freeT3 !== null && freeT3 < t.freeT3Low) triggers.push('free_t3_low');

  // Antibody markers — autoimmune thyroid pattern
  if (tpo  !== null && tpo  > t.tpoAntibodiesHigh)          { triggers.push('tpo_antibodies'); isAutoimmune = true; }
  if (tgab !== null && tgab > t.thyroglobulinAntibodiesHigh) { triggers.push('thyroglobulin_antibodies'); isAutoimmune = true; }

  if (triggers.length === 0) {
    return {
      hasThyroidIndicators: false,
      reason: '',
      triggerFields: [],
      confidence: 'low',
      isAutoimmune: false,
    };
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

  return {
    hasThyroidIndicators: true,
    reason,
    triggerFields: triggers,
    confidence,
    isAutoimmune,
  };
}
