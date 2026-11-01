-- PREPARED ONLY. Never add to startup, build, or the general migration runner.
-- Shared external Neon: separate schema approval is required before execution.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';

CREATE TABLE public.personal_clinical_reconciliation_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  approved_by_user_id varchar REFERENCES public.users(id) ON DELETE SET NULL,
  approval_reference text NOT NULL CHECK (length(btrim(approval_reference)) >= 8),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by_user_id varchar REFERENCES public.users(id) ON DELETE SET NULL,
  revocation_reason text,
  revocation_approval_reference text,
  UNIQUE (user_id, business_id),
  CHECK (isfinite(starts_at) AND isfinite(ends_at)
    AND ends_at = starts_at + interval '720 hours'),
  CHECK (
    (status = 'active' AND revoked_at IS NULL AND revoked_by_user_id IS NULL
      AND revocation_reason IS NULL AND revocation_approval_reference IS NULL)
    OR
    (status = 'revoked' AND revoked_at IS NOT NULL AND isfinite(revoked_at)
      AND length(btrim(revocation_reason)) >= 8 AND revocation_reason IS NOT NULL
      AND length(btrim(revocation_approval_reference)) >= 8
      AND revocation_approval_reference IS NOT NULL)
  )
);

-- Bind issuance to the existing organization window, not a fresh trial.
-- Once issued, identity/window/provenance cannot be changed or reactivated.
CREATE FUNCTION public.protect_personal_clinical_reconciliation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE b public.businesses%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO b FROM public.businesses WHERE id = NEW.business_id FOR SHARE;
    IF b.id IS NULL OR b.owner_user_id IS DISTINCT FROM NEW.user_id
      OR b.status IS DISTINCT FROM 'active'
      OR b.commercial_access_mode IS DISTINCT FROM 'onboarding_pilot'
      OR b.commercial_access_started_at IS DISTINCT FROM NEW.starts_at
      OR b.commercial_access_ends_at IS DISTINCT FROM NEW.ends_at
      OR NEW.starts_at > transaction_timestamp() OR NEW.ends_at <= transaction_timestamp()
      OR NEW.status <> 'active' OR NEW.approved_by_user_id IS NULL
    THEN RAISE EXCEPTION 'Reconciliation requires the exact existing active owner pilot'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.approved_by_user_id
      AND (is_founder IS TRUE OR is_admin IS TRUE))
    THEN RAISE EXCEPTION 'Reconciliation requires an authorized approving operator'; END IF;
  ELSE
    IF ROW(NEW.id, NEW.user_id, NEW.business_id, NEW.starts_at, NEW.ends_at,
      NEW.approval_reference, NEW.reason, NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id, OLD.user_id, OLD.business_id, OLD.starts_at, OLD.ends_at,
      OLD.approval_reference, OLD.reason, OLD.created_at)
      OR (OLD.status = 'revoked' AND ROW(NEW.status, NEW.revoked_at,
        NEW.revocation_reason, NEW.revocation_approval_reference)
        IS DISTINCT FROM ROW(OLD.status, OLD.revoked_at,
        OLD.revocation_reason, OLD.revocation_approval_reference))
    THEN RAISE EXCEPTION 'Reconciliation identity, window and audit history are immutable'; END IF;
    -- Nullable actor references may be cleared by account erasure, not reassigned.
    IF (NEW.approved_by_user_id IS DISTINCT FROM OLD.approved_by_user_id
        AND NEW.approved_by_user_id IS NOT NULL)
      OR (OLD.revoked_by_user_id IS NOT NULL
        AND NEW.revoked_by_user_id IS DISTINCT FROM OLD.revoked_by_user_id
        AND NEW.revoked_by_user_id IS NOT NULL)
    THEN RAISE EXCEPTION 'Reconciliation audit actors cannot be reassigned'; END IF;
    IF OLD.status = 'active' AND NEW.status = 'revoked' THEN
      IF NEW.revoked_by_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.users WHERE id = NEW.revoked_by_user_id
        AND (is_founder IS TRUE OR is_admin IS TRUE))
      THEN RAISE EXCEPTION 'Revocation requires an authorized approving operator'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER personal_clinical_reconciliation_protection
  BEFORE INSERT OR UPDATE ON public.personal_clinical_reconciliation_grants
  FOR EACH ROW EXECUTE FUNCTION public.protect_personal_clinical_reconciliation();
COMMIT;
