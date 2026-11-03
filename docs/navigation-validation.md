# Phase 2 — Static navigation validation

## Commands and gate

- `npm run validate:navigation` scans source and exits nonzero for unmatched literal
  page destinations or unsupported/unresolved registered routes.
- `npm run validate:navigation -- --json` prints the complete machine-readable
  findings, including file, line, reference kind, and unresolved expressions.
- `npm run test:navigation-check` runs isolated parser, matcher, and command-line
  regression tests. Fixtures use temporary directories, not accounts or databases.
- Development `npm run validate` runs both commands before its existing checks.
  No findings baseline, broad allowlist, or automatic route repair is used.

## Source authority and scope

The registered `<Route path=...>` declarations in
`client/src/components/Router.tsx` are the SPA route authority, not a knowledge
catalog or the Not Found fallback. Scanned roots are `client/src`,
`shared/coaching`, and `server/services/coaching`. Tests are excluded.

Recognized references include JSX link/navigation props, ordinary navigation
calls and Wouter setter aliases, browser location/history navigation, and
route/path metadata used by Copilot, Ask Chef, feature registries and Library
integrations. Query strings and fragments are removed for page matching;
registered parameter, optional-parameter, and wildcard paths are supported.

API routes, external links, file-resource targets and URL query-parameter objects
are not SPA page destinations. They are not independently validated by this check.

## Required interpretation

- A match proves **only structural route compatibility**. It does not prove
  authentication, subscription/role access, redirect correctness, mobile/iOS
  presentation, successful persistence, or that the intended action is available.
- Dynamic/imported destinations, relative links and unresolved expressions are
  reported for manual review, not counted as matching destinations. Unresolved
  registered routes fail closed. Unresolved destination expressions do not
  independently fail the static gate, but remain outstanding completion evidence.
- Source scanning includes legacy, unreferenced and conditional files. An unmatched
  reference is a concrete source mismatch, not proof of a reachable customer defect.
  Review reachability before deciding whether or how to fix it.
- Free-form knowledge prose and arbitrary custom navigation wrappers cannot be
  completely analyzed. The report is not a platform-wide navigation guarantee.
- Existing mismatches fail the gate too. They are not suppressed merely because
  they predate this check. Do not rewrite unrelated routes to make validation pass.

Critical-workflow click-through verification remains Phase 3. Business Suite and
Academy native iOS verification remains Phase 4. Neither is activated by this tool.

## Initial Development findings

The initial scan inspected 1,359 source files against 247 registered routes:
1,106 literal references matched, 82 references pointed at 63 unregistered
destinations, and 365 expressions required review. All registered route patterns
were supported. The static gate **fails** on the existing unmatched references;
no baseline was introduced to hide them.

Examples requiring reachability review before any repair:

| Source | Unregistered destination |
| --- | --- |
| `client/src/components/copilot/CanonicalAliasRegistry.ts:139` | `/glp1-menu-builder` |
| `server/services/coaching/capabilityRegistry.ts:77` | `/meals` |
| `client/src/components/DailiesGlucoseCard.tsx:23` | `/blood-sugar-hub` |

These are source mismatches, not a claim that all are currently visible to members.
The scan also includes legacy code. Rerun the JSON command for complete current
findings; these counts are an initial snapshot, not a maintained baseline.
