# My Perfect Meals Demo Studio — Phase 1 and Group 1

## What this is

A connected, Development-only synthetic walkthrough using the **actual**
`OnboardingV3`, `MacroCalculator`, and `DashboardNew` source components, now
connected to the normal Dashboard / Builders / Lifestyle / More navigation and
the safe Cravings and Beverage landing hubs.
It is the foundation for Demo Mode, not a backend Test Sandbox.
Do not describe it as a verified, full Stripe-style test environment.

Onboarding saves update the synthetic profile. Calculator saves update that same
profile and its macro targets. Dashboard's nutrition summary uses those targets.
**Continue demo** and the workflow navigation preserve the connected journey.

## Launch

1. In the Development workspace, run `npm run demo:prepare`.
   This compiles client assets only. It does not boot the application server,
   connect to the database, invoke migrations, or change environment settings.
2. Keep the existing Development application running. No backend restart is
   necessary. At desktop width (768px or wider), open **Dev Navigator**.
3. Select **Open Demo Studio**, in its own section above developer diagnostics.
4. Select **Enter Demo Mode** to open the actual Dashboard. It seeds a returning
   synthetic member on first entry and retains existing progress on later entries.
   The three original **Start Fresh** workflows remain under **Existing Phase 1
   workflows**. All use the reserved synthetic identity
   `demo-studio-user`, never the account signed in behind the studio.

The normal Development-tools visibility gate must already be enabled. This
feature does not change it or enable developer tools in a Production workspace.
Re-run `npm run demo:prepare` after changing screen source, then close/reopen
Demo Studio to load the new bundle.

## Record a connected journey

- Start Fresh **Onboarding**. Enter synthetic information and complete the real
  visible steps. Use an adult, general-nutrition scenario with no clinical
  conditions for the supported Phase 1 walkthrough. The safety PIN completion
  is simulated; the entered PIN is never stored or echoed.
- Continue to the **Macro Calculator**, or use its navigation control without
  clicking Start Fresh. Enter measurements, goal and activity, calculate, and
  save with the actual customer-facing controls.
- Open **Dashboard** through the demo navigation. The synthetic name and saved
  nutrition summary carry forward. Navigating back and forth does not reset them.
- **Return to Demo Studio** opens the chooser without resetting the journey.
  **Continue demo** resumes its shared state.

The synthetic session is retained in the current browser tab when closing and
reopening the studio. No local account data is copied. Closing the browser tab
ends that tab's session. If sessionStorage is unavailable, a warning explains
that state is memory-only until the studio closes.

## Reset

- **Start Fresh** restores the predictable starting synthetic state for the
  selected workflow.
- **Reset Current Demo** restarts the shared synthetic journey at the current
  workflow's original seed. This intentionally discards earlier demo selections,
  including selections made in the other screens of the connected journey.
- **Reset All Demo Data** clears that same demo journey and returns to the chooser.
- **Reset Demo** restores the default returning-member Dashboard, including the
  initial builder choice, targets, counters, memory stores and query cache.
- A fresh Dashboard seed includes example saved targets; a fresh Calculator
  seed has not saved its targets; a fresh Onboarding seed has not completed
  onboarding.

Resets clear only the frame's memory stores and its query client. Retained state
uses exactly one parent sessionStorage key: `mpm.demoStudio.phase1`. No account
storage is enumerated or cleared. No account or database reset is involved.

## Isolation and authority

- The frame is `sandbox="allow-scripts"`: **no** `allow-same-origin`, popup,
  top-navigation, form, camera or microphone permission.
- The provider seam requires a Development build, opaque child-frame origin,
  `about:srcdoc` and the explicit demo marker. It rejects Production builds.
- The frame gets memory-only implementations of localStorage/sessionStorage
  before importing any customer components.
- Its separate compiled JavaScript realm owns its module singletons and query
  caches. The real `AuthProvider` is never mounted inside it.
- The real URL helpers use `https://demo.invalid` **only in this isolated build**,
  allowing their existing origin-based behavior to work in an opaque frame.
  The adapter accepts that reserved origin or relative paths, not other hosts.
- The isolated build also routes imperative Location and history navigation to
  demo state. External links/popups cannot turn into a live application fallback.
- Every supported read/save is local and marked synthetic. Unknown requests
  fail closed with an unsupported-action disclosure. There is no original-fetch
  fallback. CSP independently sets `connect-src 'none'`; XHR, WebSocket,
  EventSource, workers, beacons, speech services and media capture are blocked.
- Existing public brand images, the Dashboard hero and approved hub backgrounds are embedded at build time rather than
  fetched from the authenticated app. Other HTTP image/media requests are denied.
- Static bundle/style preparation requests omit account credentials. The normal
  parent app may continue its own polling; those are not demo requests and are
  not used to populate the frame.
- No token is issued. The live server's existing authentication, CSRF, subscription,
  clinical and authorization rules are unchanged. A synthetic user ID/header/
  body flag is not accepted as authentication by live protected APIs.

## Deliberate limitations

- Group 1 adds bounded navigation and verified landing pages, not functional
  Creators, meal generation, shopping, clinical or professional workflows.
  See [Group 1 scope](demo-studio-group-1.md) for supported and blocked destinations.
- Macro results are explicitly **synthetic nonclinical illustrations**, not
  production prescription calculations or clinical-validation evidence.
- No real AI, billing, email, messages, uploads, audio generation, recording,
  external images or other server side effects run. CSP may log a refusal for
  an existing component's automatic media/image request; it cannot reach the
  application server. Customer controls for unsupported actions fail closed.
- This is a client-side demo environment, not isolated backend infrastructure.
  Additional modules require explicit adapters and workflow/isolation verification.

## Verification commands

```sh
npm run demo:prepare
npx jest --config client/src/demo-studio/__tests__/jest.config.cjs --runInBand
npm run check:release-types
```

The focused suite covers synthetic state continuity, adapter contracts, resets,
unknown/live URL rejection, memory storage, actual compiled Development/Production
runtime guards, live API rejection of fabricated demo credentials, normal
authentication restoration, no-auth-fallback synthetic rendering, and the existing
browser CSRF/native credential behavior. None of these tests opens a database.

Navigation cleanup removed menu links only. The unresolved legacy onboarding
entry had no registered route (its only remaining reference is an existing layout
exclusion); the V2 compatibility URL remains and is accurately labeled V3.

## Changed-file inventory

- `client/src/components/DevNavigator.tsx` — menu cleanup and separate Studio entry.
- `client/src/contexts/AuthContext.tsx` — approved additive guarded provider interface;
  normal authentication implementation unchanged.
- `client/src/demo-studio/`: `adapter.ts`, `authority.ts`, `bootstrap.ts`,
  `DemoRuntime.tsx`, `DemoStudioLauncher.tsx`, `frameDocument.ts`, `isolation.ts`,
  `runtimeAuthority.ts`, `state.ts`, `StudioControls.tsx`.
- `client/src/demo-studio/__tests__/`: `authProvider.test.tsx`, `isolation.test.ts`,
  `liveApiBoundary.test.ts`, `runtimeBarriers.test.ts`, `jest.config.cjs`,
  `reactTestTransform.cjs`.
- `scripts/build-demo-studio.mjs`, `package.json` — client-only preparation command.
- `.gitignore` — ignored prepared assets. `.replitignore` has only a trailing-newline
  formatting change; no deployment configuration values changed.
- `docs/demo-studio-phase-1.md` — launch/reset, limitations and verification.
- `.agents/memory/MEMORY.md`, `.agents/memory/demo-studio-authority.md` — durable
  product/scope and verification boundaries.

The three real customer screen files, server code, schema, lockfile, workflow
configuration and application environment were not changed.
