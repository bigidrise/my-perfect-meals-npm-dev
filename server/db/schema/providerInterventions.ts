import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { studios } from "./studio";

/**
 * Provider Clinical Interventions
 *
 * One row per active provider selection for a patient.
 * When a clinician selects "Nausea: Moderate" for a patient, a row is
 * created here. The Protocol Envelope loader queries these on every
 * generation call and injects them as hard limits / optimization layers
 * into the AI prompt — so every generator (GLP-1 Builder, Restaurant
 * Guide, Recipe Scan, etc.) automatically honors provider directives
 * without per-generator wiring.
 *
 * Condition keys (conditionKey):
 *   nausea | vomiting | constipation | diarrhea | early_fullness
 *   poor_appetite | poor_hydration | low_protein | low_calorie
 *   muscle_preservation_risk | fatigue | food_aversion
 *   rapid_weight_loss | glucose_concerns | reflux
 *   transitioning_off_medication
 *
 * Severity values: none | mild | moderate | severe
 *   "none" is stored when a provider explicitly clears a condition.
 *   is_active=false means deactivated (resolvedAt is set).
 */
export const providerClinicalInterventions = pgTable(
  "provider_clinical_interventions",
  {
    id:             uuid("id").defaultRandom().primaryKey(),
    studioId:       uuid("studio_id").references(() => studios.id, { onDelete: "cascade" }),
    clientUserId:   text("client_user_id").notNull(),
    providerUserId: text("provider_user_id").notNull(),

    conditionKey: text("condition_key")
      .$type<
        | "nausea"
        | "vomiting"
        | "constipation"
        | "diarrhea"
        | "early_fullness"
        | "poor_appetite"
        | "poor_hydration"
        | "low_protein"
        | "low_calorie"
        | "muscle_preservation_risk"
        | "fatigue"
        | "food_aversion"
        | "rapid_weight_loss"
        | "glucose_concerns"
        | "reflux"
        | "transitioning_off_medication"
      >()
      .notNull(),

    severity: text("severity")
      .$type<"none" | "mild" | "moderate" | "severe">()
      .notNull()
      .default("mild"),

    notes:          text("notes"),
    metadata:       jsonb("metadata").$type<Record<string, unknown>>().default({}),
    isActive:       boolean("is_active").notNull().default(true),
    escalationFlag: boolean("escalation_flag").notNull().default(false),

    activatedAt:  timestamp("activated_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt:   timestamp("resolved_at",  { withTimezone: true }),
    createdAt:    timestamp("created_at",   { withTimezone: true }).defaultNow().notNull(),
    updatedAt:    timestamp("updated_at",   { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clientActiveIdx:  index("idx_pci_client_active").on(t.clientUserId, t.isActive),
    studioClientIdx:  index("idx_pci_studio_client").on(t.studioId, t.clientUserId),
    providerIdx:      index("idx_pci_provider").on(t.providerUserId),
  })
);

export type ProviderClinicalIntervention = typeof providerClinicalInterventions.$inferSelect;
export type InsertProviderClinicalIntervention = typeof providerClinicalInterventions.$inferInsert;

export const INTERVENTION_CONDITION_LABELS: Record<string, string> = {
  nausea:                       "Nausea",
  vomiting:                     "Vomiting",
  constipation:                 "Constipation",
  diarrhea:                     "Diarrhea",
  early_fullness:               "Early Fullness",
  poor_appetite:                "Reduced Appetite",
  poor_hydration:               "Poor Hydration",
  low_protein:                  "Protein Intake Too Low",
  low_calorie:                  "Calories Consistently Too Low",
  muscle_preservation_risk:     "Lean-Tissue Risk",
  fatigue:                      "Fatigue / Low Energy",
  food_aversion:                "Food Aversion",
  rapid_weight_loss:            "Rapid Weight Loss",
  glucose_concerns:             "Blood Glucose Concerns",
  reflux:                       "Reflux / Heartburn",
  transitioning_off_medication: "Transitioning Off Medication",
};

export const INTERVENTION_SEVERITY_LABELS: Record<string, string> = {
  none:     "None",
  mild:     "Mild",
  moderate: "Moderate",
  severe:   "Severe",
};

export const ESCALATION_CONDITIONS = new Set([
  "vomiting",
  "rapid_weight_loss",
  "glucose_concerns",
]);

export const ESCALATION_SEVERITIES = new Set(["severe"]);
