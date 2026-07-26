/**
 * GLP-1 Clinical Rule Registry — Phase 0 Governance
 *
 * Every rule that influences AI meal recommendations for GLP-1 / metabolic
 * medication users must be registered here with:
 *   - ruleId        unique identifier referenced in resolver output
 *   - sourceIds[]   one or more entries from SOURCE_CATALOG below
 *   - evidenceLevel how strong the backing is
 *   - reviewStatus  approved = can ship; pending_review = ship with flag; removed = do not use
 *   - lastReviewed  ISO date of last clinical review
 *   - governanceNote human-readable rationale, especially for partial/uncited items
 *
 * RULE: No rule with reviewStatus === "removed" may remain in the resolver.
 * RULE: No rule with evidenceLevel === "uncited" may reach production users without
 *       a pending_review flag in the resolver output.
 *
 * Review cycle: sources and rules should be re-evaluated annually or when a
 * major FDA label update, new consensus paper, or clinical partner feedback
 * requires it.
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
  /** Which platform surfaces this source's rules drive */
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
// RULE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceLevel =
  | "fda_label"
  | "peer_reviewed_consensus"
  | "institutional_guideline"
  | "expert_opinion"
  | "uncited";

export type ReviewStatus =
  | "approved"     // ships to users, evidence reviewed
  | "pending_review" // in codebase, flagged for clinical review before production
  | "removed";     // must not be used in any resolver

export interface ClinicalRule {
  ruleId: string;
  description: string;
  sourceIds: string[];
  evidenceLevel: EvidenceLevel;
  reviewStatus: ReviewStatus;
  lastReviewedDate: string; // ISO date
  governanceNote?: string;
}

export const RULE_REGISTRY: Record<string, ClinicalRule> = {

  // ── SYMPTOM RECOGNITION ───────────────────────────────────────────────────

  glp1_symptoms_recognized: {
    ruleId: "glp1_symptoms_recognized",
    description:
      "Nausea, vomiting, diarrhea, constipation, abdominal pain, dyspepsia, and reduced appetite are recognized as common adverse reactions for GLP-1 / GIP-GLP-1 dual agonist medications.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025", "FDA_TIRZEPATIDE_PI_2025"],
    evidenceLevel: "fda_label",
    reviewStatus: "approved",
    lastReviewedDate: "2025-07-26",
  },

  glp1_dehydration_risk: {
    ruleId: "glp1_dehydration_risk",
    description:
      "Vomiting and diarrhea from GLP-1 medications can contribute to dehydration and acute kidney injury. Hydration is a first-class clinical concern.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025", "FDA_TIRZEPATIDE_PI_2025"],
    evidenceLevel: "fda_label",
    reviewStatus: "approved",
    lastReviewedDate: "2025-07-26",
  },

  // ── NUTRITION RESPONSES ───────────────────────────────────────────────────

  glp1_smaller_portions: {
    ruleId: "glp1_smaller_portions",
    description:
      "Smaller, more frequent meals reduce GLP-1-related nausea. The platform favors smaller portion volumes, not a specific hardcoded calorie ceiling.",
    sourceIds: ["PMID_36614945"],
    evidenceLevel: "peer_reviewed_consensus",
    reviewStatus: "approved",
    lastReviewedDate: "2025-07-26",
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
    lastReviewedDate: "2025-07-26",
    governanceNote:
      "Directional flag only. The specific fat ceiling (e.g., 12g or 15g per meal) is a provider-configurable guardrail. The default guardrail is 15g (baseline), tighter for intro phase. No specific gram value has a peer-reviewed source — the clinical evidence supports lower fat, not a specific threshold.",
  },

  glp1_protein_priority: {
    ruleId: "glp1_protein_priority",
    description:
      "GLP-1 patients are at elevated risk of lean mass loss due to appetite suppression. Protein-dense foods are prioritized to support lean mass preservation.",
    sourceIds: ["PMID_36614945", "AND_GLP1_NUTRITION"],
    evidenceLevel: "peer_reviewed_consensus",
    reviewStatus: "approved",
    lastReviewedDate: "2025-07-26",
  },

  glp1_hydration_emphasis: {
    ruleId: "glp1_hydration_emphasis",
    description:
      "Hydration is emphasized throughout the platform for GLP-1 users due to dehydration risk from vomiting and diarrhea.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025", "FDA_TIRZEPATIDE_PI_2025", "NIDDK_GASTROPARESIS"],
    evidenceLevel: "fda_label",
    reviewStatus: "approved",
    lastReviewedDate: "2025-07-26",
  },

  glp1_avoid_carbonation: {
    ruleId: "glp1_avoid_carbonation",
    description:
      "Carbonated beverages are avoided because carbonation can worsen bloating, nausea, and GI discomfort.",
    sourceIds: ["PMID_36614945"],
    evidenceLevel: "peer_reviewed_consensus",
    reviewStatus: "approved",
    lastReviewedDate: "2025-07-26",
    governanceNote:
      "The consensus paper references avoidance of carbonated beverages for gas/bloating management in GI symptom contexts. The citation is indirect for GLP-1 specifically, but falls within its GI symptom management recommendations.",
  },

  glp1_avoid_raw_cruciferous: {
    ruleId: "glp1_avoid_raw_cruciferous",
    description:
      "Raw cruciferous vegetables are avoided because delayed gastric emptying (a GLP-1 pharmacological effect) can worsen tolerance of high-fiber raw foods.",
    sourceIds: ["NIDDK_GASTROPARESIS"],
    evidenceLevel: "institutional_guideline",
    reviewStatus: "approved",
    lastReviewedDate: "2025-07-26",
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
    lastReviewedDate: "2025-07-26",
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
    lastReviewedDate: "2025-07-26",
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
    lastReviewedDate: "2025-07-26",
  },

  glp1_reflux_smaller_meals: {
    ruleId: "glp1_reflux_smaller_meals",
    description:
      "Reflux/dyspepsia is managed with smaller portions and avoidance of acidic or heavily spiced foods.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025", "AGA_GI_MANAGEMENT"],
    evidenceLevel: "fda_label",
    reviewStatus: "approved",
    lastReviewedDate: "2025-07-26",
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
    lastReviewedDate: "2025-07-26",
    governanceNote:
      "FDA prescribing information §5.1 and §6.1 explicitly warn about vomiting as a risk factor for dehydration and acute kidney injury and state that patients should contact their healthcare provider. Escalation wording must be reviewed by a clinician before production deployment.",
  },

  glp1_dehydration_difficulty_escalate: {
    ruleId: "glp1_dehydration_difficulty_escalate",
    description:
      "Moderate or severe difficulty staying hydrated combined with any GI symptom triggers an escalation message.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025", "FDA_TIRZEPATIDE_PI_2025"],
    evidenceLevel: "fda_label",
    reviewStatus: "approved",
    lastReviewedDate: "2025-07-26",
    governanceNote:
      "Escalation is based on symptom type (vomiting + hydration difficulty), not on a count of symptoms. The removed '3 severe symptoms = escalate' rule had no clinical source and has been superseded by this rule.",
  },

  // ── TREATMENT PHASE MULTIPLIERS (PENDING REVIEW) ──────────────────────────

  glp1_intro_phase_calorie_multiplier: {
    ruleId: "glp1_intro_phase_calorie_multiplier",
    description:
      "During the intro/up-titration treatment phase, meal calorie allocation is scaled by 0.82× to account for initial GI intolerance and appetite suppression.",
    sourceIds: [],
    evidenceLevel: "uncited",
    reviewStatus: "pending_review",
    lastReviewedDate: "2025-07-26",
    governanceNote:
      "The direction (smaller portions during intro) is supported by PMID_36614945. The specific coefficient (0.82×) has no peer-reviewed source — it is a conservative engineering estimate. This value must be reviewed by a registered dietitian or physician before reaching non-provider-configured users. Until reviewed, the 400 kcal static fallback is preferred when no macro target exists.",
  },

  glp1_appetite_suppressed_multiplier: {
    ruleId: "glp1_appetite_suppressed_multiplier",
    description:
      "When appetite is reported as suppressed, meal calorie allocation is scaled by 0.80×.",
    sourceIds: ["FDA_SEMAGLUTIDE_PI_2025"],
    evidenceLevel: "uncited",
    reviewStatus: "pending_review",
    lastReviewedDate: "2025-07-26",
    governanceNote:
      "Appetite suppression is FDA-documented as a common adverse reaction. The directional adjustment (lower calories when appetite is suppressed) is clinically sound. The specific coefficient (0.80×) is an engineering estimate without a peer-reviewed source. Pending RD review.",
  },

  // ── REMOVED RULES — DO NOT IMPLEMENT ─────────────────────────────────────

  glp1_portionScale_0_65: {
    ruleId: "glp1_portionScale_0_65",
    description: "REMOVED — hardcoded 65% calorie reduction for nausea.",
    sourceIds: [],
    evidenceLevel: "uncited",
    reviewStatus: "removed",
    lastReviewedDate: "2025-07-26",
    governanceNote:
      "No clinical source. Replaced by directional flag glp1_smaller_portions. This specific coefficient must not appear in any resolver.",
  },

  glp1_maxFatAdjustmentG_minus5: {
    ruleId: "glp1_maxFatAdjustmentG_minus5",
    description: "REMOVED — automatic -5g fat reduction beyond provider cap.",
    sourceIds: [],
    evidenceLevel: "uncited",
    reviewStatus: "removed",
    lastReviewedDate: "2025-07-26",
    governanceNote:
      "No clinical source. Fat ceiling is now provider-configurable via guardrails. Directional flag glp1_lower_fat is the replacement.",
  },

  glp1_three_symptoms_escalate: {
    ruleId: "glp1_three_symptoms_escalate",
    description: "REMOVED — 3 severe symptoms triggers escalation.",
    sourceIds: [],
    evidenceLevel: "uncited",
    reviewStatus: "removed",
    lastReviewedDate: "2025-07-26",
    governanceNote:
      "No source for symptom count threshold. Replaced by glp1_vomiting_escalate and glp1_dehydration_difficulty_escalate, which trigger on symptom type, not count.",
  },

  glp1_48h_injection_window: {
    ruleId: "glp1_48h_injection_window",
    description: "REMOVED — automatic 48-hour post-injection dietary restriction window.",
    sourceIds: [],
    evidenceLevel: "uncited",
    reviewStatus: "removed",
    lastReviewedDate: "2025-07-26",
    governanceNote:
      "No source. Individual pharmacokinetics vary by medication (Ozempic peaks ~72h, Mounjaro ~8–72h by dose) and patient. A universal 48-hour window is not supportable. The shot tracker can prompt the daily tolerance check-in without imposing automatic restrictions.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns only rules that are approved for production use */
export function getApprovedRules(): ClinicalRule[] {
  return Object.values(RULE_REGISTRY).filter(r => r.reviewStatus === "approved");
}

/** Returns rules that need clinical review before going to production */
export function getPendingReviewRules(): ClinicalRule[] {
  return Object.values(RULE_REGISTRY).filter(r => r.reviewStatus === "pending_review");
}

/** Returns all sources that back a given ruleId */
export function getSourcesForRule(ruleId: string): ClinicalSource[] {
  const rule = RULE_REGISTRY[ruleId];
  if (!rule) return [];
  return rule.sourceIds
    .map(id => SOURCE_CATALOG[id])
    .filter(Boolean);
}

/** Returns all ruleIds that cite a given sourceId */
export function getRulesForSource(sourceId: string): ClinicalRule[] {
  return Object.values(RULE_REGISTRY).filter(r => r.sourceIds.includes(sourceId));
}
