\set ON_ERROR_STOP on
-- DBA-only, separately approved. Never schedule or bundle into publish/startup.
-- Required -v: approved_by_user_id=<verified founder/admin account ID>
--              approval_reference=<external approval record ID>
-- Optional -v apply=true: without it the transaction is always rolled back.
-- Run ONLY after the migration, published reader and schema switch verification.
\if :{?approved_by_user_id}
\else
  \echo 'Missing approving operator ID; no change.'
  \quit
\endif
\if :{?approval_reference}
\else
  \echo 'Missing approval reference; no change.'
  \quit
\endif
\if :{?apply}
\else
  \set apply false
\endif

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
SELECT set_config('mpm.reconcile.operator', :'approved_by_user_id', true),
       set_config('mpm.reconcile.approval', :'approval_reference', true);

DO $reconcile$
DECLARE v_user_id varchar;
        v_business_id uuid;
        v_start timestamptz;
        v_end timestamptz;
        v_existing public.personal_clinical_reconciliation_grants%ROWTYPE;
        v_operator varchar := current_setting('mpm.reconcile.operator');
        v_approval text := current_setting('mpm.reconcile.approval');
BEGIN
  IF length(btrim(v_approval)) < 8 OR NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = v_operator
      AND (is_founder IS TRUE OR is_admin IS TRUE)
  ) THEN RAISE EXCEPTION 'Verified approving operator and approval record required'; END IF;

  SELECT id INTO v_user_id FROM public.users
    WHERE lower(email) = 'eric@drericfete.com' FOR UPDATE;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Exact existing account not found'; END IF;

  SELECT id, commercial_access_started_at, commercial_access_ends_at
    INTO v_business_id, v_start, v_end
    FROM public.businesses
    WHERE name = 'Dr. Eric Prime-X' AND owner_user_id = v_user_id
      AND status = 'active' AND plan = 'clinical_business_monthly'
      AND commercial_access_mode = 'onboarding_pilot'
    FOR UPDATE;
  IF v_business_id IS NULL OR v_start IS DISTINCT FROM
      '2026-10-12T15:41:27.737Z'::timestamptz
    OR v_end IS DISTINCT FROM '2026-11-11T15:41:27.737Z'::timestamptz
    OR transaction_timestamp() >= v_end
  THEN RAISE EXCEPTION 'Existing pilot identity or exact window changed; stop'; END IF;

  SELECT * INTO v_existing FROM public.personal_clinical_reconciliation_grants
    WHERE user_id = v_user_id AND business_id = v_business_id FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.status <> 'active'
       OR v_existing.starts_at IS DISTINCT FROM v_start
       OR v_existing.ends_at IS DISTINCT FROM v_end
    THEN RAISE EXCEPTION 'Existing grant conflicts with the authorized window; stop'; END IF;
    RAISE NOTICE 'Already reconciled: existing grant unchanged';
  ELSE
    INSERT INTO public.personal_clinical_reconciliation_grants
      (user_id,business_id,starts_at,ends_at,approved_by_user_id,approval_reference,reason)
      VALUES (v_user_id,v_business_id,v_start,v_end,v_operator,v_approval,
        'Approved restoration of missing personal Clinical access');
    RAISE NOTICE 'Grant staged against the original organization window';
  END IF;
END
$reconcile$;

-- Confirm scope in the SAME transaction. Never print email or a token.
SELECT g.status, g.starts_at, g.ends_at, g.revoked_at,
       b.commercial_access_started_at AS business_starts_at,
       b.commercial_access_ends_at AS business_ends_at
FROM public.personal_clinical_reconciliation_grants g
JOIN public.businesses b ON b.id = g.business_id
WHERE b.name = 'Dr. Eric Prime-X' AND g.user_id = b.owner_user_id;

\if :apply
  COMMIT;
  \echo 'APPROVED APPLY: transaction committed; verify read-only access and exact organization window.'
\else
  ROLLBACK;
  \echo 'DRY RUN: transaction rolled back; no grant was saved.'
\endif
