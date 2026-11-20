# Bounded release-gate corrections

Scope: founder-approved final corrections for the existing reconciliation
candidate. No future Shopping/Recipe Maker enhancement, feature activation,
clinical rule, numerical calculation, authentication setting or Production
change is authorized by this work.

## Type fingerprint

Only the reviewed SHA-256 changes from
`9baf1a0a477bef598b2c7b9afaba2624c41cae19a7705ee30f43ceeeab873ef3`
to
`e49b8f2b61d299d3c277e6b1f426af4624c1f957d46556e94673400f8ed96fe3`.
The allowed count remains 109; the release checker is unchanged.

## Exact inventory enrollment

All 68 omissions identified in the completed classification are explicitly
enrolled at their verified counts after detection corrections. The 479 existing
per-file thresholds and the aggregate hardcoded-string threshold are unchanged.
The inventory summary totals now describe 547 entries; the larger sum includes
newly inventoried historical debt, not an increase to an existing threshold.
No active component is removed. New files and future count increases still fail.

## Detection corrections, not exemptions

The legacy audit checks regex candidates against actual TypeScript AST spans.
Callback return types, generic syntax and substrings inside other literals are
not JSX text or object properties. Existing extraction/classification and
ratchet requirements otherwise remain.

The legacy and incremental checks recognize the two existing closed display
owners: BackNavigationLabel and ClinicalSupportLabel. They verify the imported
component, exact renderer implementation, closed label membership, actual EN/ES
resource connection and matching interpolation. Unknown labels, changed
renderers, arbitrary same-named components, spreads and missing resources remain
findings. Protected wording still requires review. Recognition is also used on
historical snapshots; the adoption boundary is unchanged.

The incremental check no longer treats equality-comparison enum operands as
rendered copy. Actual conditional branches and displayed enum names remain
scanned. A template containing only runtime substitutions has no authored copy;
templates with static words remain checked.

## Ordinary copy only

The classified per-file ratchets receive bounded EN/ES connections at their
existing text owners: route/loading/toast labels, scan labels, metric headings,
nutrition activity headings, saved-evidence controls, accessible labels and four
ordinary Copilot suggestion fields. Copilot stays paused. The four condition
display names reuse their existing EN/ES keys; identifiers, flags, colors,
physician precedence and nutrition calculations do not change.

No new main-locale key is required: source-key copy extends the existing
consumerJourney catalog. Existing approved Spanish values and brand names are
preserved. The earlier recovery's other locales remain intact.

## Clinical source holds

See `release-recovery-clinical-source-review.md` for the exact six current
explanations, locations and reasons. Registry entries are retained. Five retired
Academy references and one navigation source move use exact, source-hash-bound
dispositions, with tests for stale evidence, reactivation and missing ownership.
No clinical translation or substantive explanation is approved here.

## Validation boundary

Run Phase 0 once for this correction batch, the release type gate, the
localization-check tests and directly affected focused suites. Do not repeat the
430-assertion recovery suite or start another application-wide investigation.
Any unresolved protected/dynamic finding continues to fail; classification is
not permission to merge a red gate.

## Recorded validation results

- `npm run check:release-types`: passed, exactly 109 diagnostics matching the
  approved fingerprint. The checker, count, error identities and error contents
  are unchanged.
- `npm run validate:i18n:phase0`: executed once; exit 1 with seven failed checks
  and one migration-coverage warning. The six clinical source holds remain,
  plus the aggregate incremental-review gate. All inventory/per-file checks pass:
  469 stable, 78 improved, no regressions. The aggregate hardcoded count decreased
  by 265 from the unchanged 6466 ceiling.
- A final guard-only recheck after conditional-label detection repair reports
  568 findings: 413 protected-review and 155 dynamic/binding-review, zero ordinary
  interface or missing-connection findings. No exceptions applied; adoption base
  and exception configuration are unchanged. These reviews are NOT approved by
  the detection correction, and the guard still exits 1.
- `npm run test:i18n:new`: all 52 tests pass, no skipped or removed tests.
- Directly relevant Jest checks: 140 tests across ten suites pass. Two initially
  failed to load the existing Vite-only `import.meta.env.DEV` expression in
  CopilotPageExplanations; those two were rerun with the test-only
  `tests/fixtures/viteImportMeta.transformer.cjs` before-transformer:
  `--globals='{"ts-jest":{"isolatedModules":true,"astTransformers":{"before":["<rootDir>/tests/fixtures/viteImportMeta.transformer.cjs"]}}}'`.
  This supplies deterministic Development-mode Vite metadata to CommonJS Jest;
  the real modules and every assertion run unchanged. Default application and
  Jest configuration and all application feature gates are unchanged.
- `git diff --check`: passed. All 479 old per-file limits, the global ceiling,
  registry identities, incremental adoption/exception configuration and release
  type checker are unchanged. The two source files containing the six held
  explanations have no candidate changes.
- All 19 recovery paths remain. Sixteen are byte-identical to the start of this
  pass; Router, consumerFeatureCopy and the source-review document retain the
  recovery with the approved additions. Candidate HEAD and original branches
  are unchanged; no commit, push, merge, deployment or publication occurred.

Result: 94 of the classified 101 failed checks are resolved. The bounded changes
are ready for founder review, but the candidate is not release-ready. Qualified
review of the six explanations and disposition of the remaining protected and
dynamic ownership queue are still required. No additional content approval,
gate bypass or remote action is inferred.
