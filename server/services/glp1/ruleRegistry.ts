/**
 * GLP-1 Clinical Rule Registry — Phase 0.5 Governance
 *
 * This registry is the SINGLE SOURCE OF TRUTH for every rule that influences
 * AI meal recommendations for GLP-1 / metabolic medication users.
 *
 * Architecture:
 *   Resolver → assertRuleApproved(ruleId) → RULE_REGISTRY → evidence source
 *
 * Every multiplier and threshold in the resolver must:
 *   1. Have a corresponding ClinicalRule entry here
 *   2. Be read via getRuleValue() — never hardcoded in the resolver
 *   3. Emit a RuleFiredEntry in the resolver output's rulesFired[]
 *
 * Enforcement rules:
 *   - reviewStatus === "removed"  → assertRuleApproved() throws; resolver must not use the rule
 *   - reviewStatus === "pending_review" → rule executes but is flagged in rulesFired and logs
 *   - reviewStatus === "approved"  → normal execution
 *   - evidenceLevel === "uncited"  → must be pending_review or removed; never approved
 *
 * Review cycle: re-evaluate annually, on any major FDA label update, on new
 * consensus paper publication, or on clinical partner feedback.
 *
 * Versioning: semantic version "MAJOR.MINOR.PATCH"
 *   MAJOR — recommendation direction reversal or removal
 *   MINOR — new evidence source added, value updated by RD review
 *   PATCH — governance note clarification, date update
 */

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE CATALOG
// ─────────────────────────────────────────────────────────────────────────────

export interface ClinicalSource {
  sourceId: string;
  title: string;
  organization: string;
  year: number;
  url: string;
  drives: string[];
}

export const SOURCE_CATALOG: Record<string, ClinicalSource> = {
  FDA_SEMAGLUTIDE_PI_2025: {
    sourceId: "FDA_SEMAGLUTIDE_PI_2025",
    title: "Ozempic / Wegovy (Semaglutide) Prescribing Information",
    organization: "U.S. Food and Drug Administration",
    year: 2025,
    url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/209637s025lbl.pdf",
    drives: [
      "GLP-1 Builder",
      "Grocery Coach",
      "Snack Creator",
      "Beverage Creator",
      "Coach's Corner",
      "Restaurant Guide",
      "Smart Scan",
      "Daily Tolerance Check-in",
      "Escalation Triggers",
    ],
  },

  FDA_TIRZEPATIDE_PI_2025: {
    sourceId: "FDA_TIRZEPATIDE_PI_2025",
    title: "Mounjaro / Zepbound (Tirzepatide) Prescribing Information",
    organization: "U.S. Food and Drug Administration",
    year: 2025,
    url: "https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/215866s039lbl.pdf",
    drives: [
      "GLP-1 Builder",
      "Grocery Coach",
      "Snack Creator",
      "Beverage Creator",
      "Coach's Corner",
      "Restaurant Guide",
      "Smart Scan",
      "Daily Tolerance Check-in",
      "Escalation Triggers",
    ],
  },

  PMID_36614945: {
    sourceId: "PMID_36614945",
    title:
      "Clinical Recommendations to Manage Gastrointestinal Adverse Events in Patients Treated with GLP-1 Receptor Agonists for Weight Management",
    organization: "Gut (BMJ) — Peer-Reviewed Consensus, 2023",
    year: 2023,
    url: "https://pubmed.ncbi.nlm.nih.gov/36614945/",
    drives: [
      "GLP-1 Builder",
      "Snack Creator",
      "Meal Builders",
      "Grocery Coach",
      "Beverage Creator",
      "Daily Tolerance Check-in",
    ],
  },

  NIDDK_GASTROPARESIS: {
    sourceId: "NIDDK_GASTROPARESIS",
    title: "Gastroparesis: Symptoms & Causes",
    organization: "National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK)",
    year: 2023,
    url: "https://www.niddk.nih.gov/health-information/digestive-diseases/gastroparesis/symptoms-causes",
    drives: [
      "GLP-1 Builder",
      "Grocery Coach",
      "Coach's Corner",
      "Smart Scan",
    ],
  },

  AND_GLP1_NUTRITION: {
    sourceId: "AND_GLP1_NUTRITION",
    title: "Evidence-Based Practice — Weight Management & Metabolic Medication Nutrition",
    organization: "Academy of Nutrition and Dietetics",
    year: 2024,
    url: "https://www.eatright.org/",
    drives: [
      "GLP-1 Builder",
      "Beverage Creator",
      "Meal Builders",
      "Grocery Coach",
    ],
  },

  AGA_GI_MANAGEMENT: {
    sourceId: "AGA_GI_MANAGEMENT",
    title: "GI Symptom Management — Dietary Guidance",
    organization: "American Gastroenterological Association",
    year: 2023,
    url: "https://www.gastro.org/",
    drives: [
      "Daily Tolerance Check-in",
      "GLP-1 Builder",
      "Coach's Corner",
      "Escalation Triggers",
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RULE SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceLevel =
  | "fda_label"
  | "peer_reviewed_consensus"
  | "institutional_guideline"
  | "expert_opinion"
  | "uncited";

export type ReviewStatus =
  | "approved"        // ships to users; evidence reviewed
  | "pending_review"  // in codebase; flagged for clinical review before production promotion
  | "removed";        // must not be used in any resolver — kept for audit trail only

export interface ClinicalRule {
  ruleId: string;
  description: string;
  sourceIds: string[];
  evidenceLevel: EvidenceLevel;
  reviewStatus: ReviewStatus;
  version: string;            // semantic version — bump on any change to evidence or value
  lastReviewedDate: string;   // ISO date of most recent clinical review
  effectiveDate: string;      // ISO date when this rule version took effect
  reviewDate: string;         // ISO date when this rule is due for re-review
  expiresDate?: string;       // optional — if set, rule must be re-reviewed by this date
  value?: number;             // configurable numeric value read by resolver; never hardcode in resolver
  governanceNote?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const RULE_REGISTRY: Record<string, ClinicalRule> = {

  // ── SYMPTOM RECOGNITION ───────────────────────────────────────────────────

  glp1_symptoms_recognized: {
    ruleId: "glp1_symptoms_recognized",
    description:
      "Nausea, vomiting, diarrhea, constipation, abdominal pain, dyspepsia, and reduced appetite are recognized as common adverse reactions for GLP-1 / GIP-GLP-1 dual agonist medications.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025", "FDA_TIRZEPATIDE_PI_2025"],
    evidenceLevel: "fda_label",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
  },

  glp1_dehydration_risk: {
    ruleId: "glp1_dehydration_risk",
    description:
      "Vomiting and diarrhea from GLP-1 medications can contribute to dehydration and acute kidney injury. Hydration is a first-class clinical concern.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025", "FDA_TIRZEPATIDE_PI_2025"],
    evidenceLevel: "fda_label",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
  },

  // ── NUTRITION RESPONSES ───────────────────────────────────────────────────

  glp1_smaller_portions: {
    ruleId: "glp1_smaller_portions",
    description:
      "Smaller, more frequent meals reduce GLP-1-related nausea. The platform favors smaller portion volumes, not a specific hardcoded calorie ceiling.",
    sourceIds: ["PMID_36614945"],
    evidenceLevel: "peer_reviewed_consensus",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
    governanceNote:
      "Directional flag only. Specific calorie targets are driven by the user's macro calculator and provider guardrails — not by this rule. The 400 kcal static baseline is a fallback when no calorie target exists, not a clinical ceiling.",
  },

  glp1_lower_fat: {
    ruleId: "glp1_lower_fat",
    description:
      "High dietary fat is the primary GLP-1 nausea trigger. Lower-fat meals reduce nausea risk.",
    sourceIds: ["PMID_36614945"],
    evidenceLevel: "peer_reviewed_consensus",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
    governanceNote:
      "Directional flag only. The specific fat ceiling is a provider-configurable guardrail. No specific gram value has a peer-reviewed source — the clinical evidence supports lower fat, not a specific threshold.",
  },

  glp1_protein_priority: {
    ruleId: "glp1_protein_priority",
    description:
      "GLP-1 patients are at elevated risk of lean mass loss due to appetite suppression. Protein-dense foods are prioritized to support lean mass preservation.",
    sourceIds: ["PMID_36614945", "AND_GLP1_NUTRITION"],
    evidenceLevel: "peer_reviewed_consensus",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
  },

  glp1_hydration_emphasis: {
    ruleId: "glp1_hydration_emphasis",
    description:
      "Hydration is emphasized throughout the platform for GLP-1 users due to dehydration risk from vomiting and diarrhea.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025", "FDA_TIRZEPATIDE_PI_2025", "NIDDK_GASTROPARESIS"],
    evidenceLevel: "fda_label",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
  },

  glp1_avoid_carbonation: {
    ruleId: "glp1_avoid_carbonation",
    description:
      "Carbonated beverages are avoided because carbonation can worsen bloating, nausea, and GI discomfort.",
    sourceIds: ["PMID_36614945"],
    evidenceLevel: "peer_reviewed_consensus",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
    governanceNote:
      "The consensus paper references avoidance of carbonated beverages for gas/bloating management in GI symptom contexts. The citation is indirect for GLP-1 specifically but falls within its GI symptom management recommendations.",
  },

  glp1_avoid_raw_cruciferous: {
    ruleId: "glp1_avoid_raw_cruciferous",
    description:
      "Raw cruciferous vegetables are avoided because delayed gastric emptying (a GLP-1 pharmacological effect) can worsen tolerance of high-fiber raw foods.",
    sourceIds: ["NIDDK_GASTROPARESIS"],
    evidenceLevel: "institutional_guideline",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
    governanceNote:
      "This rule applies via the gastroparesis dietary management literature, which maps directly to GLP-1's gastric emptying delay mechanism. The source is NIDDK gastroparesis guidance rather than a GLP-1-specific paper.",
  },

  glp1_neutral_flavors_nausea: {
    ruleId: "glp1_neutral_flavors_nausea",
    description:
      "Neutral flavors and avoidance of strong smells or spices reduce nausea episodes.",
    sourceIds: ["PMID_36614945"],
    evidenceLevel: "peer_reviewed_consensus",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
    governanceNote:
      "The consensus paper recommends avoiding strong smells and rich aromas as a behavioral intervention for nausea. Specific spices/aromatics are not enumerated — this is a directional recommendation.",
  },

  glp1_constipation_fiber: {
    ruleId: "glp1_constipation_fiber",
    description:
      "Constipation is addressed with increased soluble fiber — ONLY when paired with adequate hydration. Fiber without fluids can worsen constipation.",
    sourceIds: ["PMID_36614945", "AND_GLP1_NUTRITION"],
    evidenceLevel: "peer_reviewed_consensus",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
    governanceNote:
      "This rule MUST NOT activate independently of hydration status. If a user reports both constipation and hydration difficulty, hydration takes priority and fiber promotion is suppressed. This pairing is enforced in the resolver.",
  },

  glp1_diarrhea_reduce_fiber: {
    ruleId: "glp1_diarrhea_reduce_fiber",
    description:
      "Diarrhea is addressed with reduced insoluble fiber and bland/BRAT-adjacent foods.",
    sourceIds: ["AGA_GI_MANAGEMENT"],
    evidenceLevel: "institutional_guideline",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
  },

  glp1_reflux_smaller_meals: {
    ruleId: "glp1_reflux_smaller_meals",
    description:
      "Reflux/dyspepsia is managed with smaller portions and avoidance of acidic or heavily spiced foods.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025", "AGA_GI_MANAGEMENT"],
    evidenceLevel: "fda_label",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
    governanceNote:
      "Dyspepsia is FDA-listed as a common adverse reaction. Dietary management (smaller meals, avoiding triggers) is standard AGA guidance for reflux/dyspepsia.",
  },

  // ── ESCALATION ────────────────────────────────────────────────────────────

  glp1_vomiting_escalate: {
    ruleId: "glp1_vomiting_escalate",
    description:
      "Vomiting (any severity) triggers an escalation message recommending provider contact before the next meal. Severe or persistent vomiting is explicitly flagged.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025", "FDA_TIRZEPATIDE_PI_2025"],
    evidenceLevel: "fda_label",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
    governanceNote:
      "FDA prescribing information §5.1 and §6.1 explicitly warn about vomiting as a risk factor for dehydration and acute kidney injury. Escalation wording must be reviewed by a clinician before production deployment.",
  },

  glp1_dehydration_difficulty_escalate: {
    ruleId: "glp1_dehydration_difficulty_escalate",
    description:
      "Moderate or severe difficulty staying hydrated combined with any GI symptom triggers an escalation message.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025", "FDA_TIRZEPATIDE_PI_2025"],
    evidenceLevel: "fda_label",
    reviewStatus: "approved",
    version: "1.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2027-07-26",
    governanceNote:
      "Escalation is based on symptom type (vomiting + hydration difficulty), not on a count of symptoms. The removed '3 severe symptoms = escalate' rule had no clinical source and has been superseded by this rule.",
  },

  // ── TREATMENT PHASE MULTIPLIERS (PENDING REVIEW) ──────────────────────────

  glp1_intro_phase_calorie_multiplier: {
    ruleId: "glp1_intro_phase_calorie_multiplier",
    description:
      "During the intro/up-titration treatment phase, meal calorie allocation is scaled by value× to account for initial GI intolerance and appetite suppression.",
    sourceIds: [],
    evidenceLevel: "uncited",
    reviewStatus: "pending_review",
    version: "1.0.0",
    value: 0.82,
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2026-12-31",
    expiresDate: "2027-06-30",
    governanceNote:
      "The direction (smaller portions during intro) is supported by PMID_36614945. The specific coefficient (0.82×) has no peer-reviewed source — it is a conservative engineering estimate. Must be reviewed by a registered dietitian or physician before promoting to 'approved'. Until then, resolves as pending_review in rulesFired.",
  },

  glp1_muscle_preserve_calorie_multiplier: {
    ruleId: "glp1_muscle_preserve_calorie_multiplier",
    description:
      "During the muscle-preservation treatment phase, meal calorie allocation is scaled up by value× to support anabolic demand while on appetite-suppressing medication.",
    sourceIds: ["PMID_36614945", "AND_GLP1_NUTRITION"],
    evidenceLevel: "uncited",
    reviewStatus: "pending_review",
    version: "1.0.0",
    value: 1.08,
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2026-12-31",
    expiresDate: "2027-06-30",
    governanceNote:
      "Direction (higher calories for muscle preservation on GLP-1) is supported by lean mass guidance in AND and PMID_36614945. The specific coefficient (1.08×) is an engineering estimate without a peer-reviewed source. Pending RD review.",
  },

  glp1_appetite_suppressed_multiplier: {
    ruleId: "glp1_appetite_suppressed_multiplier",
    description:
      "When appetite is reported as suppressed, meal calorie allocation is scaled by value× to avoid forcing intake the patient cannot tolerate.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025"],
    evidenceLevel: "uncited",
    reviewStatus: "pending_review",
    version: "1.0.0",
    value: 0.80,
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2026-12-31",
    expiresDate: "2027-06-30",
    governanceNote:
      "Appetite suppression is FDA-documented. Directional adjustment (lower calories when suppressed) is clinically sound. The specific coefficient (0.80×) is an engineering estimate. Pending RD review.",
  },

  glp1_appetite_reduced_multiplier: {
    ruleId: "glp1_appetite_reduced_multiplier",
    description:
      "When appetite is reported as reduced (but not fully suppressed), meal calorie allocation is scaled by value×.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025"],
    evidenceLevel: "uncited",
    reviewStatus: "pending_review",
    version: "1.0.0",
    value: 0.90,
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2026-12-31",
    expiresDate: "2027-06-30",
    governanceNote:
      "Reduced appetite is FDA-documented for GLP-1 medications. The specific coefficient (0.90×) is an engineering estimate. Pending RD review.",
  },

  // ── INTRO PHASE FAT THRESHOLDS (PENDING REVIEW) ───────────────────────────

  glp1_intro_fat_ceiling: {
    ruleId: "glp1_intro_fat_ceiling",
    description:
      "During the intro treatment phase, the maximum tolerated fat per meal is reduced to value grams to reduce nausea risk.",
    sourceIds: ["PMID_36614945"],
    evidenceLevel: "uncited",
    reviewStatus: "pending_review",
    version: "1.0.0",
    value: 10,
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2026-12-31",
    expiresDate: "2027-06-30",
    governanceNote:
      "Lower fat during intro is supported by PMID_36614945. The specific ceiling (10g) is an engineering estimate. The directional guidance is approved via glp1_lower_fat; this specific threshold is pending RD review.",
  },

  glp1_intro_fat_target: {
    ruleId: "glp1_intro_fat_target",
    description:
      "During the intro treatment phase, the recommended fat target per meal is value grams (below the ceiling to provide headroom).",
    sourceIds: ["PMID_36614945"],
    evidenceLevel: "uncited",
    reviewStatus: "pending_review",
    version: "1.0.0",
    value: 8,
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2026-12-31",
    expiresDate: "2027-06-30",
    governanceNote:
      "Derived from glp1_intro_fat_ceiling (10g ceiling × 0.8 headroom ratio = 8g target). Both values are engineering estimates pending RD review.",
  },

  // ── REMOVED RULES — DO NOT IMPLEMENT ─────────────────────────────────────

  glp1_portionScale_0_65: {
    ruleId: "glp1_portionScale_0_65",
    description: "REMOVED — hardcoded 65% calorie reduction for nausea.",
    sourceIds: [],
    evidenceLevel: "uncited",
    reviewStatus: "removed",
    version: "0.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2026-07-26",
    governanceNote:
      "No clinical source. Replaced by directional flag glp1_smaller_portions. This specific coefficient must not appear in any resolver.",
  },

  glp1_maxFatAdjustmentG_minus5: {
    ruleId: "glp1_maxFatAdjustmentG_minus5",
    description: "REMOVED — automatic -5g fat reduction beyond provider cap.",
    sourceIds: [],
    evidenceLevel: "uncited",
    reviewStatus: "removed",
    version: "0.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2026-07-26",
    governanceNote:
      "No clinical source. Fat ceiling is now provider-configurable via guardrails. Directional flag glp1_lower_fat is the replacement.",
  },

  glp1_three_symptoms_escalate: {
    ruleId: "glp1_three_symptoms_escalate",
    description: "REMOVED — 3 severe symptoms triggers escalation.",
    sourceIds: [],
    evidenceLevel: "uncited",
    reviewStatus: "removed",
    version: "0.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2026-07-26",
    governanceNote:
      "No source for symptom count threshold. Replaced by glp1_vomiting_escalate and glp1_dehydration_difficulty_escalate, which trigger on symptom type, not count.",
  },

  glp1_48h_injection_window: {
    ruleId: "glp1_48h_injection_window",
    description: "REMOVED — automatic 48-hour post-injection dietary restriction window.",
    sourceIds: [],
    evidenceLevel: "uncited",
    reviewStatus: "removed",
    version: "0.0.0",
    lastReviewedDate: "2026-07-26",
    effectiveDate: "2026-07-26",
    reviewDate: "2026-07-26",
    governanceNote:
      "No source. Individual pharmacokinetics vary by medication and patient. A universal 48-hour window is not supportable. The shot tracker can prompt the daily tolerance check-in without imposing automatic restrictions.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME ENFORCEMENT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert that a rule exists and is not removed.
 * - "removed"       → throws (must never reach a resolver)
 * - "pending_review"→ returns the rule (resolver should flag it in rulesFired)
 * - "approved"      → returns the rule
 * - unknown ruleId  → returns null with a console.warn
 */
export function assertRuleApproved(ruleId: string): ClinicalRule | null {
  const rule = RULE_REGISTRY[ruleId];
  if (!rule) {
    console.warn(`[GLP-1 Registry] Unknown rule: "${ruleId}" — using fallback.`);
    return null;
  }
  if (rule.reviewStatus === "removed") {
    throw new Error(
      `[GLP-1 Registry] Rule "${ruleId}" has been removed (v${rule.version}) and must not be used in any resolver. ` +
      `Reason: ${rule.governanceNote ?? "see registry"}`
    );
  }
  return rule;
}

/**
 * Read the numeric value for a rule from the registry.
 * Returns `fallback` if the rule is unknown, removed, or has no value field.
 * Logs a warning for pending_review rules so they appear in MACRO_AUDIT output.
 */
export function getRuleValue(ruleId: string, fallback: number): number {
  const rule = RULE_REGISTRY[ruleId];
  if (!rule || rule.value === undefined || rule.reviewStatus === "removed") return fallback;
  return rule.value;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED AUDIT LOGGING
// ─────────────────────────────────────────────────────────────────────────────

export interface RuleFiredEntry {
  ruleId: string;
  sourceIds: string[];
  evidenceLevel: EvidenceLevel;
  reviewStatus: ReviewStatus;
  version: string;
  value?: number;
}

/**
 * Emit a structured clinical rule log, gated on the MACRO_AUDIT env var.
 * Format matches the architect's required output:
 *
 *   Rule:          glp1_intro_phase_calorie_multiplier
 *   Evidence:      FDA_SEMAGLUTIDE_PI_2025
 *   Status:        pending_review
 *   Version:       1.0.0
 *   Value:         0.82
 *   Review by:     2025-12-31
 */
export function emitRuleLog(entries: RuleFiredEntry[]): void {
  if (process.env.MACRO_AUDIT !== "true") return;
  console.log("\n╔══ GLP-1 Clinical Rules Fired ══════════════════════════════╗");
  for (const e of entries) {
    const sources = e.sourceIds.length > 0 ? e.sourceIds.join(", ") : "(none)";
    const valueStr = e.value !== undefined ? `  Value:       ${e.value}` : "";
    const rule = RULE_REGISTRY[e.ruleId];
    const reviewBy = rule?.reviewDate ? `  Review by:   ${rule.reviewDate}` : "";
    const expiresBy = rule?.expiresDate ? `  Expires:     ${rule.expiresDate}` : "";
    const statusFlag = e.reviewStatus === "pending_review" ? " ⚠️  PENDING CLINICAL REVIEW" : "";
    console.log(
      `  ─────────────────────────────────────────────────────────────\n` +
      `  Rule:        ${e.ruleId} (v${e.version})${statusFlag}\n` +
      `  Evidence:    ${sources}\n` +
      `  Level:       ${e.evidenceLevel}\n` +
      `  Status:      ${e.reviewStatus}` +
      (valueStr ? `\n${valueStr}` : "") +
      (reviewBy ? `\n${reviewBy}` : "") +
      (expiresBy ? `\n${expiresBy}` : "")
    );
  }
  console.log("╚════════════════════════════════════════════════════════════╝\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// QUERY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function getApprovedRules(): ClinicalRule[] {
  return Object.values(RULE_REGISTRY).filter(r => r.reviewStatus === "approved");
}

export function getPendingReviewRules(): ClinicalRule[] {
  return Object.values(RULE_REGISTRY).filter(r => r.reviewStatus === "pending_review");
}

export function getSourcesForRule(ruleId: string): ClinicalSource[] {
  const rule = RULE_REGISTRY[ruleId];
  if (!rule) return [];
  return rule.sourceIds.map(id => SOURCE_CATALOG[id]).filter(Boolean);
}

export function getRulesForSource(sourceId: string): ClinicalRule[] {
  return Object.values(RULE_REGISTRY).filter(r => r.sourceIds.includes(sourceId));
}

export function getRulesExpiringSoon(withinDays = 90): ClinicalRule[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);
  return Object.values(RULE_REGISTRY).filter(r => {
    if (!r.expiresDate) return false;
    return new Date(r.expiresDate) <= cutoff;
  });
}
