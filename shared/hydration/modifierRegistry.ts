import {
  HYDRATION_MODIFIER_AUTHORITIES,
  HYDRATION_MODIFIER_EFFECTS,
  HYDRATION_MODIFIER_METRICS,
  HYDRATION_MODIFIER_SOURCES,
  HYDRATION_MODIFIER_STATUSES,
  type HydrationModifierAuthority,
  type HydrationModifierEffect,
  type HydrationModifierInput,
  type HydrationModifierMetric,
  type HydrationModifierSource,
  type HydrationModifierStatus,
  type HydrationRegistryProvenance,
} from "./contracts";
import { hydrationRegistryClaimInputSchema } from "./modifierSchemas";

export const HYDRATION_MODIFIER_REGISTRY_VERSION =
  "hydration-clinical-modifier-registry-v1";

export const HYDRATION_MODIFIER_FAMILIES = [
  "cardiovascular",
  "renal",
  "dysautonomia",
  "bariatric",
  "gastrointestinal",
  "metabolic_endocrine",
  "medication_treatment",
  "life_stage",
  "performance_environment",
  "acute_fluid_loss",
] as const;
export type HydrationModifierFamily =
  (typeof HYDRATION_MODIFIER_FAMILIES)[number];

export const HYDRATION_REGISTRY_GOVERNANCE_MODES = [
  "context_only",
  "actionable_later",
  "restriction_oriented",
  "review_required",
] as const;
export type HydrationRegistryGovernanceMode =
  (typeof HYDRATION_REGISTRY_GOVERNANCE_MODES)[number];

export const HYDRATION_REGISTRY_DIMENSIONS = [
  "fluid_need",
  "fluid_restriction",
  "sodium_electrolyte_relevance",
  "intake_tolerance",
  "timing",
  "fluid_loss_risk",
  "monitoring_context",
] as const;
export type HydrationRegistryDimension =
  (typeof HYDRATION_REGISTRY_DIMENSIONS)[number];

export const HYDRATION_REGISTRY_SAFETY_DOMAINS = [
  "cardiac",
  "renal",
  "sodium_electrolyte",
  "fluid_restriction",
  "pregnancy",
  "medication",
  "gastrointestinal",
  "pediatric",
  "dysautonomia",
  "performance",
  "dehydration_risk",
] as const;
export type HydrationRegistrySafetyDomain =
  (typeof HYDRATION_REGISTRY_SAFETY_DOMAINS)[number];

export const HYDRATION_REGISTRY_PROVENANCE_REQUIREMENTS = [
  "source_record",
  "source_timestamp",
  "authority_identity",
  "protocol_revision",
  "population_context",
] as const;
export type HydrationRegistryProvenanceRequirement =
  (typeof HYDRATION_REGISTRY_PROVENANCE_REQUIREMENTS)[number];

export type HydrationModifierRegistryEntry = Readonly<{
  id: string;
  name: string;
  family: HydrationModifierFamily;
  applicableContext: string;
  allowedSources: readonly HydrationModifierSource[];
  requiredAuthorities: readonly HydrationModifierAuthority[];
  governanceMode: HydrationRegistryGovernanceMode;
  defaultEffect: HydrationModifierEffect;
  allowedEffects: readonly HydrationModifierEffect[];
  dimensions: readonly HydrationRegistryDimension[];
  allowedMetrics: readonly HydrationModifierMetric[];
  safetyDomains: readonly HydrationRegistrySafetyDomain[];
  conflictDomains: readonly HydrationRegistrySafetyDomain[];
  provenanceRequirements: readonly HydrationRegistryProvenanceRequirement[];
  policyVersion: string;
  status: "active" | "inactive";
  resolverModifierType: string;
}>;

export type HydrationRegistryClaimInput = Readonly<{
  definitionId: string;
  instanceId: string;
  source: HydrationModifierSource;
  sourceId: string;
  authority: HydrationModifierAuthority;
  policyVersion: string;
  effect?: HydrationModifierEffect;
  metric?: HydrationModifierMetric;
  rationaleCode?: string;
  status?: HydrationModifierStatus;
  hardStop?: boolean;
  contextKey?: string;
  provenance: HydrationRegistryProvenance;
}>;

export class HydrationModifierRegistryError extends Error {
  constructor(
    public readonly code:
      | "DUPLICATE_ID"
      | "UNKNOWN_DEFINITION"
      | "INACTIVE_DEFINITION"
      | "POLICY_VERSION_MISMATCH"
      | "SOURCE_NOT_ALLOWED"
      | "AUTHORITY_NOT_ALLOWED"
      | "EFFECT_NOT_ALLOWED"
      | "METRIC_NOT_ALLOWED"
      | "PROVENANCE_INCOMPLETE"
      | "INVALID_CLAIM",
    message: string,
  ) {
    super(message);
    this.name = "HydrationModifierRegistryError";
  }
}

const common = {
  policyVersion: HYDRATION_MODIFIER_REGISTRY_VERSION,
  status: "active" as const,
};

function makeEntry(
  definition: Omit<HydrationModifierRegistryEntry, "policyVersion" | "status"> &
    Partial<Pick<HydrationModifierRegistryEntry, "status" | "policyVersion">>,
): HydrationModifierRegistryEntry {
  return {
    ...common,
    ...definition,
  };
}

const entry = makeEntry;

const CONTEXT_ONLY: Pick<
  HydrationModifierRegistryEntry,
  "governanceMode" | "defaultEffect" | "allowedEffects"
> = {
  governanceMode: "context_only",
  defaultEffect: "context_only",
  allowedEffects: ["context_only"],
};

const ACTIONABLE_LATER: Pick<
  HydrationModifierRegistryEntry,
  "governanceMode" | "defaultEffect" | "allowedEffects"
> = {
  governanceMode: "actionable_later",
  defaultEffect: "context_only",
  allowedEffects: ["context_only", "supports", "requires_review"],
};

const RESTRICTION_ORIENTED: Pick<
  HydrationModifierRegistryEntry,
  "governanceMode" | "defaultEffect" | "allowedEffects"
> = {
  governanceMode: "restriction_oriented",
  defaultEffect: "context_only",
  allowedEffects: ["context_only", "limits", "blocks", "requires_review"],
};

const REVIEW_REQUIRED: Pick<
  HydrationModifierRegistryEntry,
  "governanceMode" | "defaultEffect" | "allowedEffects"
> = {
  governanceMode: "review_required",
  defaultEffect: "requires_review",
  allowedEffects: ["context_only", "requires_review"],
};

const CARDIAC = ["cardiac"] as const;
const RENAL = ["renal"] as const;
const GI = ["gastrointestinal"] as const;
const PERFORMANCE = ["performance"] as const;
const CLINICIAN = ["clinician_directive"] as const;
const CONDITION = ["condition"] as const;
const MEDICATION = ["medication"] as const;
const BUILDER = ["builder"] as const;
const MANUAL = ["manual", "import"] as const;

const REGISTRY_ENTRIES: readonly HydrationModifierRegistryEntry[] = [
  makeEntry({
    id: "cardiovascular.heart_failure",
    name: "Heart failure context",
    family: "cardiovascular",
    applicableContext: "Heart failure or related cardiac fluid-management context",
    allowedSources: [...CONDITION, ...CLINICIAN],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_restriction", "sodium_electrolyte_relevance", "monitoring_context"],
    allowedMetrics: ["fluid", "sodium", "electrolyte", "general"],
    safetyDomains: CARDIAC,
    conflictDomains: ["fluid_restriction", "renal", "sodium_electrolyte"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "heart_failure",
  }),
  makeEntry({
    id: "cardiovascular.clinician_fluid_restriction",
    name: "Clinician-directed fluid restriction",
    family: "cardiovascular",
    applicableContext: "A clinician-defined cardiac or general fluid restriction",
    allowedSources: CLINICIAN,
    requiredAuthorities: ["clinician"],
    ...RESTRICTION_ORIENTED,
    dimensions: ["fluid_restriction", "monitoring_context"],
    allowedMetrics: ["fluid", "general"],
    safetyDomains: ["fluid_restriction", ...CARDIAC],
    conflictDomains: ["fluid_restriction", "performance", "dysautonomia"],
    provenanceRequirements: ["source_record", "source_timestamp", "authority_identity", "protocol_revision"],
    resolverModifierType: "fluid_restriction",
  }),
  entry({
    id: "cardiovascular.cardiac_review",
    name: "Cardiac fluid or sodium review context",
    family: "cardiovascular",
    applicableContext: "Cardiac condition where fluid or sodium changes require review",
    allowedSources: [...CONDITION, ...CLINICIAN],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_restriction", "sodium_electrolyte_relevance", "monitoring_context"],
    allowedMetrics: ["fluid", "sodium", "electrolyte", "general"],
    safetyDomains: ["cardiac", "fluid_restriction", "sodium_electrolyte"],
    conflictDomains: ["cardiac", "fluid_restriction", "sodium_electrolyte"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "cardiac_review",
  }),
  entry({
    id: "renal.chronic_kidney_disease",
    name: "Chronic kidney disease context",
    family: "renal",
    applicableContext: "Chronic kidney disease context without an inferred fluid prescription",
    allowedSources: [...CONDITION, ...CLINICIAN],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_restriction", "sodium_electrolyte_relevance", "monitoring_context"],
    allowedMetrics: ["fluid", "sodium", "electrolyte", "general"],
    safetyDomains: RENAL,
    conflictDomains: ["renal", "fluid_restriction", "sodium_electrolyte"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "chronic_kidney_disease",
  }),
  entry({
    id: "renal.dialysis",
    name: "Dialysis context",
    family: "renal",
    applicableContext: "Dialysis treatment context requiring clinician-governed hydration review",
    allowedSources: [...CONDITION, ...CLINICIAN],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_restriction", "sodium_electrolyte_relevance", "monitoring_context"],
    allowedMetrics: ["fluid", "sodium", "electrolyte", "general"],
    safetyDomains: RENAL,
    conflictDomains: ["renal", "fluid_restriction", "sodium_electrolyte"],
    provenanceRequirements: ["source_record", "source_timestamp", "authority_identity"],
    resolverModifierType: "dialysis",
  }),
  entry({
    id: "renal.fluid_restriction",
    name: "Renal fluid restriction",
    family: "renal",
    applicableContext: "Renal fluid restriction",
    allowedSources: CLINICIAN,
    requiredAuthorities: ["organ_safety"],
    ...RESTRICTION_ORIENTED,
    dimensions: ["fluid_restriction", "monitoring_context"],
    allowedMetrics: ["fluid", "general"],
    safetyDomains: ["renal", "fluid_restriction"],
    conflictDomains: ["renal", "fluid_restriction", "performance", "dysautonomia"],
    provenanceRequirements: ["source_record", "source_timestamp", "authority_identity", "protocol_revision"],
    resolverModifierType: "fluid_restriction",
  }),
  entry({
    id: "renal.sodium_electrolyte_restriction",
    name: "Renal sodium/electrolyte restriction",
    family: "renal",
    applicableContext: "Renal sodium or electrolyte restriction",
    allowedSources: CLINICIAN,
    requiredAuthorities: ["organ_safety"],
    ...RESTRICTION_ORIENTED,
    dimensions: ["sodium_electrolyte_relevance", "monitoring_context"],
    allowedMetrics: ["sodium", "electrolyte", "general"],
    safetyDomains: ["renal", "sodium_electrolyte"],
    conflictDomains: ["renal", "sodium_electrolyte", "dysautonomia"],
    provenanceRequirements: ["source_record", "source_timestamp", "authority_identity", "protocol_revision"],
    resolverModifierType: "sodium_restriction",
  }),
  entry({
    id: "dysautonomia.pots",
    name: "POTS context",
    family: "dysautonomia",
    applicableContext: "Self-reported or otherwise non-protocol POTS context",
    allowedSources: [...CONDITION, ...MANUAL],
    requiredAuthorities: ["condition_overlay", "user_preference"],
    ...CONTEXT_ONLY,
    dimensions: ["monitoring_context", "timing", "fluid_loss_risk"],
    allowedMetrics: ["fluid", "sodium", "electrolyte", "timing", "general"],
    safetyDomains: ["dysautonomia"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "sodium_electrolyte", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "pots",
  }),
  entry({
    id: "dysautonomia.pots_clinician_protocol",
    name: "Clinician-defined POTS hydration protocol",
    family: "dysautonomia",
    applicableContext: "Clinician-defined POTS hydration or sodium protocol",
    allowedSources: CLINICIAN,
    requiredAuthorities: ["clinician"],
    ...ACTIONABLE_LATER,
    dimensions: ["fluid_need", "sodium_electrolyte_relevance", "timing", "monitoring_context"],
    allowedMetrics: ["fluid", "sodium", "electrolyte", "timing", "general"],
    safetyDomains: ["dysautonomia"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "sodium_electrolyte", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp", "authority_identity", "protocol_revision"],
    resolverModifierType: "pots",
  }),
  entry({
    id: "bariatric.preoperative_liquid_diet",
    name: "Bariatric pre-operative liquid diet",
    family: "bariatric",
    applicableContext: "Pre-operative bariatric liquid-diet stage",
    allowedSources: [...CONDITION, ...CLINICIAN, ...BUILDER],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...CONTEXT_ONLY,
    dimensions: ["intake_tolerance", "timing", "monitoring_context"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["gastrointestinal"],
    conflictDomains: ["fluid_restriction", "gastrointestinal", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp", "population_context"],
    resolverModifierType: "bariatric_liquid_stage",
  }),
  entry({
    id: "bariatric.postoperative_stage",
    name: "Bariatric post-operative stage",
    family: "bariatric",
    applicableContext: "Post-operative bariatric diet stage",
    allowedSources: [...CONDITION, ...CLINICIAN, ...BUILDER],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...CONTEXT_ONLY,
    dimensions: ["intake_tolerance", "timing", "monitoring_context"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["gastrointestinal"],
    conflictDomains: ["fluid_restriction", "gastrointestinal", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp", "population_context"],
    resolverModifierType: "bariatric_liquid_stage",
  }),
  entry({
    id: "bariatric.clear_liquid_diet",
    name: "Clear-liquid diet",
    family: "bariatric",
    applicableContext: "Clear-liquid diet protocol",
    allowedSources: [...CONDITION, ...CLINICIAN, ...BUILDER],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...CONTEXT_ONLY,
    dimensions: ["intake_tolerance", "timing"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["gastrointestinal"],
    conflictDomains: ["fluid_restriction", "gastrointestinal"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "liquid_diet",
  }),
  entry({
    id: "bariatric.full_liquid_diet",
    name: "Full-liquid diet",
    family: "bariatric",
    applicableContext: "Full-liquid diet protocol",
    allowedSources: [...CONDITION, ...CLINICIAN, ...BUILDER],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...CONTEXT_ONLY,
    dimensions: ["intake_tolerance", "timing"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["gastrointestinal"],
    conflictDomains: ["fluid_restriction", "gastrointestinal"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "liquid_diet",
  }),
  entry({
    id: "bariatric.temporary_medical_liquid_protocol",
    name: "Temporary medically prescribed liquid protocol",
    family: "bariatric",
    applicableContext: "Temporary medically prescribed liquid-diet protocol",
    allowedSources: CLINICIAN,
    requiredAuthorities: ["clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["intake_tolerance", "timing", "monitoring_context"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["gastrointestinal", "medication"],
    conflictDomains: ["fluid_restriction", "gastrointestinal", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp", "authority_identity", "protocol_revision"],
    resolverModifierType: "medical_liquid_protocol",
  }),
  entry({
    id: "bariatric.reduced_intake_tolerance",
    name: "Reduced intake/tolerance context",
    family: "bariatric",
    applicableContext: "Reduced intake or tolerance during a staged diet",
    allowedSources: [...CONDITION, ...CLINICIAN, ...BUILDER],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["intake_tolerance", "monitoring_context"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["gastrointestinal"],
    conflictDomains: ["fluid_restriction", "gastrointestinal", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "reduced_intake_tolerance",
  }),
  entry({
    id: "gastrointestinal.vomiting",
    name: "Vomiting fluid-loss context",
    family: "gastrointestinal",
    applicableContext: "Vomiting with possible fluid-loss or intake-tolerance impact",
    allowedSources: [...CONDITION, ...MANUAL],
    requiredAuthorities: ["condition_overlay", "user_preference"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_loss_risk", "intake_tolerance", "monitoring_context"],
    allowedMetrics: ["fluid", "electrolyte", "general"],
    safetyDomains: ["gastrointestinal", "dehydration_risk"],
    conflictDomains: ["fluid_restriction", "gastrointestinal", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "vomiting",
  }),
  entry({
    id: "gastrointestinal.diarrhea",
    name: "Diarrhea fluid-loss context",
    family: "gastrointestinal",
    applicableContext: "Diarrhea with possible fluid-loss or intake-tolerance impact",
    allowedSources: [...CONDITION, ...MANUAL],
    requiredAuthorities: ["condition_overlay", "user_preference"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_loss_risk", "intake_tolerance", "monitoring_context"],
    allowedMetrics: ["fluid", "electrolyte", "general"],
    safetyDomains: ["gastrointestinal", "dehydration_risk"],
    conflictDomains: ["fluid_restriction", "gastrointestinal", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "diarrhea",
  }),
  entry({
    id: "gastrointestinal.ostomy_high_output",
    name: "Ostomy/high-output context",
    family: "gastrointestinal",
    applicableContext: "Ostomy or high-output gastrointestinal loss context",
    allowedSources: [...CONDITION, ...CLINICIAN],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_loss_risk", "sodium_electrolyte_relevance", "monitoring_context"],
    allowedMetrics: ["fluid", "sodium", "electrolyte", "general"],
    safetyDomains: ["gastrointestinal", "dehydration_risk", "sodium_electrolyte"],
    conflictDomains: ["fluid_restriction", "gastrointestinal", "sodium_electrolyte"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "ostomy_high_output",
  }),
  entry({
    id: "gastrointestinal.short_bowel_malabsorption",
    name: "Short-bowel/malabsorption context",
    family: "gastrointestinal",
    applicableContext: "Short-bowel or clinically significant malabsorption context",
    allowedSources: [...CONDITION, ...CLINICIAN],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_loss_risk", "intake_tolerance", "sodium_electrolyte_relevance", "monitoring_context"],
    allowedMetrics: ["fluid", "sodium", "electrolyte", "general"],
    safetyDomains: ["gastrointestinal", "dehydration_risk", "sodium_electrolyte"],
    conflictDomains: ["fluid_restriction", "gastrointestinal", "sodium_electrolyte"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "short_bowel_malabsorption",
  }),
  entry({
    id: "metabolic_endocrine.diabetes",
    name: "Diabetes context",
    family: "metabolic_endocrine",
    applicableContext: "Diabetes context without inferred hydration treatment",
    allowedSources: [...CONDITION, ...CLINICIAN, ...BUILDER],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...CONTEXT_ONLY,
    dimensions: ["monitoring_context", "fluid_loss_risk"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["dehydration_risk", "medication"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "diabetes",
  }),
  entry({
    id: "metabolic_endocrine.hyperglycemia_dehydration_risk",
    name: "Hyperglycemia/dehydration-risk context",
    family: "metabolic_endocrine",
    applicableContext: "Significant hyperglycemia or dehydration-risk context",
    allowedSources: [...CONDITION, ...CLINICIAN],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_loss_risk", "monitoring_context"],
    allowedMetrics: ["fluid", "general"],
    safetyDomains: ["dehydration_risk", "renal"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "hyperglycemia_dehydration_risk",
  }),
  entry({
    id: "metabolic_endocrine.diabetes_insipidus",
    name: "Diabetes insipidus context",
    family: "metabolic_endocrine",
    applicableContext: "Diabetes insipidus context requiring clinical review",
    allowedSources: [...CONDITION, ...CLINICIAN],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_loss_risk", "monitoring_context"],
    allowedMetrics: ["fluid", "electrolyte", "general"],
    safetyDomains: ["dehydration_risk", "renal"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "diabetes_insipidus",
  }),
  entry({
    id: "metabolic_endocrine.other_endocrine_review",
    name: "Other governed endocrine review context",
    family: "metabolic_endocrine",
    applicableContext: "Endocrine context explicitly approved for Hydration representation",
    allowedSources: CLINICIAN,
    requiredAuthorities: ["clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["monitoring_context"],
    allowedMetrics: ["general"],
    safetyDomains: ["dehydration_risk"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp", "authority_identity", "protocol_revision"],
    resolverModifierType: "endocrine_review",
  }),
  entry({
    id: "medication_treatment.glp1_therapy",
    name: "GLP-1 therapy context",
    family: "medication_treatment",
    applicableContext: "GLP-1 therapy context",
    allowedSources: [...MEDICATION, ...CLINICIAN, ...BUILDER],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...CONTEXT_ONLY,
    dimensions: ["intake_tolerance", "timing", "monitoring_context"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["medication", "gastrointestinal"],
    conflictDomains: ["fluid_restriction", "gastrointestinal", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "glp1_therapy",
  }),
  entry({
    id: "medication_treatment.diuretic_therapy",
    name: "Diuretic therapy context",
    family: "medication_treatment",
    applicableContext: "Diuretic therapy context",
    allowedSources: [...MEDICATION, ...CLINICIAN],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_loss_risk", "timing", "monitoring_context"],
    allowedMetrics: ["fluid", "electrolyte", "timing", "general"],
    safetyDomains: ["medication", "renal", "sodium_electrolyte"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "sodium_electrolyte"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "diuretic_therapy",
  }),
  entry({
    id: "medication_treatment.treatment_nausea_vomiting_diarrhea",
    name: "Treatment-related GI fluid-loss context",
    family: "medication_treatment",
    applicableContext: "Treatment-related nausea, vomiting, or diarrhea",
    allowedSources: [...MEDICATION, ...CLINICIAN],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_loss_risk", "intake_tolerance", "monitoring_context"],
    allowedMetrics: ["fluid", "electrolyte", "general"],
    safetyDomains: ["medication", "gastrointestinal", "dehydration_risk"],
    conflictDomains: ["fluid_restriction", "gastrointestinal", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "treatment_gi_loss",
  }),
  entry({
    id: "medication_treatment.clinician_fluid_restriction",
    name: "Medication-related clinician fluid restriction",
    family: "medication_treatment",
    applicableContext: "Clinician-directed medication-related hydration restriction",
    allowedSources: CLINICIAN,
    requiredAuthorities: ["organ_safety"],
    ...RESTRICTION_ORIENTED,
    dimensions: ["fluid_restriction", "monitoring_context"],
    allowedMetrics: ["fluid", "general"],
    safetyDomains: ["medication", "fluid_restriction"],
    conflictDomains: ["fluid_restriction", "performance", "dysautonomia"],
    provenanceRequirements: ["source_record", "source_timestamp", "authority_identity", "protocol_revision"],
    resolverModifierType: "medication_fluid_restriction",
  }),
  entry({
    id: "life_stage.pregnancy",
    name: "Pregnancy context",
    family: "life_stage",
    applicableContext: "Pregnancy context",
    allowedSources: [...CONDITION, ...CLINICIAN, ...BUILDER],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["monitoring_context", "timing"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["pregnancy"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp", "population_context"],
    resolverModifierType: "pregnancy",
  }),
  entry({
    id: "life_stage.lactation",
    name: "Lactation/breastfeeding context",
    family: "life_stage",
    applicableContext: "Lactation or breastfeeding context",
    allowedSources: [...CONDITION, ...CLINICIAN, ...BUILDER],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["monitoring_context", "timing"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["pregnancy"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp", "population_context"],
    resolverModifierType: "lactation",
  }),
  entry({
    id: "life_stage.children",
    name: "Children context",
    family: "life_stage",
    applicableContext: "Child population context",
    allowedSources: [...CONDITION, ...CLINICIAN, ...BUILDER],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["monitoring_context", "intake_tolerance"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["pediatric"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp", "population_context"],
    resolverModifierType: "children",
  }),
  entry({
    id: "life_stage.toddlers",
    name: "Toddlers context",
    family: "life_stage",
    applicableContext: "Toddler population context",
    allowedSources: [...CONDITION, ...CLINICIAN, ...BUILDER],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["monitoring_context", "intake_tolerance"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["pediatric"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp", "population_context"],
    resolverModifierType: "toddlers",
  }),
  entry({
    id: "life_stage.older_adult",
    name: "Older-adult context",
    family: "life_stage",
    applicableContext: "Older-adult context where clinically relevant",
    allowedSources: [...CONDITION, ...CLINICIAN, ...BUILDER],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["monitoring_context", "intake_tolerance"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: ["cardiac", "renal"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp", "population_context"],
    resolverModifierType: "older_adult",
  }),
  entry({
    id: "performance_environment.exercise_training",
    name: "Exercise/training context",
    family: "performance_environment",
    applicableContext: "Exercise or training context",
    allowedSources: [...MANUAL, ...BUILDER],
    requiredAuthorities: ["performance", "user_preference"],
    ...ACTIONABLE_LATER,
    dimensions: ["fluid_need", "timing", "monitoring_context"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: PERFORMANCE,
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "dysautonomia"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "performance_context",
  }),
  entry({
    id: "performance_environment.endurance_activity",
    name: "Endurance activity context",
    family: "performance_environment",
    applicableContext: "Endurance activity context",
    allowedSources: [...MANUAL, ...BUILDER],
    requiredAuthorities: ["performance", "user_preference"],
    ...ACTIONABLE_LATER,
    dimensions: ["fluid_need", "sodium_electrolyte_relevance", "timing"],
    allowedMetrics: ["fluid", "sodium", "electrolyte", "timing", "general"],
    safetyDomains: PERFORMANCE,
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "dysautonomia", "sodium_electrolyte"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "performance_context",
  }),
  entry({
    id: "performance_environment.heat_exposure",
    name: "Heat exposure context",
    family: "performance_environment",
    applicableContext: "Heat exposure context",
    allowedSources: [...MANUAL, ...BUILDER],
    requiredAuthorities: ["performance", "user_preference"],
    ...ACTIONABLE_LATER,
    dimensions: ["fluid_need", "fluid_loss_risk", "sodium_electrolyte_relevance"],
    allowedMetrics: ["fluid", "sodium", "electrolyte", "general"],
    safetyDomains: ["performance", "dehydration_risk"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "sodium_electrolyte"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "environment_context",
  }),
  entry({
    id: "performance_environment.excessive_sweating",
    name: "Excessive sweating context",
    family: "performance_environment",
    applicableContext: "Excessive sweating context",
    allowedSources: [...MANUAL, ...BUILDER],
    requiredAuthorities: ["performance", "user_preference"],
    ...ACTIONABLE_LATER,
    dimensions: ["fluid_loss_risk", "sodium_electrolyte_relevance", "monitoring_context"],
    allowedMetrics: ["fluid", "sodium", "electrolyte", "general"],
    safetyDomains: ["performance", "dehydration_risk"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "sodium_electrolyte"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "environment_context",
  }),
  entry({
    id: "performance_environment.competition_preparation",
    name: "Competition preparation context",
    family: "performance_environment",
    applicableContext: "Competition preparation context",
    allowedSources: [...MANUAL, ...BUILDER],
    requiredAuthorities: ["performance", "user_preference"],
    ...ACTIONABLE_LATER,
    dimensions: ["fluid_need", "timing", "monitoring_context"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: PERFORMANCE,
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "dysautonomia"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "performance_context",
  }),
  entry({
    id: "performance_environment.altitude_exposure",
    name: "Altitude exposure context",
    family: "performance_environment",
    applicableContext: "Altitude exposure context",
    allowedSources: [...MANUAL, ...BUILDER],
    requiredAuthorities: ["performance", "user_preference"],
    ...ACTIONABLE_LATER,
    dimensions: ["fluid_need", "timing", "monitoring_context"],
    allowedMetrics: ["fluid", "timing", "general"],
    safetyDomains: PERFORMANCE,
    conflictDomains: ["renal", "cardiac", "fluid_restriction"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "environment_context",
  }),
  entry({
    id: "performance_environment.future_sweat_rate",
    name: "Future sweat-rate data seam",
    family: "performance_environment",
    applicableContext: "Future validated sweat-rate data input",
    allowedSources: ["wearable", "import"],
    requiredAuthorities: ["performance"],
    ...CONTEXT_ONLY,
    dimensions: ["fluid_loss_risk", "monitoring_context"],
    allowedMetrics: ["fluid", "general"],
    safetyDomains: PERFORMANCE,
    conflictDomains: ["renal", "cardiac", "fluid_restriction"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    policyVersion: HYDRATION_MODIFIER_REGISTRY_VERSION,
    status: "inactive",
    resolverModifierType: "sweat_rate_data",
  }),
  entry({
    id: "performance_environment.future_electrolyte_data",
    name: "Future sweat/electrolyte data seam",
    family: "performance_environment",
    applicableContext: "Future validated sweat or electrolyte data input",
    allowedSources: ["wearable", "import"],
    requiredAuthorities: ["performance"],
    ...CONTEXT_ONLY,
    dimensions: ["sodium_electrolyte_relevance", "monitoring_context"],
    allowedMetrics: ["sodium", "electrolyte", "general"],
    safetyDomains: ["performance", "sodium_electrolyte"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "sodium_electrolyte"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    policyVersion: HYDRATION_MODIFIER_REGISTRY_VERSION,
    status: "inactive",
    resolverModifierType: "electrolyte_data",
  }),
  entry({
    id: "acute_fluid_loss.fever",
    name: "Fever context",
    family: "acute_fluid_loss",
    applicableContext: "Fever as an explicitly represented short-term dehydration-risk state",
    allowedSources: [...CONDITION, ...MANUAL],
    requiredAuthorities: ["condition_overlay", "user_preference"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_loss_risk", "monitoring_context"],
    allowedMetrics: ["fluid", "general"],
    safetyDomains: ["dehydration_risk"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "acute_dehydration_risk",
  }),
  entry({
    id: "acute_fluid_loss.significant_sweating",
    name: "Significant sweating context",
    family: "acute_fluid_loss",
    applicableContext: "Significant sweating as an explicitly represented short-term state",
    allowedSources: [...MANUAL, ...BUILDER],
    requiredAuthorities: ["performance", "user_preference"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_loss_risk", "sodium_electrolyte_relevance", "monitoring_context"],
    allowedMetrics: ["fluid", "sodium", "electrolyte", "general"],
    safetyDomains: ["dehydration_risk", "performance"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "sodium_electrolyte"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "acute_dehydration_risk",
  }),
  entry({
    id: "acute_fluid_loss.short_term_dehydration_risk",
    name: "Short-term dehydration-risk state",
    family: "acute_fluid_loss",
    applicableContext: "Other explicitly approved short-term dehydration-risk state",
    allowedSources: [...CONDITION, ...CLINICIAN],
    requiredAuthorities: ["condition_overlay", "clinician"],
    ...REVIEW_REQUIRED,
    dimensions: ["fluid_loss_risk", "monitoring_context"],
    allowedMetrics: ["fluid", "electrolyte", "general"],
    safetyDomains: ["dehydration_risk"],
    conflictDomains: ["renal", "cardiac", "fluid_restriction", "medication"],
    provenanceRequirements: ["source_record", "source_timestamp"],
    resolverModifierType: "acute_dehydration_risk",
  }),
] as const;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

export function validateHydrationModifierRegistry(
  entries: readonly HydrationModifierRegistryEntry[],
): readonly HydrationModifierRegistryEntry[] {
  const seen = new Set<string>();
  for (const definition of entries) {
    if (!definition.id.trim() || seen.has(definition.id)) {
      throw new HydrationModifierRegistryError(
        "DUPLICATE_ID",
        `Hydration modifier registry ID is duplicated or empty: ${definition.id}`,
      );
    }
    seen.add(definition.id);
    if (definition.policyVersion !== HYDRATION_MODIFIER_REGISTRY_VERSION) {
      throw new HydrationModifierRegistryError(
        "POLICY_VERSION_MISMATCH",
        `Registry definition ${definition.id} has an unsupported policy version`,
      );
    }
  }
  return deepFreeze(
    [...entries].sort((left, right) => left.id.localeCompare(right.id)),
  );
}

export const HYDRATION_CLINICAL_MODIFIER_REGISTRY =
  validateHydrationModifierRegistry(REGISTRY_ENTRIES);

export function listHydrationModifierDefinitions(): readonly HydrationModifierRegistryEntry[] {
  return HYDRATION_CLINICAL_MODIFIER_REGISTRY;
}

export function getHydrationModifierDefinition(
  definitionId: string,
): HydrationModifierRegistryEntry {
  const definition = HYDRATION_CLINICAL_MODIFIER_REGISTRY.find(
    (candidate) => candidate.id === definitionId,
  );
  if (!definition) {
    throw new HydrationModifierRegistryError(
      "UNKNOWN_DEFINITION",
      `Unknown Hydration modifier definition: ${definitionId}`,
    );
  }
  return definition;
}

function hasRequiredProvenance(
  definition: HydrationModifierRegistryEntry,
  provenance: HydrationRegistryProvenance | undefined,
): boolean {
  if (!provenance) return false;
  return definition.provenanceRequirements.every((requirement) => {
    if (requirement === "source_record") return Boolean(provenance.sourceRecordId);
    if (requirement === "source_timestamp") return Boolean(provenance.sourceTimestamp);
    if (requirement === "authority_identity") return Boolean(provenance.authorityIdentity);
    if (requirement === "protocol_revision") return Boolean(provenance.protocolRevision);
    return Boolean(provenance.populationContext);
  });
}

function parseClaim(input: unknown): HydrationRegistryClaimInput {
  try {
    return hydrationRegistryClaimInputSchema.parse(
      input,
    ) as HydrationRegistryClaimInput;
  } catch (error) {
    throw new HydrationModifierRegistryError(
      "INVALID_CLAIM",
      error instanceof Error ? error.message : "Invalid Hydration registry claim",
    );
  }
}

export function createHydrationModifierFromRegistry(
  input: unknown,
): HydrationModifierInput {
  const claim = parseClaim(input);
  const definition = getHydrationModifierDefinition(claim.definitionId);
  if (definition.status !== "active") {
    throw new HydrationModifierRegistryError(
      "INACTIVE_DEFINITION",
      `Inactive Hydration modifier definition cannot become active: ${definition.id}`,
    );
  }
  if (claim.policyVersion !== definition.policyVersion) {
    throw new HydrationModifierRegistryError(
      "POLICY_VERSION_MISMATCH",
      `Claim ${claim.instanceId} does not use definition policy ${definition.policyVersion}`,
    );
  }
  if (!definition.allowedSources.includes(claim.source)) {
    throw new HydrationModifierRegistryError(
      "SOURCE_NOT_ALLOWED",
      `Source ${claim.source} is not allowed for ${definition.id}`,
    );
  }
  if (!definition.requiredAuthorities.includes(claim.authority)) {
    throw new HydrationModifierRegistryError(
      "AUTHORITY_NOT_ALLOWED",
      `Authority ${claim.authority} is not allowed for ${definition.id}`,
    );
  }
  const effect = claim.effect ?? definition.defaultEffect;
  if (!definition.allowedEffects.includes(effect)) {
    throw new HydrationModifierRegistryError(
      "EFFECT_NOT_ALLOWED",
      `Effect ${effect} is not allowed for ${definition.id}`,
    );
  }
  const metric = claim.metric ?? definition.allowedMetrics[0];
  if (!definition.allowedMetrics.includes(metric)) {
    throw new HydrationModifierRegistryError(
      "METRIC_NOT_ALLOWED",
      `Metric ${metric} is not allowed for ${definition.id}`,
    );
  }
  if (!hasRequiredProvenance(definition, claim.provenance)) {
    throw new HydrationModifierRegistryError(
      "PROVENANCE_INCOMPLETE",
      `Claim ${claim.instanceId} is missing required provenance`,
    );
  }

  return {
    id: claim.instanceId,
    modifierType: definition.resolverModifierType,
    registryDefinitionId: definition.id,
    registryFamily: definition.family,
    registryProvenance: claim.provenance,
    metric,
    effect,
    authority: claim.authority,
    source: claim.source,
    sourceId: claim.sourceId,
    conflictGroup: definition.conflictDomains[0],
    rationaleCode:
      claim.rationaleCode ?? `registry_${definition.id.replaceAll(".", "_")}`,
    policyVersion: definition.policyVersion,
    status: claim.status,
    hardStop: claim.hardStop,
    contextKey: claim.contextKey ?? definition.id,
  };
}

export function assertHydrationModifierMatchesRegistry(
  modifier: HydrationModifierInput,
): HydrationModifierRegistryEntry {
  if (!modifier.registryDefinitionId) {
    throw new HydrationModifierRegistryError(
      "UNKNOWN_DEFINITION",
      `Hydration modifier ${modifier.id} is not bound to a registry definition`,
    );
  }
  const definition = getHydrationModifierDefinition(
    modifier.registryDefinitionId,
  );
  if (definition.status !== "active") {
    throw new HydrationModifierRegistryError(
      "INACTIVE_DEFINITION",
      `Inactive Hydration modifier definition cannot become active: ${definition.id}`,
    );
  }
  if (
    modifier.policyVersion !== definition.policyVersion ||
    modifier.registryFamily !== definition.family ||
    modifier.modifierType !== definition.resolverModifierType
  ) {
    throw new HydrationModifierRegistryError(
      "POLICY_VERSION_MISMATCH",
      `Hydration modifier ${modifier.id} does not match registry definition ${definition.id}`,
    );
  }
  if (!definition.allowedSources.includes(modifier.source)) {
    throw new HydrationModifierRegistryError(
      "SOURCE_NOT_ALLOWED",
      `Source ${modifier.source} is not allowed for ${definition.id}`,
    );
  }
  if (!definition.requiredAuthorities.includes(modifier.authority)) {
    throw new HydrationModifierRegistryError(
      "AUTHORITY_NOT_ALLOWED",
      `Authority ${modifier.authority} is not allowed for ${definition.id}`,
    );
  }
  if (!definition.allowedEffects.includes(modifier.effect)) {
    throw new HydrationModifierRegistryError(
      "EFFECT_NOT_ALLOWED",
      `Effect ${modifier.effect} is not allowed for ${definition.id}`,
    );
  }
  if (!definition.allowedMetrics.includes(modifier.metric)) {
    throw new HydrationModifierRegistryError(
      "METRIC_NOT_ALLOWED",
      `Metric ${modifier.metric} is not allowed for ${definition.id}`,
    );
  }
  if (!hasRequiredProvenance(definition, modifier.registryProvenance)) {
    throw new HydrationModifierRegistryError(
      "PROVENANCE_INCOMPLETE",
      `Hydration modifier ${modifier.id} is missing registry provenance`,
    );
  }
  return definition;
}

export function getHydrationModifierRegistrySnapshotHash(
  entries: readonly HydrationModifierRegistryEntry[] =
    HYDRATION_CLINICAL_MODIFIER_REGISTRY,
): string {
  const serialized = JSON.stringify(
    entries.map((definition) => ({
      ...definition,
      allowedSources: [...definition.allowedSources].sort(),
      requiredAuthorities: [...definition.requiredAuthorities].sort(),
      allowedEffects: [...definition.allowedEffects].sort(),
      dimensions: [...definition.dimensions].sort(),
      allowedMetrics: [...definition.allowedMetrics].sort(),
      safetyDomains: [...definition.safetyDomains].sort(),
      conflictDomains: [...definition.conflictDomains].sort(),
      provenanceRequirements: [...definition.provenanceRequirements].sort(),
    })),
  );
  let hash = 2_166_136_261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export const HYDRATION_MODIFIER_REGISTRY_COUNTS = Object.freeze({
  total: HYDRATION_CLINICAL_MODIFIER_REGISTRY.length,
  active: HYDRATION_CLINICAL_MODIFIER_REGISTRY.filter(
    (definition) => definition.status === "active",
  ).length,
  inactive: HYDRATION_CLINICAL_MODIFIER_REGISTRY.filter(
    (definition) => definition.status === "inactive",
  ).length,
});

export {
  HYDRATION_MODIFIER_AUTHORITIES,
  HYDRATION_MODIFIER_EFFECTS,
  HYDRATION_MODIFIER_METRICS,
  HYDRATION_MODIFIER_SOURCES,
  HYDRATION_MODIFIER_STATUSES,
};