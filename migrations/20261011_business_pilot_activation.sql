-- REVIEW ONLY. Not registered with startup and must not run without separate approval.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';

-- Companion table avoids adding columns to existing SELECT * projections before release.
CREATE TABLE IF NOT EXISTS business_pilot_activation_links (
  authorization_id uuid PRIMARY KEY REFERENCES business_pilot_authorizations(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  invitation_expires_at timestamptz NOT NULL,
  activated_user_id varchar(255) REFERENCES users(id) ON DELETE RESTRICT,
  personal_access_started_at timestamptz,
  personal_access_ends_at timestamptz,
  business_id uuid UNIQUE REFERENCES businesses(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (activated_user_id IS NULL AND personal_access_started_at IS NULL AND personal_access_ends_at IS NULL)
    OR
    (activated_user_id IS NOT NULL AND personal_access_started_at IS NOT NULL
      AND personal_access_ends_at = personal_access_started_at + interval '720 hours')
  )
);
CREATE INDEX IF NOT EXISTS business_pilot_activation_user_idx
  ON business_pilot_activation_links(activated_user_id);

CREATE TABLE IF NOT EXISTS organization_checkout_consents (
  reservation_id text PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  actor_user_id varchar(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  price_id text NOT NULL,
  unit_amount integer NOT NULL CHECK (unit_amount >= 0),
  currency text NOT NULL,
  billing_interval text NOT NULL,
  interval_count integer NOT NULL CHECK (interval_count > 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity = 1),
  terms_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
