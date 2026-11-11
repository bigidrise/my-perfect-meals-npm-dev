# Tutorial / Getaway release-gate review

## Scope and release boundary

This correction is based on the Getaway reconciliation candidate, not the older Development checkout. It localizes only newly flagged tutorial captions and the generic Getaway venue placeholder. It does not alter tutorial destinations, missing-link behavior, mobile button layout, Getaway prompts, venue discovery, clinical policy, registries, localization baselines, or validator implementation.

No merge, running Production workspace synchronization, or publication was performed.

## Source comparison

Fetched GitHub source references on November 10, 2026:

| Snapshot | Commit | Phase 0 failures | ACTIVE hardcoded findings |
| --- | --- | ---: | ---: |
| Production before tutorial merge | `4e9082f50c56ceab6c8b867ba471e2ca5810353b` | 126 | 7510 |
| Tutorial PR head | `f8008bd361121f75062f08617fa00bcbffcd3c35` | 126 | 7533 |
| GitHub Production after tutorial merge | `b294db796630dd8a4f4a90b483b7b0e841534a1d` | 126 | 7533 |
| Getaway reconciliation head | `8bff8f27df2b2aa45666cbfae7d79cbe847e3119` | 126 | 7534 |
| This localization correction | See this PR's head | 126 | 7510 |

These are GitHub source states, **not evidence of the running published version**.

The unmodified Phase 0 validator (`npm run validate:i18n:phase0`) was executed against all four source snapshots with the same installed dependencies. Each snapshot regenerated its own audit and reachability reports. The reconciliation's 126 failures reproduced the [GitHub failure log](https://github.com/bigidrise/my-perfect-meals-npm-dev/actions/runs/42898136678).

Every failing check already failed before the tutorial merge. Equal failure counts alone do not prove no regression:

- Tutorials added 23 `How It Works` findings in 22 files. This worsened the aggregate failure and two existing per-file failures (`SavedGroceriesSheet` and `GroceryStoreCoachSheet`).
- Getaway replaced a branded example with a generic placeholder. The new placeholder added one finding, worsening the aggregate failure and the existing unbaselined `GetawayVenueMeals` entry.
- This correction removes all 24 new findings using real translation keys. Its **complete ordered list of 126 failure messages exactly equals the pre-tutorial Production list**, not merely its count.
- No new missing locale keys or clinical-source-integrity failures came from either change.

## Corrections prepared

- Shared tutorial control accepts a typed translation key for the new captions while preserving existing literal-label callers and the legacy default.
- Accessible tutorial labels and the legacy default have localized resources.
- Getaway's generic placeholder is localized; its English wording is preserved.
- All four resource keys are populated in English and all 13 supported non-English locales. No English copy-through was added to those locales.
- The 23 new caption occurrences use the shared translation key without inserting hooks into their parent pages.
- No localization ratchet was raised and no clinical registry or review manifest was regenerated.

## Validation

- Seven focused suites passed: **348 tests**. Coverage includes every configured tutorial's exact destination and protected-tab behavior, five unavailable links, mobile size and caption classes, form safety, translated labels for all 14 locales, and existing Getaway client/server regression cases.
- `npm run validate:i18n`: **passed**; no interpolation mismatches, no clinical-English gate failures, and all identical-to-English percentages below the configured limits.
- `npm run validate:i18n:phase0`: **failed as intended**, with the 126 inherited failures below and one inherited clinical migration-coverage warning.
- Root strict type baseline review is a separate correction. No error suppression or validator edits are included here.
- Client and server production bundles built successfully in the isolated worktree. The fresh worktree needed its ignored build-version module; the client check used stable Development metadata, not a new release identity.

The separate type review reproduced the historical **109-diagnostic** baseline exactly. Of the candidate's 109 diagnostics, **99 are byte-identical and 10 moved only by source line**. Mapping those 10 locations through the source diff reconstructs the exact original fingerprint. The reviewed update changes only the baseline hash from `414c8b7ab1a15509a2b756467c98b58942678d780479bb9f98e703a2d7ff6f44` to `86ce5ce161a64df58b5ca6a635861672941ab3282d1b385e75bf5342fb9e11e9`; the count and strict validator are unchanged.

The full release is **not cleared** while Phase 0 remains red. Focused tests do not establish live Production behavior.

## Exact remaining blockers and proposed fixes

### 1. Key parity — 13 failures

Locales `ar`, `de`, `es`, `fr`, `hi`, `it`, `ja`, `ko`, `pt`, `ru`, `tl`, `vi`, and `zh` each lack the same 38 English keys (494 missing locale-key instances):

```text
dashboard.foodsEnjoyTitle
dashboard.foodsEnjoyDescription
savedMeals.sourceSavedMeal
shopping.findProduct.verificationRequired
restaurant.orderingEducationTitle
restaurant.orderingEducationBody
restaurant.orderingEducationGuidance
restaurant.orderingEducationClosing
fridgeRescue.resultsCount_one
fridgeRescue.resultsCount_other
cravingCreator.serving1
cravingCreator.servingN
findMeals.orderingEducationTitle
findMeals.orderingEducationBody
findMeals.orderingEducationGuidance
findMeals.orderingEducationClosing
trialStatusCard.pilotProgram
trialStatusCard.clientAccess
ingredientSheet.simple.matters
ingredientSheet.simple.chef
ingredientSheet.simple.details
ingredientSheet.simple.byName
ingredientSheet.simple.byLabel
ingredientSheet.simple.noGrade
ingredientSheet.simple.restrictions
ingredientSheet.simple.allPoints
ingredientSheet.simple.recommendation
ingredientSheet.simple.savedFromCoach
ingredientSheet.simple.savedRecommendation
ingredientSheet.simple.whyRecommended
ingredientSheet.simple.recommendationSource
ingredientSheet.simple.analyzeNotice
ingredientSheet.simple.analyzingProduct
ingredientSheet.simple.analyzeProduct
ingredientSheet.simple.viewSaved
ingredientSheet.simple.updateSaved
ingredientSheet.simple.removeSaved
ingredientSheet.simple.saveUnconfirmed
```

**Proposed fix:** translate these keys in all 13 locales, preserving variables and plurals. Review safety-related wording through the existing clinical process where applicable. Do not fill them with English just to pass parity.

### 2. Clinical source integrity — 10 failures

Registry references, not current source positions:

| Source | Registry line | Protected text / identifying prefix |
| --- | ---: | --- |
| `client/src/pages/AcademyLandingPage.tsx` | 551 | Clinical Deep Dives |
| `client/src/pages/AcademyLandingPage.tsx` | 565 | Diabetes Nutrition |
| `client/src/pages/AcademyLandingPage.tsx` | 566 | GLP-1 Support |
| `client/src/pages/Learn.tsx` | 1363 | Real-time diabetic meal adjustment |
| `client/src/pages/Learn.tsx` | 1369 | GlucoseGuard is for diabetics only. It reads your actual blo… |
| `client/src/pages/Learn.tsx` | 1382 | Starch Guard is about weight management and limiting high-gl… |
| `client/src/pages/academy/AcademyHome.tsx` | 39 | Diabetes Nutrition |
| `client/src/pages/academy/AcademyHome.tsx` | 40 | GLP-1 Support |
| `client/src/pages/profile/EditProfilePage.tsx` | 1339 | Metabolic Medication Support — Nutritional Guidance Only |
| `client/src/pages/profile/EditProfilePage.tsx` | 1341 | not a substitute for your prescribing doctor's guidance |

**Proposed fix:** trace the actual removals/moves/rewrites, obtain the required controlled clinical sign-off, then reconcile the registry and affected approvals. Do not restore obsolete claims or regenerate the registry without review merely to obtain green CI.

### 3. Aggregate hardcoded-string ratchet — 1 failure

The unchanged baseline is **6466**; the corrected candidate still contains **7510** ACTIVE findings, an inherited excess of **1044**.

**Proposed fix:** localize inherited findings in bounded reviewed groups until the aggregate is at or below 6466. Some findings may be scanner classifications rather than rendered copy; substantiate those individually without broad exemptions or a higher baseline.

### 4. Existing per-file regressions — 23 failures

All paths below are under `client/src/components/`. Values are baseline → corrected candidate:

```text
Router.tsx                                      6 → 19
shopping/SavedGroceriesSheet.tsx                 4 → 14
MacroScanModal.tsx                              7 → 13
copilot/packs/basePacks.tsx                     24 → 28
pro/ProClientFolderModal.tsx                    40 → 44
pro/StudioMetricsSnapshot.tsx                   3 → 7
shopping/GroceryStoreCoachSheet.tsx            20 → 24
DailyMacroTotalsRow.tsx                         0 → 3
protocol/NutritionPersonalizationSummaryCard.tsx 1 → 4
MealCard.tsx                                   1 → 3
WorkspaceChooser.tsx                           0 → 2
ace/CoachCornerCard.tsx                         0 → 2
pro/ProClientComplianceSnapshot.tsx             8 → 10
AppRouter.tsx                                  0 → 1
BugReportModal.tsx                              5 → 6
JustDescribeItModal.tsx                         5 → 6
MealRefinementSheet.tsx                         0 → 1
MedicalSourcesInfo.tsx                       281 → 282
MfaChallengeModal.tsx                           1 → 2
ReplaceMealMenu.tsx                            12 → 13
SafetyGuardBanner.tsx                          0 → 1
guided/QuickTourModal.tsx                       0 → 1
shopping/GroceryExportModal.tsx                 0 → 1
```

**Proposed fix:** convert the excess findings to translation-backed copy without changing feature behavior or raising each file's ratchet. This work overlaps the aggregate excess; these are not separate additive counts.

### 5. Components absent from the per-file baseline — 79 failures

These files predate the tutorial changes. Of the 79, **21 have zero findings** and **58 contain findings**. Paths are relative to `client/src/components/`; counts reflect this corrected candidate.

```text
AcademyBackButton.tsx                                  0
CanonicalTimezonePrompt.tsx                            0
DiabetesProtocolIndicator.tsx                          0
HydrationEverydayCreatorButton.tsx                     2
HydrationFourDoorPanels.tsx                           47
HydrationHubGuide.tsx                                 20
HydrationInterventionCards.tsx                         3
MealGenerationProgress.tsx                            0
MealPlanDestinationPicker.tsx                         11
NutritionPrioritiesSelector.tsx                       7
OncologySymptomDialog.tsx                             3
OncologySymptomSelector.tsx                           1
OrganizationAccessCard.tsx                           16
QuickStartPopover.tsx                                 4
ReleaseBannerMount.tsx                                0
StudioAccessCard.tsx                                 28
admin/ProfessionalCredentialReview.tsx               25
away-from-home/GetawayAvailabilityNotice.tsx           2
away-from-home/GetawayMealImage.tsx                    0
away-from-home/GetawayVenueMeals.tsx                   4
away-from-home/PlateItems.tsx                          0
away-from-home/RestaurantPortions.tsx                  2
beverage/BeverageChoiceCards.tsx                       2
biometrics/BasicHydrationLogger.tsx                    8
business/BusinessPilotWindowNotice.tsx                 0
business/DevelopmentBusinessPilotActivation.tsx       14
business/DevelopmentPilotMfaStatus.tsx                 7
business/FounderPilotInvitation.tsx                    3
business/GuidedBusinessPilot.tsx                       9
business/OrganizationInvitationsAccess.tsx            31
business/OrganizationPaidContinuation.tsx              3
business/OrganizationQuickStartModal.tsx              16
business/OrganizationQuickStartReturn.tsx               0
business/RewardfulPayoutGuidance.tsx                    9
coaching/ChefConversationEntry.tsx                     0
coaching/ChefResponseAvatar.tsx                        0
coaching/CoachBubble.tsx                               1
coaching/CoachFeatureAction.tsx                        0
coaching/chefResponseText.tsx                          0
coming-soon/ComingSoonPresentation.tsx                 1
coming-soon/PlannedFeaturesNotice.tsx                  2
dashboard/GettingStartedCard.tsx                       0
dashboard/GettingStartedCardView.tsx                   3
dashboard/HydrationDashboardCard.tsx                   2
glp1/GLP1MealPreflight.tsx                            10
guided/BuilderGuidanceTour.tsx                        0
guided/GuidedJourneyExplanation.tsx                    1
guided/GuidedMealBoard.tsx                             3
guided/GuidedWorkflowNextStep.tsx                      1
guided/OnboardingWelcome.tsx                          3
one-touch/CreatorConceptCards.tsx                      1
one-touch/CreatorMenuRestorationProgress.tsx            2
one-touch/OneTouchCreateModal.tsx                     12
pediatric/PediatricImageRetry.tsx                      0
pro/ClinicalDirectiveReviewPanel.tsx                  15
pro/DemoCareInvitation.tsx                             7
pro/DemoSyntheticPatientView.tsx                      59
pro/DevelopmentPatientFolder.tsx                       1
pro/DevelopmentPhysicianStudio.tsx                     8
pro/DevelopmentStudioGuard.tsx                        4
pro/ProBloodGlucosePanel.tsx                           3
pro/ProHydrationControls.tsx                          30
pro/StudioLoadingPanel.tsx                            3
pro/StudioStarchGamePlan.tsx                           9
profile/AntiInflammatorySupportControl.tsx              4
profile/ConsumerHealthContextSection.tsx               0
profile/GLP1CurrentUseControl.tsx                       5
profile/HealthContextControls.tsx                     26
shopping/GroceryCoachMacroTiles.tsx                    2
shopping/MealIngredientBrands.tsx                      2
shopping/ProductCatalogChoices.tsx                     3
shopping/RecommendedProductActions.tsx                 0
shopping/SavedGroceryEvidenceUpdate.tsx                5
shopping/SavedProductAnalysisAction.tsx                0
shopping/ShoppingProductPicker.tsx                     8
shopping/SmartShoppingProductChoice.tsx                2
ui/bouncing-dots.tsx                                  0
ui/icon-pill-option.tsx                               0
voice/VoiceInputButton.tsx                            1
```

**Proposed fix:** explicitly register the 21 verified zero-finding files at zero. Localize and review the other 58 before registering them at zero; do not bulk-adopt their current hardcoded counts. Preserve controlled clinical review for safety copy.

## Release decision

The tutorial/Getaway additions no longer worsen the inherited localization failures, but **the release remains blocked** by the unchanged strict Phase 0 gate. Clearing inherited debt requires separately reviewed localization and clinical-registry work, not a check bypass or a baseline increase. Preserve the reconciliation candidate while applying the separate type-baseline and localization corrections.
