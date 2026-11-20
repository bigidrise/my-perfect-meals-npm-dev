# Incremental localization guard — verification

## Dictionary registration repair

The static reader now registers the existing nested feature dictionaries and
the separately connected approved training explanations. It no longer stops at
`consumerFeatureCopy.ts#savedGroceriesSpanish`. Historical snapshots load only
their connected feature modules; connected missing modules, unknown spreads and
executable expressions still fail closed.

The reader also recognizes the existing calculator catalog when mounted in both
runtime languages, checks its English derivation, and follows the calculator
helper's actual namespace precedence. This changes validation tooling only,
not application code or translation resources.

**Current verification:** all **36 tests passed**, zero failed or skipped.
Coverage includes all registered feature spreads, duplicate-key precedence,
historical absence versus missing connected modules, executable rejection,
empty/placeholder values, interpolation, protected wording, calculator helper
aliases and missing/partial namespace registration.

The current-workspace guard completed its scan of **289 changed source files**
and exited **1** for **666 unresolved findings**: 405 protected-review,
149 review and 112 interface. It did not exit 2 with a reader failure.
These are review/connection candidates within the documented incremental scope,
not 666 confirmed customer defects. No finding was waived or suppressed.

No application restart, database access, provider request, translation batch,
TypeScript investigation or publication was performed. The adoption boundary,
exceptions, approval manifests and release/typecheck baseline remain untouched.
The earlier passing results below describe the original guard delivery, not the
current workspace.

## Original delivery

- Permanent standalone command `npm run validate:i18n:new` and regression suite
  `npm run test:i18n:new`.
- Added GATE_09 to the existing Phase 0 validator; existing gates remain intact.
- Localization workflow runs the regression tests and integrated validator,
  fetches full comparison history and triggers on the relevant client, shared,
  server and tooling changes.
- Pinned adoption boundary, explicit ancestor-base validation and documented
  exact review exceptions. No exceptions were shipped.
- Static, nonexecuting EN/ES resource reader; no application/provider imports.

## Verification results

1. **26 tests passed**, zero failed/skipped:
   headings, labels, accessibility, menu/dialog text, conditional/template
   messages, producers inside event callbacks, technical/data distinctions,
   clinical registry/keyword protection, translator/hook aliases, lexical
   namespace ownership, shadowing, count plurals and direct interpolation,
   missing Spanish/default fallback, narrow shared-label connections,
   CSS exclusion, net-count evasion, duplicate occurrences, additive resource
   parity, committed/staged/unstaged/untracked source, unavailable/pre-adoption
   bases, resource-only gaps, nonexecuting resource construction, source-bound
   exceptions and server notification configuration.
2. **Standalone current-source check passed.** No application-source changes
   were made by this task. This is not a claim that inherited text is localized.
3. **All original Phase 0 logic is byte-identical** to the adoption snapshot
   after removing only the additive GATE_09 block.
4. **Application/resources, clinical registry/review manifests, both historical
   hardcoded baselines, release-type baseline checker, pre-push checker and
   release-check script compare unchanged** against the adoption snapshot.
5. **Integrated Phase 0 run:** exit 1, **94 failures and one warning**, the same
   inherited outcome recorded in the completed inventory. GATE_09 passed.
   The run used a temporary copied source/resource/report directory and the
   existing read-only Git history; the extra comparison file count in that
   copy reflects copied-file discovery, not new application changes.
   Original generated audit reports and allowances were not overwritten.
6. Node syntax checks for the new executable modules and `git diff --check`
   passed. Existing npm dependencies suffice; no install or lockfile change.

## What was deliberately not done

No interface translation, language-detection/selector change, nutrition or
clinical change, app/browser pass, runtime restart, account operation, database
access, provider request, email or Production deployment. This offline tool
does not need an app screenshot to establish correctness. English/Spanish
desktop/mobile behavior verification belongs to the separately approved
downstream food-workflow implementation, not this source-validator task.

The root release-type check was not rerun: no typed application source or
compiler configuration changed, and its script/baselines are unchanged.
Its previously reported inherited failure is not represented as passing.
No full release or pre-push script that could start the application was run.

## Limits and next step

See `NEW_INTERFACE_TEXT_CHECK.md` for classification, comparison, exception and
dataflow/template limits. This guard is intentionally incremental; it neither
replaces the completed inventory nor certifies runtime visibility, translation
meaning or all-platform completion.

The approved next implementation task may now use the check while completing
shared food components and the selected consumer workflows. Keep all existing
English behavior and protected wording; no scope expansion or Production
publication is authorized.
