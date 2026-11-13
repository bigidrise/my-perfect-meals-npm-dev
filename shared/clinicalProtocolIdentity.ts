/**
 * Compatibility identities for the EXISTING live specialty system.
 * This is not the shadow health-source registry and grants no clinical authority.
 * Unknown values are retained; distinct conditions are never guessed/merged.
 */
const ALIASES: Record<string, string> = {
  "heart-failure": "cardiac", "heart failure": "cardiac", "heart-disease": "cardiac",
  "heart disease": "cardiac", hypertension: "cardiac",
  "kidney-disease": "renal", "kidney disease": "renal", ckd: "renal",
  "chronic kidney disease": "renal",
  anti_inflammatory: "anti-inflammatory",
  thyroid: "thyroid-support", hypothyroidism: "hypothyroid", hyperthyroidism: "hyperthyroid",
  "hashimoto's": "hashimotos",
  oncology: "oncology-support", cancer: "oncology-support",
  liver_disease: "liver-disease", liver_support: "liver-support",
  hormone_optimization: "hormone-optimization", metabolic_recovery: "metabolic-recovery",
  pregnancy_support: "pregnancy-support",
};

export function canonicalClinicalProtocol(value: string): string {
  const key = value.trim().toLowerCase();
  return ALIASES[key] ?? key;
}

export function normalizeClinicalProtocols(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim())
    .map(canonicalClinicalProtocol))];
}

/** Independent status for each EXISTING indicator; never infer one from another. */
export function isClinicalIndicatorActive(key: string, protocols: readonly string[]): boolean {
  const active = normalizeClinicalProtocols(protocols);
  if (key === "thyroid-support") {
    return active.some(value => ["thyroid-support", "hashimotos", "hypothyroid", "hyperthyroid"].includes(value));
  }
  return active.includes(canonicalClinicalProtocol(key));
}

/** Canonical, additive activation / exact removal; unrelated protocols survive. */
export function changeClinicalProtocols(
  current: readonly string[], protocol: string, status: "accepted" | "removed",
): string[] {
  const canonical = canonicalClinicalProtocol(protocol);
  const normalized = normalizeClinicalProtocols(current);
  return status === "removed"
    ? normalized.filter(value => value !== canonical)
    : normalizeClinicalProtocols([...normalized, canonical]);
}

export const LAB_PROTOCOL_IDS = [
  "heart-failure", "kidney-disease", "liver-disease", "liver-support",
  "metabolic-support", "inflammation-support", "metabolic-stress",
  "thyroid-support", "hashimotos", "hypothyroid", "hyperthyroid",
  "hormone-optimization", "menopause", "perimenopause",
] as const;

export interface ExistingClinicalProfile {
  specialtyConditions?: string[] | null;
  specialtyCondition?: string | null;
  healthConditions?: string[] | null;
  medicalConditions?: string[] | null;
  selectedMealBuilder?: string | null;
  oncologySupportContext?: { enabled?: boolean } | null;
}

export const EXISTING_CLINICAL_PROTOCOLS = [
  "anti-inflammatory", "cardiac", "renal", "liver-support", "liver-disease",
  "oncology-support", "thyroid-support", "alpha-gal-syndrome", "hashimotos",
  "hypothyroid", "hyperthyroid", "menopause", "perimenopause", "metabolic-recovery",
  "hormone-optimization", "pregnancy-support", "glp1",
  "diabetes", "metabolic-support", "inflammation-support", "metabolic-stress",
  "performance-nutrition", "therapeutic-support", "competition-prep",
] as const;

/** Stored state only. A raw recommendation, trainer assignment, or macro flag is not activation. */
export function effectiveClinicalProtocols(profile: ExistingClinicalProfile): string[] {
  return normalizeClinicalProtocols([
    ...(profile.specialtyConditions ?? []),
    ...(profile.specialtyCondition ? [profile.specialtyCondition] : []),
    ...(profile.healthConditions ?? []),
    ...(profile.medicalConditions ?? []),
    ...(profile.oncologySupportContext?.enabled ? ["oncology-support"] : []),
    // Existing personal Builder strategy, not users.activeBoard or membership cache.
    ...(["anti_inflammatory", "anti-inflammatory"].includes(profile.selectedMealBuilder ?? "")
      ? ["anti-inflammatory"] : []),
  ]).filter(protocol => (EXISTING_CLINICAL_PROTOCOLS as readonly string[]).includes(protocol));
}
