\set ON_ERROR_STOP on
-- DBA-only emergency revocation. Required -v approved_by_user_id and
-- -v approval_reference. Without -v apply=true this rolls back.
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
DO $revoke$
DECLARE v_grant public.personal_clinical_reconciliation_grants%ROWTYPE;
        v_operator varchar := current_setting('mpm.reconcile.operator');
        v_approval text := current_setting('mpm.reconcile.approval');
BEGIN
  IF length(btrim(v_approval)) < 8 OR NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = v_operator
      AND (is_founder IS TRUE OR is_admin IS TRUE)
  ) THEN RAISE EXCEPTION 'Verified approving operator and approval record required'; END IF;
  SELECT g.* INTO v_grant FROM public.personal_clinical_reconciliation_grants g
    JOIN public.businesses b ON b.id = g.business_id
    JOIN public.users u ON u.id = g.user_id
    WHERE lower(u.email) = 'eric@drericfete.com'
      AND b.name = 'Dr. Eric Prime-X' AND b.owner_user_id = u.id
      AND g.starts_at = '2026-10-12T15:41:27.737Z'::timestamptz
      AND g.ends_at = '2026-11-11T15:41:27.737Z'::timestamptz
    FOR UPDATE OF g;
  IF v_grant.id IS NULL THEN RAISE EXCEPTION 'Exact grant not found; stop'; END IF;
  IF v_grant.status = 'revoked' THEN
    RAISE NOTICE 'Already revoked; audit unchanged';
  ELSE
    UPDATE public.personal_clinical_reconciliation_grants
      SET status='revoked', revoked_at=transaction_timestamp(),
        revoked_by_user_id=v_operator,
        revocation_reason='Approved revocation of personal Clinical reconciliation',
        revocation_approval_reference=v_approval
      WHERE id=v_grant.id;
    RAISE NOTICE 'Revocation staged; organization pilot unchanged';
  END IF;
END
$revoke$;
\if :apply
  COMMIT;
  \echo 'APPROVED APPLY: revocation committed; verify entitlement denied.'
\else
  ROLLBACK;
  \echo 'DRY RUN: transaction rolled back; no grant was revoked.'
\endif
