# Messages heading and startup language flash — Development correction

## Root causes and actual startup sequence

### Dashboard Messages

The client inbox branch in `DashboardNew.tsx` used a literal `"Messages"` when
the existing client-messaging flag was enabled, bypassing the page's centralized
translation hook. The alternate legacy branch already used `t("myMessages")`.

Correction: only the literal branch now calls `t("Messages")`; the existing
consumer EN/ES namespace supplies `Messages` / `Mensajes`. No message queries,
counts, unread flags, notifications, read receipts, coaching functionality,
permission checks, expansion handlers or feature flags were changed.

### Temporary English welcome during login

The reproduced sequence is:

1. `main.tsx` imports the i18n module before dynamically importing/mounting the
   React application. That module reads the existing non-sensitive language hint
   and resolves EN/ES/Auto using bundled resources. The reported welcome/login
   translations already exist; this is not a missing welcome resource.
2. AuthProvider starts without a verified profile. Anonymous startup now leaves
   the hint alone, as fixed in the previous bounded correction.
3. The login adapter constructs a routing identity without `preferredLanguage`;
   the corresponding server login response likewise does not supply this
   profile preference. MFA also returns a limited identity. Auth's
   `proceedAfterLogin` calls `setUser` with that identity **before** awaiting its
   existing canonical `refreshUser()` request.
4. The language layout effect treated any user without a language field as
   `auto` (`user?.preferredLanguage || "auto"`). It therefore replaced an
   explicit Spanish hint with Auto and synchronously selected English on an
   English device while the full profile request remained pending.
5. Welcome/login text using the existing reactive translator rendered English
   in that intermediate state. Full profile hydration then supplied the saved
   Spanish preference and switched it back. The reverse error was reproducible
   for explicit English on a Spanish device.

The asynchronous boundary was the existing authenticated profile request, not
a missing translation download or a component's hardcoded welcome fallback.
Local translation subscriptions responded to both switches; rendering only the
final state had hidden the intermediate defect from earlier tests.

## Smallest application correction

`AuthContext.tsx` now leaves locale state alone when `user` is absent **or**
`user.preferredLanguage == null`. Incomplete routing identities do not own a
language choice.

The existing hydrated profile normalizes its preference and still applies
explicit `en`, `es`, or `auto` in the same layout effect before paint. A genuine
Auto remains authoritative and follows the device; it is never replaced with a
persisted explicit resolution. Known but unsupported preferences retain the
existing English fallback.

No new loader, timeout, loading delay, request, await, authentication gate,
cache field or storage format was introduced. Account identity, session
validation, login/MFA routing and profile-refresh behavior remain unchanged.
The existing protected-startup loading boundary is unchanged.

## Reproduction and regression coverage

The new `startupLanguageFirstFrame.test.tsx` uses **the real Auth component,
AuthProvider, i18next instance and consumer translation hook**, with synthetic
credentials and intercepted-in-Jest authentication dependencies. The login
result is deliberately incomplete and the profile response is deliberately
deferred to expose the separately observable intermediate render.

Before the application correction, the regression run reported **3 failed,
5 passed**: explicit Spanish became English, explicit English became Spanish,
and a partial identity overwrote the hint in the authority test. Both existing
Auto cases and the existing reload behavior passed. Evidence:
`.local/reports/spanish-welcome-flash-before.log`.

After correction, the expanded nine-case suite passes. It checks:

- Initial visible login heading, intermediate heading while profile hydration
  is pending, and final language after profile completion.
- Explicit Spanish on English device; explicit English on Spanish device;
  Auto on Spanish and English devices.
- No wrong-language `languageChanged` event during same-preference login.
- Reload with a routing cache lacking a profile language: no authenticated
  welcome while verification is pending, correct heading on completion.
- Hydrated explicit English and real Auto override a conflicting Spanish hint.
- No additional requests or non-GET profile mutations.

The existing dashboard messaging suite now checks actual heading wiring in EN
and ES without marking messages read; its other tests continue exercising
conversation loading, unread/read behavior, draft retention, failure/retry,
voice/video controls and account-specific UI.

Two early new-test fixture issues were corrected without application changes:
the real Auth callback routes to `/` (the router later chooses the destination),
and the message-card visibility assertion must wait for its existing animation.
Neither was handled by changing navigation or animation behavior.

## Final code verification

**102 tests passed across 7 suites**, zero failures:

- `startupLanguageFirstFrame.test.tsx`
- `dashboardClientMessaging.test.tsx`
- `authCookieRestore.test.tsx`
- `languagePreferenceFoundation.test.ts`
- `languagePreferencesPersistence.test.tsx`
- `consumerJourneyLocalization.test.tsx`
- `targetedSpanishScreens.test.tsx`

Additional results:

- New-interface-copy localization guard: passed with no new exemptions or
  allowance reset.
- Strict safety typecheck: passed.
- Client Vite compilation and server esbuild compilation: passed with visible
  non-fatal bundle-size warnings. Existing scripts were used; only output paths
  were redirected into ignored `generated-artifacts/`.
- Canonical release-type verification: exact approved **109 diagnostics**,
  fingerprint
  `e8dadf605ccc7c3c6dec1285551bfa2a37871bee3a9fa1993444c871565813a7`.
  No fingerprint refresh, suppression or compiler/checker change.
  Generated build-version state restored.
- Protected-candidate integrity and whitespace checks: passed.

Logs: `.local/reports/spanish-welcome-messages-{focused-tests,release-types,copy-guard,safety-types,client-build,server-build}.log`.

## Browser evidence and limitations

One public, anonymous browser pass installed a requestAnimationFrame sampler
and MutationObserver before application scripts, filtering headings by ancestor
display, visibility and opacity. At **1280×800 desktop** and **390×844 mobile**:

| Hint | Simulated device | First visible `/auth` heading, initial and reload | First visible welcome modal heading |
| --- | --- | --- | --- |
| `es` | `en-US` | Bienvenido de nuevo | Bienvenido |
| `en` | `es-MX` | Welcome Back | Welcome |
| `auto` | `es-MX` | Bienvenido de nuevo | Bienvenido |

There were **no wrong-language visible heading samples** in these checks.
Hints stayed `es`, `en` and `auto` respectively. Each login-page load produced
two deduplicated trace states: pre-bootstrap with no heading and the correctly
localized heading. Each welcome/modal sequence produced seven trace states,
with My Perfect Meals as the brand heading and the appropriate modal heading.
The pre-bootstrap static document used `lang="en"` before i18n initialized, but
contained no visible English welcome heading; it was not the reproduced
login-to-profile language switch.

Representative screenshots:

- Desktop Spanish login: `attached_assets/testing_screenshot/ohvz14.jpg`.
- Desktop Spanish reload: `attached_assets/testing_screenshot/6sq4gf.jpg`.
- Desktop Spanish modal: `attached_assets/testing_screenshot/4141ac.jpg`.
- Mobile Spanish login: `attached_assets/testing_screenshot/pfqzeb.jpg`.
- Mobile Spanish reload: `attached_assets/testing_screenshot/1tc6ra.jpg`.
- Mobile Spanish modal: `attached_assets/testing_screenshot/4wgovb.jpg`.
- Explicit English on Spanish device: `attached_assets/testing_screenshot/2jssdp.jpg`.
- Auto on Spanish device: `attached_assets/testing_screenshot/52ysfu.jpg`.

The mobile Spanish login and desktop Spanish modal images were inspected
directly. Browser console output included expected anonymous profile 401s and
development websocket noise. No authenticated browser login, form submission
or live customer-account access was performed. The dashboard Messages heading
and intermediate authenticated login transition were verified with synthetic
component tests, not signed-in browser evidence.

Unit/component render assertions are not proof of a physical screen's first
paint. Simulated device language must be reported separately from real OS
settings, and public startup/reload evidence does not certify an authenticated
login transition or dashboard.

## Scope and release boundary

The only application edits are the locale guard/comment in AuthContext, the
Messages heading call in DashboardNew and the single EN/ES resource entry.

All seven protected Ask Chef/Getaway candidate passages remain unchanged,
founder-wording accepted, clinically pending and inactive. No clinical or
nutrition safeguards, venue verification or concierge responsibilities changed.

All local tests/builds ran without inherited database/provider credentials.
No paid AI calls, customer-data writes, new runtime, Production publication or
unrelated screen localization was performed. No backend code or workflow
configuration changed; browser navigation reloads the Development client.
