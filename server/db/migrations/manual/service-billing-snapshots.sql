-- NOT APPLIED. Requires explicit release approval and verified webhook writer.
-- This table records one current verified Stripe subscription snapshot, not
-- entitlement, membership, or workspace visibility.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE IF NOT EXISTS stripe_service_subscription_snapshots (
  stripe_subscription_id text PRIMARY KEY,
  stripe_customer_id text NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('personal', 'professional', 'organization')),
  owner_user_id text NOT NULL,
  business_id uuid,
  studio_id uuid,
  price_id text NOT NULL,
  product_id text NOT NULL,
  trusted_plan_key text NOT NULL,
  status text NOT NULL,
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL,
  terminal_at timestamptz,
  source_event_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('webhook', 'reconciliation', 'backfill')),
  event_created_at timestamptz NOT NULL,
  event_rank integer NOT NULL,
  verified_at timestamptz NOT NULL,
  CONSTRAINT service_billing_attachment_scope CHECK (
    (service_type = 'organization' AND business_id IS NOT NULL AND studio_id IS NULL)
    OR (service_type IN ('personal', 'professional') AND business_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS service_billing_snapshots_owner_idx
  ON stripe_service_subscription_snapshots (owner_user_id, service_type);
CREATE INDEX IF NOT EXISTS service_billing_snapshots_business_idx
  ON stripe_service_subscription_snapshots (business_id);
CREATE INDEX IF NOT EXISTS service_billing_snapshots_studio_idx
  ON stripe_service_subscription_snapshots (studio_id);
COMMIT;