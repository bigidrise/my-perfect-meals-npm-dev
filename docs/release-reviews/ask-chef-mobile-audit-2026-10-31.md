# Ask Chef branding and mobile release audit

## Release status

Development preparation only. No publishing, merge, new release branch, native sync, native project modification, purchase, migration, or paid AI/image test was performed.

Corrections are in the existing `dev` working tree alongside the earlier restaurant/Getaway serving and Buffet image-fallback work. They have **not** been incorporated into the `production` branch or activated in Production. This report is not a release approval.

## Branding corrections

- Added **Ask Chef — conversational food, nutrition, and My Perfect Meals guidance** to both Pro display-feature sources: shared comparison data and the pricing SKU list. No price, SKU, entitlement, purchase, or subscription-enforcement field changed.
- Display-copy normalization now covers Chef's Corner, Chef’s Corner, Chefs Corner, Chef Corner, Coach's Corner, Coach’s Corner, Coachs Corner, and Coach Corner, without changing internal routes or identifiers.
- Prepared release branding no longer depends on the Development-only conversation gate. That gate and the legacy Production behavior remain unchanged.
- Corrected the desktop route heading, legacy dashboard card text, intake/profile explanation, completion text, return buttons, composer placeholder, voice-input label, medical-source display names, Copilot page explanations, and model self-identification.
- Existing App Library and welcome/learning copy already use the display helper; they now normalize consistently in both build modes.
- Corrected the feature title and translated Open button in all 15 locale files. **Ask Chef** remains the proper feature name; the surrounding action remains localized.
- Internal `/coach-corner/*` routes, APIs, feature flags, stored records, specialization names, and entitlement keys remain unchanged.

## Checks completed

- Nine focused suites: **240 tests passed, zero failed**. Covers branding, every locale, both Pro feature sources, existing conversation behavior, navigation authorization, clinical safety, restaurant/Getaway serving rendering, image fallback, Favorites and explicit Biometrics review.
- Safety TypeScript check passed.
- Final client production build passed with the responsive corrections included; existing large-chunk warnings remain. Final Tailwind compilation and diff whitespace checks also passed.
- Development was restarted once after the code changes. Safe-startup logs confirmed migrations/maintenance stayed suppressed, and Pricing returned HTTP 200.
- Public Pricing rendered at **320×740, 390×844, 768×1024, 1280×900** without horizontal document overflow.
- Direct visual wrapping checks at 320 and 768 confirmed Pro's Ask Chef description fits its card. No clipping observed.
- Pricing scrolling worked through the existing `#root-viewport` owner; window scrolling remains intentionally disabled.
- The initial public Pricing obstruction was an open Copilot sheet. Clicking its outside backdrop dismissed it. No code fix or shared scroll redesign was needed.
- Public `/learn` App Library rendered and its accessibility snapshot contained **Ask Chef**. A Copilot panel obscured part of its initial visual capture.

## Authenticated browser boundary

The separate test browser did not inherit the user's signed-in preview. Normal unauthenticated requests returned 401. Available named test credentials were not accessible through its secure browser notebook. No credentials were exposed, no account was created, and no server authorization was bypassed.

A secure browser takeover was attempted but returned `unavailable / no_browser_sessions`. Consequently, real signed-in Pro access, persisted conversation changes, and protected mobile pages must not be described as authenticated end-to-end verified. Deterministic tests are separate evidence, not a substitute for that verification.

The following isolated frontend browser simulations must not be represented as authenticated access checks.

### Isolated mocked mobile checks

Every `/api/**` request in these checks was intercepted before page load and fulfilled with synthetic fixtures. No live account, generation, checkout, image, or voice request was sent.

- Ask Chef checked at 320×740, 390×844, and 768×1024: long responses wrapped, chat history scrolled internally, and composer controls remained inside the viewport.
- Mocked message submission, approved Restaurant Guide navigation, returning and restoring via mocked bootstrap, and mocked conversation clearing worked.
- Browser viewport resize to 320×480 kept the composer visible. This did not emulate an actual native keyboard overlay; the layout viewport itself resized.
- Found and corrected a real 320px composer usability issue: the Voice button squeezed the input to about 98px. At widths through 360px the text field now has its own full-width row, with Voice and Send below. The corrected input measured 288px wide; Back, Voice, and Send measured at least 44px high.
- Getaway's generated card rendered after correcting the test-only saved-meal-check fixture to an array. At 768px, the food portions, macro columns, and Flame Chef fallback were readable.
- The 320px card check found overlapping macro text in the five-column strip. The shared meal card now uses three columns below 480px and keeps five columns on wider screens. Data and actions are unchanged.
- Final refreshed-card verification passed: at 320px the three approximately 56.7px columns had no overlapping macro-value bounds and no card overflow; at 768px all five columns remained readable. Both portions and Flame Chef remained present at each size.
- One intermediate result measured obsolete pre-fix DOM after a disconnected HMR session. After the single Development restart and a full browser reload, the tester asserted the current DOM classes before recording the final passing measurements.
- Simulation limitations: the first card attempt failed on a malformed fixture, not a demonstrated app regression. Missing synthetic profile context also generated repeated intercepted profile requests; this was not real-account behavior.
- Voice recording, physical iOS keyboard/safe areas, real persistence and billing were not exercised. Find Meals Near Me was not separately browser-verified; it remains part of the signed-in release check.

## iOS and safe areas

- RootViewport remains the single page scroll owner; no global scroll or safe-area changes were made.
- Ask Chef retains its existing top safe-area padding, bottom composer safe-area padding, and visualViewport keyboard-inset handling.
- App Library retains its fixed-header and content-offset safe-area treatment. No additional padding was added.
- Both checked-in Capacitor configs use packaged `client/dist` assets and have no remote `server.url`. This does not identify the effective packaging of the installed App Store build.
- The user's previously identified installed version is 1.0.150. Its matching archive/effective distribution configuration was not verified.
- These corrections are web-source changes and introduce **no native dependency**. Whether a web publish alone updates the installed iOS UI remains unresolved; a packaged-client build would require an approved native release, whereas a remote-web build may receive it through publishing.
- No physical iPhone, notch/Dynamic Island, native keyboard, notification, or meal-reminder verification was performed. No native notification or reminder code was modified.

## Files changed

- `shared/planFeatures.ts`
- `client/src/data/planSkus.ts`
- `client/src/lib/chefMemberBranding.ts`
- `client/src/layout/DesktopHeader.tsx`
- `client/src/components/ace/CoachCornerCard.tsx`
- `client/src/components/away-from-home/AwayFromHomeMealCard.tsx`
- `client/src/components/MedicalSourcesInfo.tsx`
- `client/src/components/copilot/CopilotPageExplanations.ts`
- `client/src/pages/CoachsCorner.tsx`
- `client/src/pages/CoachCornerComplete.tsx`
- `client/src/pages/CoachCornerProgressSlowed.tsx`
- `client/src/pages/CoachCornerTired.tsx`
- `client/src/i18n/locales/{ar,de,en,es,fr,hi,it,ja,ko,pt,ru,tl,vi,xq,zh}.json`
- `server/services/coaching/conciergeInstructions.ts`
- `server/services/coaching/engine.ts`
- `client/src/lib/__tests__/askChefBranding.test.tsx`
- `client/src/lib/__tests__/askChefReleaseCopy.test.ts`
- `.agents/memory/chef-concierge-boundary.md`
- `.agents/memory/dom-snapshot-css-fidelity.md`
- This audit report.

## Required before Production approval

1. Finish genuinely signed-in mobile verification where isolated mocks cannot establish access or persistence.
2. Establish installed iOS delivery mode before promising that publishing alone updates today's client UI.
3. Deliberately review the existing Development-only feature gates and incorporate approved changes into the existing Production release process. Branding preparation is not permission to activate the new experience.

Do not publish or perform native build/sync work automatically.
