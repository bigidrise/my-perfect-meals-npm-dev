# Demo Studio Group 1

Development-only extension of the [Phase 1 foundation](demo-studio-phase-1.md).
No backend Test Sandbox, database, real account, external service, production
release, environment change, or GitHub push is part of this work.

## Entry and navigation

Dev Navigator → Open Demo Studio → **Enter Demo Mode** opens the actual Dashboard
with a returning synthetic profile on first entry. Later entries keep the same
profile and saved targets. The ordinary desktop sidebar and phone bottom navigation
provide Dashboard / Builders / Lifestyle / More. The normal Profile menu opens
the existing Meal Builder Selection page; its save updates only synthetic state.
The ordinary four-change allowance is modeled, never unlimited/admin switching.
The unmodified selector exposes four source-defined choices. The demo does not
add a fifth choice or activate hidden Performance/Competition options.

Only these paths are allowed:

| Page | Path | Existing page/guard |
|---|---|---|
| Dashboard | `/dashboard` | `SafeDashboard` |
| Builders | `/builders` | `GuardedBuilders` / `MealBuildersGuard` |
| Lifestyle | `/lifestyle` | `LifestyleLandingPage` |
| More | `/more` | `SafeMore` |
| Builder selection | `/select-builder` | `GuardedMealBuilderSelection` / `MealBuildersGuard` |
| Cravings, Sushi & Desserts hub | `/craving-creator-landing` | `GuardedCravingCreatorLanding` / `ProGuard` |
| Beverage Creator hub | `/lifestyle/beverage-hub` | `GuardedBeverageCreatorHub` / `ProGuard` |
| Original onboarding | `/onboarding`, `/onboarding-v2` | `SafeOnboarding` |
| Original calculator | `/macro-counter` | `SafeMacroCounter` |

`/home` and `/planner` normalize to Dashboard and Builders. Query strings and
hashes stay in synthetic state. Back/forward/replace operate on bounded in-frame
history, never the parent browser URL. Unverified links stay on the current safe
page with an unsupported-action disclosure; there is no redirect to the live app.
Returning to the Studio chooser and closing/reopening the studio retain the
same tab-scoped synthetic account. Reset Demo restores the default Dashboard.
The original Start Fresh, Reset Current Demo and Reset All Demo Data remain.

## Shared-code approval boundary

The only shared-component edit is an additive named-export block at the end of
`client/src/components/Router.tsx`. No route, guard body, redirect or import in
the existing router was changed. The full normal route table is not mounted.
`CustomerShell.tsx` selects only the explicit pages above, using their existing
guards and the existing authentication/onboarding/layout boundary.

The opaque frame's `demo.invalid` host is intentionally not a real application
host. Its own composition reuses `DesktopLayout` at desktop width without
changing `AppLayout`'s host rules. The normal mobile `BottomNav` is reused too.
No professional identity, verified credential, organization membership, or
clinical activation is fabricated.
Background Quick Start and More status reads return zero Academy completion and
MFA disabled for this synthetic account; their enrollment/actions remain blocked.

## Blocked and deferred

- Diabetes/Diabetic, Metabolic Medication/GLP-1, Performance and other clinical
  builder destinations: substantive clinical reads/actions are not verified.
  Selecting a builder persists metadata only; it does not activate a clinical
  protocol or make its builder functional.
- Craving, dessert, sushi, beverage and other creator forms/generation, meal
  boards, Menu, Favorites, grocery, shopping and other later-group workflows.
- Pregnancy and Spirit & Wine Pairing stay **Coming Soon**, including legacy
  pairing links. Hidden Weekly/Competition/professional builder cards are not
  enabled by demo fixtures.
- Business/Studio/care-team/workspace actions, subscriptions, checkout, messaging,
  notifications, support submissions, account deletion and uploads.
- All unknown API requests, outbound HTTP/media, speech services, recording,
  workers, beacons and browser transports still fail closed. Empty organization
  and Studio reads describe a nonmember; they never authorize those workspaces.

## Verification

```sh
npm run demo:prepare
npx jest --config client/src/demo-studio/__tests__/jest.config.cjs --runInBand
npm run check:release-types
```

The routing regression pins the pre-export Router contents to prove that the
approved shared edit is additive only. If normal routing is intentionally
changed in future, review that change before updating this fingerprint.
It also executes the actual MealBuilders/Pro/Clinical guard bodies against the
real entitlement predicates for denied, missing-user and eligible paid cases.
Other checks cover navigation/state continuity, query/history behavior, bounded
builder saves, privilege immutability, Coming Soon, restricted destinations and
the existing Phase 1/authentication/network boundaries.

Changed implementation files: the Router export block; Demo Studio's
`CustomerShell.tsx`, `navigation.ts`, `state.ts`, `adapter.ts`, `DemoRuntime.tsx`,
`StudioControls.tsx`, `bootstrap.ts`, `isolation.ts`; and the client-only
`scripts/build-demo-studio.mjs` asset list. Regression files are
`navigation.test.ts`, `isolation.test.ts`, `runtimeBarriers.test.ts` and
`jest.config.cjs`. Documentation and the existing Demo Studio scope memory were
updated as well. Generated bundles remain ignored and are not deployment assets.

## Acceptance evidence

- Client-only bundle preparation succeeded. The focused Jest suite passed **82
  tests across 7 suites**. The final release type gate matched the reviewed
  **121-diagnostic baseline**, with no new diagnostics.
- An anonymous browser context entered the real Dashboard, then used the
  existing desktop Dashboard / Builders / Lifestyle / More navigation.
  The initial lazy-page loading failure was corrected with the normal Suspense
  boundary in the demo composition, not a shared-router change. A cold-frame
  focused retest confirmed first-visit More and both approved creator hubs,
  followed by Dashboard, without page errors.
- Clicking Craving Creator and Beverage Creator stayed on their respective
  hubs and visibly disclosed the blocked destinations. Their forms/generation
  were not mounted.
- The existing builder selection page was opened through the permitted
  in-frame navigation probe, not a verified Profile-menu click. Its actual
  toggle and Save Builder control saved Anti-Inflammatory. Builders marked it
  Current and Dashboard retained it without changing macro targets.
- In-frame query strings, back/forward and Reset Demo were exercised. Reset
  restored the default Dashboard/general-nutrition seed. Parent `/welcome` and
  an unrelated parent sessionStorage sentinel remained unchanged.
- At 390px, all four real bottom-navigation sections worked without horizontal
  overflow. Existing Phase 1 chooser/reset controls remained visible; the
  unchanged full onboarding/calculator sequence was not replayed in this pass.
- Reserved `.invalid` fetch/XHR/beacon probes were blocked and produced **zero
  outbound probe requests**. Sandbox asset/audio CSP refusals were non-blocking.
- The browser runner supplied interaction/console/network observations but no
  usable Demo Studio screenshot IDs. No demo screenshots are claimed here.
