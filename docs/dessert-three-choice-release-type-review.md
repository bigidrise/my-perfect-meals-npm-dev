# Dessert Creator release type-check investigation

PR: [#481](https://github.com/bigidrise/my-perfect-meals-npm-dev/pull/481).
This is a Development-side correction only. Keep the PR in draft; merging,
Production modifications and publishing require separate explicit approval.

## Root cause and exact diagnostics

A fresh execution of the unchanged mandatory release-type validator reproduced
**111 diagnostics**, fingerprint
`eb76a413b1e1861f6f2c002223fe75fc2cd8fd865c4414bc9495656ad0b82551`.

The two additional diagnostics were:

| File | Line | Column | TypeScript code | Diagnostic |
| --- | ---: | ---: | --- | --- |
| `client/src/lib/__tests__/entryFontSizePreferences.test.tsx` | 31 | 63 | TS2769 | No overload matches this call. |
| `client/src/lib/__tests__/entryFontSizePreferences.test.tsx` | 42 | 60 | TS2769 | No overload matches this call. |

Both overload errors explain: **`'exact' does not exist in type 'ByRoleOptions'`**.
The test supplied `exact: true` to Testing Library's `getByRole`.
That API does not support the option. String accessible-name matching is already
exact, so removing the unsupported options preserves the assertion semantics.
The existing test separately selects `A`, `A+` and `A++`, exercising that
distinction.

### Attribution

These errors **were not introduced by Task #1899**. The text-size test originated
in the earlier entry-screen readability change, commit `4954014ce`.
It is absent from the Dessert implementation's changed-file list.
The test's complete Git blob at the Dessert commit's parent and at the inspected
GitHub Production source is identical:
`caf4937b4b5f78a16e9fd8b2f5460637045abca5`.
This was read-only source inspection, not a Production modification.

Comparing the complete fresh diagnostic set established that the other 109
diagnostic lines already match the approved count and fingerprint exactly,
including locations, messages, codes and multiplicities. This comparison was
investigative only: no diagnostic was removed from compiler output or from the
actual gate's evaluation.

## Correction

Removed only the two `exact: true` properties from the text-size test.
No Dessert application code required a type correction.

The following remain unchanged:

- Approved baseline: `scripts/release-typecheck-baseline.json`.
- Root TypeScript configuration and strictness.
- Safety TypeScript configuration, including Dessert's existing coverage.
- Release validator and release-check script.
- CI workflows, acceptance rules, diagnostic extraction and compiler output.
- Dessert generation, safety and nutrition code, comparison cards and recipe actions.

## Verification

### Focused regressions

**12 suites passed: 305 tests passed, one optional live-provider test skipped.**
This is the existing 303-test Dessert/Creator verification plus both corrected
text-size preference tests, run together after the correction.

Tests ran with synthetic services and a minimal child environment without the
shared database or real provider credentials. Coverage included:

- Three independently validated, distinct recipes; duplicate refill; partial
  results; bounded generation; rejected candidates; repair and deadline handling.
- Allergy and vegan checks, clinical-evidence rejection, GLP-1 policy,
  exact-allergen override propagation and validation of transformed/repaired food.
- Full cakes and wedding tiers, pies, cheesecakes, cookies, brownies and bars;
  whole-recipe totals and derived per-serving arithmetic.
- Recipe selection, Favorites and add/log payloads, shopping, sharing,
  translation, restored choices, account isolation and selected-recipe deletion.
- Existing Beverage, Craving and Create a Dish regression coverage.

These are offline handler/component and policy tests, not live-model nutritional
composition validation or real customer persistence tests. Recipe actions keep
their existing behavior; no action implementation changed in this correction.
Navigation, responsive appearance and iOS safe-area behavior were not re-tested
because no runtime interface or application code changed.

### Mandatory release checks

The complete unchanged **`npm run release-check` passed: 14 checks passed,
zero warnings and zero failures**, with exit status 0. It included:

- Client and server production builds.
- Compiled-production support compatibility and **76 additional passing tests**
  in four suites.
- The strict safety type check.
- The mandatory root release-type validator.
- Development server and read-only object-storage readiness checks.
- Unauthenticated authentication, body-composition, meal-generation, shopping,
  weekly-board and AI-gate smoke checks. Protected routes rejected the anonymous
  probes; these were not live paid-model or customer-write tests.

The final compiler result is **109 diagnostics**, exactly matching the unchanged
approved fingerprint:
`e49b8f2b61d299d3c277e6b1f426af4624c1f957d46556e94673400f8ed96fe3`.
The complete before/after comparison found only the two TS2769 removals and no
added diagnostics. Input hashes confirmed that the baseline, both TypeScript
configurations and both release-gate scripts remained byte-identical.

This passes the existing reviewed-debt contract; it does **not** mean the strict
root compiler is clean. The 109 approved legacy diagnostics still exist.

## Separate CI findings and release boundary

The original PR's **Phase 0 Localization Gates** CI job failed separately.
Its log reported six clinical-string registry mismatches, four shopping-copy
ratchet/review findings and an incremental interface-copy check with 629
connection/review items, including Dessert messages. This is not the cause of the
two TypeScript diagnostics, and fixing them does not establish localization CI
success. No localization registry, ratchet, workflow or CI result was changed
or bypassed as part of this correction.

Keep PR #481 in draft and do not claim an all-green CI or unqualified
Production-ready release. No merge, Production workspace modification,
deployment or publishing is authorized by this investigation.

Full raw compiler outputs, before/after fingerprints, release-check output,
focused test output and input hashes are retained locally under the ignored
`generated-artifacts/dessert-release-type-review/` directory, not deployed or
committed as generated artifacts.
