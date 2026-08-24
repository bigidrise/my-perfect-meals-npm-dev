/**
 * AI Observability Checkpoint 1 persistence definitions.
 *
 * These tables are intentionally not included in drizzle.config.ts yet.
 * migrations/0011_ai_observability_foundation.sql is an additive, reviewable
 * artifact and is not executed by application startup in this checkpoint.
 *
 * PHI boundary: there are no prompt, output, content, clinical, user/account,
 * filename, image, audio, header, or raw provider-error columns in this
 * schema. Only enumerated operational metadata and nullable provider usage
 * metadata are represented.
 */

import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const aiOperations = pgTable(
  "ai_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 32 }).notNull().default("openai"),
    apiFamily: varchar("api_family", { length: 32 }).notNull(),
    workload: varchar("workload", { length: 32 }).notNull(),
    requestedModel: varchar("requested_model", { length: 128 }),
    actualModel: varchar("actual_model", { length: 128 }),
    outcome: varchar("outcome", { length: 32 }).notNull(),
    errorCode: varchar("error_code", { length: 128 }),
    validationOutcome: varchar("validation_outcome", { length: 32 })
      .notNull()
      .default("not_run"),
    guardrailOutcome: varchar("guardrail_outcome", { length: 32 })
      .notNull()
      .default("not_run"),
    retryDisposition: varchar("retry_disposition", { length: 32 })
      .notNull()
      .default("not_retried"),
    attemptCount: integer("attempt_count").notNull().default(0),
    durationMs: integer("duration_ms"),
    httpStatus: integer("http_status"),
    providerRequestId: varchar("provider_request_id", { length: 255 }),
    systemFingerprint: varchar("system_fingerprint", { length: 255 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    imageInputTokens: integer("image_input_tokens"),
    imageOutputTokens: integer("image_output_tokens"),
    audioDurationMs: integer("audio_duration_ms"),
    estimatedCostMicros: bigint("estimated_cost_micros", { mode: "number" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    outcomeIdx: index("ai_operations_outcome_idx").on(
      table.outcome,
      table.createdAt,
    ),
    providerModelIdx: index("ai_operations_provider_model_idx").on(
      table.provider,
      table.actualModel,
      table.createdAt,
    ),
    operationalValuesNonnegative: check(
      "ai_operations_operational_values_nonnegative",
      sql`(
        ${table.attemptCount} >= 0
        AND (${table.durationMs} IS NULL OR ${table.durationMs} >= 0)
        AND (${table.inputTokens} IS NULL OR ${table.inputTokens} >= 0)
        AND (${table.outputTokens} IS NULL OR ${table.outputTokens} >= 0)
        AND (${table.totalTokens} IS NULL OR ${table.totalTokens} >= 0)
        AND (${table.imageInputTokens} IS NULL OR ${table.imageInputTokens} >= 0)
        AND (${table.imageOutputTokens} IS NULL OR ${table.imageOutputTokens} >= 0)
        AND (${table.audioDurationMs} IS NULL OR ${table.audioDurationMs} >= 0)
        AND (${table.estimatedCostMicros} IS NULL OR ${table.estimatedCostMicros} >= 0)
      )`,
    ),
  }),
);

export const aiModelAttempts = pgTable(
  "ai_model_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => aiOperations.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    provider: varchar("provider", { length: 32 }).notNull().default("openai"),
    requestedModel: varchar("requested_model", { length: 128 }),
    actualModel: varchar("actual_model", { length: 128 }),
    outcome: varchar("outcome", { length: 32 }).notNull(),
    errorCode: varchar("error_code", { length: 128 }),
    validationOutcome: varchar("validation_outcome", { length: 32 })
      .notNull()
      .default("not_run"),
    guardrailOutcome: varchar("guardrail_outcome", { length: 32 })
      .notNull()
      .default("not_run"),
    retryDisposition: varchar("retry_disposition", { length: 32 })
      .notNull()
      .default("not_retried"),
    durationMs: integer("duration_ms"),
    httpStatus: integer("http_status"),
    providerRequestId: varchar("provider_request_id", { length: 255 }),
    systemFingerprint: varchar("system_fingerprint", { length: 255 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    imageInputTokens: integer("image_input_tokens"),
    imageOutputTokens: integer("image_output_tokens"),
    audioDurationMs: integer("audio_duration_ms"),
    estimatedCostMicros: bigint("estimated_cost_micros", { mode: "number" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    operationAttemptUnique: uniqueIndex(
      "ai_model_attempts_operation_attempt_uniq",
    ).on(table.operationId, table.attemptNumber),
    operationCreatedIdx: index("ai_model_attempts_operation_created_idx").on(
      table.operationId,
      table.createdAt,
    ),
    attemptNumberPositive: check(
      "ai_model_attempts_attempt_number_positive",
      sql`${table.attemptNumber} > 0`,
    ),
    operationalValuesNonnegative: check(
      "ai_model_attempts_operational_values_nonnegative",
      sql`(
        (${table.durationMs} IS NULL OR ${table.durationMs} >= 0)
        AND (${table.inputTokens} IS NULL OR ${table.inputTokens} >= 0)
        AND (${table.outputTokens} IS NULL OR ${table.outputTokens} >= 0)
        AND (${table.totalTokens} IS NULL OR ${table.totalTokens} >= 0)
        AND (${table.imageInputTokens} IS NULL OR ${table.imageInputTokens} >= 0)
        AND (${table.imageOutputTokens} IS NULL OR ${table.imageOutputTokens} >= 0)
        AND (${table.audioDurationMs} IS NULL OR ${table.audioDurationMs} >= 0)
        AND (${table.estimatedCostMicros} IS NULL OR ${table.estimatedCostMicros} >= 0)
      )`,
    ),
  }),
);

export const aiPricingCatalog = pgTable(
  "ai_pricing_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 32 }).notNull().default("openai"),
    model: varchar("model", { length: 128 }).notNull(),
    apiFamily: varchar("api_family", { length: 32 }).notNull(),
    version: varchar("version", { length: 128 }).notNull(),
    inputTokenPriceMicrosPerMillion: bigint(
      "input_token_price_micros_per_million",
      { mode: "number" },
    ),
    outputTokenPriceMicrosPerMillion: bigint(
      "output_token_price_micros_per_million",
      { mode: "number" },
    ),
    imageInputPriceMicrosPerMillion: bigint(
      "image_input_price_micros_per_million",
      { mode: "number" },
    ),
    imageOutputPriceMicrosPerMillion: bigint(
      "image_output_price_micros_per_million",
      { mode: "number" },
    ),
    audioPriceMicrosPerMinute: bigint("audio_price_micros_per_minute", {
      mode: "number",
    }),
    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
    }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    versionUnique: uniqueIndex("ai_pricing_catalog_version_uniq").on(
      table.provider,
      table.model,
      table.apiFamily,
      table.version,
    ),
    effectiveDateUnique: uniqueIndex(
      "ai_pricing_catalog_effective_date_uniq",
    ).on(table.provider, table.model, table.apiFamily, table.effectiveFrom),
    lookupIdx: index("ai_pricing_catalog_lookup_idx").on(
      table.provider,
      table.model,
      table.apiFamily,
      table.effectiveFrom,
    ),
    pricesNonnegative: check(
      "ai_pricing_catalog_prices_nonnegative",
      sql`(
        (${table.inputTokenPriceMicrosPerMillion} IS NULL OR ${table.inputTokenPriceMicrosPerMillion} >= 0)
        AND (${table.outputTokenPriceMicrosPerMillion} IS NULL OR ${table.outputTokenPriceMicrosPerMillion} >= 0)
        AND (${table.imageInputPriceMicrosPerMillion} IS NULL OR ${table.imageInputPriceMicrosPerMillion} >= 0)
        AND (${table.imageOutputPriceMicrosPerMillion} IS NULL OR ${table.imageOutputPriceMicrosPerMillion} >= 0)
        AND (${table.audioPriceMicrosPerMinute} IS NULL OR ${table.audioPriceMicrosPerMinute} >= 0)
        AND (${table.effectiveTo} IS NULL OR ${table.effectiveTo} > ${table.effectiveFrom})
      )`,
    ),
  }),
);

export type AiOperationRow = typeof aiOperations.$inferSelect;
export type InsertAiOperation = typeof aiOperations.$inferInsert;
export type AiModelAttemptRow = typeof aiModelAttempts.$inferSelect;
export type InsertAiModelAttempt = typeof aiModelAttempts.$inferInsert;
export type AiPricingCatalogRow = typeof aiPricingCatalog.$inferSelect;
export type InsertAiPricingCatalog = typeof aiPricingCatalog.$inferInsert;