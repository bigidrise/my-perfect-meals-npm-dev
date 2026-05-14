/**
 * Protocol Decision Contract — Phase 2
 *
 * This file is the single source of truth for:
 *   1. safeNum()       — guards every lab comparison against null / NaN / blank
 *   2. ProtocolDecision — the typed union of all possible protocol outcomes
 *   3. LabProtocolSignal — the structured output of resolveProtocolFromLabs()
 *   4. LAB_THRESHOLDS   — every numeric threshold used by the resolver
 *
 * NEVER hardcode threshold values anywhere else.
 * NEVER compare a raw lab value without first passing it through safeNum().
 *
 * Precedence order (must match clinicalModeResolver.ts exactly):
 *   liver-disease > kidney-disease > heart-failure > liver-support > anti-inflammatory
 */

// ---------------------------------------------------------------------------
// 1. Safeguard — prevents NaN/null from silently mis-routing protocols
// ---------------------------------------------------------------------------

/**
 * Safely coerces a lab value (string | number | null | undefined) to a
 * finite number, returning null for anything blank, null, or non-finite.
 *
 * Use this before EVERY threshold comparison in the resolver.
 * Without it, `NaN > 200` evaluates to false and silently skips escalation.
 */
export function safeNum(val: string | number | null | undefined): number | null {
  if (val == null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// 2. ProtocolDecision type
// ---------------------------------------------------------------------------

export type ProtocolDecision =
  | 'liver-disease'
  | 'kidney-disease'
  | 'heart-failure'
  | 'liver-support'
  | 'anti-inflammatory';

// ---------------------------------------------------------------------------
// 3. LabProtocolSignal — structured output from resolveProtocolFromLabs()
// ---------------------------------------------------------------------------

export interface LabProtocolSignal {
  /** The protocol the lab values indicate the patient may benefit from. */
  protocol: ProtocolDecision;

  /**
   * Human-readable reason string used in the recommendation modal.
   * Language MUST be advisory ("may benefit from", "suggests") —
   * never diagnostic ("you have", "you need").
   */
  reason: string;

  /**
   * Confidence level driven by number and severity of triggering fields.
   * - high:     multiple markers OR a single severely abnormal value
   * - moderate: one clearly abnormal marker
   * - low:      one borderline marker
   */
  confidence: 'high' | 'moderate' | 'low';

  /** The specific field name(s) that triggered this signal, e.g. ["alt", "ast"]. */
  triggerFields: string[];
}

// ---------------------------------------------------------------------------
// 4. LAB_THRESHOLDS — all numeric thresholds in one place
// ---------------------------------------------------------------------------

/**
 * Thresholds are defined per-protocol using directional naming:
 *   High  = value must be ABOVE this to trigger
 *   Low   = value must be BELOW this to trigger
 *
 * Sources:
 *   liver-disease:  AASLD / EASL guidelines
 *   liver-support:  AASLD / NIH clinical reference ranges
 *   kidney-disease: KDIGO / NKF guidelines
 *   cardiac:        ACC / AHA guidelines
 */
export const LAB_THRESHOLDS = {
  liverDisease: {
    altHigh:       200,  // U/L   — ALT > 200 escalates to liver-disease
    astHigh:       200,  // U/L   — AST > 200 escalates to liver-disease
    bilirubinHigh: 1.2,  // mg/dL — total bilirubin > 1.2 escalates to liver-disease
    albuminLow:    3.4,  // g/dL  — albumin < 3.4 escalates to liver-disease
  },

  liverSupport: {
    altHigh: 36,  // U/L — ALT > 36 (upper normal) signals liver-support
    astHigh: 33,  // U/L — AST > 33 (upper normal) signals liver-support
  },

  kidney: {
    creatinineHigh: 1.2,  // mg/dL — creatinine > 1.2 signals kidney-disease
    bunHigh:        20,   // mg/dL — BUN > 20 signals kidney-disease
  },

  cardiac: {
    ldlHigh:             130,  // mg/dL — LDL ≥ 130 signals heart-failure protocol
    bpSystolicHigh:      130,  // mmHg  — systolic > 130 signals heart-failure protocol
    ejectionFractionLow:  50,  // %     — EF < 50 signals heart-failure protocol
  },

  // Thyroid Support — additive modifier layer, not a primary protocol override.
  // Sources: American Thyroid Association (ATA), American Association of Clinical
  // Endocrinology (AACE), Endocrine Society clinical practice guidelines.
  thyroid: {
    tshHigh:                    4.5,  // mIU/L  — TSH > 4.5 suggests hypothyroid (ATA/AACE)
    tshLow:                     0.4,  // mIU/L  — TSH < 0.4 suggests hyperthyroid (ATA/AACE)
    freeT4Low:                  0.8,  // ng/dL  — Free T4 < 0.8 suggests inadequate hormone level
    freeT3Low:                  2.3,  // pg/mL  — Free T3 < 2.3 suggests low active thyroid hormone
    tpoAntibodiesHigh:          9,    // IU/mL  — TPO Ab > 9 suggests autoimmune thyroid (Hashimoto's)
    thyroglobulinAntibodiesHigh: 1,   // IU/mL  — TgAb > 1 suggests autoimmune thyroid activity
  },
} as const;

export type LabThresholds = typeof LAB_THRESHOLDS;

// ---------------------------------------------------------------------------
// 6. LabDowngradeSignal — returned when a user is already on a protocol and
//    their new lab values are now within the normal reference range for that
//    protocol's activation markers. Offers the user the option to step down
//    to the Anti-Inflammatory foundation. Never auto-applied.
// ---------------------------------------------------------------------------

export interface LabDowngradeSignal {
  /**
   * The protocol the user is currently on that may no longer be needed.
   * 'thyroid-support' | 'liver-disease' | 'kidney-disease' | 'heart-failure' | 'liver-support'
   */
  protocol: string;

  /** Human-readable protocol name, e.g. "Cardiac Health" */
  protocolLabel: string;

  /**
   * The specific lab field names that were entered and are now within normal
   * range (used to display "markers improved" in the modal).
   */
  normalFields: string[];

  /**
   * Advisory reason text for the reassessment modal.
   * Language is positive and non-diagnostic ("your values now fall within...",
   * "you may be ready to...").
   */
  reason: string;
}

// ---------------------------------------------------------------------------
// 5. ThyroidLabSignal — separate from LabProtocolSignal because thyroid is
//    an additive modifier, not a primary protocol override.
// ---------------------------------------------------------------------------

export interface ThyroidLabSignal {
  /** Whether any thyroid threshold was crossed. */
  hasThyroidIndicators: boolean;

  /**
   * Human-readable reason string used in the recommendation modal.
   * Language MUST be advisory — never diagnostic.
   */
  reason: string;

  /** The specific field name(s) that triggered this signal. */
  triggerFields: string[];

  /** Confidence level driven by number and type of triggering fields. */
  confidence: 'high' | 'moderate' | 'low';

  /** true when the trigger is antibody-based (autoimmune pattern like Hashimoto's). */
  isAutoimmune: boolean;
}
