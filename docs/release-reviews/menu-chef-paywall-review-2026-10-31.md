# My Perfect Menu and Ask Chef paywall verification

## Scope

- Branch: `integration/all-approved-development-20261031`.
- Starting source: `7c7607962`.
- Authorization: verify and correct only entitlement, subscription-listing, and upgrade-prompt discrepancies. Do not activate Ask Chef, change prices/Stripe products/native iOS, merge into Production, push, deploy, or publish.

## Verified standard consumer matrix

| Tier | My Perfect Menu | Ask Chef when separately activated |
| --- | --- | --- |
| Free | Locked | Locked |
| Essential | Included | Locked |
| Pro | Included | Included |
| Clinical | Included | Included |

Existing server-resolved internal, pilot, temporary Clinical, family, and provider access rules are retained; this is not permission to infer professional access from a personal subscription.

## Findings and corrections

### My Perfect Menu

- Already correctly guarded by `PaywallGuard` on `/foods-i-enjoy` and by `requireAuth, requireEssentialAccess` on the complete `/api/my-perfect-menu` router. Those guards were not changed.
- The Menu's meal and snack completion hooks both call `/api/meals/generate`, which already mounts `requireAuth, requireEssentialAccess`. Builder/subject resolution, household authorization, selection validation, clinical safeguards, finalization, and board insertion were not changed.
- `shared/planFeatures.ts` already includes `my_perfect_menu` in Essential, Pro and Clinical entitlements and lists the feature in Essential copy.
- Added the missing My Perfect Menu feature to the Essential entry in the secondary `client/src/data/planSkus.ts` listing. No price, SKU, product, or checkout behavior changed.
- App Library's topic now explicitly says “Included with Essential, Pro, and Clinical”; the dashboard card says “Essential and above.”
- Added the proper “My Perfect Menu” feature name to route upgrade prompts. The existing Essential upgrade requirement and accessible-parent dismissal behavior remain unchanged.

### Ask Chef

- Pro subscription copy already includes Ask Chef in both shared plan features and the secondary plan listing. It is not listed in Essential.
- Found missing tier checks on the six Ask Chef frontend routes. All six now use the existing `ProGuard`: home, welcome, intake, complete, progress-slowed, and tired. Stable module-level lazy components avoid remounting protected pages on each guard render.
- Added the proper “Ask Chef” feature name to the existing Pro upgrade prompt.
- Found authentication-only protection on conversation APIs. Added the existing `requireProAccess` after `requireAuth` on all eleven conversation/message/history/bootstrap/plan/follow-up read and mutation registrations.
- No middleware policy was changed. Tests explicitly enable billing enforcement and use the real Pro middleware.
- Authentication remains per-route, not router-global: shared activity-event collection stays at its existing authentication boundary rather than making ordinary platform activity a Pro-only feature.
- The separate navigation resolver retains its existing destination-specific Essential/Pro/Clinical/purchased-plan checks, and remains unavailable in Production. Resolving a destination does not grant conversation access or bypass the destination's page/API guards.
- Outer `VITE_COACHES_CORNER_ENABLED`, client conversation Development gating, server concierge/intake conditions, and navigation environment gating are unchanged. Ask Chef was **not activated**.

## Verification

**17 suites / 247 tests passed, zero failed.**

The new isolated HTTP matrix suite covers:

- Free/Essential/Pro/Clinical frontend access predicates and real server middleware.
- Legacy monthly plan aliases; Family Essential/Pro/Clinical; Clinical Business and provider Studio plan keys.
- Unauthorized direct calls to every protected Ask Chef API, including delete and follow-up delivery, before any database read/write or engine call.
- Rejection of client-supplied subscription claims.
- Existing server-resolved internal/pilot/temporary Clinical allowances.
- Menu outer-router protection and correct frontend/server guard wiring.
- Production-disabled navigation, authorized Menu navigation, and rejection of a Pro user's Clinical-only destination.
- Both subscription-listing sources, App Library/dashboard copy, and minimum-tier prompt configuration.

The suite uses synthetic identities with mocked authentication, database, engine, and activity-event dependencies. These are real Express-router authorization checks, not live subscriber login, live generation, or shared-database fixture tests. Menu handler bodies are not exercised by its isolated outer-guard harness; existing guard registration and completion-path source were separately audited.

Additional passing suites cover existing Menu Essential access, Menu builder/contract/completion behavior, conversation restoration/intake behavior, navigation contracts, authentication credential precedence and session probes, CSRF, Stripe entitlement resolution, access tiers, provider/client access, authorized board insertion, release copy, and upgrade dismissal.

The existing conversation-route fixture was given an explicit authorized Pro identity instead of relying on an authenticated ID alone.

### Full release validation

`NODE_OPTIONS=--max-old-space-size=4096 npm run release-check` exited **0**:
**12 passed, 1 warning, 0 failed**.

- Client and server Production builds passed.
- Strict safety types passed.
- Strict root release gate passed against the **unchanged 118-diagnostic baseline**. This is not a clean root compilation or a newly refreshed baseline.
- Critical unauthenticated route and generation probes passed without invoking paid generation.
- The sole warning is the same legacy storage-health probe: it expects `hasS3`, whereas health reports an Object Storage bucket but no `hasS3` field. No storage-write test was performed, and no image behavior was changed to suppress the warning.

### Restarted preview

- Restarted the existing main workflow once with its unchanged Production-mode safe-start configuration.
- Health reports `ok: true`, `initialized: true`, `initError: null`, and billing enforcement enabled.
- Direct unauthenticated GETs to `/api/coach/bootstrap`, `/api/coach/conversation`, and `/api/my-perfect-menu/concepts` return **401**.
- Public `/pricing` visibly renders My Perfect Menu under Essential and Ask Chef under Pro. The unsigned-in desktop shell also displays a workspace-discovery warning alongside expected authentication 401s; this is outside the bounded paywall correction and was not changed.
- The screenshot browser is unsigned-in. Signed-in Menu/Ask Chef screens and real subscriber sessions were **not** visually verified; the tier matrix is established by the source audit and isolated HTTP/permission tests above.
- Native iOS, Stripe products/prices, shared tier policy, Ask Chef activation gates, the release baseline, Production entrypoint/route registration, and pinned image/reminder sources remain unchanged.

Evidence: [`menu-chef-paywall-2026-10-31/regression-summary.json`](menu-chef-paywall-2026-10-31/regression-summary.json) and [`release-check.txt`](menu-chef-paywall-2026-10-31/release-check.txt).

## Release status

This bounded audit does not waive the two pre-existing catalog-test failures or other qualifications recorded in the preceding final integration review. No Production release approval, feature activation, or publication is implied.
