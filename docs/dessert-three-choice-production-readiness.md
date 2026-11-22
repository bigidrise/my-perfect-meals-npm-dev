# Dessert Creator three-choice Production readiness

Reviewed 2026-11-21 UTC (2026-11-20 America/Chicago).

## Final authorized workspace handoff

This section supersedes the earlier isolated-candidate and unpushed-patch status
below. The owner subsequently authorized final technical preparation and pulling
the release into this Production workspace for preview, without merging GitHub
Production or publishing.

- Pushed the approved Vite 6.4.6 correction and exact esbuild 0.25.12 pin to
  PR #481 in `21c275009`, with an explicit six-row missing-approval status in
  the existing clinical review package.
- Checked the package and current GitHub PR review/comment records: no qualified
  exact-text approval was found for any of the six items. Reviewer identity,
  qualifications, approval evidence and date remain not supplied for every item.
- Pulled and merged that release branch into the local Production workspace
  only, preserving the existing local application corrections and Shopping
  Product Options. A pre-import backup branch was retained.
- Existing passing regression, localization-guard and TypeScript evidence
  remains applicable to the unchanged application source. The workspace is
  rebuilt for preview after import; the full build passed and the unchanged
  safe-preview workflow completed initialization. All 21 changed source/check
  files matched the previously verified integration candidate byte-for-byte.
  No repeated diagnostic cycle was run. The screenshot reached the startup/auth
  boundary; the signed-in UI was not visually verified.
- **BLOCKED for GitHub Production merge and publication:** items 1–6 in the
  clinical approval package still require qualified exact-text decisions and
  the required clinical release gate must pass. PR #481 remains draft.

## Decision

**PR #481 is not merge-ready. Production is technically compatible with the
candidate, but release remains blocked by six protected clinical wording
discrepancies requiring qualified review. Nothing was merged into GitHub
Production or published.**

- PR: https://github.com/bigidrise/my-perfect-meals-npm-dev/pull/481
- Reviewed head: `e038922fb489f4901fd719a4cdec93b9938776bf`.
- GitHub target: `bdf3e33a4236ac72498b45b51aa40057e50e3b15`.
- Existing Production workspace source: `4069781e1`.
- The PR remains a draft. GitHub reports mergeable, with an unsuccessful
  localization check; no review approval is recorded.

## What was fixed here

1. Restored declared development dependencies, including React declarations and
   `jest-environment-jsdom`, so tests and the real TypeScript gates could execute.
   A successful install under `NODE_ENV=production` had still omitted them.
   Temporarily including development dependencies resolved that omission; the
   temporary npm configuration and unrelated manifest edits were removed.
2. Updated Vite from 6.4.2 to the compatible 6.4.6 patch in the local manifest and
   lockfile. The package firewall rejected the old locked archive for a critical
   CVE. The existing esbuild 0.25.12 override remains unchanged and installed.
3. Prepared an isolated, uncommitted integration candidate combining the current
   Production workspace and PR #481. The merge had no conflicts. The main
   workspace did not receive the Dessert feature, and no remote branch was changed.

The PR already contains the localization comparison correction; no duplicate
correction was needed. Its workflow supplies the actual pull-request target SHA,
and its argument selector validates and forwards that SHA without disabling the
independent clinical, historical, or per-file checks.

## Locally verified results

All candidate checks used the combined Production source, including the local
build correction, with Vite 6.4.6.

| Check | Result |
| --- | --- |
| Dessert, Beverage, Craving, recipe-choice UI, nutrition, shopping localization and entry preferences | 13 suites; 291 passed; one opt-in live-provider test skipped |
| Shared choice coordinators and Shopping Product Options release gates | 3 suites; 91 passed |
| Compiled Production support compatibility and clinical/support regressions | 4 suites; 76 passed |
| Localization guard regressions | 59 passed |
| Strict safety TypeScript check | Passed |
| Root release TypeScript fingerprint | Passed: exactly 109 reviewed legacy diagnostics |
| Full `npm run build` | Passed: client, release-manifest verification and server |
| Incremental localization against actual GitHub Production SHA | Passed: zero unresolved findings |
| Full Phase 0 localization | Failed: six clinical discrepancies, one migration-coverage warning |
| Whitespace validation | Passed |

Total: **458 passing regression tests across 20 suites, plus 59 passing
localization-guard tests**. The root fingerprint remains
`e49b8f2b61d299d3c277e6b1f426af4624c1f957d46556e94673400f8ed96fe3`;
the baseline and gate were not changed. Passing this contract does not mean
the root compiler has no legacy errors.

The full release-check wrapper was not claimed as passing: its build, compiled
support and type gates were run separately, while the candidate was deliberately
not made the running Production application.

### Feature behavior covered

- Three distinct whole-dessert recipes for cakes, wedding tiers, pies,
  cheesecakes, cookie batches, brownies and bars.
- Requested yield preservation, recipe-total nutrition and per-serving
  arithmetic; finite nutrition, quantities and preparation requirements.
- Allergy, vegan, clinical, final-transformation and repair checks.
- No duplicates or rejected recipes used to fill an empty choice; honest
  partial results when fewer than three pass.
- Final accepted ingredients used for images; image failure does not fabricate
  a successful image or discard a valid recipe.
- Real page/component tests for selecting each choice and forwarding its data
  to Favorites, add/log, shopping and sharing controls.
- Refresh, account isolation, stale responses, translation persistence and
  removal of the selected recipe without losing other choices.
- Shopping Product Options remains available in Production, with its selection,
  clear behavior and original evidence preserved.

These were offline tests with synthetic services and a minimal environment,
without real database or provider credentials. They are not paid-model recipe
quality tests, independent nutritional composition verification, actual image
provider verification, or real customer persistence tests.

The restarted main safe-preview workflow completed initialization with its
existing maintenance suppression unchanged. A 390px browser screenshot of the
Dessert route reached the expected sign-in boundary. **The signed-in candidate
UI and native-device experience were not visually verified.** Component tests
do not replace that limitation. The unrelated mockup-sandbox workflow was already
failed and remains outside this release.

## Exact GitHub blocker

Run: https://github.com/bigidrise/my-perfect-meals-npm-dev/actions/runs/44864062404

Inspection of the actual job log confirmed:

- Dependency installation and the guard regression step succeeded.
- GATE_09 compared against `bdf3e33a4236ac72498b45b51aa40057e50e3b15`
  and passed with no new unresolved interface-copy findings.
- The component ratchet passed.
- Phase 0 exited 1 solely because of the following six clinical source-integrity
  discrepancies. The registry-generation and fallback-report steps were skipped
  after that failure, not passed.

| Protected registry identity | Current explanation requiring review |
| --- | --- |
| `learn.realtime_diabetic_meal_adjustment` | Glucose-aware meal context across the platform |
| `learn.glucoseguard_is_for_diabetics` | Logged glucose awareness across builders and creation tools |
| `learn.starch_guard_is_about` | Starch Guard versus logged glucose context and coexistence |
| `editprofilepage.protocol_controlled_by_your_2` | Clinical Protocol Review Required |
| `editprofilepage.metabolic_medication_support_nutritional` | Existing GLP-1 meal-generation guidance |
| `editprofilepage.not_a_substitute_for_4` | Legacy GLP-1 setting, separate support choice and clinician guidance |

The two source files are unchanged between the current GitHub Production target
and the integrated candidate. These are inherited discrepancies, not new
Dessert wording. Prior shipment does not constitute qualified approval.

The existing exact-text package supplies each full explanation, observed code
evidence, evidence still needed, and the reviewer-return format:

https://github.com/bigidrise/my-perfect-meals-npm-dev/blob/e038922fb489f4901fd719a4cdec93b9938776bf/docs/localization/release-clinical-approval-package.md

For each item, a qualified reviewer must approve the exact text or request a
revision, recording qualification, date, source-owner corroboration, evidence
and scope. No such approval was inferred. No protected wording, registry,
source disposition, safety rule, physician authority or required check was
changed or bypassed.

## Production preservation

The isolated integration retained all seven local application/test files
differing from GitHub Production byte-for-byte: the main route registration,
My Perfect Menu route, oncology service, culinary concept engine, generation
reliability service, and their local regression tests. The esbuild correction
was retained. Shopping Product Options from PR #480 remains in the candidate.
The main workspace's pre-existing release-manifest edit was left untouched.

## Remaining release procedure

These steps describe future work, not authorization to perform it:

1. Obtain qualified exact-text decisions and the required source-owner evidence
   for all six held clinical explanations. Implement only explicitly approved
   wording/dispositions through the controlled review process; do not regenerate
   the registry simply to clear the failure.
2. Carry the reviewed local Vite patch and any needed Production-only source/build
   corrections through a reviewable GitHub branch. Preserve the exact esbuild pin.
   The local patch has not been pushed to PR #481.
3. Re-run required checks on the final reviewed commit and current Production
   target, including full Phase 0. All required checks and approvals must be
   recorded before marking the PR ready.
4. Obtain the owner's explicit authorization to merge PR #481 into GitHub
   Production. Merge using the normal protected GitHub process, without bypasses.
5. After separate source-sync authorization, back up this workspace, fetch the
   approved Production commit, and reconcile it without a hard reset or losing
   local work. Rebuild the actual workspace and restart its unchanged safe
   preview workflow. Do not run release migrations or maintenance for this
   feature; the Dessert patch introduces no schema migration.
6. Verify the authenticated Production preview: three passing whole-dessert
   choices when available; per-serving/whole-recipe values; images; selection;
   Favorites, plan/log, shopping, translation and sharing; preserved Shopping
   Product Options. Reconfirm the final source and build metadata.
7. Obtain explicit owner authorization to publish. Keep the existing Publishing
   configuration: build `npm run build`, run `npm run start`. The owner publishes
   from the Publishing tool. If it proposes any schema change, stop for separate
   review; no schema migration is expected for this release.
8. Check the new published revision's readiness and authenticated Dessert and
   Shopping flows. Do not infer successful publication from a workspace build.

Official publishing reference:
https://docs.replit.com/learn/projects-and-artifacts/replit-deployments

## Retained local evidence

The ignored `generated-artifacts/` directory contains the isolated candidate and
the `dessert-481-*.log` build, regression, localization, safety, raw root compiler
and root-baseline outputs. Generated output is excluded from Git and deployment.
