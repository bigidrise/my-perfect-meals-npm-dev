# AI Pairing Advisor — mocked server integration only

## Scope and application behavior

The user authorized synthetic, dependency-injected Increment 2 integration, not live
authority resolution, provider access, a conversational UI, or a release.

`POST /api/ai/pairing-advisor` has a minimal registration before the broad `/api/ai`
group in `server/routes.ts`. Both that call and the registrar require exactly:

    NODE_ENV === "development" && !REPLIT_DEPLOYMENT

The module is dynamically imported only inside that condition. No advisor route is
registered outside undeployed Development. Production bootstrap is untouched.
The handler independently checks the runtime at entry and before serialization.

**The application supplies no synthetic or live dependencies.** Its new Development
binding returns `503 ADVISOR_NOT_ACTIVATED` before executing the advisor's security
chain, loading authority, or invoking orchestration. Requests cannot supply activation
or dependency fields. Existing upstream session/CSRF middleware still applies.
No user can obtain fixture recommendations through this application binding.

The registrar receives the existing `requireAuth`, `requireActiveAccess`, and
`requireProAccess` functions unchanged. The synthetic enabled router uses that same
three-stage interface. Existing billing bypass policy remains in existing middleware;
there is no advisor-specific entitlement bypass.

Disabled direct factory requests return `404 ADVISOR_DISABLED`. Outside Development
the application registers nothing: existing global security or normal unknown-route
behavior may therefore respond first. There is no claim that every Production request
has the same status, only that no advisor executes.

## Authority: intentionally unavailable for live execution

The adapter has no default loader and imports no runtime profile service. Only
`synthetic_test_only` ports can resolve fixture authority.

The loader seam requires `{ userId: authenticatedAccountId, personalSubject: true }`.
Its fixture receipt must explicitly establish:

- Account-owner scope and matching owner, subject, and envelope user identity.
- Successful allergy, protocol, clinical, and nested resolution.
- No side effects.

Missing receipts, false flags, non-null incomplete envelopes, wrong subjects,
exceptions, and unknown side effects all produce authority-unavailable. Optional
preferences are not required and do not replace missing safety information.

**Live blocker:** the existing envelope path has nested catches and can reach indirect
prescription persistence through daily nutrition resolution. A non-null result cannot
prove complete, side-effect-free authority. The real path remains disconnected. Do not
disable safety context or fabricate completeness flags to activate it.

The synthetic adapter can inject the unchanged pure ingredient-verification helper;
integration tests exercise its allergy, alpha-gal and active-trimester behavior without
loading real profiles or the runtime protocol resolver.

## Orchestration and validation

The orchestrator receives explicit fixture ports for authority, classification,
generation, input checks, protocol/alcohol scanners, and complete-response review.
No provider fallback, retries, timers, or live adapter selection exists.

Flow:

1. Resolve and validate owner authority before any mock model operation.
2. Classify the current turn with bounded request context and the intent prompt.
3. Apply Increment 1's pure policy.
4. For eligible consumption, require the input-safety adapter.
5. Select the educational or consumption prompt. Education receives no personalized
   drinking constraint block.
6. Reparse server-owned evidence from the current request list.
7. Assemble fixed restriction/clarification messages or normalized generated content.
8. For recommendations, require both protocol and alcohol scanner ports.
9. Require complete-response review for every generated paragraph/card/follow-up.
10. Reject content mutated after scanning/review, validate final contracts/evidence,
    and serialize only an accepted payload.

Mixed blocked requests may generate education only; their restriction message is
server-owned. No model can rewrite its reason or add an unchecked recommendation.
Server request/conversation/revision metadata replaces generated identifiers.

The safety adapter is an injection seam for established scanners, NOT a replacement
clinical engine. It supplies every actionable recommendation, alternative, narrative,
serving field and follow-up to the mock scanners. Education uses its distinct review
path. Real runtime scanner binding is NOT activated, and mock passes do not establish
actual scanner or semantic accuracy. Frozen Phase 1 modules are unchanged.

## Limits and provisional operations

Approved endpoint limits are a process-local, account-scoped sliding window:

- Five accepted submissions per minute, including invalid submitted bodies after auth.
- One in-flight submission per account.
- Idempotent release in `finally`, including validation/model failures.
- Expired inactive account entries are removed.

Existing request/context limits remain enforced before authority work. This is a
post-parse JSON size check; the global parser is not changed. No distributed limiter,
new package, environment variable, or persistence is introduced.

Future physical-attempt budgets, deadlines, cancellation, and HTTP mappings remain
provisional. Synthetic harness responses use illustrative `200`/`503` mappings only;
the live advisor is not activated. A hung mock retains its lease until completion;
there is intentionally no unapproved timeout/cancellation executor.

## Offline verification architecture

Use the standalone configuration, never application startup or a listening server:

    ./node_modules/.bin/jest --config server/tests/pairingAdvisorOffline/jest.config.cjs --runInBand
    ./node_modules/.bin/jest --config server/tests/pairingAdvisorIntegration/jest.config.cjs --runInBand
    ./node_modules/.bin/tsc -p server/tests/pairingAdvisorIntegration/tsconfig.json

The harness dispatches through a real Express app using in-memory request/response
objects. It does not call `listen`, open a socket, invoke Supertest, use a session store,
or import application bootstrap. Sessions and principals are synthetic.

The existing real CSRF middleware is exercised with synthetic requests. Authentication
and tier middleware behavior is injected synthetically to verify routing/order/rejection;
static registration checks verify that the application receives the actual existing
middleware references. This is not a new test of the entire production authentication
or billing stack.

Provider/database/audit/override imports fail, and HTTP, sockets, DNS, fetch, WebSocket,
and subprocess calls are blocked before I/O. The new source import graph admits only
its explicit local modules, the existing pure list identity helper, Express and Zod.
Production/deployment tests use explicit runtime snapshots, never mutate environment
variables, and never start Production (which could execute real startup migrations).

Acceptance remains grouped under the five original policies, plus direct requests,
Production/deployment isolation, real CSRF, synthetic auth/entitlements, limits, lease
release, corrupted authority, scanner rejection, failed review, stale list evidence,
and missing dependency behavior. Mocked multilingual labels prove wiring, not language
understanding. Frontend lifecycle behavior remains Increment 3.

## Remaining gates before activation

1. Prove a complete, account-owner-only authority path without unintended writes.
2. Separately authorize and validate real scanner/semantic-review integration.
3. Approve execution deadlines, cancellation, physical attempt budgets and HTTP mapping.
4. Separately authorize any live profile/provider execution and conversational UI.

Phase 1 stays frozen. No publishing, deployment, schema, environment, authentication,
subscription or clinical-authority changes are part of this increment.

## Verification results

- Increment 1 offline acceptance: 114 passed, 0 failed.
- Increment 2 integration acceptance: 96 passed, 0 failed.
- Both standalone focused TypeScript configurations pass.
- Root diagnostics: 121 existing errors, byte-for-byte identical to the pre-change capture;
  no reviewed debt baseline was modified.
- Protected Phase 1 files and frontend have no diff.

The application workflow and Production startup are not restarted or exercised for
this verification: startup can perform real persistence outside the isolated harness.
No actual advisor request is submitted to the running application.
