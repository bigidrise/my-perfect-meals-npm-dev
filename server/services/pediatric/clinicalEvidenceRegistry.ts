/**
 * clinicalEvidenceRegistry.ts
 *
 * Versioned evidence records for each pediatric protocol block.
 * Each record links a condition ID to its clinical source authorities,
 * version, effective date, scheduled review date, and approval status.
 *
 * Sources: AAP (American Academy of Pediatrics), CDC, NIH, AND (Academy
 * of Nutrition and Dietetics), NASPGHAN (North American Society for Pediatric
 * Gastroenterology, Hepatology, and Nutrition).
 *
 * Status lifecycle:
 *   approved        → in production use, passed clinical review
 *   pending_review  → due for update or awaiting re-review
 *   deprecated      → superseded; remove from active injection
 */

export type EvidenceSource =
  | "AAP"
  | "CDC"
  | "NIH"
  | "AND"
  | "NASPGHAN"
  | "ADA"     // American Diabetes Association
  | "AHA"     // American Heart Association (cardiac/sodium)
  | "KDOQI"   // Kidney disease guidelines
  | "CFF"     // Cystic Fibrosis Foundation
  | "ACR"     // American College of Rheumatology (JIA/Lupus)
  | "CCFA"    // Crohn's and Colitis Foundation
  | "USDA"    // Dietary Guidelines for Americans
  | "WHO";    // World Health Organization

export type EvidenceStatus = "approved" | "pending_review" | "deprecated";

export interface PediatricProtocolEvidence {
  /** Matches conditionId in PediatricProtocolBlock */
  conditionId: string;
  /** Human-readable name for logging/admin UI */
  conditionName: string;
  /** Primary clinical authority sources */
  sources: EvidenceSource[];
  /** Secondary references (links or citation strings) */
  references: string[];
  /** Protocol version — bump when guidance changes */
  version: string;
  /** When this version became active */
  effectiveDate: string; // ISO date YYYY-MM-DD
  /** When this should be re-reviewed */
  reviewDate: string;    // ISO date YYYY-MM-DD
  /** Current approval status */
  status: EvidenceStatus;
  /** Clinical notes visible to audit/admin only — never injected into AI prompt */
  internalNotes?: string;
}

export const CLINICAL_EVIDENCE_REGISTRY: PediatricProtocolEvidence[] = [
  // ── Tier 1 — Hard stops ──────────────────────────────────────────────────
  {
    conditionId: "pku",
    conditionName: "Phenylketonuria (PKU)",
    sources: ["AAP", "NIH", "AND"],
    references: [
      "NIH National PKU Alliance — Nutrition Management Guidelines for PKU (2021)",
      "AAP Clinical Report: Phenylketonuria and Other Hyperphenylalaninemias",
      "AND Pediatric Nutrition Care Manual — PKU and Metabolic Disorders",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2027-01-01",
    status: "approved",
    internalNotes:
      "PKU requires individual phenylalanine tolerance calculation by a metabolic dietitian. " +
      "Standard recipe generation is categorically unsafe. Hard stop — no meal generation.",
  },
  {
    conditionId: "g_tube",
    conditionName: "G-Tube / Enteral Feeding",
    sources: ["AAP", "AND", "NASPGHAN"],
    references: [
      "NASPGHAN Position Paper on Enteral Nutrition in Infants and Children",
      "AND Pediatric Nutrition Care Manual — Enteral Nutrition",
      "AAP Guidance on Home Enteral Nutrition for Pediatric Patients",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2027-01-01",
    status: "approved",
    internalNotes:
      "Enteral-fed children may or may not have any oral feeding clearance. " +
      "Meal generation without clinician oral-feeding clearance is unsafe. Hard stop.",
  },
  // ── Tier 3–5 — Medical condition protocols ───────────────────────────────
  {
    conditionId: "t1d",
    conditionName: "Type 1 Diabetes (Pediatric)",
    sources: ["AAP", "ADA", "AND"],
    references: [
      "ADA Standards of Medical Care in Diabetes — Children and Adolescents (2024)",
      "AAP Clinical Practice Guideline on Pediatric Diabetes Management",
      "AND Pediatric Nutrition Care Manual — Diabetes",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-01-01",
    status: "approved",
    internalNotes: "Carbohydrate counting guidance. CGM prevalence means carb awareness (not restriction) is the primary tool.",
  },
  {
    conditionId: "t2d",
    conditionName: "Type 2 Diabetes / Prediabetes (Pediatric)",
    sources: ["AAP", "ADA", "AND"],
    references: [
      "AAP Clinical Practice Guideline for Screening and Treatment of Children and Adolescents with Obesity",
      "ADA Standards of Care — Youth-Onset Type 2 Diabetes (2024)",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-01-01",
    status: "approved",
    internalNotes: "Focus on whole-food, low-glycemic-index eating. Weight-neutral language required.",
  },
  {
    conditionId: "celiac",
    conditionName: "Celiac Disease (Confirmed — biopsy or serology)",
    sources: ["AAP", "NASPGHAN", "AND"],
    references: [
      "NASPGHAN Revised Criteria for Diagnosis of Celiac Disease (2012)",
      "AAP Celiac Disease in Pediatrics — clinical report",
      "AND Evidence-Based Nutrition Practice Guideline on Celiac Disease",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
    internalNotes: "Strict gluten elimination is the ONLY treatment. No 'low-gluten' option is acceptable.",
  },
  {
    conditionId: "ncgs",
    conditionName: "Non-Celiac Gluten Sensitivity",
    sources: ["NASPGHAN", "AAP"],
    references: [
      "NASPGHAN Position Statement on Non-Celiac Gluten Sensitivity in Children (2016)",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
    internalNotes: "Evidence weaker than celiac. Gluten avoidance still clinically appropriate pending further workup.",
  },
  {
    conditionId: "ckd",
    conditionName: "Chronic Kidney Disease (Pediatric)",
    sources: ["AAP", "KDOQI", "AND"],
    references: [
      "KDOQI Clinical Practice Guidelines for Nutrition in CKD — Pediatric Supplement (2020)",
      "AAP Section on Nephrology — CKD Nutrition Guidance",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-01-01",
    status: "approved",
    internalNotes: "Phosphorus and potassium guidance varies by CKD stage. Generic limits applied without lab values.",
  },
  {
    conditionId: "liver_disease",
    conditionName: "Pediatric Liver Disease (Cholestasis / NAFLD / Cirrhosis)",
    sources: ["NASPGHAN", "AAP", "AND"],
    references: [
      "NASPGHAN Clinical Report on Pediatric NAFLD (2022)",
      "AND Pediatric Nutrition Care Manual — Liver Disease",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
  },
  {
    conditionId: "cystic_fibrosis",
    conditionName: "Cystic Fibrosis",
    sources: ["CFF", "AAP", "AND"],
    references: [
      "CFF Evidence-Based Nutritional Guidelines for Cystic Fibrosis (2016 update)",
      "AAP Cystic Fibrosis and Nutrition — clinical care guidance",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-01-01",
    status: "approved",
    internalNotes: "Calorie density is uniquely high for CF — opposite of obesity guidance. Enzyme replacement therapy required with meals.",
  },
  {
    conditionId: "crohns",
    conditionName: "Crohn's Disease (Pediatric)",
    sources: ["NASPGHAN", "CCFA", "AND"],
    references: [
      "NASPGHAN Clinical Report: Nutrition in Pediatric Inflammatory Bowel Disease (2019)",
      "CCFA Nutritional Recommendations for Crohn's Disease",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
    internalNotes: "Guidance varies significantly by disease activity/flare vs. remission. Using remission defaults here.",
  },
  {
    conditionId: "uc",
    conditionName: "Ulcerative Colitis (Pediatric)",
    sources: ["NASPGHAN", "CCFA", "AND"],
    references: [
      "NASPGHAN Clinical Report: Nutrition in Pediatric Inflammatory Bowel Disease (2019)",
      "CCFA Nutritional Recommendations for Ulcerative Colitis",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
  },
  {
    conditionId: "jia",
    conditionName: "Juvenile Idiopathic Arthritis",
    sources: ["ACR", "AAP", "AND"],
    references: [
      "ACR 2022 American College of Rheumatology Guideline for the Treatment of JIA",
      "AND Pediatric Nutrition Care Manual — Rheumatologic Conditions",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
    internalNotes: "Anti-inflammatory dietary pattern. Calcium/Vit D emphasized due to steroid use risk.",
  },
  {
    conditionId: "lupus",
    conditionName: "Pediatric Systemic Lupus Erythematosus",
    sources: ["ACR", "AAP", "AND"],
    references: [
      "ACR Guidelines for Lupus in Children",
      "AND Pediatric Nutrition Care Manual — Autoimmune Conditions",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
  },
  {
    conditionId: "iron_deficiency",
    conditionName: "Iron Deficiency Anemia (Pediatric)",
    sources: ["AAP", "CDC", "AND"],
    references: [
      "AAP Clinical Report on Diagnosis and Prevention of Iron Deficiency Anemia (2010, updated)",
      "CDC Recommendations to Prevent and Control Iron Deficiency in the US",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
  },
  {
    conditionId: "failure_to_thrive",
    conditionName: "Pediatric Undernutrition / Failure to Thrive",
    sources: ["AAP", "AND", "WHO"],
    references: [
      "AAP Clinical Report on Pediatric Undernutrition (2021)",
      "WHO Child Growth Standards — clinical application",
      "AND Pediatric Nutrition Care Manual — Failure to Thrive",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-01-01",
    status: "approved",
    internalNotes: "Caloric density is the priority. Weight-neutral language still required — no labeling.",
  },
  {
    conditionId: "pediatric_obesity",
    conditionName: "Pediatric Obesity / Overweight",
    sources: ["AAP", "AHA", "AND", "CDC"],
    references: [
      "AAP Clinical Practice Guideline for the Evaluation and Treatment of Children and Adolescents with Obesity (2023)",
      "AHA Dietary Recommendations for Children with Obesity",
      "AND Evidence Analysis Library — Pediatric Overweight",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
    internalNotes: "Weight-neutral, whole-food approach. Never use diet culture language. Focus on nutrient quality, not restriction.",
  },
  {
    conditionId: "underweight",
    conditionName: "Pediatric Underweight (Non-FTT — growth monitoring context)",
    sources: ["AAP", "AND", "CDC"],
    references: [
      "CDC Growth Charts — BMI-for-age interpretation",
      "AND Pediatric Nutrition Care Manual — Underweight",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
  },
  {
    conditionId: "adhd_eating",
    conditionName: "ADHD — Eating Pattern Support",
    sources: ["AAP", "AND"],
    references: [
      "AAP Clinical Practice Guideline for ADHD — updated 2019",
      "AND Position Statement: Nutrition Intervention in ADHD",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
    internalNotes: "Evidence is moderate. Iron and omega-3 data strongest. Avoid making bold treatment claims.",
  },
  {
    conditionId: "autism_sensory",
    conditionName: "Autism Spectrum Disorder — Sensory Eating",
    sources: ["AAP", "AND"],
    references: [
      "AAP Position Statement on Feeding Difficulties in Autism",
      "AND Autism and Nutrition Intervention Practice Guidance",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
    internalNotes: "Texture and sensory concerns dominate. Nutritional adequacy without pressure tactics.",
  },
  {
    conditionId: "dysphagia",
    conditionName: "Feeding Disorder / Dysphagia",
    sources: ["AAP", "AND", "NASPGHAN"],
    references: [
      "ASHA (American Speech-Language-Hearing Association) Dysphagia Practice Guidelines",
      "AND Pediatric Nutrition Care Manual — Dysphagia",
      "NASPGHAN Position Paper on Feeding Difficulties in Infants and Children",
    ],
    version: "1.0.0",
    effectiveDate: "2025-01-01",
    reviewDate: "2026-06-01",
    status: "approved",
    internalNotes: "IDDSI framework referenced. Clinician-prescribed texture level supersedes all other guidance.",
  },
];

/** Map for O(1) lookup by conditionId */
export const EVIDENCE_BY_CONDITION_ID: Map<string, PediatricProtocolEvidence> =
  new Map(CLINICAL_EVIDENCE_REGISTRY.map(e => [e.conditionId, e]));

/** Returns only approved protocols — deprecated/pending ones are excluded from injection */
export function getApprovedProtocolIds(): Set<string> {
  return new Set(
    CLINICAL_EVIDENCE_REGISTRY
      .filter(e => e.status === "approved")
      .map(e => e.conditionId)
  );
}
