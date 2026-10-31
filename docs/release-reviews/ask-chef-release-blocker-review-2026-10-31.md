# Ask Chef focused release-blocker review

## Scope and source identity

This review does not add features, repeat branding audits, change account permissions, or activate Ask Chef. The owner requested investigation without bypassing or resetting checks.

- Reviewed Development checkout: `864ed8b56` (the prior release-status document plus the completed source work).
- Completed feature-source tip: `c0996f9fec3ace5b4ac21cfca2d88c5c7da5f8bf`.
- Reviewed historical baseline source: `b7dd11f0e`.
- Fetched GitHub Production reference: `67a964474f6ab5effd915fc9bc9ffa027d8e3aa9`.

## Authoritative TypeScript comparison

Both complete compiler outputs were captured sequentially with the same installed dependencies, compiler, strict tsconfig, stable generated build-version exports, and 4 GB compiler heap. Package-lock dependencies have not changed since the historical baseline. Snapshots included the imported Vite configuration, not just the tsconfig include directories.

No compiler diagnostics were suppressed or filtered in the authoritative runs.

| Capture | Count | SHA-256 fingerprint | Compiler time |
| --- | ---: | --- | ---: |
| Historical reviewed source | 120 | `5f299b7c760be174dff591bac35d450823051e0b19ae12b81c3c0980f06649b9` | 115.100 s |
| Current Development source | 118 | `186533e21953cfa70b9c0dfa04d41ffb0bb48f95c300f2a7f28958a7e63a7a9c` | 126.553 s |

The historical output exactly reproduces the committed reviewed baseline. The current output exactly reproduces the previously rejected 118-diagnostic fingerprint.

### Added and semantically changed diagnostics

- Added: **0**.
- Changed diagnostic messages, including multiline continuations: **0**.
- Unchanged diagnostics at unchanged positions: **114**.

### Four location-only changes

All four columns and complete messages are unchanged. Mapping each historical location through the zero-context source diff produces the exact current line; none of these diagnostic-bearing lines was replaced.

| File | Code and existing issue | Historical → current position |
| --- | --- | --- |
| `client/src/pages/CompanionNutritionHub.tsx` | TS2741: `UpgradeLockModalProps.open` missing | `652:10` → `658:10` |
| `client/src/pages/SocialFindMeals.tsx` | TS2741: guided-step record lacks `step3` | `254:11` → `256:11` |
| `client/src/pages/SocialFindMeals.tsx` | TS2322: `unknown` not assignable to the meal-shaped object | `386:58` → `388:58` |
| `client/src/pages/SocialRestaurantGuide.tsx` | TS2322: same existing `unknown` assignment issue | `562:55` → `564:55` |

### Two removed diagnostics

1. **`client/src/components/shopping/RecentScans.tsx:47:3`, TS2740.** The legacy reconstruction returned an incomplete `IngredientScanResult`. The existing fix supplies the required product/provenance and collection fields. It explicitly treats old history as name-based evidence and marks unavailable grades rather than assigning an invented default grade. This is an actual contract correction, not a type-check exemption.
2. **`client/src/pages/CompanionNutritionHub.tsx:663:27`, TS2345.** The prior code passed an `IngredientScanResult` directly to storage expecting `Omit<SavedProductScan, "id">`. The existing fix explicitly serializes the saved-scan fields, preserves the full result, and binds saving to the current account with an account-switch guard.

Both affected files are byte-identical between this Development checkout and the fetched GitHub Production reference above. These removals are from existing Saved Scan corrections, not new Ask Chef work. This source comparison does not establish which version is currently live in the separate Production workspace.

### Risk conclusion and remaining gate

The delta introduces **no new TypeScript diagnostic or changed diagnostic meaning**. The two removals are attributable to real source corrections; the four remaining differences are proven source-position shifts.

This is not a claim that all 118 inherited errors are harmless or that functional Production acceptance has passed.

The strict release checker still rejects the current fingerprint while its reviewed baseline remains 120 / `5f299b7c…`. The checker, baseline, assertions and compiler configuration have been left unchanged. A specific approval was requested before advancing the reviewed baseline to the proven 118-diagnostic set. Reintroducing corrected errors merely to recover the old count would not be a legitimate resolution.

## Mocked authentication investigation

### Exact interrupted command

The original validation reached `scripts/validate.sh` line 397:

```text
npx jest --config scripts/tests/auth-validation-safety.jest.cjs --runInBand
```

The empty captured auth log does not show an assertion failure or identify a particular stalled test.

### Timing evidence

- Outer pre-push log created: `2026-10-31 23:12:28.503007434 UTC`.
- Auth-test log created: `2026-10-31 23:17:27.418884490 UTC`.
- Elapsed before Jest started: **298.916 seconds**.
- Outer execution limit: **300 seconds**.
- Approximate time available to Jest: **1.084 seconds**.

The execution tool's aggregate deadline cut off the validator almost immediately after the mocked suite started. This was not a reported Jest assertion timeout or evidence of a hung authentication request.

### Focused verification without weakened assertions

- Original test configuration and test selection, with verbose reporting and open-handle detection: **2 suites / 50 tests passed**, process exited naturally with code 0 in **13.041 seconds**.
- Same two suites with bounded discovery roots: **2 suites / 50 tests passed**, process exited naturally with code 0 in **9.914 seconds**.
- No `--forceExit`, skipped tests, relaxed assertion, increased per-test timeout, live account creation, or live authentication request was used.
- Original discovery alone completed successfully in **21.849 seconds**.
- The cgroup out-of-memory-kill counter did not increase during these review checks. Its pre-existing cumulative value cannot attribute an OOM event to the original run.

**Classification:** confirmed outer-command execution timeout after cumulative earlier validation stages. The focused original suite reproduced neither a genuine test failure nor an open-handle hang.

## Complete pre-push verification

The unchanged `npm run validate -- --report` completed in **111.348 seconds**, exited **1**, and reported **one hard failure** and **one warning**. It ran sequentially after the compiler comparison with timestamped output and a supervised 780-second outer limit.

### Critical server type failure

```text
shared/getawayRestaurantMeals.ts(41,60): error TS2345:
Argument of type '{ ... name?: string; ... }' is not assignable to parameter of type 'Meal'.
Property 'name' is optional in the argument but required in type 'Meal'.
```

This is the `currentRestaurantServing(meal.serving, meal)` call in the Getaway restaurant-card adapter. The server compiler uses `strict: false` / `strictNullChecks: false`; the strict root comparison does not replace this separate configuration's gate.

The same failure is present near the beginning of the previous pre-push log, before its later aggregate timeout. It was not caused by the authentication tests and was not introduced by this investigation. No type assertion, compiler relaxation, schema weakening or source correction was applied to conceal it.

### Passed checks in the complete run

- Hydration schema contract and Fridge Rescue consumer contract.
- Core file integrity, protected-route request checks and bare-auth-mount check.
- Established-account access contracts.
- Mandatory translation interpolation/value checks.
- Isolated application startup and health response; no critical startup patterns.
- Original mocked authentication configuration: **2 suites / 50 tests passed**. It started at **105.7 seconds** and completed at **110.7 seconds**.
- Normal Development server remained running after isolated validation cleanup.

The remaining warning lists 71 route paths without an explicit Production mount. That heuristic warning has not been treated as verification of route parity; any candidate release still needs its applicable routes reviewed.

Validation digest: `/tmp/mpm-validate-report-20261031-233634.txt`.

## Release status

**Stopped: a critical gate still fails.** Advancing the reviewed root baseline alone would not resolve the server type failure.

- Current local `dev` tip: `864ed8b5647362a00b4c00d63964c9e4bf87f872`.
- Fetched GitHub `dev`: `4796e64380e8cebbb9b2873f8d100ec3c53143df`.
- The 23 completed source-work commits remain local; the additional prior status-document checkpoint makes 24 local commits beyond fetched GitHub `dev`.
- Production remains at the fetched reference `67a964474f6ab5effd915fc9bc9ffa027d8e3aa9`; this is the identified rollback point, not a newly created backup tag.
- No GitHub push, backup tag, Production merge, workspace update, Ask Chef activation, publication, or account-permission change was performed.
- The baseline, checker, validator and all test assertions remain unchanged.
- Amber/Dr. E live access and the customer-facing Production URL remain unverified. No physical iOS or native-delivery verification was added.

Raw evidence is retained in the ignored `.local/release-review/` directory; the background log additionally records the complete validator's stage timings. These investigation files are not release source and must not be included in a release commit.
