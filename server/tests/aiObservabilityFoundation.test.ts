import fs from "node:fs";
import path from "node:path";

import {
  aiApiFamilySchema,
  aiModelAttemptTelemetrySchema,
  aiOperationTelemetrySchema,
  aiPricingCatalogEntrySchema,
  estimateAiCostMicros,
  isAiObservabilityEnabled,
  shouldPersistAiTelemetry,
} from "../services/aiObservability";
import {
  aiModelAttempts,
  aiOperations,
  aiPricingCatalog,
} from "../db/schema/aiObservability";

const migrationPath = path.resolve(
  process.cwd(),
  "migrations/0011_ai_observability_foundation.sql",
);
const schemaPath = path.resolve(
  process.cwd(),
  "server/db/schema/aiObservability.ts",
);

const baseOperation = {
  provider: "openai" as const,
  apiFamily: "chat_completions" as const,
  workload: "text" as const,
  requestedModel: "gpt-4o-mini",
  actualModel: "gpt-4o-mini",
  outcome: "success" as const,
  errorCode: null,
  validationOutcome: "passed" as const,
  guardrailOutcome: "passed" as const,
  retryDisposition: "not_retried" as const,
  attemptCount: 1,
  durationMs: 240,
  httpStatus: 200,
  providerRequestId: "req_123",
  systemFingerprint: "fp_123",
  inputTokens: 100,
  outputTokens: 25,
  totalTokens: 125,
  imageInputTokens: null,
  imageOutputTokens: null,
  audioDurationMs: null,
  estimatedCostMicros: 300,
};

const baseAttempt = {
  attemptNumber: 1,
  provider: "openai" as const,
  requestedModel: "gpt-4o-mini",
  actualModel: "gpt-4o-mini",
  outcome: "success" as const,
  errorCode: null,
  validationOutcome: "passed" as const,
  guardrailOutcome: "passed" as const,
  retryDisposition: "not_retried" as const,
  durationMs: 240,
  httpStatus: 200,
  providerRequestId: "req_123",
  systemFingerprint: "fp_123",
  inputTokens: 100,
  outputTokens: 25,
  totalTokens: 125,
  imageInputTokens: null,
  imageOutputTokens: null,
  audioDurationMs: null,
  estimatedCostMicros: 300,
};

const basePricing = {
  provider: "openai" as const,
  model: "gpt-4o-mini",
  apiFamily: "chat_completions" as const,
  version: "2026-08-24-v1",
  inputTokenPriceMicrosPerMillion: 150_000,
  outputTokenPriceMicrosPerMillion: 600_000,
  imageInputPriceMicrosPerMillion: null,
  imageOutputPriceMicrosPerMillion: null,
  audioPriceMicrosPerMinute: null,
  effectiveFrom: new Date("2026-08-24T00:00:00.000Z"),
  effectiveTo: null,
};

describe("AI observability Checkpoint 1 contracts", () => {
  afterEach(() => {
    delete process.env.AI_OBSERVABILITY_ENABLED;
  });

  it("accepts approved operational metadata and rejects prohibited content fields", () => {
    expect(aiOperationTelemetrySchema.parse(baseOperation)).toEqual(baseOperation);

    for (const prohibitedField of [
      "prompt",
      "systemPrompt",
      "output",
      "responseBody",
      "diagnosis",
      "medications",
      "labValues",
      "symptoms",
      "clinicalContext",
      "mealIngredients",
      "freeTextRequest",
      "image",
      "imageUrl",
      "audio",
      "transcript",
      "filename",
      "userId",
      "accountId",
      "rawProviderError",
      "rawHeaders",
    ]) {
      expect(() =>
        aiOperationTelemetrySchema.parse({
          ...baseOperation,
          [prohibitedField]: "must not persist",
        }),
      ).toThrow();
    }
  });

  it("models valid operation/attempt relationships and unique attempt numbering", () => {
    expect(aiOperations.id.name).toBe("id");
    expect(aiModelAttempts.operationId.name).toBe("operation_id");
    expect(aiModelAttempts.operationId.notNull).toBe(true);
    expect(aiModelAttempts.attemptNumber.notNull).toBe(true);
    expect(aiModelAttemptTelemetrySchema.parse(baseAttempt).attemptNumber).toBe(1);

    const migration = fs.readFileSync(migrationPath, "utf8");
    expect(migration).toContain(
      "operation_id UUID NOT NULL REFERENCES ai_operations(id) ON DELETE CASCADE",
    );
    expect(migration).toContain(
      "UNIQUE (operation_id, attempt_number)",
    );
    expect(migration).toContain("attempt_number INTEGER NOT NULL CHECK (attempt_number > 0)");
  });

  it("keeps pricing versions immutable and effective-dated", () => {
    expect(aiPricingCatalog.id.name).toBe("id");
    expect(aiPricingCatalog.effectiveFrom.name).toBe("effective_from");
    expect(aiPricingCatalog.effectiveTo.name).toBe("effective_to");
    expect(aiPricingCatalogEntrySchema.parse(basePricing).version).toBe(
      "2026-08-24-v1",
    );
    expect(() =>
      aiPricingCatalogEntrySchema.parse({
        ...basePricing,
        effectiveTo: new Date("2026-08-23T00:00:00.000Z"),
      }),
    ).toThrow();

    const migration = fs.readFileSync(migrationPath, "utf8");
    expect(migration).toContain("ai_pricing_catalog_version_uniq");
    expect(migration).toContain("ai_pricing_catalog_effective_date_uniq");
    expect(migration).toContain("BEFORE UPDATE OR DELETE ON ai_pricing_catalog");
    expect(migration).toContain(
      "ai_pricing_catalog is immutable; add a new effective-dated version",
    );
  });

  it("supports nullable chat, image, and audio metadata", () => {
    expect(
      aiOperationTelemetrySchema.parse({
        ...baseOperation,
        apiFamily: "image_generation",
        workload: "image",
        requestedModel: "gpt-image-1",
        actualModel: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        imageInputTokens: null,
        imageOutputTokens: null,
        audioDurationMs: null,
        estimatedCostMicros: null,
      }).actualModel,
    ).toBeNull();

    expect(
      aiOperationTelemetrySchema.parse({
        ...baseOperation,
        apiFamily: "audio_transcription",
        workload: "audio",
        requestedModel: "whisper-1",
        actualModel: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        imageInputTokens: null,
        imageOutputTokens: null,
        audioDurationMs: null,
        estimatedCostMicros: null,
      }).audioDurationMs,
    ).toBeNull();
  });

  it("returns null cost when usage or price data is incomplete", () => {
    expect(
      estimateAiCostMicros(
        {
          apiFamily: "chat_completions",
          inputTokens: 100,
          outputTokens: 25,
        },
        basePricing,
      ),
    ).toBe(30);
    expect(
      estimateAiCostMicros(
        {
          apiFamily: "chat_completions",
          inputTokens: null,
          outputTokens: null,
        },
        basePricing,
      ),
    ).toBeNull();
    expect(
      estimateAiCostMicros(
        {
          apiFamily: "chat_completions",
          inputTokens: 100,
          outputTokens: null,
        },
        {
          ...basePricing,
          inputTokenPriceMicrosPerMillion: null,
        },
      ),
    ).toBeNull();
  });

  it("uses a closed API-family contract", () => {
    expect(aiApiFamilySchema.parse("chat_completions")).toBe("chat_completions");
    expect(() => aiApiFamilySchema.parse("provider_raw_body")).toThrow();
  });
});

describe("AI observability feature gate", () => {
  afterEach(() => {
    delete process.env.AI_OBSERVABILITY_ENABLED;
  });

  it("is disabled by default and is a no-op unless explicitly enabled", () => {
    delete process.env.AI_OBSERVABILITY_ENABLED;
    expect(isAiObservabilityEnabled()).toBe(false);
    expect(shouldPersistAiTelemetry()).toBe(false);

    process.env.AI_OBSERVABILITY_ENABLED = "false";
    expect(isAiObservabilityEnabled()).toBe(false);
    expect(shouldPersistAiTelemetry()).toBe(false);

    process.env.AI_OBSERVABILITY_ENABLED = "true";
    expect(isAiObservabilityEnabled()).toBe(true);
    expect(shouldPersistAiTelemetry()).toBe(true);
  });
});

describe("AI observability scope preservation", () => {
  it("does not register the foundation as a production boot migration", () => {
    const indexSource = fs.readFileSync(
      path.resolve(process.cwd(), "server/index.ts"),
      "utf8",
    );
    const prodSource = fs.readFileSync(
      path.resolve(process.cwd(), "server/prod.ts"),
      "utf8",
    );
    expect(indexSource).not.toContain("0011_ai_observability_foundation");
    expect(prodSource).not.toContain("0011_ai_observability_foundation");
  });

  it("keeps the existing model identifiers unchanged", () => {
    const openaiSafeSource = fs.readFileSync(
      path.resolve(process.cwd(), "server/utils/openaiSafe.ts"),
      "utf8",
    );
    expect(openaiSafeSource).toContain('process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini"');
    expect(openaiSafeSource).toContain('model: "gpt-image-1"');
    expect(openaiSafeSource).not.toContain("gpt-5");
    expect(openaiSafeSource).not.toContain("sol-");
    expect(openaiSafeSource).not.toContain("terra-");
    expect(openaiSafeSource).not.toContain("luna-");
  });

  it("keeps the additive schema out of drizzle auto-discovery until migration approval", () => {
    const drizzleConfig = fs.readFileSync(
      path.resolve(process.cwd(), "drizzle.config.ts"),
      "utf8",
    );
    expect(drizzleConfig).not.toContain("./server/db/schema/aiObservability.ts");
    expect(fs.readFileSync(schemaPath, "utf8")).toContain(
      "not included in drizzle.config.ts yet",
    );
  });
});