# Unified Saved Groceries — Development review

## Scope and release boundary

Implemented the approved Development specification using the existing permanent Saved Groceries API, table, and JSON fields. No second library, database migration, Production change, live-record update, paid AI request, push, PR, merge, or deployment was performed.

The approved isolated candidate remains unchanged at `4d72a3801bb8323184244f4c48272857cfa50a9a`, with a clean candidate worktree. Development changes are local and have not been pushed.

The main application workflow was **not restarted**: startup can perform shared-database work, which would violate this request's restrictions. Browser verification used a separate synthetic harness, not the live application or real customer accounts.

## Implemented behavior

- Product Scan and Coach product sheets save the available full original analysis into the existing permanent account-owned library.
- Recommendation actions preserve the selected product and known brand, rather than saving a generic parent category. Scanner and Coach sources remain distinct.
- Saved-state matching recognizes legacy full-name records and split brand/name records without confusing conflicting known UPCs.
- **View Analysis** works for blocked, legacy, and incomplete records. Bulk selection is a separate checkbox, and unsafe additions remain disabled/server-rejected.
- Full snapshots restore original explanations, considerations, and warnings. Legacy Coach reasons and verification messages remain readable. Missing grades are not replaced with B, and absent legacy score cards are not displayed as neutral judgments.
- Current eligibility distinguishes missing evidence, known incompatibility, and unavailable profile checks. Saved analysis is explicitly not current safety approval.
- The library offers the existing ingredient-label camera/photo workflow. A separate confirmation is required before replacing evidence for the same product.
- The evidence endpoint requires authentication, exact ownership, matching identity, explicit confirmation, and the expected evidence revision. It locks the owned row transactionally and rejects stale updates.
- Prior metadata and nutrition are retained in evidence history. Current numeric nutrition is not inherited from an older label; optional newly entered fat/carbohydrate values require a serving basis. A new photo does not inherit independent certification.
- Existing server allergy, dietary, avoidance, GLP-1, and diabetes restrictions remain authoritative. Companion evidence cannot establish compatibility with a human profile.
- Temporary history and active scan caches are account-scoped. Account changes hide old results and reject affected late responses. Temporary saving is labeled separately from permanent saving.

## Changed files

| File | Purpose |
| --- | --- |
| `client/src/components/biometrics/IngredientIntelligenceSheet.tsx` | Full snapshot saving, account-scoped saved state, source/context controls, legacy-score suppression, and identity-safe matching. |
| `client/src/components/shopping/GroceryStoreCoachSheet.tsx` | Coach attribution and stale-session guards. |
| `client/src/components/shopping/MealIngredientBrands.tsx` | Correct Coach attribution for Find Brands analysis. |
| `client/src/components/shopping/RecentScans.tsx` | Account-owned temporary history and non-fabricating, complete legacy restoration. |
| `client/src/components/shopping/RecommendedProductActions.tsx` | Recommendation attribution and legacy full-name saved-state compatibility. |
| `client/src/components/shopping/SavedGroceriesSheet.tsx` | Working View Analysis, distinct eligibility explanations, separate selection, historical viewing, and verification entry. |
| `client/src/components/shopping/SavedGroceryEvidenceUpdate.tsx` | Explicit label confirmation, optional serving-based nutrition input, and controlled update UI. |
| `client/src/lib/savedGroceryAnalysis.ts` | Full snapshot payload/restoration and current-status language. |
| `client/src/lib/savedGroceryRecommendation.ts` | Source and subject attribution for recommendation payloads. |
| `client/src/lib/shoppingScanStorage.ts` | Account-scoped temporary storage without importing unowned legacy data. |
| `client/src/pages/CompanionNutritionHub.tsx` | Correct temporary scan shape and account-switch/callback isolation. |
| `client/src/pages/ShoppingListMasterView.tsx` | Account-owned active scans, verification workflow wiring, and temporary-history wording. |
| `server/routes/savedGroceries.ts` | Evidence revisions on reads and an owner-scoped transactional evidence-update endpoint. |
| `server/services/savedGroceryEvidence.ts` | Exact identity, confirmation, revision, nutrition freshness, and retained-history rules. |
| `server/services/savedGroceryCompliance.ts` | Distinguish missing evidence from known incompatibility without changing restrictions. |
| `server/services/savedGroceryRevalidation.ts` | Preserve profile-unavailable outcomes and subject boundaries. |
| `client/src/lib/__tests__/savedRecommendationProducts.test.tsx` | Product-specific saving, snapshot preservation, legacy viewing, identity matching, and account isolation. |
| `client/src/lib/__tests__/savedGroceryAnalysis.test.ts` | Snapshot/legacy restoration, honest grades/evidence, status language, and temporary account ownership. |
| `server/tests/savedGroceryEvidence.test.ts` | Exact-product updates, confirmation, revisions, history, fresh nutrition, and rejection cases. |
| `server/tests/savedGroceryEvidenceRoute.test.ts` | Mocked-DB owner/non-owner authorization, failed writes, unchanged identity, and stale conflicts. |
| `.agents/memory/saved-grocery-evidence-governance.md` | Durable product rules for historical viewing, controlled replacement, and unowned device history. |
| `docs/reviews/unified-saved-groceries-development.md` | This review and complete changed-file inventory. |

## Verification

### Focused automated checks

- **133 Jest tests across 11 suites**, with the corrected saved-product UI suite rerun separately after its final test-only assertion correction.
- **64 standalone pure-function compliance assertions**, all passing:
  `node_modules/.bin/tsx server/services/__tests__/savedGroceryCompliance.test.ts`
- Client Production build: passed, output under `/tmp/unified-saved-client-build`.
- Server Production build: passed, output under `/tmp/unified-saved-server-build`.
- Strict safety typecheck: passed.
- Strict standalone evidence-helper typecheck: passed.
- `git diff --check`: clean.

The focused suites cover saved recommendation identity, scanner/Coach snapshot saving and restoration, legacy metadata, account switching, missing evidence language, authenticated ownership, stale updates, history preservation, failure behavior, and existing product-scan/Coach regressions. Database writes in route tests use synthetic in-memory mocks, not live records.

### Browser and visual checks

The isolated harness used the actual changed UI components with synthetic auth/API/storage:

- Three different juice recommendations and independent save states.
- Saving a specific recommendation without saving generic Juice.
- Blocked legacy View Analysis and retained original warning text.
- Explicit confirmation before an evidence update.
- Same-product return to the library and previous-evidence selection.
- Known milk restriction remaining visible.
- Account switching, reload restoration, and sign-out privacy.

The initial harness had an incomplete synthetic score-card fixture; this was corrected without altering the scan engine. The browser report also interpreted the fixture's literal explanation text as a heading and flagged overflow from untranslated test keys. The stored fixture text matches the rendered narrative; a subsequent 390-pixel screenshot using the real English translations shows the three recommendations without that overflow. Missing logo resources were confined to the temporary harness.

These checks do **not** establish real-camera behavior, real database locking, full mounted authentication/CSRF integration, clinical resolver availability, or installed-device behavior.

## Full-project type gate

The raw full-project compiler now completes instead of being left running:

- Command: `tsc --pretty false --incremental false --extendedDiagnostics -p tsconfig.json`, bounded to four minutes with a 4 GiB heap.
- Completion: **223.70 seconds**, exit 2.
- Diagnostics: **118**; reviewed baseline: **120**.
- The baseline, validator, strictness, and include/exclude rules were **not changed**.
- The remaining diagnostic in an edited feature file is the existing missing `open` prop on `CompanionNutritionHub`'s unrelated `UpgradeLockModal`; it also exists in HEAD.

The feature corrected incomplete legacy scan result shapes and the old Companion scan-storage argument. A lower diagnostic count does not mean the reviewed fingerprint matches: removed diagnostics and shifted source locations both require review. The full release type gate is therefore **not claimed green**. No diagnostic suppression or baseline reset was used.

## Compatibility and remaining limits

1. Old device-only history without an account identifier is left untouched but is not imported or shown to whichever user signs in next.
2. A generic or ambiguous legacy product cannot be relabeled as a branded product by guessing. Save the identified product separately if exact identity cannot be established.
3. Evidence history permits ten updates, then rejects further replacement rather than silently deleting old evidence.
4. An ingredient photo alone cannot resolve independent certification requirements. Protected items remain blocked when required proof is unavailable.
5. New current-label numeric evidence supports explicitly entered fat and carbohydrates with a serving basis; unavailable facts remain unavailable. Prior facts remain in historical evidence.
6. No automatic AI reanalysis occurs when reopening saved items. A future user-initiated photo scan uses the existing scan workflow.
7. Live application activation, real-account verification, and real PostgreSQL concurrent-update behavior were intentionally not exercised under the no-live-write/no-migration boundary.
8. The isolated browser harness and compiler traces are temporary verification material under `/tmp`, not a new application or permanent library.

## Before any Production release

- Review the 118-versus-120 diagnostic/fingerprint mismatch without concealing errors or changing the baseline without separate approval.
- Verify full authorization and concurrent evidence updates against an explicitly approved isolated database with synthetic accounts, never shared live records.

Both have been proposed as **required-before-Production** follow-ups. No push or release action is authorized or performed by this work.
