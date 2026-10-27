-- MANUAL APPROVAL REQUIRED. Not registered in application startup.
-- This is additive shared-Neon DDL; do not execute during fixture verification.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';
CREATE TABLE IF NOT EXISTS business_pilot_clinical_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  authorization_source text NOT NULL CHECK (authorization_source = 'explicit_business_pilot_reconciliation_v1'),
  approval_reference text NOT NULL CHECK (approval_reference ~ '^[a-f0-9]{64}$'),
  approved_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
  correction_reason text NOT NULL CHECK (length(trim(correction_reason)) BETWEEN 10 AND 2000),
  original_pilot_started_at timestamptz NOT NULL,
  original_pilot_ends_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by_user_id varchar(255) REFERENCES users(id) ON DELETE SET NULL,
  revocation_reference text CHECK (revocation_reference ~ '^[a-f0-9]{64}$'),
  CHECK (original_pilot_started_at < original_pilot_ends_at),
  CHECK (expires_at = original_pilot_ends_at),
  CHECK (granted_at >= original_pilot_started_at AND granted_at < expires_at),
  CHECK ((revoked_at IS NULL AND revoked_by_user_id IS NULL AND revocation_reference IS NULL)
    OR (revoked_at IS NOT NULL AND revocation_reference IS NOT NULL)),
  UNIQUE (user_id, organization_id, source_business_id, original_pilot_started_at, original_pilot_ends_at)
);
CREATE INDEX IF NOT EXISTS business_pilot_clinical_reconciliations_user_idx
  ON business_pilot_clinical_reconciliations(user_id, expires_at) WHERE revoked_at IS NULL;
COMMIT;
