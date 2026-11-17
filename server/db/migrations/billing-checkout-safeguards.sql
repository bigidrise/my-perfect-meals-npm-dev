-- REVIEW/APPLY MANUALLY ONLY after shared-Neon migration authorization.
-- Intentionally NOT registered in either startup migration path.
CREATE TABLE IF NOT EXISTS billing_checkout_operations (
  operation_id uuid PRIMARY KEY,
  subject_key text NOT NULL,
  subject jsonb NOT NULL,
  account_id text NOT NULL,
  livemode boolean NOT NULL,
  plan_key text NOT NULL,
  request_payload jsonb NOT NULL,
  customer_id text,
  session_id text UNIQUE,
  state text NOT NULL DEFAULT 'reserved'
    CHECK (state IN ('reserved','open','complete','review_required','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  CHECK ((state = 'retired') = (retired_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_checkout_one_current_subject
  ON billing_checkout_operations (account_id, livemode, subject_key) WHERE retired_at IS NULL;
CREATE TABLE IF NOT EXISTS billing_duplicate_incidents (
  fingerprint text PRIMARY KEY,
  account_id text NOT NULL,
  livemode boolean NOT NULL,
  subject_key text NOT NULL,
  category text NOT NULL,
  subscription_ids jsonb NOT NULL,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','acknowledged','resolved')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_alert_at timestamptz,
  resolved_at timestamptz
);
CREATE TABLE IF NOT EXISTS billing_safeguard_scans (
  account_id text NOT NULL,
  livemode boolean NOT NULL,
  completed_at timestamptz NOT NULL,
  subscription_count integer NOT NULL,
  PRIMARY KEY (account_id, livemode)
);
CREATE TABLE IF NOT EXISTS billing_plan_change_operations (
  operation_id uuid PRIMARY KEY,
  account_id text NOT NULL,
  livemode boolean NOT NULL,
  subject_key text NOT NULL,
  owner_user_id text NOT NULL,
  subscription_id text NOT NULL,
  customer_id text NOT NULL,
  previous_price_id text NOT NULL,
  target_price_id text NOT NULL,
  target_plan_key text NOT NULL,
  quote jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','applying','applied','expired','review_required')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_one_pending_plan_change
  ON billing_plan_change_operations(account_id,livemode,subject_key) WHERE state IN ('pending','applying','review_required');
