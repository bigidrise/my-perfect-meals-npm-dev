# Stage 3 startup validation correction

## Status

Development fix implemented; code checks pass. Final hands-on browser testing is
left to the user at their request. The pending browser recheck was stopped.
**Do not claim final browser acceptance or proceed to Stage 4.**

Dr. Test was not transitioned. No account, Clinic, relationship, credential,
subscription, grant, or grant event was changed by this work. No Production
restart, push, publish, or deployment occurred.

## Reproduction and cause

Three initial fresh-browser fixtures did not reproduce the previously reported
TrialMilestoneModal error. The reproducible condition was clearing localStorage,
restoring the simulated cookie-backed demo session, then directly navigating to
`/care-team`. Navigation incorrectly ended at `/welcome`, followed by
`Maximum update depth exceeded`.

The complete React error identifies an `<ol>` in the Radix toast viewport:
`dispatchSetState → setRef → composed refs → safelyDetachRef → commitMutationEffects`.
The earlier TrialMilestoneModal label was not sufficient evidence that its
trial-bucket effect caused the loop. The reproduced actor had no trial window.

Two concrete startup/routing defects were identified:

1. Auth initialization skipped the authenticated profile read when the local
   routing cache was absent, even though an httpOnly session cookie can survive
   localStorage clearing.
2. AppRouter used the local `isAuthenticated` flag and only waited for loading
   when that flag existed. A missing flag therefore redirected a pending,
   cookie-backed professional to Welcome. The application also mounted the
   consumer widgets temporarily before resolving the demo operating status.

The correction addresses these auth/route transitions, not the trial effect or
Radix internals. The exact final ref-loop elimination has **not** been
browser-confirmed after the last correction.

## Exact files changed

- `client/src/contexts/AuthContext.tsx`: when there is no cached identity, recover
  only through the authenticated profile API. Reuse that result rather than
  requesting the profile twice. Existing guest/reviewer paths stay unchanged.
- `client/src/components/AppRouter.tsx`: wait for auth resolution on private
  routes regardless of localStorage; use the resolved identity, not a browser
  storage flag, for routing.
- `client/src/App.tsx`: wait for auth resolution before mounting either the
  consumer shell or the isolated demo shell.
- `client/src/lib/developmentAuthRoutes.ts`: isolate the existing Vite
  Development-only route gate for Jest importability; same route policy.
- `client/src/lib/__tests__/authCookieRestore.test.tsx`: four cookie-restoration,
  rejection, failure, and stable-refresh checks.
- `client/src/lib/__tests__/appRouterServerIdentity.test.tsx`: three loading,
  cache-clearing, and forged-local-flag checks.
- `client/src/lib/__tests__/trialMilestoneModal.test.tsx`: eight normal milestone,
  dismissal, rerender, excluded-route, paid-plan, and nontrial checks.

TrialMilestoneModal itself was not disabled or changed. Authentication,
professional readiness, entitlement and demo/live server gates are unchanged.
There is no Dr. Test-specific bypass.

## Before / after

Before: a missing local routing cache prevented cookie recovery; a missing local
authentication flag could redirect a still-loading session to Welcome and mount
the wrong widget tree.

After, as verified by focused React tests: the profile is read once without a
cache; private navigation waits for resolution; a server-resolved professional
does not require a local authentication flag; a forged flag cannot replace a
resolved identity. Consumer widgets wait until the account type is known.

## Browser evidence and limits

All browser API requests were intercepted and fulfilled with fictional fixtures.
These were UI checks, **not actual authenticated-server acceptance**.

Before the final routing correction, the fixture-based browser exercised demo
acknowledgment, case selection, simulated glucose/messages, structured plan save,
text media, and synthetic JSON download. Clearing localStorage and reloading
restored the fixture profile with one further profile request. Desktop and
390×844 mobile views rendered; mobile document/body width was 390px.

Live-route navigation then reproduced the error described above. After its
correction, the final targeted browser recheck was stopped at the user's request.
Final live-route/revocation checks, Stage 2 signed-in review UI, and real-browser
normal-trial verification are therefore **not claimed passed**. The user will
perform the remaining hands-on testing.

## Checks and unchanged data

- **213 unique tests passed across 12 suites**, including Stage 2/Stage 3 security,
  credential precedence, and 15 focused frontend regression checks.
- Client and server builds pass; server TypeScript passes.
- Full TypeScript retains **136 diagnostics**, none in changed files.
- Development workflow restarted and running; account maintenance skip retained.
- Read-only database count check: **1 synthetic workspace, 1 synthetic patient,
  0 grants, 0 events**. Browser fixtures forwarded no account/data API requests.
- No unrelated stale tests were fixed.

Credential retention/account erasure remains a Production blocker. Actual
Dr. Test transition still requires separate approval and protection of every
shared-database authenticating runtime. No invitation changes, blinking repair,
professional-role expansion, or self-upgrade work was performed. Stop here.
