/**
 * AI Observability Checkpoint 1
 *
 * This module defines the feature-disabled, PHI-safe contract for future AI
 * operational telemetry. It intentionally has no database writer and is not
 * imported by any AI request path yet. Checkpoint 2 will add the non-blocking
 * writer/provider adapter after this contract is reviewed.
 */

import { z } from "zod";

export const AI_OBSERVABILITY_FLAG = "AI_OBSERVABILITY_ENABLED";

const SAFE_CODE = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const SAFE_MODEL_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export const aiApiFamilySchema = z.enum([
  "chat_completions",
  "image_generation",
  "audio_transcription",
]);

export const aiWorkloadSchema = z.enum([
  "text",
  "vision",
  "image",
  "audio",
]);

export const aiOutcomeSchema = z.enum([
  "success",
  "error",
  "timeout",
  "rate_limited",
  "blocked",
  "cancelled",
  "unknown",
]);

export const aiValidationOutcomeSchema = z.enum([
  "not_run",
  "passed",
  "failed",
  "unknown",
]);

export const aiGuardrailOutcomeSchema = z.enum([
  "not_run",
  "passed",
  "failed",
  "unknown",
]);

export const aiRetryDispositionSchema = z.enum([
  "not_retried",
  "retryable_failure",
  "retry_succeeded",
  "retry_exhausted",
  "unknown",
]);

const nullableNonNegativeInt = z.number().int().nonnegative().nullable();
const nullableSafeCode = z.string().regex(SAFE_CODE).nullable();
const nullableModelId = z.string().regex(SAFE_MODEL_ID).nullable();

/**
 * Operational fields allowed on an AI operation.
 *
 * Deliberately absent: prompts, outputs, content hashes, route paths,
 * diagnoses, medications, labs, symptoms, clinical context, meal data,
 * free-text requests, images, audio, filenames, account/user identifiers,
 * raw provider errors, and raw headers.
 */
export const aiOperationTelemetrySchema = z
  .object({
    provider: z.literal("openai"),
    apiFamily: aiApiFamilySchema,
    workload: aiWorkloadSchema,
    requestedModel: nullableModelId,
    actualModel: nullableModelId,
    outcome: aiOutcomeSchema,
    errorCode: nullableSafeCode,
    validationOutcome: aiValidationOutcomeSchema,
    guardrailOutcome: aiGuardrailOutcomeSchema,
    retryDisposition: aiRetryDispositionSchema,
    attemptCount: z.number().int().nonnegative(),
    durationMs: nullableNonNegativeInt,
    httpStatus: z.number().int().min(100).max(599).nullable(),
    providerRequestId: z.string().max(255).regex(SAFE_CODE).nullable(),
    systemFingerprint: z.string().max(255).regex(SAFE_CODE).nullable(),
    inputTokens: nullableNonNegativeInt,
    outputTokens: nullableNonNegativeInt,
    totalTokens: nullableNonNegativeInt,
    imageInputTokens: nullableNonNegativeInt,
    imageOutputTokens: nullableNonNegativeInt,
    audioDurationMs: nullableNonNegativeInt,
    estimatedCostMicros: nullableNonNegativeInt,
  })
  .strict();

export const aiModelAttemptTelemetrySchema = z
  .object({
    attemptNumber: z.number().int().positive(),
    provider: z.literal("openai"),
    requestedModel: nullableModelId,
    actualModel: nullableModelId,
    outcome: aiOutcomeSchema,
    errorCode: nullableSafeCode,
    validationOutcome: aiValidationOutcomeSchema,
    guardrailOutcome: aiGuardrailOutcomeSchema,
    retryDisposition: aiRetryDispositionSchema,
    durationMs: nullableNonNegativeInt,
    httpStatus: z.number().int().min(100).max(599).nullable(),
    providerRequestId: z.string().max(255).regex(SAFE_CODE).nullable(),
    systemFingerprint: z.string().max(255).regex(SAFE_CODE).nullable(),
    inputTokens: nullableNonNegativeInt,
    outputTokens: nullableNonNegativeInt,
    totalTokens: nullableNonNegativeInt,
    imageInputTokens: nullableNonNegativeInt,
    imageOutputTokens: nullableNonNegativeInt,
    audioDurationMs: nullableNonNegativeInt,
    estimatedCostMicros: nullableNonNegativeInt,
  })
  .strict();

export const aiPricingCatalogEntrySchema = z
  .object({
    provider: z.literal("openai"),
    model: z.string().regex(SAFE_MODEL_ID),
    apiFamily: aiApiFamilySchema,
    version: z.string().regex(SAFE_CODE),
    inputTokenPriceMicrosPerMillion: nullableNonNegativeInt,
    outputTokenPriceMicrosPerMillion: nullableNonNegativeInt,
    imageInputPriceMicrosPerMillion: nullableNonNegativeInt,
    imageOutputPriceMicrosPerMillion: nullableNonNegativeInt,
    audioPriceMicrosPerMinute: nullableNonNegativeInt,
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.effectiveTo && value.effectiveTo <= value.effectiveFrom) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveTo"],
        message: "effectiveTo must be after effectiveFrom",
      });
    }
  });

export type AiOperationTelemetry = z.infer<typeof aiOperationTelemetrySchema>;
export type AiModelAttemptTelemetry = z.infer<
  typeof aiModelAttemptTelemetrySchema
>;
export type AiPricingCatalogEntry = z.infer<
  typeof aiPricingCatalogEntrySchema
>;

export interface AiUsageForCost {
  apiFamily: z.infer<typeof aiApiFamilySchema>;
  inputTokens?: number | null;
  outputTokens?: number | null;
  imageInputTokens?: number | null;
  imageOutputTokens?: number | null;
  audioDurationMs?: number | null;
}

/**
 * Cost estimation is intentionally pure and unused until the telemetry writer
 * is approved. Incomplete usage or pricing returns null rather than inventing
 * a cost.
 */
export function estimateAiCostMicros(
  usage: AiUsageForCost,
  pricing: AiPricingCatalogEntry | null | undefined,
): number | null {
  if (!pricing || pricing.apiFamily !== usage.apiFamily) return null;

  if (usage.apiFamily === "chat_completions") {
    if (
      usage.inputTokens == null ||
      usage.outputTokens == null ||
      pricing.inputTokenPriceMicrosPerMillion == null ||
      pricing.outputTokenPriceMicrosPerMillion == null
    ) {
      return null;
    }
    return Math.round(
      (usage.inputTokens * pricing.inputTokenPriceMicrosPerMillion) / 1_000_000 +
        (usage.outputTokens * pricing.outputTokenPriceMicrosPerMillion) /
          1_000_000,
    );
  }

  if (usage.apiFamily === "image_generation") {
    if (
      usage.imageInputTokens == null ||
      usage.imageOutputTokens == null ||
      pricing.imageInputPriceMicrosPerMillion == null ||
      pricing.imageOutputPriceMicrosPerMillion == null
    ) {
      return null;
    }
    return Math.round(
      (usage.imageInputTokens * pricing.imageInputPriceMicrosPerMillion) /
        1_000_000 +
        (usage.imageOutputTokens * pricing.imageOutputPriceMicrosPerMillion) /
          1_000_000,
    );
  }

  if (
    usage.audioDurationMs == null ||
    pricing.audioPriceMicrosPerMinute == null
  ) {
    return null;
  }
  return Math.round(
    (usage.audioDurationMs * pricing.audioPriceMicrosPerMinute) / 60_000,
  );
}

/**
 * Feature gate only. Reading the environment at call time keeps tests and
 * future runtime configuration explicit; unset and every value except the
 * literal "true" are disabled.
 */
export function isAiObservabilityEnabled(): boolean {
  return process.env[AI_OBSERVABILITY_FLAG] === "true";
}

export function shouldPersistAiTelemetry(): boolean {
  return isAiObservabilityEnabled();
}