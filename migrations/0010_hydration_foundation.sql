-- Hydration Phase 1 foundation.
-- Additive only. This file is an artifact for the approved migration runner;
-- it is not executed during Checkpoint 1 and must never replace water_logs.

CREATE TABLE IF NOT EXISTS hydration_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL,
  version TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('foundation_algorithm', 'future_policy_manifest')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'withheld', 'retired')),
  content_hash TEXT NOT NULL,
  manifest JSONB NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ,
  created_by_user_id VARCHAR REFERENCES users(id),
  CONSTRAINT hydration_policy_versions_key_version_uniq UNIQUE (policy_key, version)
);
CREATE INDEX IF NOT EXISTS hydration_policy_versions_status_idx
  ON hydration_policy_versions (status, effective_at DESC);

CREATE TABLE IF NOT EXISTS hydration_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id VARCHAR NOT NULL REFERENCES users(id),
  revision INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'withheld', 'expired', 'superseded')),
  mode TEXT,
  target_ml INTEGER,
  minimum_ml INTEGER,
  maximum_ml INTEGER,
  timezone TEXT,
  formula_id TEXT,
  formula_version TEXT,
  explanation_key TEXT,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  rationale_code TEXT NOT NULL,
  source_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id VARCHAR REFERENCES users(id),
  CONSTRAINT hydration_baselines_subject_revision_uniq UNIQUE (subject_user_id, revision),
  CONSTRAINT hydration_baselines_phase1_values_null CHECK (
    target_ml IS NULL AND minimum_ml IS NULL AND maximum_ml IS NULL
  )
);
CREATE INDEX IF NOT EXISTS hydration_baselines_subject_effective_idx
  ON hydration_baselines (subject_user_id, effective_at DESC);

CREATE TABLE IF NOT EXISTS hydration_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id VARCHAR NOT NULL REFERENCES users(id),
  modifier_type TEXT NOT NULL,
  timing_scope TEXT NOT NULL,
  delta_ml INTEGER,
  minimum_delta_ml INTEGER,
  maximum_delta_ml INTEGER,
  target_floor_ml INTEGER,
  target_ceiling_ml INTEGER,
  condition_key TEXT,
  conflict_group TEXT,
  policy_version_id UUID REFERENCES hydration_policy_versions(id),
  evidence_reference TEXT,
  explanation_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'withheld', 'expired', 'superseded')),
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  rationale_code TEXT NOT NULL,
  source_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id VARCHAR REFERENCES users(id),
  CONSTRAINT hydration_modifiers_phase1_values_null CHECK (
    delta_ml IS NULL AND minimum_delta_ml IS NULL AND maximum_delta_ml IS NULL
    AND target_floor_ml IS NULL AND target_ceiling_ml IS NULL
  )
);
CREATE INDEX IF NOT EXISTS hydration_modifiers_subject_effective_idx
  ON hydration_modifiers (subject_user_id, effective_at DESC);
CREATE INDEX IF NOT EXISTS hydration_modifiers_policy_idx
  ON hydration_modifiers (policy_version_id);

CREATE TABLE IF NOT EXISTS hydration_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id VARCHAR NOT NULL REFERENCES users(id),
  restriction_kind TEXT NOT NULL,
  metric TEXT NOT NULL,
  scope TEXT NOT NULL,
  minimum_value NUMERIC,
  maximum_value NUMERIC,
  unit TEXT NOT NULL,
  hard_stop BOOLEAN NOT NULL DEFAULT FALSE,
  severity TEXT NOT NULL,
  policy_version_id UUID REFERENCES hydration_policy_versions(id),
  explanation_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'withheld', 'expired', 'superseded')),
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  rationale_code TEXT NOT NULL,
  source_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id VARCHAR REFERENCES users(id),
  CONSTRAINT hydration_restrictions_phase1_values_null CHECK (
    minimum_value IS NULL AND maximum_value IS NULL AND hard_stop = FALSE
  )
);
CREATE INDEX IF NOT EXISTS hydration_restrictions_subject_effective_idx
  ON hydration_restrictions (subject_user_id, effective_at DESC);
CREATE INDEX IF NOT EXISTS hydration_restrictions_policy_idx
  ON hydration_restrictions (policy_version_id);

CREATE TABLE IF NOT EXISTS hydration_clinician_directives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id VARCHAR NOT NULL REFERENCES users(id),
  organization_id VARCHAR,
  author_user_id VARCHAR REFERENCES users(id),
  directive_kind TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_ml INTEGER,
  minimum_ml INTEGER,
  maximum_ml INTEGER,
  review_at TIMESTAMPTZ,
  reason_code TEXT NOT NULL,
  consent_reference TEXT,
  policy_version_id UUID REFERENCES hydration_policy_versions(id),
  status TEXT NOT NULL CHECK (status IN ('draft', 'withheld', 'expired', 'superseded')),
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  rationale_code TEXT NOT NULL,
  source_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id VARCHAR REFERENCES users(id),
  CONSTRAINT hydration_clinician_directives_phase1_values_null CHECK (
    target_ml IS NULL AND minimum_ml IS NULL AND maximum_ml IS NULL
  )
);
CREATE INDEX IF NOT EXISTS hydration_clinician_directives_subject_effective_idx
  ON hydration_clinician_directives (subject_user_id, effective_at DESC);
CREATE INDEX IF NOT EXISTS hydration_clinician_directives_organization_subject_idx
  ON hydration_clinician_directives (organization_id, subject_user_id);

CREATE TABLE IF NOT EXISTS hydration_plan_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id VARCHAR NOT NULL REFERENCES users(id),
  local_date DATE NOT NULL,
  timezone TEXT NOT NULL,
  revision INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('monitor_only', 'needs_review', 'blocked')),
  target_kind TEXT NOT NULL CHECK (target_kind = 'monitor_only'),
  target_ml INTEGER,
  minimum_ml INTEGER,
  maximum_ml INTEGER,
  remaining_ml INTEGER,
  calculation_policy_version_id UUID NOT NULL REFERENCES hydration_policy_versions(id),
  input_snapshot_hash TEXT NOT NULL,
  policy_version_manifest JSONB NOT NULL,
  missing_data_codes TEXT[] NOT NULL,
  rationale_codes TEXT[] NOT NULL,
  explanation_keys TEXT[] NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hydration_plan_revisions_subject_date_revision_uniq
    UNIQUE (subject_user_id, local_date, revision),
  CONSTRAINT hydration_plan_revisions_phase1_values_null CHECK (
    target_ml IS NULL AND minimum_ml IS NULL AND maximum_ml IS NULL
    AND remaining_ml IS NULL
  )
);
CREATE INDEX IF NOT EXISTS hydration_plan_revisions_subject_date_effective_idx
  ON hydration_plan_revisions (subject_user_id, local_date, effective_at DESC);

CREATE TABLE IF NOT EXISTS hydration_intake_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id VARCHAR NOT NULL REFERENCES users(id),
  occurred_at TIMESTAMPTZ NOT NULL,
  occurred_timezone TEXT NOT NULL,
  local_date DATE NOT NULL,
  volume_ml INTEGER NOT NULL CHECK (volume_ml > 0),
  original_amount NUMERIC(12, 3) NOT NULL CHECK (original_amount > 0),
  original_unit TEXT NOT NULL CHECK (original_unit IN ('ml', 'l', 'oz', 'fl_oz', 'cup')),
  beverage_class TEXT NOT NULL CHECK (
    beverage_class IN (
      'water', 'oral_rehydration', 'electrolyte_drink', 'coffee', 'tea',
      'juice', 'milk', 'alcohol', 'other', 'unknown'
    )
  ),
  source TEXT NOT NULL CHECK (
    source IN ('manual', 'import', 'beverage_recipe', 'wearable', 'clinician_entry', 'legacy_manual')
  ),
  source_event_id TEXT,
  idempotency_key UUID NOT NULL,
  payload_hash TEXT NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entered_by_user_id VARCHAR NOT NULL REFERENCES users(id),
  client_instance_id UUID,
  observed_plan_revision_id UUID REFERENCES hydration_plan_revisions(id),
  note TEXT,
  declared_nutrients JSONB,
  CONSTRAINT hydration_intake_events_owner_idempotency_uniq
    UNIQUE (subject_user_id, idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS hydration_intake_events_source_event_uniq
  ON hydration_intake_events (source, source_event_id)
  WHERE source_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS hydration_intake_events_owner_local_date_occurred_idx
  ON hydration_intake_events (subject_user_id, local_date, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS hydration_intake_events_owner_occurred_idx
  ON hydration_intake_events (subject_user_id, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS hydration_intake_events_observed_plan_idx
  ON hydration_intake_events (observed_plan_revision_id);

CREATE TABLE IF NOT EXISTS hydration_event_supersessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id VARCHAR NOT NULL REFERENCES users(id),
  prior_event_id UUID NOT NULL REFERENCES hydration_intake_events(id),
  successor_event_id UUID REFERENCES hydration_intake_events(id),
  kind TEXT NOT NULL CHECK (kind IN ('correction', 'void')),
  reason_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id VARCHAR NOT NULL REFERENCES users(id),
  correlation_id TEXT NOT NULL,
  CONSTRAINT hydration_event_supersessions_prior_uniq UNIQUE (prior_event_id)
);
CREATE INDEX IF NOT EXISTS hydration_event_supersessions_subject_created_idx
  ON hydration_event_supersessions (subject_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hydration_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id VARCHAR REFERENCES users(id),
  subject_user_id VARCHAR REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  outcome TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  policy_version_id UUID REFERENCES hydration_policy_versions(id),
  plan_revision_id UUID REFERENCES hydration_plan_revisions(id),
  metadata_redacted JSONB
);
CREATE INDEX IF NOT EXISTS hydration_audit_subject_occurred_idx
  ON hydration_audit_log (subject_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS hydration_audit_actor_occurred_idx
  ON hydration_audit_log (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS hydration_audit_resource_idx
  ON hydration_audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS hydration_audit_correlation_idx
  ON hydration_audit_log (correlation_id);

CREATE TABLE IF NOT EXISTS hydration_plan_supersessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prior_plan_revision_id UUID NOT NULL REFERENCES hydration_plan_revisions(id),
  successor_plan_revision_id UUID NOT NULL REFERENCES hydration_plan_revisions(id),
  subject_user_id VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id VARCHAR REFERENCES users(id),
  reason_code TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  CONSTRAINT hydration_plan_supersessions_prior_uniq UNIQUE (prior_plan_revision_id),
  CONSTRAINT hydration_plan_supersessions_successor_uniq UNIQUE (successor_plan_revision_id)
);

CREATE TABLE IF NOT EXISTS hydration_plan_revision_input_refs (
  plan_revision_id UUID NOT NULL REFERENCES hydration_plan_revisions(id),
  input_kind TEXT NOT NULL,
  input_id UUID NOT NULL,
  input_revision INTEGER,
  input_hash TEXT,
  disposition TEXT NOT NULL CHECK (
    disposition IN ('used', 'withheld', 'missing', 'conflicted')
  ),
  reason_code TEXT NOT NULL,
  PRIMARY KEY (plan_revision_id, input_kind, input_id)
);
CREATE INDEX IF NOT EXISTS hydration_plan_revision_input_refs_input_idx
  ON hydration_plan_revision_input_refs (input_kind, input_id);

CREATE TABLE IF NOT EXISTS hydration_event_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES hydration_intake_events(id),
  plan_revision_id UUID NOT NULL REFERENCES hydration_plan_revisions(id),
  contribution_ml INTEGER,
  method TEXT NOT NULL CHECK (method IN ('unknown', 'direct_water', 'declared_beverage', 'recipe_derived', 'estimated')),
  confidence TEXT NOT NULL CHECK (confidence IN ('not_available', 'low', 'medium', 'high')),
  assumption_codes TEXT[] NOT NULL,
  excluded_reason TEXT,
  algorithm_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hydration_event_contributions_event_plan_uniq UNIQUE (event_id, plan_revision_id),
  CONSTRAINT hydration_event_contributions_phase1_unknown CHECK (
    contribution_ml IS NULL AND method = 'unknown' AND confidence = 'not_available'
  )
);

CREATE TABLE IF NOT EXISTS hydration_electrolyte_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id VARCHAR NOT NULL REFERENCES users(id),
  local_date DATE NOT NULL,
  timezone TEXT NOT NULL,
  plan_revision_id UUID NOT NULL UNIQUE REFERENCES hydration_plan_revisions(id),
  coverage TEXT NOT NULL CHECK (coverage IN ('not_tracked', 'water_only', 'partial', 'complete')),
  sodium_mg NUMERIC,
  potassium_mg NUMERIC,
  magnesium_mg NUMERIC,
  source_count INTEGER NOT NULL DEFAULT 0,
  warning_codes TEXT[] NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hydration_electrolyte_ledgers_phase1_unknown CHECK (
    sodium_mg IS NULL AND potassium_mg IS NULL AND magnesium_mg IS NULL
    AND coverage IN ('not_tracked', 'water_only')
  )
);
CREATE INDEX IF NOT EXISTS hydration_electrolyte_ledgers_subject_date_idx
  ON hydration_electrolyte_ledgers (subject_user_id, local_date);

CREATE TABLE IF NOT EXISTS hydration_daily_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id VARCHAR NOT NULL REFERENCES users(id),
  local_date DATE NOT NULL,
  timezone TEXT NOT NULL,
  state_version INTEGER NOT NULL,
  effective_plan_revision_id UUID NOT NULL REFERENCES hydration_plan_revisions(id),
  input_watermark TEXT NOT NULL,
  active_event_count INTEGER NOT NULL CHECK (active_event_count >= 0),
  total_declared_volume_ml INTEGER NOT NULL CHECK (total_declared_volume_ml >= 0),
  known_contribution_ml INTEGER,
  unknown_contribution_event_count INTEGER NOT NULL CHECK (unknown_contribution_event_count >= 0),
  last_event_at TIMESTAMPTZ,
  electrolyte_ledger_id UUID NOT NULL REFERENCES hydration_electrolyte_ledgers(id),
  plan_status TEXT NOT NULL CHECK (plan_status IN ('monitor_only', 'needs_review', 'blocked')),
  progress_status TEXT NOT NULL CHECK (progress_status = 'unknown'),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculation_policy_version_id UUID NOT NULL REFERENCES hydration_policy_versions(id),
  projection_hash TEXT NOT NULL,
  CONSTRAINT hydration_daily_states_subject_date_version_uniq
    UNIQUE (subject_user_id, local_date, state_version),
  CONSTRAINT hydration_daily_states_phase1_unknown CHECK (known_contribution_ml IS NULL)
);
CREATE INDEX IF NOT EXISTS hydration_daily_states_subject_date_version_idx
  ON hydration_daily_states (subject_user_id, local_date, state_version DESC);

CREATE TABLE IF NOT EXISTS hydration_backfill_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backfill_version TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'rolled_back')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  source_count INTEGER NOT NULL DEFAULT 0,
  mapped_count INTEGER NOT NULL DEFAULT 0,
  mismatch_count INTEGER NOT NULL DEFAULT 0,
  source_checksum TEXT,
  canonical_checksum TEXT,
  watermark TEXT,
  error_code TEXT
);

CREATE TABLE IF NOT EXISTS hydration_legacy_event_mappings (
  legacy_water_log_id UUID PRIMARY KEY REFERENCES water_logs(id),
  hydration_event_id UUID NOT NULL UNIQUE REFERENCES hydration_intake_events(id),
  source_row_hash TEXT NOT NULL,
  backfill_version TEXT NOT NULL,
  mapped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  backfill_run_id UUID NOT NULL REFERENCES hydration_backfill_runs(id)
);
CREATE INDEX IF NOT EXISTS hydration_legacy_event_mappings_run_idx
  ON hydration_legacy_event_mappings (backfill_run_id);

CREATE OR REPLACE FUNCTION reject_hydration_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'HYDRATION_APPEND_ONLY_TABLE';
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'hydration_intake_events',
    'hydration_event_supersessions',
    'hydration_plan_revisions',
    'hydration_plan_supersessions',
    'hydration_event_contributions',
    'hydration_electrolyte_ledgers',
    'hydration_daily_states',
    'hydration_audit_log'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = table_name || '_immutable_trigger'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_hydration_immutable_mutation()',
        table_name || '_immutable_trigger',
        table_name
      );
    END IF;
  END LOOP;
END
$$;