# Business Pilot — source-only safety corrections

This report supersedes the original report's schema/deletion description. This
is source review, not permission to apply shared-Neon DDL or enable activation.

**Later installation status:** The unchanged migration was subsequently committed
and verified under separate approval. See
`docs/business-pilot-controlled-schema-installation-report.md`. Activation remains disabled.

## Corrected expiration contract

The review SQL requires an activated user, a non-null start, a non-null end,
finite timestamps, and exactly 720 elapsed hours. Pending invitations may have
all three activation fields null. Finite invitation deadlines are required too.

Application validation rejects null, missing, invalid, numeric infinity and
PostgreSQL infinity values before granting access. It verifies the exact duration
on stored grants, inspection and replay, and rejects corrupt partial activation.
Replay returns the existing window without writing or starting another month.

The migration is explicitly qualified to `public`, matching the reviewed live
parent schema. It still creates only the two proposed companion tables and the
lookup index. It is not a repair migration for a differently shaped existing
table: `IF NOT EXISTS` still requires structural verification before approval.

## Account erasure and Business cleanup

### Account-owned activation capability

`activated_user_id` uses `ON DELETE CASCADE` specifically for the activation
capability. There is no financial audit requirement established for retaining
that capability or its token hash after account erasure. Deleting the account
removes that one account-owned record. It does not cascade through Business,
other accounts, patient trials, clinical data, or consent receipts.

The old invitation token then resolves to no activation record and cannot be
reclaimed or reset. Existing authorization records remain subject to their
existing policy; this change does not invent cleanup of legacy authorizations
or claim that all legacy identifying data has been removed.

The current professional-lifecycle erasure service/trigger stays unchanged:
its existing minimization and protection rules still execute, and the database
handles these new FK effects in the same transaction. This also works with
older Production application code once the separately approved schema exists.
Existing unrelated deletion restrictions remain enforced.

### Minimal financial consent evidence

Consent `actor_user_id` and `business_id` are nullable `ON DELETE SET NULL`
references. Erasing an account removes its direct actor reference; deleting the
Business removes its Business reference. The receipt's opaque reservation,
price, amount, currency, recurrence, quantity, terms version, and acceptance
time remain as the minimal financial consent snapshot.

No email, name, credential, IP address, payment method or raw invitation token
was added to that receipt. An opaque reservation may still correlate with
external billing records; this is minimized audit evidence, not a claim of
irreversible anonymity. Archived/null-reference receipts cannot authorize
another owner, account or Business: the existing exact-subject consent query
fails closed against null references.

No specific financial-consent retention duration has been supplied. The
separate general audit-log six-year policy is not automatically applied here,
and no speculative purge schedule or legal-compliance claim is introduced.
Financial retention/purge policy remains a policy-owner review item before
automatic removal or a claim of complete retention compliance.

### Business deletion does not restart personal access

The activation's `business_id` uses `ON DELETE SET NULL`. Its original personal
dates remain. A separate non-identifying `organization_consumed` Boolean stays
true, so the same invitation cannot fund another Business after cleanup.
Binding atomically sets the reference and marker, and fails if already consumed.

The existing authenticated Development-only reset route keeps its environment
and ownership checks. Its three deletions are now one transaction. Any remaining
legacy FK failure restores the invitations, memberships and Business together,
rather than leaving partially deleted records.

## Isolated verification

**Result:** 176 unique tests pass across eight suites, including 20 actual
PostgreSQL constraint/FK cases. The final PostgreSQL case was rerun after
correcting its expectation for Drizzle's wrapped error; the remaining 19 passed
in the preceding run. Seven other suites passed unchanged.

The application typecheck matched the exact reviewed 121-diagnostic legacy
baseline; the baseline was not changed. `git diff --check` passed.

Tests remove database/Stripe credentials from their child environment.
The SQL safety suite uses existing PostgreSQL binaries to create a disposable
private Unix-socket cluster with no TCP listener and no connection-string
fallback. Only synthetic fixtures are used. SQL is exercised inside this local
test fixture, never against Neon or an application database. The fixture is
stopped and removed after testing.

The tests exercise the actual proposed constraints/FKs and the unchanged
professional-lifecycle migrations/erasure trigger in that disposable fixture.
They cover null/invalid/infinite dates, off-by-one duration, DST, replay,
idempotency, account erasure, minimal receipt retention, consent denial after
detachment, Business cleanup, permanent consumption, foreign-key rejection,
transaction rollback and preservation of another patient's independent trial.

Actual shared-Neon execution, installed-schema verification, authenticated
screens, controlled restart, founder-to-patient E2E and TEST-Stripe continuation
remain subject to separate approval.

**Recommendation:** The two demonstrated safety blockers are corrected. The
revised migration is ready to submit for separate approval, not to execute or
enable. Verify the exact schema after authorized installation and confirm the
financial-consent retention policy before live paid continuation.

## Changed source and test files

- `migrations/20261011_business_pilot_activation.sql`
- `server/services/businessPilotActivationPolicy.ts`
- `server/services/businessPilotActivationService.ts`
- `server/services/developmentBusinessCleanup.ts`
- `server/routes/businessPilotActivationRoutes.ts`
- `server/routes/businessRoutes.ts`
- `client/src/components/business/BusinessPilotWindowNotice.tsx`
- `server/tests/businessPilotActivationWorkflow.test.ts`
- `server/tests/businessPilotMigrationSafety.test.ts`
- `server/tests/helpers/disposablePostgres.ts`

The original professional erasure implementation was inspected and tested, not
changed. No startup registration or package/configuration changes were made.
