# Release typecheck restoration — exact fingerprint approved

## Status

**The founder explicitly approved the exact fingerprint update after receiving
the complete semantic comparison. Only that stored fingerprint was changed;
the unchanged canonical gate then passed with the same 109 diagnostics.**

The current 109 diagnostics are the same full diagnostic set as the approved
109: **92 unchanged, 17 line-position-only movements, zero added, zero removed,
zero path changes and zero message changes.** All columns, error codes,
multiline messages and diagnosed source lines match. This conclusion comes
from independent source-diff mapping, not matching counts or sorted pairing.

No application correction is indicated by this comparison. No application,
compiler, dependency, checker, exclusion, suppression or runtime configuration
was changed. No translation, account/data operation, provider request,
publication or application restart was performed.

## Exact approval received

The founder approved only the following replacement in
`scripts/release-typecheck-baseline.json`:

- Diagnostic count: **109 → 109**, unchanged.
- Previously approved fingerprint:
  `e8dadf605ccc7c3c6dec1285551bfa2a37871bee3a9fa1993444c871565813a7`.
- Newly approved current fingerprint:
  `9baf1a0a477bef598b2c7b9afaba2624c41cae19a7705ee30f43ceeeab873ef3`.

Approval accepts the observed line movements only. It does not erase
existing debt, exempt future changes, relax the checker, certify all release
gates or authorize publication. Only that fingerprint was updated; the
unchanged canonical gate passed on the current workspace.

The post-approval run exited **0**, produced the exact approved fingerprint
and retained compiler stdout/stderr **byte-identical** to the pre-approval
capture. All captured compiler inputs other than the explicitly approved
baseline file were unchanged. The generated build-version file was restored
byte-for-byte and the exclusive workspace lock was removed.

## Reproduction and baseline provenance

Current source at capture:
`e9667e2d37fb4491e13f848be8bcc07c01f41389`.
Node **20.20.0**, TypeScript **5.9.3**.

The actual validator ran unchanged with its original compiler command,
arguments, inherited process environment, deterministic `dev` build-version
module, exclusive workspace lock and restoration logic. An observation-only
`spawnSync` wrapper retained complete compiler stdout/stderr before the gate
printed its truncated failure preview. No subprocess arguments or results
were changed. Root checks ran sequentially without an external short timeout.

The pre-approval current run returned compiler status 2, **109 diagnostics**,
the newly approved fingerprint above, and canonical-gate exit 1. The original ignored build-version
file was restored byte-for-byte, with before/after SHA-256
`2f0bc4e1a375f168584e2d03838f2e829cfef1ebe8a3e7c5d52dc152bf9ca00d`.

The latest baseline-changing commit,
`aca2c2aff2aa335716f61bd456761728175857b6`, is **not itself the exact
previously reviewed source snapshot**. A first replay of all 3,794 authentic
Git code/configuration files from that commit produced 110 diagnostics,
fingerprint
`15dfcd8919f7fd52fda77a7438dbd96474a9c75514196f3c7f55ffff4d479e32`.
Its one additional TS1117 duplicate-property error in
`client/src/i18n/consumerFeatureCopy.ts` was absent from the approved capture.
That transient error is already absent from current source; it was not fixed
by this investigation.

For the isolated historical replay only, the exact preceding Git blob for
that dictionary was restored from
`761dd99870f3c3cc26b8d85dac57d164c07b40fe`
(blob `85f28b197f25da06861a67c68474fff4745aa5d0`).
The final historical snapshot was verified against Git: 3,793 files from the
baseline-changing commit and that one file from its parent. **No current
application source was replaced.**

The unchanged historical canonical gate then **passed** with the exact
approved **109 / e8dadf605ccc7c3c6dec1285551bfa2a37871bee3a9fa1993444c871565813a7**.
Its complete raw compiler output is also **byte-identical** to the original
approved capture, `.local/reports/spanish-next-types-current.json`, including
all diagnostic continuations. No diagnostic was removed from compiler output
to obtain that result. The historically absent generated module was absent
again after cleanup.

Both current and historical runs used the **same physical installed
dependency directory**, not separate installations. The following input
SHA-256 values were identical:

| Input | SHA-256 |
| --- | --- |
| `tsconfig.json` | `f904cb55f165948fae771d3277b9c1e313ffc760e47b7648ccfed13bf63c12c2` |
| `package.json` | `9ff7d02e1670119b3927c9da307839808187bff4c0e935f117f4eeae5e2bcf90` |
| `package-lock.json` | `a2ddbddb31e80b06a1d8e042b599f793074d05b996cb9b60ee1161c3d21644ab` |
| Canonical checker | `217119447ca16c68658a29537de40a8ed75c773b844f6040ce29f6c3239c292c` |
| Stored baseline file | `045d70716e3c408a54308c7f4b9240a3bd6b3f221266164296769f95bcd92d46` |
| Installed `typescript/lib/typescript.js` | `3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675` |

## Complete semantic comparison

Every historical diagnostic was paired at its independently diff-mapped
current position, preserving duplicate multiplicities. All 109 full messages,
codes, columns and paths match exactly. No union-member or other display-order
normalization was needed. All 109 diagnosed source lines remain unchanged.

The complete **109-row** CSV contains both full messages, old/new
file/line/column, error code, classification and independently mapped line:

`generated-artifacts/release-type-repair/complete-diagnostic-comparison.csv`

CSV SHA-256:
`7e087008612c8fa77620652c8a85f8d3eb9e58a6a4112d998565795ade88a601`.

All 17 changed locations are below; the remaining 92 positions are identical:

| Source | Reviewed → current location | Code |
| --- | --- | --- |
| `client/src/components/mealCreatorSteps/Step2.tsx` | `26:10` → `27:10` | `TS2769` |
| `client/src/components/mealCreatorSteps/Step2.tsx` | `37:10` → `38:10` | `TS2769` |
| `client/src/components/mealCreatorSteps/Step4.tsx` | `57:12` → `58:12` | `TS2769` |
| `client/src/pages/CompanionNutritionHub.tsx` | `663:10` → `664:10` | `TS2741` |
| `client/src/pages/FastFoodGuidePage.tsx` | `504:55` → `505:55` | `TS2322` |
| `client/src/pages/MacroCalculator.tsx` | `92:3` → `93:3` | `TS2440` |
| `client/src/pages/MacroCalculator.tsx` | `93:3` → `94:3` | `TS2440` |
| `client/src/pages/MacroCalculator.tsx` | `1069:9` → `1070:9` | `TS2322` |
| `client/src/pages/SocialRestaurantGuide.tsx` | `609:55` → `610:55` | `TS2322` |
| `client/src/pages/TrainingNutritionHub.tsx` | `1140:65` → `1152:65` | `TS2551` |
| `client/src/pages/TrainingNutritionHub.tsx` | `1140:114` → `1152:114` | `TS2551` |
| `client/src/pages/TrainingNutritionHub.tsx` | `1141:65` → `1153:65` | `TS2551` |
| `client/src/pages/TrainingNutritionHub.tsx` | `1141:114` → `1153:114` | `TS2551` |
| `client/src/pages/WhiteLabelSolutions.tsx` | `509:21` → `510:21` | `TS2339` |
| `client/src/pages/admin/AdminCertifications.tsx` | `340:24` → `341:24` | `TS2345` |
| `client/src/pages/biometrics/sleep.tsx` | `192:34` → `194:34` | `TS7006` |
| `client/src/pages/companion/CatNutritionHub.tsx` | `459:10` → `460:10` | `TS2741` |

### Preserved evidence

All temporary compiler snapshots, full stdout/stderr, source provenance,
restoration records, comparison data and check logs are under the ignored
`generated-artifacts/release-type-repair/` directory. The first 110-error
historical run remains in `reviewed-initial/` and
`reviewed-initial-gate.log`; it was not silently replaced by the passing
reconstruction. The final historical run is in `reviewed/`; the untouched
pre-approval current run is in `current/`. The passing post-approval run,
including complete output, provenance and restoration records, is in
`approved/` and `approved-gate.log`. CSV evidence is delivered separately for review.

## Other verification and remaining blocker

- `npm run check:safety-types`: **passed**.
- `npm run build:server`: **passed**, existing non-fatal bundle-size warning.
- `npm run check:production-support`: **passed**, 76 tests across 4 suites,
  with mocked persistence and no inherited provider/database credentials.
- Incremental localization guard: **could not run**, exit 2:
  `Unregistered dictionary spread: client/src/i18n/consumerFeatureCopy.ts#savedGroceriesSpanish`.
  This inherited guard limitation is not a type diagnostic and was neither
  exempted nor bypassed. It remains separate from the proposed type-fingerprint
  approval and belongs to the already queued localization reconciliation.
- Approved current root gate: **passed**, exit 0, exact approved fingerprint
  and 109 diagnostics. Compiler output was unchanged; generated-file
  restoration and lock cleanup were independently confirmed.

No full release/pre-push script, browser test, client rebuild, schema
migration or deployed-app check was needed or run for this offline comparison.
This is not a claim of full release readiness.
