import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users, waterLogs } from "@shared/schema";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const hydrationPolicyVersions = pgTable(
  "hydration_policy_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyKey: text("policy_key").notNull(),
    version: text("version").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    contentHash: text("content_hash").notNull(),
    manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdByUserId: varchar("created_by_user_id").references(() => users.id),
  },
  (table) => ({
    policyVersionUnique: uniqueIndex(
      "hydration_policy_versions_key_version_uniq",
    ).on(table.policyKey, table.version),
    statusEffectiveIdx: index("hydration_policy_versions_status_idx").on(
      table.status,
      table.effectiveAt,
    ),
  }),
);

export const hydrationBaselines = pgTable(
  "hydration_baselines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectUserId: varchar("subject_user_id")
      .notNull()
      .references(() => users.id),
    revision: integer("revision").notNull(),
    status: text("status").notNull(),
    mode: text("mode"),
    targetMl: integer("target_ml"),
    minimumMl: integer("minimum_ml"),
    maximumMl: integer("maximum_ml"),
    timezone: text("timezone"),
    formulaId: text("formula_id"),
    formulaVersion: text("formula_version"),
    explanationKey: text("explanation_key"),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    rationaleCode: text("rationale_code").notNull(),
    sourceReference: text("source_reference"),
    createdAt: createdAt(),
    createdByUserId: varchar("created_by_user_id").references(() => users.id),
  },
  (table) => ({
    subjectRevisionUnique: uniqueIndex("hydration_baselines_subject_revision_uniq").on(
      table.subjectUserId,
      table.revision,
    ),
    subjectEffectiveIdx: index("hydration_baselines_subject_effective_idx").on(
      table.subjectUserId,
      table.effectiveAt,
    ),
  }),
);

export const hydrationModifiers = pgTable(
  "hydration_modifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectUserId: varchar("subject_user_id")
      .notNull()
      .references(() => users.id),
    modifierType: text("modifier_type").notNull(),
    timingScope: text("timing_scope").notNull(),
    deltaMl: integer("delta_ml"),
    minimumDeltaMl: integer("minimum_delta_ml"),
    maximumDeltaMl: integer("maximum_delta_ml"),
    targetFloorMl: integer("target_floor_ml"),
    targetCeilingMl: integer("target_ceiling_ml"),
    conditionKey: text("condition_key"),
    conflictGroup: text("conflict_group"),
    policyVersionId: uuid("policy_version_id").references(
      () => hydrationPolicyVersions.id,
    ),
    evidenceReference: text("evidence_reference"),
    explanationKey: text("explanation_key"),
    status: text("status").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    rationaleCode: text("rationale_code").notNull(),
    sourceReference: text("source_reference"),
    createdAt: createdAt(),
    createdByUserId: varchar("created_by_user_id").references(() => users.id),
  },
  (table) => ({
    subjectEffectiveIdx: index("hydration_modifiers_subject_effective_idx").on(
      table.subjectUserId,
      table.effectiveAt,
    ),
    policyIdx: index("hydration_modifiers_policy_idx").on(table.policyVersionId),
  }),
);

export const hydrationRestrictions = pgTable(
  "hydration_restrictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectUserId: varchar("subject_user_id")
      .notNull()
      .references(() => users.id),
    restrictionKind: text("restriction_kind").notNull(),
    metric: text("metric").notNull(),
    scope: text("scope").notNull(),
    minimumValue: numeric("minimum_value"),
    maximumValue: numeric("maximum_value"),
    unit: text("unit").notNull(),
    hardStop: boolean("hard_stop").notNull().default(false),
    severity: text("severity").notNull(),
    policyVersionId: uuid("policy_version_id").references(
      () => hydrationPolicyVersions.id,
    ),
    explanationKey: text("explanation_key"),
    status: text("status").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    rationaleCode: text("rationale_code").notNull(),
    sourceReference: text("source_reference"),
    createdAt: createdAt(),
    createdByUserId: varchar("created_by_user_id").references(() => users.id),
  },
  (table) => ({
    subjectEffectiveIdx: index("hydration_restrictions_subject_effective_idx").on(
      table.subjectUserId,
      table.effectiveAt,
    ),
    policyIdx: index("hydration_restrictions_policy_idx").on(
      table.policyVersionId,
    ),
  }),
);

export const hydrationClinicianDirectives = pgTable(
  "hydration_clinician_directives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectUserId: varchar("subject_user_id")
      .notNull()
      .references(() => users.id),
    organizationId: varchar("organization_id"),
    authorUserId: varchar("author_user_id").references(() => users.id),
    directiveKind: text("directive_kind").notNull(),
    targetKind: text("target_kind").notNull(),
    targetMl: integer("target_ml"),
    minimumMl: integer("minimum_ml"),
    maximumMl: integer("maximum_ml"),
    reviewAt: timestamp("review_at", { withTimezone: true }),
    reasonCode: text("reason_code").notNull(),
    consentReference: text("consent_reference"),
    policyVersionId: uuid("policy_version_id").references(
      () => hydrationPolicyVersions.id,
    ),
    status: text("status").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    rationaleCode: text("rationale_code").notNull(),
    sourceReference: text("source_reference"),
    createdAt: createdAt(),
    createdByUserId: varchar("created_by_user_id").references(() => users.id),
  },
  (table) => ({
    subjectEffectiveIdx: index(
      "hydration_clinician_directives_subject_effective_idx",
    ).on(table.subjectUserId, table.effectiveAt),
    organizationSubjectIdx: index(
      "hydration_clinician_directives_organization_subject_idx",
    ).on(table.organizationId, table.subjectUserId),
  }),
);

export const hydrationPlanRevisions = pgTable(
  "hydration_plan_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectUserId: varchar("subject_user_id")
      .notNull()
      .references(() => users.id),
    localDate: date("local_date").notNull(),
    timezone: text("timezone").notNull(),
    revision: integer("revision").notNull(),
    status: text("status").notNull(),
    targetKind: text("target_kind").notNull(),
    targetMl: integer("target_ml"),
    minimumMl: integer("minimum_ml"),
    maximumMl: integer("maximum_ml"),
    remainingMl: integer("remaining_ml"),
    calculationPolicyVersionId: uuid("calculation_policy_version_id")
      .notNull()
      .references(() => hydrationPolicyVersions.id),
    inputSnapshotHash: text("input_snapshot_hash").notNull(),
    policyVersionManifest: jsonb("policy_version_manifest")
      .$type<Record<string, string>>()
      .notNull(),
    missingDataCodes: text("missing_data_codes").array().notNull(),
    rationaleCodes: text("rationale_codes").array().notNull(),
    explanationKeys: text("explanation_keys").array().notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    subjectDateRevisionUnique: uniqueIndex(
      "hydration_plan_revisions_subject_date_revision_uniq",
    ).on(table.subjectUserId, table.localDate, table.revision),
    subjectDateEffectiveIdx: index(
      "hydration_plan_revisions_subject_date_effective_idx",
    ).on(table.subjectUserId, table.localDate, table.effectiveAt),
  }),
);

export const hydrationIntakeEvents = pgTable(
  "hydration_intake_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectUserId: varchar("subject_user_id")
      .notNull()
      .references(() => users.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    occurredTimezone: text("occurred_timezone").notNull(),
    localDate: date("local_date").notNull(),
    volumeMl: integer("volume_ml").notNull(),
    originalAmount: numeric("original_amount", {
      precision: 12,
      scale: 3,
    }).notNull(),
    originalUnit: text("original_unit").notNull(),
    beverageClass: text("beverage_class").notNull(),
    source: text("source").notNull(),
    sourceEventId: text("source_event_id"),
    idempotencyKey: uuid("idempotency_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    enteredAt: timestamp("entered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    enteredByUserId: varchar("entered_by_user_id")
      .notNull()
      .references(() => users.id),
    clientInstanceId: uuid("client_instance_id"),
    observedPlanRevisionId: uuid("observed_plan_revision_id").references(
      () => hydrationPlanRevisions.id,
    ),
    note: text("note"),
    declaredNutrients: jsonb("declared_nutrients").$type<Record<
      string,
      unknown
    >>(),
  },
  (table) => ({
    ownerIdempotencyUnique: uniqueIndex(
      "hydration_intake_events_owner_idempotency_uniq",
    ).on(table.subjectUserId, table.idempotencyKey),
    sourceEventUnique: uniqueIndex(
      "hydration_intake_events_source_event_uniq",
    )
      .on(table.source, table.sourceEventId)
      .where(sql`${table.sourceEventId} IS NOT NULL`),
    ownerLocalDateOccurredIdx: index(
      "hydration_intake_events_owner_local_date_occurred_idx",
    ).on(table.subjectUserId, table.localDate, table.occurredAt, table.id),
    ownerOccurredIdx: index("hydration_intake_events_owner_occurred_idx").on(
      table.subjectUserId,
      table.occurredAt,
      table.id,
    ),
    observedPlanIdx: index("hydration_intake_events_observed_plan_idx").on(
      table.observedPlanRevisionId,
    ),
  }),
);

export const hydrationEventSupersessions = pgTable(
  "hydration_event_supersessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectUserId: varchar("subject_user_id")
      .notNull()
      .references(() => users.id),
    priorEventId: uuid("prior_event_id")
      .notNull()
      .references(() => hydrationIntakeEvents.id),
    successorEventId: uuid("successor_event_id").references(
      () => hydrationIntakeEvents.id,
    ),
    kind: text("kind").notNull(),
    reasonCode: text("reason_code").notNull(),
    createdAt: createdAt(),
    createdByUserId: varchar("created_by_user_id")
      .notNull()
      .references(() => users.id),
    correlationId: text("correlation_id").notNull(),
  },
  (table) => ({
    priorUnique: uniqueIndex(
      "hydration_event_supersessions_prior_uniq",
    ).on(table.priorEventId),
    subjectCreatedIdx: index(
      "hydration_event_supersessions_subject_created_idx",
    ).on(table.subjectUserId, table.createdAt),
  }),
);

export const hydrationAuditLog = pgTable(
  "hydration_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    actorUserId: varchar("actor_user_id").references(() => users.id),
    subjectUserId: varchar("subject_user_id").references(() => users.id),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    outcome: text("outcome").notNull(),
    correlationId: text("correlation_id").notNull(),
    policyVersionId: uuid("policy_version_id").references(
      () => hydrationPolicyVersions.id,
    ),
    planRevisionId: uuid("plan_revision_id").references(
      () => hydrationPlanRevisions.id,
    ),
    metadataRedacted: jsonb("metadata_redacted").$type<Record<
      string,
      unknown
    >>(),
  },
  (table) => ({
    subjectOccurredIdx: index("hydration_audit_subject_occurred_idx").on(
      table.subjectUserId,
      table.occurredAt,
    ),
    actorOccurredIdx: index("hydration_audit_actor_occurred_idx").on(
      table.actorUserId,
      table.occurredAt,
    ),
    resourceIdx: index("hydration_audit_resource_idx").on(
      table.resourceType,
      table.resourceId,
    ),
    correlationIdx: index("hydration_audit_correlation_idx").on(
      table.correlationId,
    ),
  }),
);

export const hydrationPlanSupersessions = pgTable(
  "hydration_plan_supersessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    priorPlanRevisionId: uuid("prior_plan_revision_id")
      .notNull()
      .references(() => hydrationPlanRevisions.id),
    successorPlanRevisionId: uuid("successor_plan_revision_id")
      .notNull()
      .references(() => hydrationPlanRevisions.id),
    subjectUserId: varchar("subject_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    createdByUserId: varchar("created_by_user_id").references(() => users.id),
    reasonCode: text("reason_code").notNull(),
    correlationId: text("correlation_id").notNull(),
  },
  (table) => ({
    priorUnique: uniqueIndex("hydration_plan_supersessions_prior_uniq").on(
      table.priorPlanRevisionId,
    ),
    successorUnique: uniqueIndex(
      "hydration_plan_supersessions_successor_uniq",
    ).on(table.successorPlanRevisionId),
  }),
);

export const hydrationPlanRevisionInputRefs = pgTable(
  "hydration_plan_revision_input_refs",
  {
    planRevisionId: uuid("plan_revision_id")
      .notNull()
      .references(() => hydrationPlanRevisions.id),
    inputKind: text("input_kind").notNull(),
    inputId: uuid("input_id").notNull(),
    inputRevision: integer("input_revision"),
    inputHash: text("input_hash"),
    disposition: text("disposition").notNull(),
    reasonCode: text("reason_code").notNull(),
  },
  (table) => ({
    primary: primaryKey({
      name: "hydration_plan_revision_input_refs_pk",
      columns: [table.planRevisionId, table.inputKind, table.inputId],
    }),
    inputIdx: index("hydration_plan_revision_input_refs_input_idx").on(
      table.inputKind,
      table.inputId,
    ),
  }),
);

export const hydrationEventContributions = pgTable(
  "hydration_event_contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => hydrationIntakeEvents.id),
    planRevisionId: uuid("plan_revision_id")
      .notNull()
      .references(() => hydrationPlanRevisions.id),
    contributionMl: integer("contribution_ml"),
    method: text("method").notNull(),
    confidence: text("confidence").notNull(),
    assumptionCodes: text("assumption_codes").array().notNull(),
    excludedReason: text("excluded_reason"),
    algorithmVersion: text("algorithm_version").notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    eventPlanUnique: uniqueIndex(
      "hydration_event_contributions_event_plan_uniq",
    ).on(table.eventId, table.planRevisionId),
  }),
);

export const hydrationElectrolyteLedgers = pgTable(
  "hydration_electrolyte_ledgers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectUserId: varchar("subject_user_id")
      .notNull()
      .references(() => users.id),
    localDate: date("local_date").notNull(),
    timezone: text("timezone").notNull(),
    planRevisionId: uuid("plan_revision_id")
      .notNull()
      .references(() => hydrationPlanRevisions.id),
    coverage: text("coverage").notNull(),
    sodiumMg: numeric("sodium_mg"),
    potassiumMg: numeric("potassium_mg"),
    magnesiumMg: numeric("magnesium_mg"),
    sourceCount: integer("source_count").notNull().default(0),
    warningCodes: text("warning_codes").array().notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    planUnique: uniqueIndex("hydration_electrolyte_ledgers_plan_uniq").on(
      table.planRevisionId,
    ),
    subjectDateIdx: index("hydration_electrolyte_ledgers_subject_date_idx").on(
      table.subjectUserId,
      table.localDate,
    ),
  }),
);

export const hydrationDailyStates = pgTable(
  "hydration_daily_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectUserId: varchar("subject_user_id")
      .notNull()
      .references(() => users.id),
    localDate: date("local_date").notNull(),
    timezone: text("timezone").notNull(),
    stateVersion: integer("state_version").notNull(),
    effectivePlanRevisionId: uuid("effective_plan_revision_id")
      .notNull()
      .references(() => hydrationPlanRevisions.id),
    inputWatermark: text("input_watermark").notNull(),
    activeEventCount: integer("active_event_count").notNull(),
    totalDeclaredVolumeMl: integer("total_declared_volume_ml").notNull(),
    knownContributionMl: integer("known_contribution_ml"),
    unknownContributionEventCount: integer(
      "unknown_contribution_event_count",
    ).notNull(),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    electrolyteLedgerId: uuid("electrolyte_ledger_id")
      .notNull()
      .references(() => hydrationElectrolyteLedgers.id),
    planStatus: text("plan_status").notNull(),
    progressStatus: text("progress_status").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    calculationPolicyVersionId: uuid("calculation_policy_version_id")
      .notNull()
      .references(() => hydrationPolicyVersions.id),
    projectionHash: text("projection_hash").notNull(),
  },
  (table) => ({
    subjectDateVersionUnique: uniqueIndex(
      "hydration_daily_states_subject_date_version_uniq",
    ).on(table.subjectUserId, table.localDate, table.stateVersion),
    subjectDateVersionIdx: index(
      "hydration_daily_states_subject_date_version_idx",
    ).on(table.subjectUserId, table.localDate, table.stateVersion),
  }),
);

export const hydrationBackfillRuns = pgTable(
  "hydration_backfill_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    backfillVersion: text("backfill_version").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sourceCount: integer("source_count").notNull().default(0),
    mappedCount: integer("mapped_count").notNull().default(0),
    mismatchCount: integer("mismatch_count").notNull().default(0),
    sourceChecksum: text("source_checksum"),
    canonicalChecksum: text("canonical_checksum"),
    watermark: text("watermark"),
    errorCode: text("error_code"),
  },
  (table) => ({
    versionUnique: uniqueIndex("hydration_backfill_runs_version_uniq").on(
      table.backfillVersion,
    ),
  }),
);

export const hydrationLegacyEventMappings = pgTable(
  "hydration_legacy_event_mappings",
  {
    legacyWaterLogId: uuid("legacy_water_log_id")
      .primaryKey()
      .references(() => waterLogs.id),
    hydrationEventId: uuid("hydration_event_id")
      .notNull()
      .unique()
      .references(() => hydrationIntakeEvents.id),
    sourceRowHash: text("source_row_hash").notNull(),
    backfillVersion: text("backfill_version").notNull(),
    mappedAt: timestamp("mapped_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    backfillRunId: uuid("backfill_run_id")
      .notNull()
      .references(() => hydrationBackfillRuns.id),
  },
  (table) => ({
    backfillRunIdx: index("hydration_legacy_event_mappings_run_idx").on(
      table.backfillRunId,
    ),
  }),
);

export type HydrationPolicyVersion =
  typeof hydrationPolicyVersions.$inferSelect;
export type HydrationIntakeEventRow = typeof hydrationIntakeEvents.$inferSelect;
export type HydrationPlanRevisionRow =
  typeof hydrationPlanRevisions.$inferSelect;
export type HydrationDailyStateRow = typeof hydrationDailyStates.$inferSelect;