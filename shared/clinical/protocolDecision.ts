/**
 * Protocol Decision Contract — Phase 5
 *
 * This file is the single source of truth for:
 *   1. safeNum()          — guards every lab comparison against null / NaN / blank
 *   2. ProtocolDecision   — typed union of all possible protocol outcomes
 *   3. LabProtocolSignal  — structured output of resolveProtocolFromLabs()
 *   4. ThyroidLabSignal   — structured output of resolveThyroidFromLabs() (additive modifier)
 *   5. HormoneLabSignal   — structured output of resolveHormoneFromLabs() (additive modifier)
 *   6. LAB_THRESHOLDS     — every numeric threshold used by the resolver
 *
 * NEVER hardcode threshold values anywhere else.
 * NEVER compare a raw lab value without first passing it through safeNum().
 *
 * Precedence order (must match clinicalModeResolver.ts exactly):
 *   liver-disease > kidney-disease > heart-failure > liver-support >
 *   metabolic-support > inflammation-support > metabolic-stress >
 *   anti-inflammatory (base, no signal)
 *
 * Additive modifiers (run independently, do not interrupt primary precedence):
 *   thyroid-support + subtypes (hypothyroid / hyperthyroid / hashimotos)
 *   hormone-optimization + menopause / perimenopause
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
  | 'metabolic-support'      // Phase 4 — insulin resistance / metabolic / diabetic-aware
  | 'inflammation-support'   // Phase 4 — CRP-driven anti-inflammatory escalation
  | 'metabolic-stress'       // Phase 4 — cortisol-driven metabolic stress support
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
 *   liver-disease:       AASLD / EASL guidelines
 *   liver-support:       AASLD / NIH clinical reference ranges
 *   kidney-disease:      KDIGO / NKF guidelines
 *   cardiac:             ACC / AHA guidelines
 *   thyroid:             ATA / AACE / Endocrine Society
 *   thyroidSubtype:      ATA / AACE / Endocrine Society
 *   metabolic:           ADA / AHA metabolic risk thresholds
 *   inflammation:        AHA / CDC high-sensitivity CRP classification
 *   metabolicStress:     Endocrine Society / standard clinical lab reference ranges
 *   testosterone:        AUA / Endocrine Society
 *   menopause:           NAMS / ACOG / Endocrine Society
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
  // Sources: ATA, AACE, Endocrine Society clinical practice guidelines.
  thyroid: {
    tshHigh:                    4.5,  // mIU/L  — TSH > 4.5 suggests hypothyroid (ATA/AACE)
    tshLow:                     0.4,  // mIU/L  — TSH < 0.4 suggests hyperthyroid (ATA/AACE)
    freeT4Low:                  0.8,  // ng/dL  — Free T4 < 0.8 suggests inadequate hormone level
    freeT3Low:                  2.3,  // pg/mL  — Free T3 < 2.3 suggests low active thyroid hormone
    tpoAntibodiesHigh:          9,    // IU/mL  — TPO Ab > 9 suggests autoimmune thyroid (Hashimoto's)
    thyroglobulinAntibodiesHigh: 1,   // IU/mL  — TgAb > 1 suggests autoimmune thyroid activity
  },

  // Thyroid Subtype — used to resolve hypothyroid / hyperthyroid / hashimotos from existing markers + rT3.
  // Sources: ATA, AACE, Endocrine Society.
  thyroidSubtype: {
    reverseT3High: 25,   // ng/dL — rT3 > 25 suggests impaired T4→T3 conversion (functional hypothyroid pattern)
    freeT4High:    1.8,  // ng/dL — Free T4 > 1.8 elevated (hyperthyroid pattern)
    freeT3High:    4.2,  // pg/mL — Free T3 > 4.2 elevated (hyperthyroid pattern)
  },

  // Metabolic Support — insulin resistance / diabetic-aware support.
  // Sources: ADA Standards of Medical Care in Diabetes, AHA metabolic risk.
  metabolic: {
    a1cHigh:             5.7,   // %       — pre-diabetic range (ADA)
    glucoseHigh:         100,   // mg/dL   — impaired fasting glucose (ADA)
    fastingInsulinHigh:  15,    // µIU/mL  — above optimal functional range
    triglyceridesHigh:   150,   // mg/dL   — borderline high triglycerides (AHA)
    tgHdlRatioHigh:      3.5,   // ratio   — TG/HDL > 3.5 signals insulin resistance
  },

  // Inflammation Support — CRP-driven anti-inflammatory escalation.
  // Sources: AHA / CDC high-sensitivity CRP classification (2003 joint statement).
  inflammation: {
    crpHigh: 3.0,  // mg/L — > 3.0 = high cardiovascular inflammation risk (AHA/CDC)
  },

  // Metabolic Stress Support — cortisol-driven.
  // Sources: Endocrine Society, standard clinical lab reference ranges (AM draw).
  metabolicStress: {
    cortisolHigh: 20,  // µg/dL — > 20 above optimal AM range (clinical lab refs)
  },

  // Testosterone / Hormone Optimization — sex hormone deficiency triggers hormone-optimization.
  // Sources: AUA guideline on testosterone deficiency (2018, updated 2022),
  //          Endocrine Society clinical practice guideline on testosterone therapy.
  testosterone: {
    totalTestosteroneLow: 300,  // ng/dL — < 300 consistent with testosterone deficiency (AUA)
    freeTestosteroneLow:    5,  // pg/mL — broadly low free testosterone across sexes
    dheaSLow:              70,  // µg/dL — low adrenal androgen output (Endocrine Society)
  },

  // Menopause / Perimenopause — drives menopause and perimenopause additive modifier activation.
  // Sources: NAMS (North American Menopause Society) Position Statement 2023,
  //          ACOG Committee Opinion on Menopause,
  //          Endocrine Society Clinical Practice Guideline.
  menopause: {
    // Menopause: consistently elevated FSH + low estradiol = postmenopausal range
    fshMenopauseHigh:      40,  // mIU/mL — FSH > 40 consistent with menopause (NAMS/ACOG)
    estradiolMenopauseLow: 20,  // pg/mL  — E2 < 20 = postmenopausal range (NAMS)
    // Perimenopause: fluctuating FSH + declining estradiol + low luteal progesterone
    fshPeriLow:            10,  // mIU/mL — FSH ≥ 10 begins perimenopausal range
    estradiolPeriLow:      50,  // pg/mL  — E2 20–50 pg/mL = perimenopausal transition zone
    progesteroneLow:        2,  // ng/mL  — luteal phase < 2 suggests anovulatory/perimenopause
    lhElevated:            20,  // mIU/mL — LH > 20 supports perimenopause when combined with other markers
  },
} as const;

export type LabThresholds = typeof LAB_THRESHOLDS;

// ---------------------------------------------------------------------------
// 5. LabDowngradeSignal — returned when a user is already on a protocol and
//    their new lab values are now within the normal reference range for that
//    protocol's activation markers. Offers the user the option to step down
//    to the Anti-Inflammatory foundation. Never auto-applied.
// ---------------------------------------------------------------------------

export interface LabDowngradeSignal {
  /**
   * The protocol the user is currently on that may no longer be needed.
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
// 6. ThyroidLabSignal — separate from LabProtocolSignal because thyroid is
//    an additive modifier, not a primary protocol override.
//    Phase 5: extended with subtypeConditions for subtype detection.
// ---------------------------------------------------------------------------

export interface ThyroidLabSignal {
  /** Whether any thyroid threshold was crossed. */
  hasThyroidIndicators: boolean;

  /**
   * Specific thyroid subtype conditions inferred from lab pattern.
   * Empty array = generic thyroid-support only (no clear subtype).
   * These are ADDITIVE — multiple subtypes can coexist.
   * - 'hashimotos':   TPO Ab or TgAb elevated (autoimmune pattern)
   * - 'hypothyroid':  TSH high + Free T4/T3 low (or rT3 elevated)
   * - 'hyperthyroid': TSH low + Free T4/T3 elevated
   */
  subtypeConditions: Array<'hypothyroid' | 'hyperthyroid' | 'hashimotos'>;

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

// ---------------------------------------------------------------------------
// 7. HormoneLabSignal — additive modifier for sex hormone protocols.
//    Drives: hormone-optimization, menopause, perimenopause.
//    Does NOT affect the primary protocol precedence chain.
// ---------------------------------------------------------------------------

export interface HormoneLabSignal {
  /** Whether any hormone threshold was crossed. */
  hasHormoneIndicators: boolean;

  /**
   * Specific hormone-related conditions inferred from lab pattern.
   * Multiple conditions can coexist (e.g., perimenopause + hormone-optimization).
   * - 'hormone-optimization': low testosterone/DHEA-S → nutrient support protocol
   * - 'menopause':            FSH > 40 + E2 < 20 (postmenopausal pattern)
   * - 'perimenopause':        FSH 10–40 OR E2 20–50 OR progesterone < 2
   */
  conditions: Array<'hormone-optimization' | 'menopause' | 'perimenopause'>;

  /**
   * Human-readable reason string for the recommendation modal.
   * Language MUST be advisory — never diagnostic.
   */
  reason: string;

  /** The specific field name(s) that triggered this signal. */
  triggerFields: string[];

  /** Confidence level driven by number of markers crossed. */
  confidence: 'high' | 'moderate' | 'low';
}
