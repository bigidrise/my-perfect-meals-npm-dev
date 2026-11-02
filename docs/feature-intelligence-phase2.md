# Feature Intelligence Phase 2 — Development, isolated and disabled

## Approval boundary

Offline enrichment and isolated integration are implemented. The running
application has NOT been opted into the integration. The server requires
`NODE_ENV=development`, no published-runtime marker, and the explicit
`ASK_CHEF_FEATURE_INTELLIGENCE=true` flag. Missing/false flags and Production
always retain the existing conversation path. Do not enable the running
application without the founder's separate approval.

The UI context field also requires a separate Development-only
`VITE_ASK_CHEF_FEATURE_INTELLIGENCE=true` flag. Neither workspace flag was set
as part of this work. These are optional UI hints, never identity, membership,
subscription, clinical authority, consent or navigation authorization.

## Classification precedes enrichment

Classification uses the client HTML/module entry, the configured Vite client
root, the Development server entry, declared Production build source, resolved
imports, route registrations, guards, literal flag conditions, own-page
requests and mounted backend handlers. Unsupported build layouts and unresolved
flags produce review gaps, not invented reachability.

| Status | Evidence |
| --- | --- |
| Active | Resolved implementation and enabled registration reachable from the configured client entry |
| Restricted | Reachability plus existing role/subscription/clinical/permission evidence; never a grant |
| Coming Soon | Explicit existing unavailable/planned metadata |
| Legacy / Unused | Explicit file-level superseded/replaced annotation plus absence from known entry graphs |
| Unverified | Missing, contradictory or conditional evidence; uncertainty is preserved |

An independently documented backend entry can establish restricted functionality
even when its UI visibility flag is unknown. This requires that exact entry,
own-page request and reachable handler evidence, not an incidental auth hook.
An explicitly false UI flag is never overridden this way.

Registered direct links and invitation routes do not require a dashboard link.
Internal/admin routes are retained in engineering coverage but never enter
consumer knowledge. Redirect entries preserve compatibility links and are
reported separately from the screens they replaced. Modules not found by static
reachability remain *suspected/unverified*, not automatically unused. Dynamic
loading and runtime execution are outside this static proof.

No suspected legacy code was deleted, archived or rewritten.

## Enrichment and verified knowledge

Existing catalogs, capability definitions, usage instructions, names, access
notes and source references remain the authorities. Ask Chef now has an opt-in
catalog definition grounded in its current page, API, instructions and
conversation pipeline. The normal catalog call remains unchanged.

Mechanical enrichment may describe source-observed navigation to a named,
reviewed destination. It does not turn a button label, endpoint, title or
navigation relationship into a claimed product capability. Structural
summaries are counted separately and never promoted into reviewed purposes.

Obsolete routes, inconsistent names and alias collisions remain review gaps;
no replacement route is invented. A current route plus a source-backed
description is still NOT runtime, clinical, access or medical validation.

## Isolated Ask Chef integration

The gated hook is inside the existing concierge conversation function, after
the engine's established safety flow. It reads only generated artifacts, never
scans application source or invokes enrichment at request time. A matching
registry/state digest prevents reading a partly regenerated snapshot; build
fingerprints detect mismatched configuration. Missing, malformed or mismatched
artifacts provide no verified knowledge.

Only reviewed, non-stale records classified Active/Restricted are eligible.
Legacy, internal, redirects, unavailable, contradictory and unverified records
are withheld. Professional and organization knowledge require the existing
server-resolved role access. Destination records must also exist in the
caller's existing tool list. Knowledge can narrow that list, never expand it.
Access to a description does not authorize use of a destination or client data.

The projection contains official names, bounded descriptions, instructions and
limitations—not source paths, guards, backend details or the engineering JSON.
Names of withheld records can recognize a question internally, but do not supply
descriptions or new permissions.

Bounded feature-help questions receive deterministic, explanation-only replies.
Self-purpose never defaults to shopping tools. Context uses a validated,
untrusted current-route hint; absent/unknown context asks for clarification.
Ambiguous aliases ask which workflow; explicit comparisons explain both
eligible names. Ordinary conversation still uses the existing provider path;
when the isolated flag is on, its feature knowledge/tool list is narrowed to
the verified projection. Explicit navigation still requires the existing
goal/consent/allowlist/access validation. The hook never adds navigation buttons
or executes feature actions.

This is not a universal natural-language classifier or proof of live model
quality. The supported variations and fallback boundaries are exercised in
offline regressions. No paid model calls were made.

## Automatic maintenance

The **Feature Intelligence (offline)** workflow runs `npm run features:watch`
alongside the normal Development project workflow. It watches source roots,
catalog/analyzer changes and build/entry configuration. Debounced refreshes use
a fresh process so imported catalog updates are not silently cached. Root-file
watchers survive atomic editor saves. The existing Development validation also
regenerates/checks the registry and runs the offline contracts.

Changes regenerate classifications, dependency impact and coverage warnings.
Changed implementations with unchanged reviewed metadata stay stale until
their existing authority is reviewed/updated. The watcher never executes the
application, accesses accounts, calls an AI service or enables the integration.
If it is stopped, run `npm run features:check` before an isolated diagnostic;
request-time source scanning is deliberately absent.

## Test the isolated integration

From the Development workspace:

```sh
npm run test:feature-intelligence
npm run check:feature-intelligence-types

npm run features:isolated -- "What do you do?"
npm run features:isolated -- "What does Ask Chef do?"
npm run features:isolated -- "What does this feature do?" "/coach-corner/home"
npm run features:isolated -- "What does this feature do?"
npm run features:isolated -- "Can you diagnose diabetes?"
```

The diagnostic regenerates private artifacts and calls the actual concierge
hook in a separate short-lived process using a synthetic member/tool context.
It enables the hook **only in that child process**, supplies a provider stub
that rejects any provider attempt, and does not start the app, sign in, save a
conversation or touch a database. Opening/navigation questions and non-feature
questions are intentionally not supported by this no-provider diagnostic.
Use the offline tests for ambiguous aliases, role-denied and malformed cases.

Tests of the normal conversation path use deterministic provider fixtures.
They verify response wiring and selection, not paid-model understanding.
No authenticated or customer-record testing was performed.

## Generated reports

Verified Development snapshot: 2,486 source files, 57 documented feature entries,
238 page records and 3,353 control observations. Inventory now includes legacy
source for reporting; these counts are not new or verified product capabilities.
Across the 295 feature/page records, classification found 52 Active, 120
Restricted, four Coming Soon, zero source-confirmed Legacy/Unused records, and
119 Unverified. Nine internal route declarations are reported separately.

There are 34 source-backed reviewed-description records (17 feature entries and
17 corresponding page records), plus two explicitly non-verified structural
summaries. Ten records qualify for the diagnostic's synthetic member knowledge
projection; this is not an entitlement assessment of any actual account.
Stricter component binding deliberately downgraded uncertain earlier bindings.

Open review includes five obsolete capability routes, two ambiguous aliases,
213 page records without sufficient descriptions, 73 unresolved rendered-page
bindings, 210 suspected/unverified components and three compatibility redirects.
No suspected component is labeled confirmed unused merely for being unreachable
in the static graph. The detailed report also preserves 22 unregistered legacy
navigation entries. These overlapping gap counts must not be summed as features.

Verification: 59 offline Feature Intelligence tests and 322 existing concierge
regressions passed; dedicated types and both builds passed. The root release
type gate matched its existing 118-diagnostic debt baseline. The actual isolated
self-purpose and current-screen diagnostics returned correct explanation-only
replies with zero provider attempts. Private report/helper URLs returned 403.

All live under ignored/private `generated-artifacts/feature-intelligence/`:

- `registry.json`: classified engineering evidence and separate enrichments.
- `coverage.json` / `coverage.md`: counts, gaps, aliases, internal entries and deltas.
- `legacy-unused.json` / `legacy-unused.md`: confirmed evidence, suspected
  components/designs/onboarding, obsolete routes and preserved redirect entries.
- `state.json`: incremental cache, record states and snapshot/build digests.

These paths and analyzer/runtime-helper source paths are denied by the
Development file server; nothing is published as a consumer registry.

## Changed files

- `scripts/feature-intelligence/{types,discovery,knowledge,registry,cli,foundation.test}.ts`
- `scripts/feature-intelligence/{classification,enrichment,isolated,phase2.test}.ts`
- `server/services/coaching/{featureIntelligence,featureIntelligenceRegistry}.ts`
- `server/services/coaching/{platformFeatureCatalog,conciergeConversation,engine}.ts`
- `server/routes/coachingEngine.ts`
- `shared/coaching/types.ts`
- `client/src/pages/CoachsCorner.tsx`
- `config/development-artifact-privacy.ts`
- `package.json`
- `docs/feature-intelligence-phase2.md`
- `docs/feature-intelligence-foundation.md`
- `.agents/memory/feature-intelligence-boundary.md`
- Development workflow configuration: an offline watcher, no integration flag.

## Completion review

| Area | Result |
| --- | --- |
| Backend/core | Classification, enrichment, private snapshots and gated hook |
| Ask Chef knowledge | Isolated integration only; live activation withheld |
| App Library | No member feature or entitlement changed |
| Academy | No curriculum/progression change |
| Certification | No credentials or activation change |
| Pro Tips | No member workflow change |
| What's New | No public release or release-note claim |
| Sources | No medical/nutrition evidence or clinical validation changed |
| White label | No tenant access added; no consumer registry export |
| Marketing | No new public promises |
| AI training | No training or paid enrichment; isolated knowledge projection |
| Testing | Offline regressions/types/builds; no live-model or clinical claims |
