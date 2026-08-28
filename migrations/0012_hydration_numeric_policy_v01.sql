-- Hydration numeric policy v0.1.
-- Development-side schema for product-approved clinician directives.
-- This does not activate production routes or numeric consumer behavior.

ALTER TABLE hydration_policy_versions
  DROP CONSTRAINT IF EXISTS hydration_policy_versions_status_check;

ALTER TABLE hydration_policy_versions
  ADD CONSTRAINT hydration_policy_versions_status_check
  CHECK (status IN ('draft', 'withheld', 'approved_inactive', 'active', 'retired'));

ALTER TABLE hydration_clinician_directives
  DROP CONSTRAINT IF EXISTS hydration_clinician_directives_status_check;

ALTER TABLE hydration_clinician_directives
  ADD CONSTRAINT hydration_clinician_directives_status_check
  CHECK (status IN ('draft', 'active', 'withheld', 'expired', 'revoked', 'superseded'));

ALTER TABLE hydration_clinician_directives
  DROP CONSTRAINT IF EXISTS hydration_clinician_directives_phase1_values_null;

ALTER TABLE hydration_clinician_directives
  DROP CONSTRAINT IF EXISTS hydration_clinician_directives_target_shape_check;

ALTER TABLE hydration_clinician_directives
  ADD CONSTRAINT hydration_clinician_directives_target_shape_check CHECK (
    (
      target_kind = 'point'
      AND target_ml > 0
      AND minimum_ml IS NULL
      AND maximum_ml IS NULL
    )
    OR (
      target_kind = 'range'
      AND target_ml IS NULL
      AND minimum_ml > 0
      AND maximum_ml >= minimum_ml
    )
    OR (
      target_kind = 'floor'
      AND target_ml IS NULL
      AND minimum_ml > 0
      AND maximum_ml IS NULL
    )
    OR (
      target_kind = 'ceiling'
      AND target_ml IS NULL
      AND minimum_ml IS NULL
      AND maximum_ml > 0
    )
  );

INSERT INTO hydration_policy_versions (
  policy_key,
  version,
  kind,
  status,
  content_hash,
  manifest,
  effective_at
)
VALUES (
  'MPM-HYDRATION-NUMERIC-POLICY',
  'v0.1',
  'future_policy_manifest',
  'approved_inactive',
  'product-approved-2026-08-27-clinician-defined-only',
  '{"automaticBaseline":false,"clinicianDirectiveRequired":true,"intakeLedger":"water_logs","productionActivation":false}'::jsonb,
  NOW()
)
ON CONFLICT (policy_key, version) DO UPDATE
SET
  status = 'approved_inactive',
  content_hash = EXCLUDED.content_hash,
  manifest = EXCLUDED.manifest;