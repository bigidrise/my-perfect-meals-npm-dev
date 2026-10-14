-- REVIEW ONLY. Not registered with startup and must not run without separate approval.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';

-- Companion table avoids adding columns to existing SELECT * projections before release.
CREATE TABLE IF NOT EXISTS public.business_pilot_activation_links (
  authorization_id uuid PRIMARY KEY REFERENCES public.business_pilot_authorizations(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  invitation_expires_at timestamptz NOT NULL CHECK (isfinite(invitation_expires_at)),
  -- An activation capability belongs to its account, not to billing history.
  -- Erasure deletes this capability/hash; the retained authorization cannot redeem it.
  activated_user_id varchar REFERENCES public.users(id) ON DELETE CASCADE,
  personal_access_started_at timestamptz,
  personal_access_ends_at timestamptz,
  -- Business cleanup must not remove the user's independent personal window.
  business_id uuid UNIQUE REFERENCES public.businesses(id) ON DELETE SET NULL,
  organization_consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_pilot_activation_window_check CHECK (
    (activated_user_id IS NULL AND personal_access_started_at IS NULL AND personal_access_ends_at IS NULL)
    OR
    (activated_user_id IS NOT NULL AND personal_access_started_at IS NOT NULL
      AND personal_access_ends_at IS NOT NULL
      AND isfinite(personal_access_started_at) AND isfinite(personal_access_ends_at)
      AND personal_access_ends_at = personal_access_started_at + interval '720 hours')
  ),
  CONSTRAINT business_pilot_activation_organization_check CHECK (
    (business_id IS NULL OR organization_consumed)
    AND (NOT organization_consumed OR activated_user_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS business_pilot_activation_user_idx
  ON public.business_pilot_activation_links(activated_user_id);

-- Keep the minimal financial consent snapshot, not an erased person's identity.
-- These nullable references are never sufficient to authorize receipt reuse.
-- No retention duration is invented here; deletion scheduling needs its own policy.
CREATE TABLE IF NOT EXISTS public.organization_checkout_consents (
  reservation_id text PRIMARY KEY,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  actor_user_id varchar REFERENCES public.users(id) ON DELETE SET NULL,
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
