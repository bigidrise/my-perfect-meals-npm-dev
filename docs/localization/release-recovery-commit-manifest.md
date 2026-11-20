# Release-recovery preservation commit manifest

## Scope and source authority

Target branch: `reconcile/dev-production-20261119`, in
`bigidrise/my-perfect-meals-npm-dev`.

The existing reconciliation merge
`f1bf5074da3cdddcd72f06d256ec34aac9156c68` retains both parents:

- Production: `4a7a5338653904e9505ff99b62fe629c5ae43f64`.
- Development: `b7353c9b32305475f61776645c80d197e1ae288c`.

Live read-only remote checks before preparation matched both parent tips; no
reconciliation remote branch was present at that check. Recheck immediately
before push. Do not update original `dev` or `production`, modify PR metadata,
merge, deploy or publish.

This manifest covers **48 files**: the **43 previously reviewed recovery paths**
plus **five review/manifest evidence files**. No new feature implementation.

Aggregate SHA-256 of the sorted original 43 path/content-hash records:
`2b0b696e5fde8bb06df56edb520c8ab35ae8093dbe227fba2cbf465aeb9864a3`.
The preservation preparation must not change any of those 43 contents.

## Complete file manifest

### Existing bounded presentation and continuation recovery

- `client/src/components/BugReportModal.tsx` — ordinary optional-label binding.
- `client/src/components/MacroScanModal.tsx` — existing label-scan interface copy.
- `client/src/components/MealRefinementSheet.tsx` — voice-control display label.
- `client/src/components/ReplaceMealMenu.tsx` — voice-control display label.
- `client/src/components/Router.tsx` — retained conflict resolution and bounded display copy; no route/access change.
- `client/src/components/ace/CoachCornerCard.tsx` — existing brand-image accessible labels.
- `client/src/components/copilot/packs/basePacks.tsx` — four ordinary copy bindings; Copilot remains paused.
- `client/src/components/pro/ProClientComplianceSnapshot.tsx` — nutrition-activity heading.
- `client/src/components/pro/ProClientFolderModal.tsx` — four existing condition-display keys; authority/flags unchanged.
- `client/src/components/pro/StudioMetricsSnapshot.tsx` — existing metric headings; calculations unchanged.
- `client/src/components/shopping/GroceryExportModal.tsx` — export display heading.
- `client/src/components/shopping/SavedGroceriesSheet.tsx` — existing evidence/package controls; no new shopping feature.
- `client/src/i18n/consumerFeatureCopy.ts` — corresponding source-owned display resources.
- `client/src/pages/procare/ProCareAttestation.tsx` — retained established-account continuation copy recovery; no agreement/authority rewrite.

### Existing locale recovery

Each locale adds the same 26 measurement-preference and three language keys;
no previous value or key is removed or changed.

- `client/src/i18n/locales/ar.json`
- `client/src/i18n/locales/de.json`
- `client/src/i18n/locales/fr.json`
- `client/src/i18n/locales/hi.json`
- `client/src/i18n/locales/it.json`
- `client/src/i18n/locales/ja.json`
- `client/src/i18n/locales/ko.json`
- `client/src/i18n/locales/pt.json`
- `client/src/i18n/locales/ru.json`
- `client/src/i18n/locales/tl.json`
- `client/src/i18n/locales/vi.json`
- `client/src/i18n/locales/zh.json`

### Existing validation, regression and evidence recovery

- `client/src/lib/__tests__/groceryCoachClinicalSwapOverlay.test.tsx` — real test-only i18n setup; assertions retained.
- `server/tests/oneTouchPhase3Concepts.test.ts` — isolated database-access tripwire; assertions retained.
- `tests/fixtures/viteImportMeta.transformer.cjs` — invocation-only Vite metadata compatibility; application gates unchanged.
- `docs/localization/clinical-registry.json` — two JSX-entity normalizations in both representations; identities retained.
- `docs/localization/hardcoded-baseline-perfile.json` — 68 explicit historical omissions; all 479 prior limits unchanged.
- `docs/localization/release-gate-corrections.md` — approved correction scope and recorded results.
- `docs/localization/release-recovery-clinical-source-review.md` — exact provenance and six retained holds.
- `docs/localization/release-source-dispositions.json` — five approved retirements and one unchanged display-owner move, hash-bound.
- `scripts/i18n-audit.ts` — AST-backed detection and existing display-owner recognition.
- `scripts/i18n-phase0-validate.ts` — exact source dispositions; qualified review checks retained.
- `scripts/localization-check/analyze.cjs` — bounded detection corrections; protected review retained.
- `scripts/localization-check/audit-context.cjs` — actual source-span recognition.
- `scripts/localization-check/bounded-release.test.cjs` — positive and negative fail-closed regression cases.
- `scripts/localization-check/cli.cjs` — before/after display ownership parity; adoption/exceptions unchanged.
- `scripts/localization-check/clinical-source.cjs` — exact registry/source/disposition validation.
- `scripts/localization-check/display-owners.cjs` — two existing closed display owners only.
- `scripts/release-typecheck-baseline.json` — previously approved diagnostic fingerprint only; count remains 109.

### Five preservation/approval evidence files

- `docs/localization/release-clinical-approval-package.md` — concise six-explanation reviewer handoff; no approval recorded.
- `docs/localization/release-localization-review-batches.md` — bounded review batches and credential-safe authentication guidance.
- `docs/localization/release-review-findings.csv` — authoritative existing 568-row queue copied byte-for-byte.
- `docs/localization/release-review-classification.csv` — source-linked classification/evidence index; no runtime configuration.
- `docs/localization/release-recovery-commit-manifest.md` — this complete scope manifest.

## Review, exclusions and validation boundary

Reviewed the pending source diff, new source helpers/tests, parsed locale deltas,
registry changes and inventory additions. No unrelated feature work, build
output, credential-named file or known credential signature was found in the
pending changes. Signature checks are bounded checks, not a full security audit.

Excluded: ignored `.local/` worktrees and reports, rendered HTML, scratch analysis
JSON, generated validation output, logs, dependencies and build products.
The two controlled CSV evidence files are intentionally preserved review
documents, not regenerated inventories or runtime artifacts.

Previously recorded checks: release type gate passed with exactly 109 diagnostics;
52 localization tests and 140 focused tests passed. Phase 0 remains at seven
failures and one warning. The 568 review findings and six clinical holds are
unresolved unless individually reviewed; preservation does not approve them.

The installed pre-push hook must run its existing `npm run validate --
--no-start` path unchanged. It does not start an application. Do not bypass it,
relax it, or infer release readiness from a successful branch-preservation push.

No secrets, authentication settings, clinical approvals, application behavior or
feature gates are changed by the five evidence files. No new application
verification is claimed for documentation preparation. This is not permission
to merge or publish.
