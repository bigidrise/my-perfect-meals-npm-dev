/**
 * Future authoritative protocol state. This is deliberately separate from a
 * selected meal Builder, whose strategy is scoped to the current food action.
 *
 * Existing profile arrays must not be cast into these records without a
 * reviewed migration. In particular, "glp1" in medical_conditions is not
 * evidence of current medication use.
 */
export const HEALTH_PROTOCOLS = [
  "glp1",
  "diabetes",
  "renal",
  "cardiac",
  "anti_inflammatory",
  "thyroid",
  "oncology",
  "hormone_optimization",
  "performance",
  "liver_disease",
  "liver_support",
  "hashimotos",
  "hypothyroid",
  "hyperthyroid",
  "menopause",
  "perimenopause",
  "metabolic_recovery",
  "pregnancy_support",
] as const;

export type HealthProtocol = (typeof HEALTH_PROTOCOLS)[number];
export const HEALTH_PROTOCOL_STATUSES = ["active", "inactive", "historical", "pending_review"] as const;
export type HealthProtocolStatus = (typeof HEALTH_PROTOCOL_STATUSES)[number];
export const HEALTH_PROTOCOL_SOURCES = [
  "user", "provider", "lab", "medication", "system_recommendation", "legacy_migrated",
] as const;
export type HealthProtocolSource = (typeof HEALTH_PROTOCOL_SOURCES)[number];

export interface HealthProtocolRecord {
  /** Stable, distinct identifier for this source's claim, not a user ID. */
  id: string;
  protocol: HealthProtocol;
  source: HealthProtocolSource;
  status: HealthProtocolStatus;
  /** Provider source only. The relationship must still be active. */
  relationshipId?: string;
  /** Source owner, checked against the verified clinic at the read boundary. */
  ownerUserId?: string;
  /** Lab source only. A raw lab signal is not an accepted recommendation. */
  acceptedRecommendation?: boolean;
  /** Medication source only. Historical medication names are not current use. */
  currentMedicationUse?: boolean;
}

export type FoodBuilderStrategy =
  | "standard"
  | "anti_inflammatory"
  | "glp1"
  | "diabetic"
  | "performance_competition"
  | "other";