-- AI Observability Checkpoint 1 foundation.
-- Additive, PHI-safe, and intentionally not executed by application startup.
-- Do not add this artifact to a production boot migration until Checkpoint 1
-- review explicitly authorizes persistence activation.
--
-- There are intentionally no prompt, output, content, clinical, user/account,
-- filename, image, audio, header, or raw provider-error columns.

CREATE TABLE IF NOT EXISTS ai_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(32) NOT NULL DEFAULT 'openai'
    CHECK (provider = 'openai'),
  api_family VARCHAR(32) NOT NULL
    CHECK (api_family IN ('chat_completions', 'image_generation', 'audio_transcription')),
  workload VARCHAR(32) NOT NULL
    CHECK (workload IN ('text', 'vision', 'image', 'audio')),
  requested_model VARCHAR(128),
  actual_model VARCHAR(128),
  outcome VARCHAR(32) NOT NULL
    CHECK (outcome IN ('success', 'error', 'timeout', 'rate_limited', 'blocked', 'cancelled', 'unknown')),
  error_code VARCHAR(128),
  validation_outcome VARCHAR(32) NOT NULL DEFAULT 'not_run'
    CHECK (validation_outcome IN ('not_run', 'passed', 'failed', 'unknown')),
  guardrail_outcome VARCHAR(32) NOT NULL DEFAULT 'not_run'
    CHECK (guardrail_outcome IN ('not_run', 'passed', 'failed', 'unknown')),
  retry_disposition VARCHAR(32) NOT NULL DEFAULT 'not_retried'
    CHECK (retry_disposition IN ('not_retried', 'retryable_failure', 'retry_succeeded', 'retry_exhausted', 'unknown')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  http_status INTEGER CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  provider_request_id VARCHAR(255),
  system_fingerprint VARCHAR(255),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  total_tokens INTEGER CHECK (total_tokens IS NULL OR total_tokens >= 0),
  image_input_tokens INTEGER CHECK (image_input_tokens IS NULL OR image_input_tokens >= 0),
  image_output_tokens INTEGER CHECK (image_output_tokens IS NULL OR image_output_tokens >= 0),
  audio_duration_ms INTEGER CHECK (audio_duration_ms IS NULL OR audio_duration_ms >= 0),
  estimated_cost_micros BIGINT CHECK (estimated_cost_micros IS NULL OR estimated_cost_micros >= 0),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_operations_outcome_idx
  ON ai_operations (outcome, created_at);
CREATE INDEX IF NOT EXISTS ai_operations_provider_model_idx
  ON ai_operations (provider, actual_model, created_at);

CREATE TABLE IF NOT EXISTS ai_model_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES ai_operations(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  provider VARCHAR(32) NOT NULL DEFAULT 'openai'
    CHECK (provider = 'openai'),
  requested_model VARCHAR(128),
  actual_model VARCHAR(128),
  outcome VARCHAR(32) NOT NULL
    CHECK (outcome IN ('success', 'error', 'timeout', 'rate_limited', 'blocked', 'cancelled', 'unknown')),
  error_code VARCHAR(128),
  validation_outcome VARCHAR(32) NOT NULL DEFAULT 'not_run'
    CHECK (validation_outcome IN ('not_run', 'passed', 'failed', 'unknown')),
  guardrail_outcome VARCHAR(32) NOT NULL DEFAULT 'not_run'
    CHECK (guardrail_outcome IN ('not_run', 'passed', 'failed', 'unknown')),
  retry_disposition VARCHAR(32) NOT NULL DEFAULT 'not_retried'
    CHECK (retry_disposition IN ('not_retried', 'retryable_failure', 'retry_succeeded', 'retry_exhausted', 'unknown')),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  http_status INTEGER CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  provider_request_id VARCHAR(255),
  system_fingerprint VARCHAR(255),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  total_tokens INTEGER CHECK (total_tokens IS NULL OR total_tokens >= 0),
  image_input_tokens INTEGER CHECK (image_input_tokens IS NULL OR image_input_tokens >= 0),
  image_output_tokens INTEGER CHECK (image_output_tokens IS NULL OR image_output_tokens >= 0),
  audio_duration_ms INTEGER CHECK (audio_duration_ms IS NULL OR audio_duration_ms >= 0),
  estimated_cost_micros BIGINT CHECK (estimated_cost_micros IS NULL OR estimated_cost_micros >= 0),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_model_attempts_operation_attempt_uniq
    UNIQUE (operation_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS ai_model_attempts_operation_created_idx
  ON ai_model_attempts (operation_id, created_at);

CREATE TABLE IF NOT EXISTS ai_pricing_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(32) NOT NULL DEFAULT 'openai'
    CHECK (provider = 'openai'),
  model VARCHAR(128) NOT NULL,
  api_family VARCHAR(32) NOT NULL
    CHECK (api_family IN ('chat_completions', 'image_generation', 'audio_transcription')),
  version VARCHAR(128) NOT NULL,
  input_token_price_micros_per_million BIGINT,
  output_token_price_micros_per_million BIGINT,
  image_input_price_micros_per_million BIGINT,
  image_output_price_micros_per_million BIGINT,
  audio_price_micros_per_minute BIGINT,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_pricing_catalog_version_uniq
    UNIQUE (provider, model, api_family, version),
  CONSTRAINT ai_pricing_catalog_effective_date_uniq
    UNIQUE (provider, model, api_family, effective_from),
  CONSTRAINT ai_pricing_catalog_prices_nonnegative
    CHECK (
      (input_token_price_micros_per_million IS NULL OR input_token_price_micros_per_million >= 0)
      AND (output_token_price_micros_per_million IS NULL OR output_token_price_micros_per_million >= 0)
      AND (image_input_price_micros_per_million IS NULL OR image_input_price_micros_per_million >= 0)
      AND (image_output_price_micros_per_million IS NULL OR image_output_price_micros_per_million >= 0)
      AND (audio_price_micros_per_minute IS NULL OR audio_price_micros_per_minute >= 0)
      AND (effective_to IS NULL OR effective_to > effective_from)
    )
);

CREATE INDEX IF NOT EXISTS ai_pricing_catalog_lookup_idx
  ON ai_pricing_catalog (provider, model, api_family, effective_from);

-- Historical prices are append-only. Corrections require a new version and
-- effective date; updates/deletes must never rewrite history.
CREATE OR REPLACE FUNCTION reject_ai_pricing_catalog_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ai_pricing_catalog is immutable; add a new effective-dated version';
END;
$$;

DROP TRIGGER IF EXISTS ai_pricing_catalog_immutable_trigger
  ON ai_pricing_catalog;
CREATE TRIGGER ai_pricing_catalog_immutable_trigger
  BEFORE UPDATE OR DELETE ON ai_pricing_catalog
  FOR EACH ROW
  EXECUTE FUNCTION reject_ai_pricing_catalog_mutation();