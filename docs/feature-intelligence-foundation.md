# Automated Feature Intelligence — Development foundation

## Approved boundary

This is an **offline, engineering-only evidence compiler**, not a new application
feature or a second manually maintained source of truth. It reuses the existing
catalogs. It is not imported by Ask Chef, a server route, the client bundle, or a
production startup. Connecting it to conversation is a separate approval.

No database, model, integration, credentials, network service, migration or paid
API is needed. Source files are read as text; application code is not executed.
The only runtime imports from the application are its existing pure coaching
catalog functions and constants. These do not bootstrap the application.

## Commands

```sh
npm run features:discover
npm run features:check
npm run features:watch
npm run test:feature-intelligence
npm run check:feature-intelligence-types
```

The discovery/check/watch commands explicitly select Development. Invoking the
CLI directly with Production, an unset environment or another environment fails
before reading a state file or generating output. These scripts do not activate
or publish anything, even when a caller explicitly selects Development.

`features:check` regenerates evidence and validates registry integrity. Existing
coverage debt is reported, not silently upgraded or used to block every
Development change. `--strict` additionally fails for any incomplete record/gap.
It is deliberately not the default while legacy coverage is incomplete.

The existing Development `scripts/validate.sh` now runs the offline discovery
check and its unit tests before its historical checks. This integration does not
alter production builds, startup, release metadata, or existing runtime checks.
The CLI can also watch source files separately with a debounced refresh. It is
not attached to the application's managed workflow and incurs no request-time
scanning overhead.

## Generated artifacts

All outputs are under `generated-artifacts/feature-intelligence/`, already
excluded from Git and deployment:

| File | Purpose |
| --- | --- |
| `registry.json` | Structured documented-feature and registered-page records, aliases, relationships, source lines, controls, backend evidence, access notes and verification |
| `coverage.json` | Counts, per-record gaps, alias collisions, unresolved routes, legacy unregistered routes, unbound page modules, incremental changes |
| `coverage.md` | Human-readable coverage report |
| `state.json` | Content hashes, parsed structural facts and prior record fingerprints for incremental discovery |

These files contain implementation references and are **not consumer
responses**. They are outside the public asset directories. No consumer export
or prompt integration exists. The tool itself is also excluded from deployment.
Do not serve these artifacts or inject the raw registry into a model prompt.
Both Development Vite configurations deny these artifact/tool paths, retaining
the existing environment/certificate/Git denials. Middleware mode explicitly
preserves that file-serving policy. This is privacy isolation, not a change to
Ask Chef conversation, permissions or feature navigation.

## Existing sources reused

- `server/services/coaching/platformFeatureCatalog.ts`: current derived catalog,
  descriptions, aliases, limitations, documented audience, source evidence.
- `server/services/coaching/platformKnowledge.ts`: member knowledge and explicit
  available/Coming Soon/disabled metadata, including Development refinements.
- `server/services/coaching/capabilityRegistry.ts`: legacy capability descriptions
  and eligibility notes; these remain unreviewed until corroborated.
- `server/services/coaching/featureUsageKnowledge.ts`: existing verified controls
  and starting guidance reused through the catalog, not copied into a new list.
- `shared/coaching/navigation.ts`: existing destination facts reused through the
  catalog. Discovery never adds to its navigation allowlist.
- `client/src/chef/featureRegistry.ts`: legacy names/aliases checked against actual
  registrations; contradictions are reported rather than trusted.

No feature-by-feature list was added to the analyzer.

## Discovery and tracing

The TypeScript AST scans first-party JS/TS/JSX/TSX under `client/src`, `server`
and `shared`, excluding dependencies, generated code, tests, legacy and demo
directories, dotfiles and symlinks.

- Actual JSX `Route` registrations, static destinations, lazy page imports and
  local guarded wrappers are resolved.
- Primary headings are title candidates, not guaranteed official names. Multiple
  conditional titles stay ambiguous. A random card's heading never names a page.
- Native buttons/anchors, Button/Link/MenuItem/TabsTrigger components and elements
  with click handlers are structural controls. Rendered imported components are
  followed to include nested cards.
- Local handlers are followed with bounded recursion. Static `setLocation`/
  `navigate`, supported request calls, href/to values and template path patterns
  are recorded. Literal arguments are never evaluated.
- Imported source dependencies support affected-feature tracking, including
  shared code. Static server router mounts and nested imported routers strengthen
  request matches to exact backend paths. Unmounted nontrivial suffix matches are
  explicitly weaker evidence; `/` and bare parameter suffixes never match every
  request.
- Observed guard names and middleware are evidence, **not computed permission**.
  Existing subscription, physician, subject, consent, organization/Location,
  credential and clinical checks remain authoritative.

Static analysis cannot prove arbitrary runtime behavior. Computed routes,
translation keys, custom navigation aliases, conditional rendering, wrappers,
dynamic API construction and service-to-service behavior can remain unresolved.
Imported modules are candidate dependencies, not proof every branch runs.
Unbound page modules may be nested pages, unused code or unresolved imports; they
are not automatically new member-visible features.

Admin/debug/demo/test destinations and internal control navigation are withheld
from feature records. Professional and organization facts remain explicitly
audience-tagged in engineering output. No role is inferred from chat or granted
by a discovered route.

## Verification and coverage

- `verified`: **reviewed description with current structural source/page
  presence**, not end-to-end, authorization, nutrition, clinical or model proof.
  The explicit `verificationScope` is `source_backed_documentation_only`.
  A reviewed description can still have control/access/availability gaps.
- `partial`: existing knowledge without complete binding or review.
- `unverified`: discovered page without sufficient documented capability evidence.
- `contradictory`: a knowledge route is missing or its evidence is absent.
- `stale`: the implementation fingerprint changed while its knowledge stayed the
  same. This persists on repeated scans until existing source metadata is updated.

Page and feature observations are separate, related records, not additive claims
about the number of unique product features. A unique existing feature bound to
a page supplies that page's documentation; shared pages with multiple subfeatures
are not arbitrarily assigned one subfeature's purpose.

Coverage includes missing descriptions/names, ambiguous titles, incomplete API
traces, dynamic labels, unresolved control behavior, undocumented access,
unverified availability, Coming Soon markers needing interpretation, missing
source files, obsolete routes and ambiguous aliases. Text differences in the
legacy registry are disagreement warnings, not proof of semantic contradiction.
Button labels never manufacture capabilities or clinical claims.

## Incremental maintenance

Every run hashes source content. Unchanged files reuse cached AST-derived facts.
Only edited files and importers whose module resolution changed are reparsed.
Adding a previously missing imported module and deleting a target are handled.
Reverse impact is calculated through dependency closures and linked backend
source files. Records are compared for additions, modifications, removals and
affected dependencies. Removed source files cannot remain verified silently.

Changing the analyzer invalidates its cache and establishes a new structural
baseline rather than reporting fictitious product changes. Each watch refresh
uses a fresh offline CLI process, so both executable existing catalogs and the
analyzer are reloaded instead of retaining Node's old module cache.

The incremental state is local engineering output, not an immutable release
attestation or an approval record. A fresh checkout without state makes a clean
inventory; it cannot report historical changes it has never observed.

## Cost

No new services, subscriptions, model tokens or paid API calls. Cost is local
filesystem/CPU time and private generated JSON storage. Cold scans parse the
codebase; warm scans hash files and reuse parsed facts. Watch mode is optional
and runs outside application workflows. No AI-assisted interpretation is enabled.

## Tests and next approval

Offline fixtures cover routes/wrappers/lazy imports, nested controls, actual local
handler effects, backend mounts, weaker matches, misleading labels, dynamic
unknowns, internal exclusions, clinical boundaries, Coming Soon metadata, stale
facts, contradictions, alias collisions, cache reuse, dependency changes, record
removal, new imports, source safety and registry integrity.

The self-purpose regression is explicit: an Ask Chef heading/button alone must
not invent its purpose. The discovery report must reveal missing knowledge.
After separate live-connection approval, add the conversation regression:

1. Supply source-reviewed Ask Chef identity/purpose and current entry context.
2. Ask “What do you do?”, “What does Ask Chef do?” and “What is this feature?”
3. Assert the selected, persisted reply explains Ask Chef, does not default to
   Find a Product/Product Scan/Create a Meal, and emits no unrelated navigation.
4. Exercise history/ambiguity, unavailable features and role/subscription
   restrictions. Mocked tests establish wiring; separately approved live model
   acceptance establishes conversational quality.

No live conversation behavior, prompting, navigation allowlist, subscription
rules, clinical authority or release activation was changed by this foundation.

## Initial Development inventory

The initial inventory found 2,449 source files, 56 existing documented feature
entries, 238 registered page records and 3,233 structural control observations.
Nine internal route declarations were withheld. These are separate categories,
not 3,233 verified capabilities or 294 unique product features.

Among the 56 feature entries, 20 have reviewed documentation with source/page
presence, 31 are partial, and five have unregistered legacy routes:
`/check-in`, `/macros`, `/meals`, `/pregnancy-coach` and `/smart-scan`.
Across page records, 17 have that limited source-backed documentation status,
seven are partial, and 214 lack sufficient documentation. Coverage also found
22 unregistered legacy navigation entries, 26 page modules without a resolved
registration, and two alias collisions. Counts are observations from the
initial source snapshot, not a permanent baseline or product release claim.

The current Ask Chef page is discovered, but its purpose description is missing
from the existing feature metadata. This is flagged rather than invented; the
foundation does not fix the live self-description failure.

Measured cold discovery took 9.3 seconds; warm checks took approximately 5.7–6.4
seconds and reparsed zero files on an unchanged repeat. Registry bytes were
identical across repeat scans. Generated artifacts occupied approximately
22 MiB. Runtime cost and paid API cost remain zero for this tool.

## Changed files

- `scripts/feature-intelligence/types.ts`
- `scripts/feature-intelligence/discovery.ts`
- `scripts/feature-intelligence/knowledge.ts`
- `scripts/feature-intelligence/registry.ts`
- `scripts/feature-intelligence/cli.ts`
- `scripts/feature-intelligence/foundation.test.ts`
- `tsconfig.feature-intelligence.json`
- `package.json`
- `scripts/validate.sh`
- `config/development-artifact-privacy.ts`
- `vite.config.ts`
- `client/vite.config.ts`
- `server/vite.ts`
- `.replitignore`
- `docs/feature-intelligence-foundation.md`
- `.agents/memory/MEMORY.md`
- `.agents/memory/feature-intelligence-boundary.md`

The last two record the founder's approval boundary, not generated feature data.

## Feature completion review

| Area | Status | Scope |
| --- | --- | --- |
| Backend / core logic | Complete | Offline compiler and integrity checks only |
| Chef Copilot knowledge | Separate approval | No live knowledge connection |
| App Library | Not applicable | Internal engineering tooling, no member feature change |
| Academy | Not applicable | No educational workflow changed |
| Certification | Not applicable | No credential or progression change |
| Pro Tips | Not applicable | No member workflow changed |
| What's New / release notes | Not applicable | No consumer release or publication |
| Sources | Not applicable | No medical or nutrition evidence changed |
| White label | Preserved | No consumer export; role and tenant authority unchanged |
| Marketing | Not applicable | No new public capability claim |
| AI training | Separate approval | No prompts, runtime knowledge or model calls changed |
| Testing | Complete | Offline contracts/types/builds; no live subscription journey claim |
