# Production release-blocker correction

## Scope and authority

This corrective branch starts at `f8bfcdc3282abecd649996be8b578e813736fb85`.
It does not activate Development features, change medication authority, alter
nutrition calculations, or modify authentication, entitlements, clinical limits,
conversation screening, destination restrictions, databases, or accounts.

The Diabetic Hub's existing inactive-member GLP-1 prompt is restored only in
Production builds. Its profile-edit destination and translations are preserved.
Development retains its current medication-status error and symptom experiences.
The presentation test executes JSX extracted from the actual Hub; it is not a
complete authenticated browser test.

The three invalid PillButton variants become `emerald`, the component's existing
default styling. The weekly-schedule condition retains the same truthiness check
without comparing its typed session values to an impossible empty string.
The profile's existing nickname UI receives its missing optional payload type.
Safety-check coverage and the release-check implementation are unchanged.

## Root diagnostic reconciliation

Historical checks used identical installed dependencies and the release
validator's stable generated build-version module, with external network access
blocked. No diagnostics were filtered in the release validator.

| Source | Count | SHA-256 of sorted diagnostic headers |
| --- | ---: | --- |
| Approved `373dbb24c` | 118 | `a7f4fc91dbc777d1e4bcf367f76d03e38691d59d7be32770b3edf88465f0f717` |
| Merged `f8bfcdc32` | 117 | `7cd2e57f47d2c8197b4c21be5f86fea1ba7b477d2d1e84c3cefa6b823c5e284f` |
| Corrective diagnostic set | 110 | `9a7052463b2b9c33418e6ef777936b9f423a12f7d89eda859b09d5b02ba633f0` |

The approved snapshot exactly reproduces the previously reviewed fingerprint.
Mapping unchanged diagnostic source lines through the merge accounts for the
entire merged set:

- One diagnostic disappears: the deleted Hub nudge's unsupported `default`
  variant, originally at `DiabeticHub.tsx(405,19)`.
- Four diagnostics move with otherwise unchanged source:
  - `DiabeticHub.tsx(380,21)` becomes `(388,21)`.
  - `EditProfilePage.tsx(899,31)` becomes `(900,31)`.
  - `EditProfilePage.tsx(2088,23)` becomes `(2090,23)`.
  - `EditProfilePage.tsx(2090,43)` becomes `(2092,43)`.
- There are no other additions, removals, or message changes.

The corrective set removes exactly the seven exposed safety errors: three
invalid variants, one impossible session comparison, and three nickname-property
errors. The restored nudge uses a valid variant and reintroduces no diagnostic.
All 110 remaining diagnostic headers map to unchanged legacy diagnostics.
The baseline update therefore records reviewed debt reduction, not new allowed
errors. `npm run check:release-types` must match this complete raw set.

## Ask Chef instruction tests

Production instructions remain unchanged. Tests now distinguish the approved
Production wording from Development's flexible-format response instructions.
They still assert response boundaries, useful unresolved questions, safety
priority, destination ownership, and the absence of obsolete discovery scripts.
No authorization or screening assertions are removed.

## Five inherited recipe-test failures

The documented product policy distinguishes daily budgets, explicit recipe
design requests, and genuine safety authorities. Daily allowances do not block
food creation. Explicit requests trigger bounded repair; if matching remains
unreliable, a safe recipe may be retained with its actual nutrition and an
explicit uncertainty/mismatch notice. Missing nutrient evidence and independent
allergy or clinical conflicts remain separate failure paths.

The existing runtime implements that contract. These corrections change tests,
not nutrition runtime behavior:

1. Explicit 13g fat maximum, actual 24g: assert two attempts, unchanged 24g output,
   and a notice naming the actual value and missed maximum, without certification.
2. Explicit 30g total-carbohydrate maximum, actual 31g: assert two attempts and
   the exact unmatched-limit notice, not a synthetic generation failure.
3. Explicit approximately 25g total carbohydrate, actual 40g: assert both carb
   categories count and the mismatch is disclosed after two attempts.
4. Legacy daily zero-starch allowance: do not reinterpret it as a clinical
   prohibition. Assert successful creation with unchanged starch evidence and
   continued protocol scanning. The adjacent protocol-rejection test still
   requires failure for an actual safety conflict.
5. Forecast notice: the verified projection is still 9 grams over, but its
   current shared sentence says `9 over` rather than `9g over`. Preserve the
   numerical projection assertions and update only that formatting expectation.

These are stale test expectations under the existing documented policy, not
newly authorized changes to macro limits or clinical guardrails. No separate
founder policy decision was needed to change runtime behavior because none was
changed. The retained clinical, allergy, missing-evidence, and request-repair
tests remain part of validation.

## Validation boundary

Completed isolated validation:

| Check | Result |
| --- | --- |
| Production client build | Pass |
| Production server build | Pass |
| Expanded safety TypeScript check | Pass, zero errors |
| Root release-type gate | Pass, exact reviewed 110-diagnostic legacy fingerprint |
| Focused Jest, including Ask Chef, access/authentication, GLP-1, Hub presentation and recipe/macro checks | 47 suites; 1,387 passed, zero failed |
| Diabetic guardrail schema/round-trip script | 90 passed, zero failed |
| Production Hub bundle | Restored prompt/profile route present; Development symptom/status-error strings absent |
| Corrective diff whitespace check | Pass |

Jest totals deduplicate repeated suites: the final recipe-suite result replaces
its earlier result, and the requested-macro unit suite is counted once. The
50 recipe integration tests and 38 requested-macro unit tests are included in
the 1,387 count, not additional to it. The guardrail script's 90 checks are
reported separately.

The complete corrected root output exactly matches the predicted surviving
legacy diagnostic set, not just its count. There are no remaining failures in
these requested isolated checks. This is readiness for founder review, not
authorization to merge or deploy.

Validation uses temporary/dummy credentials and network denial (loopback is
allowed only for mocked route tests). It does not perform real provider calls,
database operations, live Production startup, customer sign-in, or native-device
verification. Build-generated tracked manifest changes are restored and are not
part of this correction. Customer release identity and release notes are
unchanged.

The working Development branch, separate Production workspace, GitHub branches,
and deployments must remain untouched. No push, pull into Production, PR
creation/merge, publishing, or feature activation is authorized by this work.
