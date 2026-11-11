# Development localization repair review

## Comparison and release boundary

- GitHub Production source: `ea57a03bd680b63038f64a58a17f46b16b01598f`. Read-only source comparison in an isolated temporary directory; the Production workspace was not opened or modified.
- Starting Development / PR head: `ab74a5586e77c6b31743dd2cfe99411fb361b6f3`.
- Both initially reported exactly the same **126 failures**, including identical failure messages. **None was introduced by the current PR changes.**
- After this repair: **92 failures**, all already in Production. **34 failures resolved; zero new failure messages.**
- No validators, failure thresholds, clinical approvals, or existing per-file allowances changed. No merge, new branch, history reset, or publication.

## Root causes and corrections

| Group | Before | After | Correction / remaining action |
| --- | ---: | ---: | --- |
| Key parity | 13 | 0 | Each non-English language lacked the same 38 keys. Added 494 real translations across 13 languages; preserved interpolation and safety qualifications. Added native Arabic/Russian result-count plural forms. |
| Clinical source integrity | 10 | 10 | Protected registry text is no longer present verbatim after Academy, Learn, and profile content changes. Requires controlled reconciliation and clinical sign-off; do not restore obsolete guidance or regenerate approvals just to pass. |
| Overall hardcoded strings | 1 | 1 | 7,510 active findings exceed the unchanged 6,466 limit by 1,044. Requires incremental string localization, with protected clinical text handled separately. |
| Existing component ratchets | 23 | 23 | Feature copy grew beyond recorded per-file limits. Migrate the actual added copy to translated keys, retaining behavior and approved clinical wording. Do not increase limits. |
| Unregistered components | 79 | 58 | Registered 21 freshly audited zero-finding components with zero allowances. The 58 remaining files contain actual findings; translate and verify before registering each at zero. |

### Additional confirmed catalog defect

Every supported language catalog, including English, contained two root `mealPicker` objects. Standard JSON loading kept only the last object, hiding **28 existing translated keys per language** (392 across 14 languages). Combined the original picker copy and newer no-options message into one object per language. No previously effective translation value was changed; only missing or shadowed keys were added/restored. This defect was not visible to parity checks because the English keys were shadowed too. A new regression test detects duplicate JSON properties recursively before they can be hidden by parsing.

### Zero-string components registered

- `client/src/components/AcademyBackButton.tsx` — zero findings, zero allowance.
- `client/src/components/CanonicalTimezonePrompt.tsx` — zero findings, zero allowance.
- `client/src/components/DiabetesProtocolIndicator.tsx` — zero findings, zero allowance.
- `client/src/components/MealGenerationProgress.tsx` — zero findings, zero allowance.
- `client/src/components/ReleaseBannerMount.tsx` — zero findings, zero allowance.
- `client/src/components/away-from-home/GetawayMealImage.tsx` — zero findings, zero allowance.
- `client/src/components/away-from-home/PlateItems.tsx` — zero findings, zero allowance.
- `client/src/components/business/BusinessPilotWindowNotice.tsx` — zero findings, zero allowance.
- `client/src/components/business/OrganizationQuickStartReturn.tsx` — zero findings, zero allowance.
- `client/src/components/coaching/ChefConversationEntry.tsx` — zero findings, zero allowance.
- `client/src/components/coaching/ChefResponseAvatar.tsx` — zero findings, zero allowance.
- `client/src/components/coaching/CoachFeatureAction.tsx` — zero findings, zero allowance.
- `client/src/components/coaching/chefResponseText.tsx` — zero findings, zero allowance.
- `client/src/components/dashboard/GettingStartedCard.tsx` — zero findings, zero allowance.
- `client/src/components/guided/BuilderGuidanceTour.tsx` — zero findings, zero allowance.
- `client/src/components/pediatric/PediatricImageRetry.tsx` — zero findings, zero allowance.
- `client/src/components/profile/ConsumerHealthContextSection.tsx` — zero findings, zero allowance.
- `client/src/components/shopping/RecommendedProductActions.tsx` — zero findings, zero allowance.
- `client/src/components/shopping/SavedProductAnalysisAction.tsx` — zero findings, zero allowance.
- `client/src/components/ui/bouncing-dots.tsx` — zero findings, zero allowance.
- `client/src/components/ui/icon-pill-option.tsx` — zero findings, zero allowance.

The component-count metadata now matches all 477 recorded entries (the old metadata undercounted existing entries). Existing nonzero allowances and aggregate string limits were preserved.

## Remaining actionable failures

### Protected clinical source records — controlled review required

- Clinical string changed/removed without controlled process: client/src/pages/AcademyLandingPage.tsx:551 "Clinical Deep Dives" — regenerate registry with [clinical-translation] sign-off
- Clinical string changed/removed without controlled process: client/src/pages/AcademyLandingPage.tsx:565 "Diabetes Nutrition" — regenerate registry with [clinical-translation] sign-off
- Clinical string changed/removed without controlled process: client/src/pages/AcademyLandingPage.tsx:566 "GLP-1 Support" — regenerate registry with [clinical-translation] sign-off
- Clinical string changed/removed without controlled process: client/src/pages/Learn.tsx:1363 "Real-time diabetic meal adjustment" — regenerate registry with [clinical-translation] sign-off
- Clinical string changed/removed without controlled process: client/src/pages/Learn.tsx:1369 "GlucoseGuard is for diabetics only. It reads your actual blo…" — regenerate registry with [clinical-translation] sign-off
- Clinical string changed/removed without controlled process: client/src/pages/Learn.tsx:1382 "Starch Guard is about weight management and limiting high-gl…" — regenerate registry with [clinical-translation] sign-off
- Clinical string changed/removed without controlled process: client/src/pages/academy/AcademyHome.tsx:39 "Diabetes Nutrition" — regenerate registry with [clinical-translation] sign-off
- Clinical string changed/removed without controlled process: client/src/pages/academy/AcademyHome.tsx:40 "GLP-1 Support" — regenerate registry with [clinical-translation] sign-off
- Clinical string changed/removed without controlled process: client/src/pages/profile/EditProfilePage.tsx:1339 "Metabolic Medication Support — Nutritional Guidance Only" — regenerate registry with [clinical-translation] sign-off
- Clinical string changed/removed without controlled process: client/src/pages/profile/EditProfilePage.tsx:1341 "not a substitute for your prescribing doctor's guidance" — regenerate registry with [clinical-translation] sign-off

These are source-integrity failures, not permission to change medical guidance or invent reviewer approvals. The affected Academy material was reorganized, Learn content replaced, and profile support copy changed. Review which original statements were retired or moved and reconcile only through the controlled process.

### Existing component copy — localize without changing behavior

- Per-file ratchet regression: client/src/components/Router.tsx — 6 → 19 (+13 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/shopping/SavedGroceriesSheet.tsx — 4 → 14 (+10 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/MacroScanModal.tsx — 7 → 13 (+6 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/copilot/packs/basePacks.tsx — 24 → 28 (+4 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/pro/ProClientFolderModal.tsx — 40 → 44 (+4 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/pro/StudioMetricsSnapshot.tsx — 3 → 7 (+4 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/shopping/GroceryStoreCoachSheet.tsx — 20 → 24 (+4 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/DailyMacroTotalsRow.tsx — 0 → 3 (+3 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/protocol/NutritionPersonalizationSummaryCard.tsx — 1 → 4 (+3 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/MealCard.tsx — 1 → 3 (+2 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/WorkspaceChooser.tsx — 0 → 2 (+2 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/ace/CoachCornerCard.tsx — 0 → 2 (+2 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/pro/ProClientComplianceSnapshot.tsx — 8 → 10 (+2 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/AppRouter.tsx — 0 → 1 (+1 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/BugReportModal.tsx — 5 → 6 (+1 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/JustDescribeItModal.tsx — 5 → 6 (+1 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/MealRefinementSheet.tsx — 0 → 1 (+1 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/MedicalSourcesInfo.tsx — 281 → 282 (+1 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/MfaChallengeModal.tsx — 1 → 2 (+1 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/ReplaceMealMenu.tsx — 12 → 13 (+1 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/SafetyGuardBanner.tsx — 0 → 1 (+1 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/guided/QuickTourModal.tsx — 0 → 1 (+1 hardcoded strings). Use t() keys for new strings in this file.
- Per-file ratchet regression: client/src/components/shopping/GroceryExportModal.tsx — 0 → 1 (+1 hardcoded strings). Use t() keys for new strings in this file.

### Components with real untranslated findings — localize, then register at zero

- New ACTIVE component not in per-file baseline: client/src/components/HydrationEverydayCreatorButton.tsx (2 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/HydrationFourDoorPanels.tsx (47 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/HydrationHubGuide.tsx (20 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/HydrationInterventionCards.tsx (3 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/MealPlanDestinationPicker.tsx (11 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/NutritionPrioritiesSelector.tsx (7 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/OncologySymptomDialog.tsx (3 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/OncologySymptomSelector.tsx (1 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/OrganizationAccessCard.tsx (16 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/QuickStartPopover.tsx (4 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/StudioAccessCard.tsx (28 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/admin/ProfessionalCredentialReview.tsx (25 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/away-from-home/GetawayAvailabilityNotice.tsx (2 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/away-from-home/GetawayVenueMeals.tsx (4 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/away-from-home/RestaurantPortions.tsx (2 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/beverage/BeverageChoiceCards.tsx (2 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/biometrics/BasicHydrationLogger.tsx (8 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/business/DevelopmentBusinessPilotActivation.tsx (14 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/business/DevelopmentPilotMfaStatus.tsx (7 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/business/FounderPilotInvitation.tsx (3 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/business/GuidedBusinessPilot.tsx (9 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/business/OrganizationInvitationsAccess.tsx (31 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/business/OrganizationPaidContinuation.tsx (3 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/business/OrganizationQuickStartModal.tsx (16 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/business/RewardfulPayoutGuidance.tsx (9 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/coaching/CoachBubble.tsx (1 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/coming-soon/ComingSoonPresentation.tsx (1 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/coming-soon/PlannedFeaturesNotice.tsx (2 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/dashboard/GettingStartedCardView.tsx (3 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/dashboard/HydrationDashboardCard.tsx (2 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/glp1/GLP1MealPreflight.tsx (10 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/guided/GuidedJourneyExplanation.tsx (1 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/guided/GuidedMealBoard.tsx (3 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/guided/GuidedWorkflowNextStep.tsx (1 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/guided/OnboardingWelcome.tsx (3 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/one-touch/CreatorConceptCards.tsx (1 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/one-touch/CreatorMenuRestorationProgress.tsx (2 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/one-touch/OneTouchCreateModal.tsx (12 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/pro/ClinicalDirectiveReviewPanel.tsx (15 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/pro/DemoCareInvitation.tsx (7 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/pro/DemoSyntheticPatientView.tsx (59 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/pro/DevelopmentPatientFolder.tsx (1 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/pro/DevelopmentPhysicianStudio.tsx (8 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/pro/DevelopmentStudioGuard.tsx (4 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/pro/ProBloodGlucosePanel.tsx (3 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/pro/ProHydrationControls.tsx (30 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/pro/StudioLoadingPanel.tsx (3 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/pro/StudioStarchGamePlan.tsx (9 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/profile/AntiInflammatorySupportControl.tsx (4 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/profile/GLP1CurrentUseControl.tsx (5 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/profile/HealthContextControls.tsx (26 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/shopping/GroceryCoachMacroTiles.tsx (2 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/shopping/MealIngredientBrands.tsx (2 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/shopping/ProductCatalogChoices.tsx (3 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/shopping/SavedGroceryEvidenceUpdate.tsx (5 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/shopping/ShoppingProductPicker.tsx (8 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/shopping/SmartShoppingProductChoice.tsx (2 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.
- New ACTIVE component not in per-file baseline: client/src/components/voice/VoiceInputButton.tsx (1 hardcoded strings). Regenerate docs/localization/hardcoded-baseline-perfile.json to include this file.

### Overall ratchet

- Hardcoded-string count on ACTIVE surfaces increased by 1044 (6466 → 7510). New user-facing strings must use t() keys. This gate is a ratchet — it never goes up.

## Verification

- Phase 0 strict localization: **92 inherited failures**, one inherited clinical-coverage warning; all 13 languages pass English-key parity. Exact failure-message comparison confirms no new failures.
- Translation value-quality scan: passed; no interpolation errors, empty or placeholder values; all locales within unchanged thresholds.
- Locale catalog regression suite: **44 passed**. Checks all 14 supported catalogs for duplicate properties, complete key coverage, nonempty values, interpolation preservation, restored meal-picker keys, and Arabic/Russian plural rendering.
- Existing Create a Dish recovery, shared Menu hook, Fridge Rescue heading, and Grocery Coach summary suites: **36 passed** across four suites. Together: **80 passed**.
- Strict release type gate: passed against the unchanged reviewed 109-diagnostic baseline.
- General pre-push validation with `--no-start`: passed with the existing 71-path route-parity warning; no application restart or live-account tests.
- Existing effective translation values: unchanged in all 14 catalogs; verified against the starting Git commit.
- App preview loaded the unauthenticated sign-in screen without catalog/import errors. It does not verify the signed-in recovery screen; that component is covered by the focused regression tests.

## Merge readiness

The PR remains free of new localization failures and this batch reduces inherited failures. It is **not fully localization-validation-clean**: the 92 remaining failures still make the strict gate fail. Do not describe it as an all-green release. The PR was not merged or published.
