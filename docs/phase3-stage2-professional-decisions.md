# Phase 3 Stage 2 — Development implementation report

## Scope and shared-Neon safety

Only controlled professional identity review/recovery and its security/readiness
boundaries are implemented. No account repair, demo grant, synthetic patient,
invitation auto-accept change, Care Team blinking fix, or occupation expansion.
Dr. Test and existing accounts were not modified.

The explicit migration evolved only the two Stage 1 tables in shared Neon.
It ran no user/account DML or backfill. Tests used isolated in-memory/mocked
accounts, not shared accounts. Development restarted with the existing
`SKIP_DEVELOPMENT_ACCOUNT_MAINTENANCE=true` protection. Production was not
restarted or published; no GitHub push or deployment occurred.

Actual authorized reviewer decisions would change shared account data globally.
The UI requires an explicit shared-data acknowledgment. No real decision was
executed during implementation or testing.

## Schema and lifecycle

`professional_identity_requests` gains only:

- `decision_reason text`
- `decided_at timestamptz`

Its state constraint now permits `draft`, `submitted`, `approved`, `rejected`,
`needs_correction`. Submitted/decided states retain submission timestamps.
Under-review is not necessary: opening a request is a read, not an authority
transition.

`professional_identity_events` retains its original append-only protection,
request foreign key and unique `(request_id, request_revision)` constraint.
Its event-type constraint additionally permits `correction_resumed`,
`identity_approved`, `identity_rejected`, `identity_correction_requested`.

No second authorized role field, verification field, or professional profile
table was added. `users.professionalRole` remains canonical.

Correction resumption is explicit: the owner POSTs the existing draft endpoint,
which changes `needs_correction → draft`, increases revision, clears the current
submission timestamp and appends an event. Historical decisions remain in the
ledger. Rejected/approved requests stay read-only.

Migration: `server/db/migrations/runProfessionalDecisionMigration.ts`,
explicit runner `scripts/migrate-professional-decisions.ts`. It has bounded
lock/statement timeouts and changes no existing user-table structure.

## Endpoints and UI

New Development-only endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/professional-requests` | Up to 50 submitted requests |
| GET | `/api/admin/professional-requests/:id` | Request, reviewed identity hash, readiness and event history |
| POST | `/api/admin/professional-requests/:id/decision` | Explicit approve/reject/needs-correction decision |
| GET | `/api/professional-onboarding/readiness` | Authenticated own-account prerequisite projection |

Responses are no-store. Reviewer endpoints reject query parameters and strict
decision bodies reject forged owner/reviewer selectors. Existing request
endpoints remain own-account only; their `decisionAvailable: false` continues
to prohibit owner decision authority, not administrative review.

Review UI: `/admin/professional-requests`, linked from the Development Admin
Dashboard. It distinguishes current identity, requested role, credential claims,
decision history, and independent readiness.

The applicant UI now renders submitted/approved/rejected/correction states.
Canonical established professionals with a request can review it without losing
their separate genuine legal-document continuation (`?legalOnly=true`).
Status/readiness APIs do not submit agreements. An identity-changing decision
requires the target to sign in again before reading status.

## Reviewer authorization

Persisted `users.isAdmin` is the explicit reviewer authority. Ownership,
subscription, Studio, professional category, training, founder/test/sandbox
flags and prior agreements never substitute for it.

Every reviewer needs enabled MFA and a current MFA-verified browser session
bound to the same account/security version. This is stricter than the existing
email-designated MFA policy. Native bearer reviewer decisions are not enabled.
Authentication and existing browser CSRF protection remain in force.

The transaction rechecks persisted administrator/MFA/security-version state
under row locks. All self-decisions are forbidden. Licensed-role self-approval
therefore cannot occur.

Approval must match the exact canonical role requested. Changing any non-null
previous identity requires the explicit recovery acknowledgment. Unsupported
legacy values remain unchanged until that specific authorized recovery decision;
there is no sweep or inferred conversion.

## Transaction and session guarantees

Each decision:

1. Acquires the same owner advisory lock used by Stage 1 and re-reads the request.
2. Requires submitted state and expected revision.
3. Locks reviewer/target account rows in deterministic order.
4. Revalidates reviewer authority and current MFA/security version.
5. Checks the reviewed target hash covering identity, credential claims,
   security version and relevant account markers.
6. Changes only the explicitly approved canonical practitioner identity.
7. On an actual role change, increments `auth_security_version` and clears
   `auth_token`, `auth_token_created_at`, `auth_token_mfa_verified_at`.
8. Saves the decision and authoritative ledger event in the same transaction.

Event failure rolls back the identity, token/version and request writes.
Optimistic SQL predicates additionally reject stale account/request state.
The pre-write snapshot is copied before mutation so audit history cannot
accidentally report new identity as previous identity.

Events record previous/requested/approved identity, authenticated reviewer
authority, reviewer security version, reason, reviewed hash/revision, decision
revision, recovery classification and previous/next target security versions.
The event timestamp is database-generated.

Organization memberships/ownership, system role, historical account data,
credential values, verification markers, Academy evidence, agreements,
subscriptions, MFA factors, relationships and consent are not written.

Existing authentication rejects cookie sessions whose version is obsolete;
cleared bearer tokens are invalid. No-op identity approvals preserve valid
sessions because no authority changed. Readiness is recalculated after commit;
an unavailable readiness read is reported separately and never misrepresents
the already-committed decision as a failed mutation.

## Readiness and credential/training boundaries

The account projection exposes independent reason-coded checks for identity,
credentials, Academy training, current agreements, entitlement and applicable
MFA. Organization/location and client relationship/consent are explicitly
`not_evaluated` without exact context. `clientAccessEvaluated` is always false
on this account endpoint; it never grants client access.

Dependency errors mark the affected check unavailable and keep prerequisites
not ready; unrelated checks remain visible.

A changed licensed identity cannot inherit a pre-existing Studio verification
marker. Stage 2 does not introduce a credential-verification writer. Such
identities remain pending independent verification, enforced in ProCare access,
provider Studio readiness and physician/client access—not only in the status UI.
Existing licensed accounts without a role-changing Stage 2 event retain their
existing verification policy. No-op approval does not clear a previous pending
credential boundary.

Both training middleware database-error branches now fail closed with retryable
503 responses. Missing accounts fail authentication. When the existing Phase 2
training gate is enabled, actual Academy ProCare evidence is required, not the
historical `procareTrainingCompleted` boolean. Provider readiness follows the same
evidence. Existing launch-policy switch and administrative bypass are preserved;
no Academy redesign or evidence backfill was performed.

## Exact implementation files

New:

- `shared/professionalIdentityReview.ts`
- `server/db/migrations/runProfessionalDecisionMigration.ts`
- `scripts/migrate-professional-decisions.ts`
- `server/middleware/requireProfessionalIdentityReviewer.ts`
- `server/routes/professionalIdentityReviewRoutes.ts`
- `server/services/professionalIdentityDecisionService.ts`
- `server/services/professionalIdentityDecisionRepository.ts`
- `server/services/professionalIdentityCredentialBoundary.ts`
- `server/services/professionalIdentityReadiness.ts`
- `client/src/lib/professionalIdentityReview.ts`
- `client/src/pages/admin/ProfessionalIdentityRequests.tsx`
- `server/tests/professionalIdentityDecision.test.ts`
- `server/tests/professionalIdentityGuards.test.ts`
- `server/tests/professionalIdentityClientContract.test.ts`

Modified:

- `shared/professionalOnboarding.ts`
- `server/db/schema/professionalOnboarding.ts`
- `server/services/professionalOnboardingService.ts`
- `server/services/professionalOnboardingRepository.ts`
- `server/routes/professionalOnboardingRoutes.ts`
- `server/routes.ts`
- `server/middleware/requirePhase1Cert.ts`
- `server/middleware/requirePhase2Training.ts`
- `server/middleware/requireProCareAccess.ts`
- `server/services/procareStudioReadiness.ts`
- `server/services/procareAccessService.ts`
- `client/src/components/Router.tsx`
- `client/src/pages/AdminDashboard.tsx`
- `client/src/pages/procare/ProCareIdentity.tsx`
- `client/src/pages/procare/ProCareAttestation.tsx`
- `client/src/pages/procare/ProfessionalRequestReview.tsx`

## Verification

- 61 new tests passed; 238 existing Stage 1/Phase 1/Phase 2 and relevant
  professional identity/legal/Business/Studio/glucose regressions passed.
  Total: 299 across 15 suites.
- New tests cover authorization, self-review, MFA/version requirements,
  unsupported roles, explicit recovery, stale/concurrent changes, atomic failure,
  preserved independent authority, readiness errors, training guards, correction
  resumption and the actual JSON-returning frontend API-helper contract.
- Server TypeScript passed. Client and server builds passed.
- Full-project TypeScript reports 136 diagnostics, the same count as the Stage 1
  HEAD baseline; none are in the new/changed review UI surfaces. Existing type
  debt remains and the older reviewed release gate was not refreshed.
- No release/type baseline was rewritten.
- Unauthenticated reviewer endpoint returns 401. Development is serving; public
  preview mounts without a new console error.
- Signed-in reviewer browser verification was stopped before completion; no
  authenticated end-to-end success is claimed. API-helper behavior is covered
  by the isolated contract test, not a real-account decision.
- The two unrelated owner-journey failures remain untouched.

## Must resolve before Production

Credential-request retention/account erasure remains an explicit Production
blocker, not additional Stage 2 implementation.

Treatment must cover Stage 1 credential type/body/number/year, category,
requested role and account linkage; Stage 2 decision reason/time and ledger
history, previous/requested/approved identities, reviewer/subject identifiers,
review hashes and security-version metadata. Free-text reasons may themselves
contain personal information.

Define deletion/anonymization versus justified audit retention before promotion.
Do not casually disable the append-only trigger or change existing permanent
account deletion behavior. No retention policy or cleanup was invented here.
