# Dessert three-choice localization correction

Scope: correct only the 15 findings introduced by the Dessert three-choice
change on [PR #481](https://github.com/bigidrise/my-perfect-meals-npm-dev/pull/481).
Keep the PR in draft; no merge, Production modification or publishing.

## Changes

- Connected the Dessert comparison region, complete choose/compare sentences,
  success notification, singular/plural counts and clear-choices action to the
  existing `consumerJourney` English/Spanish resources.
- Added 13 Spanish resource entries, retaining the existing English wording.
  Existing catalog values and the 614 historical findings were not changed.
- Kept the four known server messages as canonical English evidence in a shared
  closed catalog. Server codes, statuses, validation/repair evidence and recipe
  rejection decisions are unchanged.
- Connected those four messages to explicit client translations selected only
  for the exact known status/code/message or structured preparation finding.
  Unknown server/provider messages and recipe content are not translated.
  Authentication and nutrition-specific fallback guidance remains protected.
- Did not change generation, deduplication, repair allowances, dietary/medical
  rules, serving calculations, image generation or recipe action implementations.

Files changed: the existing Beverage comparison component, Dessert page,
consumer feature resources, Dessert result helper and server route; a shared
message catalog; focused component/helper tests; this review.

## Localization evidence

The unchanged incremental localization guard reports **614 findings**, down from
629. Comparing owner, finding kind, text and classification against the previously
captured Production-source set found:

- **Zero new findings** relative to that 614-item set.
- **Zero removed or changed historical findings**.
- All **15 Dessert findings resolved** through actual English/Spanish display
  connections; no exception, baseline refresh, scanner change or waiver.

The guard correctly still exits with failure because the 614 existing findings
remain unresolved. The PR must not be described as passing localization CI.

## Verification

- Focused Dessert/Creator and text-size regressions: **13 suites, 330 passed,
  one optional live-provider test skipped**.
- Includes actual comparison/page rendering with the existing i18next resources:
  Spanish headings and instructions; counts of one, two and three; all four
  bounded failure messages; language switching; unchanged recipe/image data;
  selection/Favorites payloads; and clearing choices.
- Existing tests continue covering dietary and medical rejection, GLP-1,
  transformed/repaired validation, batch yields and portion arithmetic, images,
  persistence/account isolation and selected-recipe actions.
- New helper tests reject unrecognized messages/codes, protect authentication
  and nutrition guidance, and verify that original English evidence is unchanged.
- Incremental localization guard tests: **52 passed**.
- Full unchanged mandatory `npm run release-check`: **14 passed, zero warnings,
  zero failures**. This includes client/server production builds, 76 additional
  production-support test passes, strict safety types, the exact root type
  baseline, read-only readiness checks and protected-route smoke checks.
- Final root diagnostic count: **109**, with the unchanged approved fingerprint
  `e49b8f2b61d299d3c277e6b1f426af4624c1f957d46556e94673400f8ed96fe3`.
  This matches reviewed legacy debt; it is not a zero-error strict root compile.

Tests used synthetic authority, services and persistence destinations, without
shared database or paid-provider credentials. Development restarted successfully
with automatic database maintenance suppressed. A mobile preview screenshot
reached the normal sign-in boundary, not an authenticated Dessert result.
Authenticated responsive/iOS safe-area appearance, live model recipe quality,
independent nutrition composition and real customer persistence were not retested.
No layout, navigation or native safe-area implementation changed.

## Remaining blockers

The prior CI failures included six clinical-registry/source mismatches and four
shopping-copy/per-file-baseline findings in unchanged files, as well as the 614
historical incremental findings. These are separate from this correction and
were deliberately left untouched. The final GitHub run must be reported after
the correction is pushed; do not mark the PR ready for merge merely because
the 15 new findings are gone.

The approved TypeScript/localization baselines, clinical registries, compiler
configuration, release gates, CI workflows and guard acceptance rules are unchanged.
