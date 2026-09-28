ALTER TABLE studio_billing
  ADD COLUMN IF NOT EXISTS stripe_checkout_reservation_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS studio_billing_checkout_session_id_uniq
  ON studio_billing (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;