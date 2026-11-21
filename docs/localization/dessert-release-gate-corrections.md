# Dessert PR localization release-gate corrections

This follow-on review records the approved release-gate corrections after the
15 Dessert localization findings were fixed. The earlier Dessert-only review is
historical evidence of that narrower correction, not the final status here.
Keep PR #481 in draft. No merge, Production workspace changes or publishing.

## Comparison wiring

The GitHub workflow now passes `github.event.pull_request.base.sha` through the
step environment to Phase 0. A focused argument selector forwards that exact SHA
to the existing checker's `--base` option using an argument-array subprocess.
Missing/malformed PR target metadata, conflicting explicit bases and malformed
arguments fail closed. The existing checker still requires available history,
adoption ancestry, HEAD ancestry and readable/static resources.

The historical adoption SHA and exception list are unchanged. Non-PR runs without
an explicit base continue auditing since adoption. No other Phase 0 gate is
skipped, made optional or counted as passing by the PR comparison.

## Four shopping failures

Connected eight distinct ordinary display phrases, appearing nine times across
three components, to the existing `useConsumerCopy` / `consumerJourney` resources:

- `ShoppingProductPicker`: six labels, including the product-evidence summary,
  candidate-identity qualification, choose action and reference-review controls.
- `SmartShoppingProductChoice`: the unverified-reference label and saved-review
  status.
- `ProductCatalogChoices`: the knowledge-based explanation heading.

Original English remains unchanged. Added explicit Spanish counterparts only.
Product identities, ingredient/label evidence, provider explanations, unresolved
warnings, clinical disclaimers and shopping selection/clear payloads were not
translated, rewritten or modified.

Fresh legacy-audit counts returned to their existing allowances:

| Component | Before | After | Existing allowance |
| --- | ---: | ---: | ---: |
| ShoppingProductPicker | 14 | 8 | 8 |
| SmartShoppingProductChoice | 4 | 2 | 2 |
| ProductCatalogChoices | 4 | 3 | 3 |

Registered the already-active `ProductRecommendationExplanation` component at
**zero** in the existing per-file registry. Its source was not changed. Every
existing file allowance and all other baseline metadata are identical; no
allowance was increased and no baseline was regenerated. New copy in this file
will fail the existing ratchet.

The historical incremental audit now reports **606** findings rather than 614.
Exactly eight historical findings were resolved by these real display
connections; no finding was added. The legacy scanner's ninth removed occurrence
was already present at adoption and therefore was not an incremental finding.
This audit still exits with failure, as required. It was not reset or suppressed.

## Six clinical failures: investigated, not cleared without review

The two affected source files are byte-for-byte identical to the PR target's
source. These six mismatches were already analyzed in
`release-clinical-approval-package.md` and explicitly held for qualified review:

| Protected registry identity | Existing current explanation |
| --- | --- |
| `learn.realtime_diabetic_meal_adjustment` | Glucose-aware meal context across the platform |
| `learn.glucoseguard_is_for_diabetics` | Logged glucose awareness across builders and creation tools |
| `learn.starch_guard_is_about` | Starch Guard versus logged glucose context and coexistence |
| `editprofilepage.protocol_controlled_by_your_2` | Clinical Protocol Review Required |
| `editprofilepage.metabolic_medication_support_nutritional` | Existing GLP-1 meal-generation guidance |
| `editprofilepage.not_a_substitute_for_4` | Legacy GLP-1 setting, separate support choice and clinician guidance |

The third legacy registry entry is truncated, but its full current replacement
also changes a clinical/product claim; truncation is not sufficient authority to
approve that replacement. The other changes likewise are not encoding-only
repairs or unchanged text moved into translations.

The owner supplied conditional authorization for technical-only, meaning-preserving
corrections, explicitly excluding substantive wording changes. After reviewing
the differences, the owner explicitly kept all six explanations unapproved and
requested behavior/code evidence and recommended wording before any decision.
The differences above do not meet the technical-only equivalence condition.
No approval has been fabricated, no text has been restored merely to satisfy the
scanner, and no registry identity or source disposition has been changed. The
existing clinical gate continues rejecting all six. Their exact current wording,
required evidence and approval-return fields remain in the linked package.

## Verification scope

- Localization guard tests: **59 distinct tests passed** (58 in the full run plus
  one added targeted history/ancestry regression), including subprocess rejection
  of new untranslated interface copy and new protected clinical copy against an
  advanced PR target; inherited findings remain rejected by the historical audit.
- Shopping/Dessert display regressions: **6 suites, 133 tests passed**, including
  actual English/Spanish resources, unchanged product evidence, selection object
  identity, clear behavior and existing Dessert three-choice behavior.
- Full local Phase 0 with the PR-source-equivalent ancestor: GATE_09 passed with
  **zero** findings; all four shopping failures cleared; **six clinical failures
  and one existing migration-coverage warning remain**.
- The local ancestor's complete tree matches the actual PR target. GitHub uses
  its merge checkout and the actual PR target SHA, not that local substitute.
- Historical/default audit: **606 findings, nonzero exit**, adoption unchanged.
- Complete mandatory `npm run release-check`: **14 passed, zero warnings, zero
  failures**, including the unchanged approved root type fingerprint and strict
  safety types. This does not override the separate localization gate failures.

The complete mandatory release-check result and final GitHub CI outcome are
reported with the pushed revision on the PR. No live provider call, customer
shopping write or clinical behavior test was introduced by this work.

Dessert generation, three-choice comparison, result handling, serving arithmetic,
images, dietary/medical validation and action implementations are unchanged.
