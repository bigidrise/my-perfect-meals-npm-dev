# Release Typecheck Baseline

The repository-wide `npm run check` remains strict and is intentionally kept
outside the release build path until its historical contract debt is remediated.
The current reviewed diagnostic set is fingerprinted in
`scripts/release-typecheck-baseline.json`.

`npm run check:release-types` always runs the strict root compiler with the
same modern, non-incremental settings as `npm run check`. It passes only when:

1. the root check is clean; or
2. every root diagnostic exactly matches the committed reviewed baseline.

This means a new error cannot be hidden by the existing debt. A changed
diagnostic set—whether its total rises, falls, or stays the same—fails the
release check until the focused change has been reviewed and the fingerprint
has been deliberately refreshed.

The release check also runs the clean strict safety slice
(`npm run check:safety-types`) and both production build targets. Add a
safety-sensitive surface to `tsconfig.safety-check.json` before relying on it
for release validation.

## Reviewed metadata refresh — 2026-10-09

This Development-only refresh changes baseline metadata, not application code,
compiler configuration, diagnostic filtering, or the validator's acceptance rule.
Before editing the baseline, a fresh execution of the unchanged validator's root
compiler produced exactly the previously investigated diagnostic array, including
messages, locations, and multiplicities.

| Reviewed set | Count | SHA-256 of sorted diagnostic lines joined with LF |
| --- | ---: | --- |
| Previous baseline | 131 | `825f53e3cc39de1a1b197d3baafbe3ea115fc39ec598581f70a7d770d036231a` |
| Current baseline | 121 | `50e798581cf3afd89a08f1384f21a92592b7935248b0719e97dab3961c03f83b` |

### Ten removed diagnostics

These diagnostics were already absent in the investigated source snapshots.
No source changes were made as part of this metadata refresh.

| Source and former location | Code | Removed diagnostic |
| --- | --- | --- |
| `client/src/components/NewLogToMacrosButton.tsx(25,9)` | TS2353 | `fibrousCarbs` was not a known property of `MacroLogInput`. |
| `client/src/pages/SushiCreator.tsx(1436,61)` | TS2339 | `starchyCarbs` was missing from the nutrition object type. |
| `client/src/pages/SushiCreator.tsx(1436,82)` | TS2339 | `starchyCarbs` was missing from `MealData`. |
| `client/src/pages/SushiCreator.tsx(1437,61)` | TS2339 | `fibrousCarbs` was missing from the nutrition object type. |
| `client/src/pages/SushiCreator.tsx(1437,82)` | TS2339 | `fibrousCarbs` was missing from `MealData`. |
| `client/src/pages/craving-creator.tsx(1796,61)` | TS2339 | `starchyCarbs` was missing from the nutrition object type. |
| `client/src/pages/craving-creator.tsx(1796,82)` | TS2339 | `starchyCarbs` was missing from `MealData`. |
| `client/src/pages/craving-creator.tsx(1797,61)` | TS2339 | `fibrousCarbs` was missing from the nutrition object type. |
| `client/src/pages/craving-creator.tsx(1797,82)` | TS2339 | `fibrousCarbs` was missing from `MealData`. |
| `client/src/pages/fridge-rescue.tsx(552,79)` | TS2322 | `unknown` was not assignable to the recipe-description object type. |

### Four existing diagnostic relocations

Each diagnostic below retains its source path, column, code, and full message;
only its line number changed.

| Source | Previous → current location | Unchanged diagnostic |
| --- | --- | --- |
| `client/src/layout/AppLayout.tsx` | `(56,11)` → `(57,11)` | TS2339: `isAuthenticated` does not exist on `AuthContextType`. |
| `client/src/pages/lifestyle/GatheringsPage.tsx` | `(68,10)` → `(69,10)` | TS2300: Duplicate identifier `useCopilotPageExplanation`. |
| `client/src/pages/lifestyle/GatheringsPage.tsx` | `(90,3)` → `(91,3)` | TS2300: Duplicate identifier `imageUrl`. |
| `client/src/pages/lifestyle/GatheringsPage.tsx` | `(113,3)` → `(114,3)` | TS2300: Duplicate identifier `imageUrl`. |

All other diagnostic lines match exactly. This is not a count-based allowance:
any nonempty unreviewed set still fails even when its count is at or below 121.
The strict root compiler still reports the 121 reviewed diagnostics; passing the
release baseline gate does not mean the repository-wide compiler is clean.

### Post-refresh Development validation

- The complete `npm run release-check` targeted the Development preview domain:
  client build, server build, strict safety typecheck, and root fingerprint gate
  all passed. Its final summary was **11 passed, 2 warnings, 0 failed**.
- All ten relevant Jest suites passed: **268 passed, 0 failed, 0 skipped**.
  The standalone Human Food Context contract also completed successfully.
- The byte-for-byte unchanged validator was exercised in an isolated temporary
  directory using the captured root compiler output and a real compiler-produced
  TS2322 (`number` assigned to `string`) from a separate temporary probe file.
  The unchanged 121-diagnostic control passed. Adding the new diagnostic failed
  at 122 total; replacing an existing diagnostic failed at 121 total; removing
  two existing diagnostics and adding the new one failed at 120 total. These
  rejection scenarios did not change application files or compiler configuration.
- Both release-script warnings were unauthenticated meal POST probes without an
  Origin header. A Development follow-up probe confirmed
  `403 CSRF_ORIGIN_REJECTED` without Origin and `401 AUTH_REQUIRED` with the
  matching Development Origin. The release script was not modified; its two
  warnings remain visible rather than being suppressed or counted as passes.
- Additional non-failing tool warnings remain: stale Browserslist data, mixed
  static/dynamic imports, large client chunks/server output, deprecated ts-jest
  options, and Jest's configured forced exit for open connection handles.

The baseline mismatch is resolved. Development validation passes with the
documented smoke-probe warnings and 121 reviewed root diagnostics still present.
This is not a claim of a clean root compiler, authenticated live AI generation,
or Production verification. No database/account changes, push, Production
changes, or publishing were performed.