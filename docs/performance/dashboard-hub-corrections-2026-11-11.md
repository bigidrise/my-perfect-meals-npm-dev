# Dashboard and My Hub — Development correction review

November 11, 2026. Development only. No GitHub push, merge, publication,
Production workspace modification, native sync/build, or schedule edits.

## Implemented change set

### My Hub

`MealReminderPanelFrame` reserves a fixed sheet compartment for reminder
settings (26rem web, 34rem native). The existing menu below it no longer changes
position when the async content changes from loading to empty, populated or
failed. Longer schedules and expanded diagnostics scroll within the
compartment, with keyboard focus support.

This is the deliberate layout tradeoff: unknown server slot counts cannot be
handled by a tiny placeholder without later moving the menu. Existing reminder
controls, colors, menu order and routes are retained. The loading skeleton now
resembles the full panel instead of a single strip.

Web reads now use the existing strict read mode too: failures render the existing
translated failure/retry UI rather than masquerading as default schedules.
Confirmed empty responses still show editable disabled defaults; no settings are
saved until the user actually edits them. Native reads were already strict.

### Dashboard hero and Ask Chef

Same original artwork, object-fit/crop rules, height, gradient and greeting.
Eager loading and high priority remain. The hero now has responsive WebP sources
and explicit intrinsic dimensions. No external image service or new dependency.

| Asset | Before | New delivered alternative | Reduction |
|---|---:|---:|---:|
| Hero, 512px | 1,409,259 bytes PNG | 38,040 bytes WebP | 97.3% |
| Hero, 768px | 1,409,259 bytes PNG | 74,802 bytes WebP | 94.7% |
| Hero, 1024px | 1,409,259 bytes PNG | 120,468 bytes WebP | 91.5% |
| Ask Chef mascot, 160px | 46,176 bytes | 10,398 bytes | 77.5% |
| Ask Chef mascot, 240px | 46,176 bytes | 18,642 bytes | 59.6% |

Hero source selection depends on actual display width/DPR. The original PNG and
mascot remain as source artwork/high-density fallback; they are not overwritten.
`scripts/optimize-dashboard-images.mjs` reproduces the variants using installed
Sharp. Hero pixel PSNR versus equally resized original artwork was approximately
41.4/42.1/42.4 dB at 512/768/1024; this is a compression metric, not proof of
perceptual identity or a mobile rendering benchmark.

The wordmark is unchanged: a lossless re-encode remained exactly 82,858 bytes.
No fidelity reduction was justified solely to change that file.

Ask Chef's card still renders independently of its status request. Pending or
incomplete status still navigates to the existing welcome destination; completed
status still uses home. No new behavior or popups.

### Nutrition Life Plan

- The authenticated summary's independent envelope, saved-target and optional
  glucose reads now start concurrently. They use the same authorized subject
  and original builders. No shared cache, shortened authorization path, changed
  macro calculation, or changed clinical threshold was added.
- Dashboard hydration enrichment previously resolved a full generation nutrition
  context only to build `consideredForYou` explanations that this response never
  used. Earlier logs put that unused context at 920–1,389 ms in sampled requests.
- The summary now explicitly omits those unused explanations. Intake, directive,
  liquid-protocol, numeric-policy and professional-update reads remain. Other
  hydration callers keep full context by default; explicit context observers
  still get their callback.
- Offline tests compare complete hydration results with only the unused
  explanation array changed, verify the skipped call count, and preserve failure
  propagation. Summary construction still waits for all required reads.
- Client baseline/dynamic cache identities, five-minute baseline freshness,
  dynamic refreshes, event invalidations and error messages are unchanged.

No authorization/profile read was removed merely because it looked similar.
No cached/invented macro values were introduced.

**Measurement limit:** eliminating the unused call is source- and test-proven;
an authenticated after-change HTTP latency or Dashboard LCP comparison was not
available. The historical stage timings are not an end-to-end speedup claim.

### Authentication and service-worker isolation

An offline VM regression reproduced the old handler returning a cached
account-A API response after an account-B network failure. It did not access
real accounts or customer caches.

The worker now leaves `/api` and `/api/...` requests to the browser's real network
path, never writing or falling back to API cache entries. Activation version
advances and retires the prior cache, including its API entries. Static offline
asset fallback and notification handlers are retained.

Auth tests distinguish successful cookie-backed restoration, definitive 401,
403 authorization denial, 503, and network failure. No authentication runtime
rewrite is included.

**Remaining issue:** initialization with no cached routing identity and a
transient profile failure can still resolve to the anonymous/welcome path. The
test verifies it does not manufacture identity; it does not prove good retry UX.
A separate narrowly scoped fail-closed retry correction was proposed rather
than silently changing the general auth lifecycle here.

## Verification

- Focused Jest suite: **16 suites, 112 tests passed**, fully mocked where
  database/native/provider modules are involved.
- Strict safety types: passed.
- Release type validation: passed against the unchanged reviewed
  **109-diagnostic baseline**. This is not a claim that the entire root project
  has zero TypeScript debt.
- Client Production build: passed.
- Server Production build: passed.
- Existing build warnings about large chunks are not resolved by this scope.
- Existing Development workflow restarted once after application changes;
  serving requests. Public optimized hero delivery visually inspected.
- `git diff --check`: passed.
- No native functionality, saved schedules, clinical protocols, subscriptions
  or entitlements changed.

## Browser evidence and limits

The tester used a 402×874, DPR 1 browser and the Development origin only.
Existing test-account credentials were not transferred or printed. Authenticated
access was blocked; the secure takeover returned `browser_view_unavailable`.
The app's unauthenticated profile request returned a genuine 401 and led to its
public welcome screen. This is not evidence of a false authenticated redirect.

Original hero standalone baseline:

| Operation | Browser measurement |
|---|---:|
| Forced-reload fetch to Blob | 308.6 ms |
| Detached decode | 21.2 ms |
| Warm force-cache fetch to Blob | 6.5 ms |
| Warm detached decode | 19.5 ms |
| Body bytes | 1,409,259 |

This was a cold-like reload, not a cache-cleared cold navigation. Resource
Timing transfer sizes were unavailable. Browser hints were 4g/downlink 10,
but no network throttling API was available; that is not a measured mobile
network profile. Detached decode is not first paint or Dashboard LCP.

After-change standalone measurements, at the same viewport/DPR:

| Asset | Forced reload to Blob | Warm cache to Blob | Detached decode forced/warm |
|---|---:|---:|---:|
| Hero 512 WebP | 109.1 ms | 6.2 ms | 11.1 / 10.3 ms |
| Hero 1024 WebP | 80.4 ms | 5.6 ms | 17.6 / 18.1 ms |
| Mascot 160 WebP | 96.3 ms | 5.4 ms | 3.5 / 3.8 ms |

The testing notebook expired between baseline and after-change work, so the
after pass used a fresh browser context. These are individual samples with
uncontrolled network variance, not a statistically controlled speedup. Blob
sizes confirm payload reductions; cache-only probes confirmed warm entries.
The real source set selected the 512w hero at this DPR 1 viewport.

The tester compared the original and responsive artwork under the existing
370×208 mobile crop and gradient. Framing/composition appeared the same;
the 512w image was marginally softer. This was an isolated presentation,
not a signed-in Dashboard paint measurement.

### Real-component browser fixture

The tester imported the actual `MealReminderPanelFrame` and `MealReminders`
modules through Vite into an isolated, browser-owned React root on the public
page. This did not bypass authentication or expose protected data. Only
reminder GETs were intercepted to return synthetic fixtures; no PUT was made.
Capacitor remained non-native.

- The compartment measured 416px. The synthetic menu below it stayed at
  Y=468 through delayed loading, empty defaults, populated and retry states.
- Six slots produced a 939px scroll height. Scrolling to 523px exposed the
  final row/time control fully without moving the menu.
- A synthetic 503 displayed an explicit error and Retry button, without
  invented/default rows. Retry issued another synthetic GET and recovered.
- The fixture caught iPhone-specific failure copy on web. The final correction
  uses existing generic translated failure/retry text outside iOS and preserves
  the iOS message. The affected 16-test panel suite passed after that change;
  the geometry was not changed.
- Temporary fetch interception and fixture DOM were removed afterward.

Signed-in Dashboard initial/repeat navigation, same-account after-change
summary request timings, integrated Hub navigation and real account-switch
offline behavior remain unverified in a real authenticated browser. Offline
regressions do not substitute for those checks.

## Release disposition

The Development change set has been self-reviewed and cheap checks/builds pass.
Review the browser limitations and outstanding session-outage behavior before
any promotion. This work does not authorize a push, merge, publish or iOS build.
Native delivery findings and the device test protocol are documented separately
in `docs/mobile/ios-meal-reminders-investigation-2026-11-11.md`.
