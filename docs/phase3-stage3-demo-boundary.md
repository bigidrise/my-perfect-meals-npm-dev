# Phase 3 Stage 3 — demo-professional isolation

## Status

Implemented in Development. Subsequent fixture-based UI checks reached the
isolated workspace and a narrow auth/startup correction was made. **Final browser
acceptance is not claimed; the user elected to perform the remaining testing.**
See `docs/phase3-stage3-validation-blocker.md`. Stop here; do not start Stage 4.

Dr. Test was not modified. No existing user/account, Clinic, organization,
membership, relationship, credential, training, agreement, or subscription was
changed by this work. No Production restart, push, publish, or deployment occurred.

## Implemented model and authority

- Canonical persona `physician`; independent operating restriction `demo_only`.
  No `demo_physician` role.
- Explicit grant binds one immutable account to one isolated workspace, with
  capabilities, prepared/active/revoked state, revision, explicit expiry (at most
  30 days), administrative approver, reason, training basis, acknowledgment
  version, approved Stage 2 request, and append-only audit events.
- Current administrative role, current MFA, reviewer security version, target
  identity hash, and expected revision are checked again under database locks.
  Self-grant/activation is denied. State, audit, and security invalidation commit
  together; an audit failure rolls the operation back.
- Academy evidence is preferred. Absent genuine completion, an explicitly
  reasoned `demo_only_waiver` is required; no completion is manufactured.
- `demo-only-v1` acknowledgment is stored separately and never writes a real
  physician agreement. Demo context explicitly grants no credential verification,
  Academy completion, real clinical readiness, real agreement, or paid plan.
- Preparation, activation, and revocation invalidate existing target sessions/
  bearer tokens. Revocation and expiry leave the restrictive operating status in
  place; neither reopens live access.

## Hard live-data boundary

The boundary is mounted after session/CSRF setup and before data-route registration
in Development. The future Production source also includes it; **the running
Production service has not received that code**.

The authenticated cookie/bearer actor, never a client-selected subject or
`demo=true`, determines the restriction. Restricted actors cannot use existing
data APIs or object/file/media paths: patients, searches, Care Team, clinical
read/write, glucose/health data, messages, uploads, exports, admin and other
unclassified data routes all fail closed. Obsolete credentials cannot fall
through as anonymous. Storage failures deny access.

Only narrow own-authentication operations, a minimal own-identity bootstrap, and
the exact isolated demo endpoints are allowed. Existing anonymous and signed
callback authorization remains in place; this boundary does not reclassify
public data or make external/public files private.

Synthetic patients are separate records, not real patient accounts, and are never
passed into live clinical, Care Team, messaging, object-storage, or export
services. Both workspace and patient must be explicitly `synthetic`; unknown/null
classification is live and denied. Every operation re-resolves account, grant,
expiry, capability, acknowledgment, and dataset scope. Substituted real IDs and
cross-workspace IDs fail. Plans accept only a nutrition-focus enum and 1–30
follow-up days; no uploads or free-form purportedly synthetic clinical content.

## Storage and interface

Four new tables only:

- `demo_professional_workspaces`
- `demo_professional_patients`
- `demo_professional_grants`
- `demo_professional_events`

Migration uses PostgreSQL lock/statement timeouts, immutable audit/restriction
triggers, and scope-preservation triggers. Its seed creates no account or grant.
Confirmed stored counts: **one synthetic workspace, one synthetic patient,
zero grants, zero events**. The seed's media identifier is a route-valid UUID.
Shared Neon receives these new tables, not a Production application release.

`/demo-physician` implements the intended synthetic case list/detail, simulated
glucose, synthetic messages/text file, structured plan save, JSON export, and
truthful acknowledgment/waiver displays. The SDK consumes JSON-returning,
URL-first request helpers. Epoch checks prevent late account/patient responses.

Demo routing does not mount live professional pages. A dedicated app shell does
not mount consumer trials, paid-plan/live-client chrome, or their providers for
`demo_only`; ordinary-account behavior remains unchanged. None of the interactive
page behaviors should be described as browser-verified yet.

## Validation

- **78 new Stage 3 service/boundary/HTTP/shell tests passed.**
- Relevant prior request lifecycle, identity decision/client/guard, role,
  organization, legal activation/recovery, Studio provisioning/access, glucose,
  Care Team and containment suites were rerun.
- Across the unique suites executed: **413 tests passed; one existing stale
  source assertion failed** (21 suites total, 20 passed).
- The extra `procareCertificationIntegrity` check expects the old string
  `requireTraining && !provider.procareTrainingCompleted`. HEAD already uses
  authoritative `progression.proCare.complete`; neither that service nor that
  assertion was changed in Stage 3. It was not repaired or hidden.
- Server TypeScript passes. Client and server builds pass. Full TypeScript
  retains **136 diagnostics**, with none on changed demo/App/Router surfaces;
  the existing debt baseline was not rewritten.
- Development workflow is running with
  `SKIP_DEVELOPMENT_ACCOUNT_MAINTENANCE=true`.
- Browser used synthetic fixtures and intercepted every API before navigation,
  with no API forwarded for an account/data mutation. An initial Router
  declaration-order error was fixed. Further attempts still reported
  `Maximum update depth exceeded` naming `TrialMilestoneModal`, before any
  `/api/demo-professional/context` request. No complete journey or mobile
  acceptance was verified. Attempts were stopped, not broadened into trial repair.
- A signed-out preview snapshot captured the boot spinner only; that is not
  evidence of successful authenticated rendering.

## Exact proposed Dr. Test transition — NOT EXECUTED

Actual writers remain hard-locked with HTTP **423
`DEMO_ACCOUNT_TRANSITION_NOT_APPROVED`**, even for an MFA administrator. No
client flag can open them.

1. Obtain separate approval for this exact account transition. Before enabling
   writers, ensure **every authenticating runtime sharing Neon** enforces the
   restriction. An old Production runtime reading changed Development identities
   would otherwise remain unsafe. No shared-account mutation is authorized now.
2. Resolve Dr. Test's immutable account ID and review current `business` identity,
   existing Clinic/organization ownership, memberships and identity history.
   Through Stage 1's account-bound owner workflow, submit a truthful physician
   identity request. Do not invent license details, attestation or completion.
3. An independent current MFA administrator prepares a grant using the current
   target `reviewedStateHash`, explicit reason, expiry, the six bounded demo
   capabilities, and both `identityOnlyAcknowledged: true` and
   `sharedDataAcknowledged: true`. Use genuine Academy evidence or an explicit
   demo-only waiver. Preparation creates a fresh isolated synthetic workspace/
   patient, imposes restrictive `demo_only` while identity is still `business`,
   invalidates old credentials, and records history. It does **not** change role.
4. Reload the Stage 2 review after preparation because the security version/hash
   changed. Its account-bound submitted request must explicitly request
   `physician`. Submit the existing Stage 2 decision with
   `decision: "approve"`, **`recovery: true`**, current `revision` and
   `reviewedStateHash`, reason, and the two explicit acknowledgments. This changes
   canonical identity only, records previous `business` identity/history and
   invalidates old sessions. It does not create credential verification,
   commercial access, Academy completion or real clinical readiness.
5. Reload target and grant again. Activate using the current grant `revision`,
   current target `reviewedStateHash`, exact approved physician
   `identityRequestId`, reason, and both acknowledgments. Activation requires
   matching approved request/event evidence, binds synthetic-only capabilities,
   and invalidates old target sessions again.
6. Dr. Test signs in afresh to the isolated workspace and makes the truthful
   versioned demo acknowledgment. Only then may it use that synthetic dataset.
   Clinic/organization ownership and historical identity/event information stay
   unchanged; existing/live APIs remain unavailable.

## Remaining gates — no expansion

**Required before Stage 3 acceptance:** diagnose the mocked browser startup
blocker and verify the isolated page, acknowledgment, plan save, text file,
JSON export, revocation and restricted-route behavior. Check served assets and
fixture metadata before changing unrelated trial logic or adding fake fields.

**Required before an actual transition:** separate approval and shared-runtime
boundary protection. Account mutation endpoints stay locked.

**Final-validation checklist:** signed-in Stage 2 browser verification remains
pending. Stage 4 invitation/email-link/login acceptance and the full synthetic
Care Team demonstration were not implemented here.

**Production blocker:** credential retention/account erasure remains unresolved.
Treatment must now also account for demo grant/event user references and
immutable-history/restriction triggers; do not silently cascade-delete them.

No invitation behavior, blinking fix, RN/PA/nutritionist/coach expansion,
self-upgrade reactivation, unrelated owner repair, or later phase was performed.
