# Phase 3 — Stage 1 professional request foundation

## Scope

Development only. This implements account-bound information collection and
request continuation, not identity establishment or approval. Stage 2 review,
legacy recovery, demo grants, and account repairs are not implemented.

`users.professionalRole` remains the only existing canonical account identity.
`requestedRole` is application metadata, never authorization.

## Exact additive storage

`professional_identity_requests`:

- `id` UUID primary key.
- `owner_user_id` text, unique and required: one current application per account.
- `requested_role`: nullable canonical `trainer`, `physician`, `dietitian`,
  `nurse_practitioner`.
- `professional_category`: nullable `certified`, `experienced`, `non_certified`.
- `credential_type`, `credential_body`, `credential_number`: nullable,
  bounded to 120 characters.
- `credential_year`: nullable four-digit year.
- `state`: `draft` or `submitted`.
- `revision`: nonnegative integer for optimistic concurrency.
- `created_at`, `updated_at`, `submitted_at`: timezone-aware timestamps.
- Check constraint pairs draft/submitted state with the appropriate submission
  timestamp.

`professional_identity_events`:

- `id` UUID primary key.
- `request_id`: foreign key to the new requests table.
- `actor_user_id`: authenticated account identifier.
- `event_type`: `draft_created`, `draft_updated`, `request_submitted`.
- `request_revision`: nonnegative integer; unique with request ID.
- `metadata`: changed field names only, not duplicated credential values.
- `created_at`: timezone-aware timestamp.

`professional_identity_event_append_only()` and its statement trigger reject
UPDATE, DELETE and TRUNCATE of the lifecycle ledger.

No professional profile table is necessary in Stage 1: current request state is
the minimum lifecycle projection. No new authoritative role or verification
column exists. No existing table is altered and no historical data is backfilled.

There is deliberately no foreign key to users: adding request storage must not
change existing account-deletion behavior. Every operation rechecks the persisted
authenticated account. Request/credential retention and erasure need release
review before this feature is promoted to Production.

## Migration

- `server/db/migrations/runProfessionalOnboardingMigration.ts`
- Explicit Development-only runner:
  `NODE_ENV=development npx tsx scripts/migrate-professional-onboarding.ts`
- Applied once against the approved shared Neon schema.
- Transactional, idempotent DDL, 3-second lock and 15-second statement timeouts.
- No ordinary startup migration, user UPDATE, existing-record conversion, or
  production release action.

## Exact endpoints

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/professional-onboarding` | Read current authorized role and own request; creates nothing |
| POST | `/api/professional-onboarding/draft` | Create or resume own draft; empty body only |
| PATCH | `/api/professional-onboarding/draft` | Update bounded own draft fields with current revision |
| POST | `/api/professional-onboarding/submit` | Freeze a complete draft as submitted |

Responses separately expose `accountId`, `currentAuthorizedRole`, `request`,
and `decisionAvailable: false`.

Only `draft` and `submitted` are persisted states. No request is represented as
approved, verified, active, or under administrative review. Submitted applications
are read-only in this stage; repeat/replayed submission returns the same result.

## Authorization

- Existing `requireAuth`, cookie CSRF and native authentication remain in force.
- No account selector is accepted in a query/body.
- Optional request IDs must match the authenticated account's own request.
- Canonical roles only at the API; the frontend reuses only Phase 2's explicit
  doctor/np request aliases. Stored account roles are never normalized.
- Credential information is a claim, not verification.
- Per-account transaction locks serialize creation and mutation.
- Revision checks reject stale edits; request and event commit atomically.
- Credential-bearing responses use `Cache-Control: no-store`.
- Errors do not log credential payloads.
- Production/deployed runtime rejects these endpoints with 404.
- `/api/auth/upgrade-to-procare` stays retired with 410.

The repository has no user, verification, billing, training, legal, organization,
Studio, relationship, or consent writer.

## UI and localStorage

Changed pages:

- `client/src/pages/procare/ProCareIdentity.tsx`
- `client/src/pages/procare/ProCareAttestation.tsx`
- `client/src/pages/procare/ProfessionalRequestReview.tsx` (new)
- `client/src/pages/Auth.tsx`

Support:

- `client/src/hooks/useProfessionalOnboarding.ts` (new)
- `client/src/lib/professionalOnboarding.ts` (new)
- `client/src/lib/auth.ts` (legacy signup payload no longer asserts acceptance)

Before: authenticated continuation depended on localStorage and called retired
self-upgrade.

After: authenticated drafts and submitted status load from the server under
account-partitioned cache keys. localStorage is only an anonymous input buffer.
Authenticated users never silently import it; they can explicitly select locally
entered information when their server draft is empty. A new signup hands its
explicitly entered information to its authenticated own-account draft, and clears
the buffer only after successful save. A failed transfer leads to the identity
page for visible retry/import rather than pretending storage succeeded.

Application submission is not attestation. It never calls legal acceptance.
Established canonical professionals retain the separate existing actual legal
continuation and their authorized identity/access.

## Safe Development startup

The existing Development LMS bootstrap also grandfather-updates account training,
bridges certification records, and backfills Studios. The workflow now explicitly
sets `SKIP_DEVELOPMENT_ACCOUNT_MAINTENANCE=true` so Stage 1 verification does not
run that legacy block. This does not bypass authentication or access gates and
does not change the Production entrypoint.

Only Development was restarted. No real/shared test user was created or mutated;
all request tests use memory/mocked data. Browser verification intercepted every
API call before navigation and used a synthetic user and request.

## Validation and baseline

- 238 tests passed across 12 suites: 56 new Stage 1 cases plus 182 existing
  professional identity, legal, Business, Studio, connection and glucose cases.
- New lifecycle/API/storage tests cover binding, isolation, canonical roles,
  resume, repeat/replay, concurrent requests, stale versions, atomic ledger
  rollback, unchanged authority, immutable submissions, and endpoint retirement.
- Browser journey passed through identity, rewards, review, submission and reload
  after clearing `procare_*` keys; mobile confirmation was readable at 390×844.
- Server TypeScript and client/server builds passed.
- Full TypeScript: HEAD 136 diagnostics; working tree 136; zero new diagnostic
  fingerprints. The reviewed release baseline still expects 133 and therefore
  its unchanged debt gate reports failure. Its baseline was not rewritten.
- The two previously documented unrelated owner-journey failures were not fixed.

No existing account, including the user-supplied Dr. Test scenario, was repaired
or modified. No GitHub push, publish, deploy, or Production restart occurred.
