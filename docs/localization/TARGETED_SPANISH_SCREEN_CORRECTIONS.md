# Targeted Spanish screen corrections — Development only

## Scope

The founder-reported workspace selector, dashboard activity summary, public
welcome page, welcome selection modal and login page only. No broader
localization audit, new task, backend recommendation change or protected
translation activation.

## Root cause

Welcome and Auth already use the centralized consumer copy hook. The exact
reported welcome subtitles, modal text, login instructions, labels and controls
already have Spanish resources. Fresh Spanish-device initialization is also
implemented.

The reproducible defect was the language synchronization effect in
`AuthContext.tsx`: when session discovery completed without a user, it treated
the missing account preference as `auto`, wrote that over the existing
non-sensitive language hint and resolved the browser language again. Thus an
explicit Spanish choice on an English/default-English browser initially loaded
Spanish, then reverted to English on public welcome/login. Anonymous startup
also wrote Auto when no hint existed. This was not a missing-resource or
namespace-loading defect.

The narrow correction leaves anonymous language state alone. Verified account
preferences still replace the startup hint before paint. No authentication
requests, credential handling, session rules, permissions, storage key, storage
format or account preference write was changed. Auto still follows the device
and is not rewritten as an explicit language.

This establishes the defect in the tested code path; the original founder
browser/device locale was not captured, so this report does not infer its exact
configuration from the reported English screenshots.

Workspace organization count/action strings and the dashboard's reported
activity labels were hardcoded. The dashboard protein opportunity was a fixed
English message selected by the existing server compliance engine and displayed
verbatim. Those are separate missing display-localization connections.

## Corrections

- `client/src/contexts/AuthContext.tsx`: removed only the anonymous reset of the
  language hint. Verified-account synchronization is unchanged.
- `client/src/components/WorkspaceChooser.tsx`: localized organization count,
  chooser action and Business Suite action. Names, destinations, selection
  requests and permission checks are unchanged.
- `client/src/components/dashboard/ComplianceCard.tsx`: connected reported
  labels, unavailable-score text and hydration explanation to existing EN/ES
  infrastructure. Scores, eligibility, denominators and recommendation selection
  remain unchanged.
- `client/src/i18n/dashboardComplianceCopy.ts`: exact closed mapping of eight
  existing compliance-engine opportunity messages. Unknown/historical/authored
  messages pass through unchanged. No arbitrary safety-content translation.
- `client/src/i18n/consumerFeatureCopy.ts`: added only the bounded display
  translations above. English remains the source-key fallback.

Welcome and Auth page copy needed no edits. My Perfect Meals, Emotion AI™,
Behavioral AI™ and existing trademark marks were preserved.

## Before/after evidence

### Reproduction before the application correction

New expectations were first run against the original AuthProvider:

| Anonymous startup / transition | Before | After |
| --- | --- | --- |
| Explicit `es` on English device | Overwritten as `auto` | `es` retained |
| Explicit `en` | Overwritten as `auto` | `en` retained |
| No local hint | `auto` written | No hint written |
| Logout after explicit `en` | Overwritten as `auto` | `en` retained |

The pre-fix run failed those four assertions and passed the existing Auto case.
The corrected full focused run passes. The pre-fix evidence is automated
AuthProvider regression evidence, not a controlled before-browser screenshot.

Evidence: `.local/reports/targeted-spanish-before-tests.log`.

### Final automated verification

**96 tests passed across 8 suites, zero failures.**

- New targeted screen suite: actual EN/ES welcome/modal, workspace selector and
  dashboard components with synthetic read-only dependencies; exact numeric
  values, eligibility branches, unchanged tenant names and opportunity input.
- Auth cookie restoration suite: anonymous hint retention, verified account
  language, account changes, logout, session and public-routing regressions.
- Consumer journey localization suite: existing Auth labels, error display,
  recovery, resource parity and other scoped consumer controls.
- Workspace discovery suite.
- Language preference foundation and persistence suites.
- Existing shared Getaway meal-card and Ask Chef/Getaway localization suites.

One new modal expectation was corrected to match the existing Spanish resource
`Es mi primera visita`. An older interpolation-parity test incorrectly required
Spanish variables to occur in English word order. It now compares the exact
placeholder multisets, preserving names, counts and missing/extra-variable
detection. No translation was changed to accommodate that test.

Additional checks:

- New-interface-copy localization guard: passed without new exemptions or
  allowance resets.
- Strict safety typecheck: passed.
- Client Vite and server esbuild compilation: passed using the existing scripts,
  redirecting only output directories to ignored `generated-artifacts/`.
  Bundle-size warnings remain visible and non-fatal.
- Canonical release-type check: exact match to **109 approved existing
  diagnostics**, fingerprint
  `e8dadf605ccc7c3c6dec1285551bfa2a37871bee3a9fa1993444c871565813a7`.
  No new diagnostic, fingerprint refresh, suppression or checker change.
  Generated build-version state was restored.
- Diff whitespace and protected-candidate integrity checks: passed.

Logs: `.local/reports/targeted-spanish-{focused-tests,copy-guard,safety-types,client-build,server-build,release-types}.log`.

### Browser verification

One browser pass verified the anonymous welcome → selection modal → login
journey at **1280×800 desktop** and **390×844 mobile**. Each variant included
login-page reload after anonymous startup settled and the Show password control
with empty fields, without any submission.

| UI hint | Simulated device locale | Visible language | Hint after reload |
| --- | --- | --- | --- |
| `es` | `en-US` | Spanish | `es` |
| `auto` | `es-MX` | Spanish | `auto` |
| `en` | `es-MX` | English | `en` |
| No hint | `es-MX` | Spanish | No hint |
| No hint | `en-US` | English | No hint |

The four requested language variants were checked at both widths; the final
English/no-hint control was additionally observed on desktop. Device language
was simulated with `navigator.language`/`navigator.languages` initialization
overrides, not a real OS locale change. Translation, hint retention and
password visibility behavior passed. Screenshots showed no clipping in the
reviewed public screens; horizontal width also matched the viewport.

Representative after-correction screenshots:

- Desktop Spanish welcome: `attached_assets/testing_screenshot/89mu6k.jpg`.
- Desktop Spanish selection modal: `attached_assets/testing_screenshot/th54xu.jpg`.
- Desktop Spanish login: `attached_assets/testing_screenshot/g2vk2b.jpg`.
- Mobile Spanish welcome: `attached_assets/testing_screenshot/arwrf4.jpg`.
- Mobile Spanish selection modal: `attached_assets/testing_screenshot/7ckykd.jpg`.
- Mobile Spanish login: `attached_assets/testing_screenshot/cgurhi.jpg`.
- Auto + Spanish device: `attached_assets/testing_screenshot/dgdlam.jpg`.
- Explicit English + Spanish device after reload: `attached_assets/testing_screenshot/l05p55.jpg`.
- Fresh Spanish-device startup without hint: `attached_assets/testing_screenshot/182txz.jpg`.

The reviewed mobile modal and desktop login screenshots were inspected
directly. Public browser console output contained expected anonymous 401s and
development websocket noise; no blocking application failure was reported.

There is no controlled pre-fix browser screenshot. The before/after comparison
combines the failing-then-passing real AuthProvider regression above with
post-correction browser evidence, not fabricated matching screenshots.

Authenticated workspace/dashboard browser verification is not claimed; no
account sign-in, fabricated session or live customer-data write was attempted.

## Boundaries

All seven Ask Chef/Getaway protected Spanish passages are byte-for-byte
unchanged in the review manifest: founder wording accepted, qualified clinical
review still pending, reviewer/timestamp unset and no runtime activation.
Clinical/nutrition safeguards, venue verification and concierge behavior are
unchanged.

All tests and builds used a minimal child environment without inherited database
or provider credentials. No paid AI calls, customer-data mutations, Production
publication, version update, server execution from build output, new runtime or
unrelated localization work was performed.
