# Release-type fingerprint reconciliation — actual evidence

**Status: investigation complete. The founder explicitly approved the exact fingerprint update after receiving the complete comparison. Only the stored SHA-256 was updated; the unchanged canonical gate then passed with the same 109 reviewed diagnostics. No checker, compiler configuration, error count or diagnostic exemption was changed. This is not full release clearance.**

Reviewed source: f9e580f4f341eecb6428f053fb7408b97b84b896. Current compiler: TypeScript 5.9.3.
The current unmodified validator ran once with complete subprocess capture. Its generated build module was restored byte-for-byte. A fresh historical validation also passed against the reviewed fingerprint using the same installed dependency directory and compiler. All 3,744 historical TypeScript/JavaScript/JSON compiler-input source files matched the reviewed Git objects before that run.

At the investigation capture, the lockfile, compiler configuration, validator and baseline were unchanged from the reviewed source. Only the subsequently approved stored fingerprint was updated. The only package-manifest differences were two localization-check script entries, not dependency changes. Historical canonical-gate output is retained in `.local/reports/spanish-historical-release-gate.log`.

- Reviewed: 109 diagnostics; SHA-256 `f35815894759a318412b3c26a05fed54432b0335d5ae4f84158ce144c2ca0133`.
- Current: 109 diagnostics; SHA-256 `7935edf0da4703eb6a68d259d0fbf0f3ee8715527c3b956194b49947057f2098`.
- Added/removed full-message multiset entries: **0/0** after comparison-only source-position and literal-union-order normalization.
- Independently source-diff-mapped locations: **109/109**.
- Unchanged diagnosed source lines: **109/109**.
- Moved diagnostics: **6**. Compiler message display-order changes: **1**.
- Validator/baseline/tsconfig unchanged at the pre-approval investigation capture: **true**.

Subsequent four-screen implementation moved four existing Gatherings diagnostics
by two lines. That later exact fingerprint is a separate, still-unapproved
change; see [the execution report](FOUR_SCREEN_SPANISH_EXECUTION.md).

## Exact differences
### client/src/components/FlavorToggle.tsx
Reviewed:
```text
client/src/components/FlavorToggle.tsx(26,7): error TS2322: Type '"ghost"' is not assignable to type 'PillButtonVariant | undefined'.
```
Current:
```text
client/src/components/FlavorToggle.tsx(28,7): error TS2322: Type '"ghost"' is not assignable to type 'PillButtonVariant | undefined'.
```
The diagnosed line is byte-identical and its location maps through the source diff. The LanguagePreferencesPage message differs additionally only in literal-union member order.

### client/src/pages/MacroCalculator.tsx
Reviewed:
```text
client/src/pages/MacroCalculator.tsx(1047,9): error TS2322: Type '"lean_gain"' is not assignable to type 'Goal'.
```
Current:
```text
client/src/pages/MacroCalculator.tsx(1069,9): error TS2322: Type '"lean_gain"' is not assignable to type 'Goal'.
```
The diagnosed line is byte-identical and its location maps through the source diff. The LanguagePreferencesPage message differs additionally only in literal-union member order.

### client/src/pages/SocialFindMeals.tsx
Reviewed:
```text
client/src/pages/SocialFindMeals.tsx(257,11): error TS2741: Property 'step3' is missing in type '{ entry: string; step1: string; step2: string; generating: string; results: string; }' but required in type 'Record<GuidedStep, string>'.
```
Current:
```text
client/src/pages/SocialFindMeals.tsx(258,11): error TS2741: Property 'step3' is missing in type '{ entry: string; step1: string; step2: string; generating: string; results: string; }' but required in type 'Record<GuidedStep, string>'.
```
The diagnosed line is byte-identical and its location maps through the source diff. The LanguagePreferencesPage message differs additionally only in literal-union member order.

### client/src/pages/SocialFindMeals.tsx
Reviewed:
```text
client/src/pages/SocialFindMeals.tsx(393,58): error TS2322: Type 'unknown' is not assignable to type '{ name?: string | undefined; description?: string | undefined; ingredients?: string[] | undefined; }'.
```
Current:
```text
client/src/pages/SocialFindMeals.tsx(394,58): error TS2322: Type 'unknown' is not assignable to type '{ name?: string | undefined; description?: string | undefined; ingredients?: string[] | undefined; }'.
```
The diagnosed line is byte-identical and its location maps through the source diff. The LanguagePreferencesPage message differs additionally only in literal-union member order.

### client/src/pages/SocialRestaurantGuide.tsx
Reviewed:
```text
client/src/pages/SocialRestaurantGuide.tsx(608,55): error TS2322: Type 'unknown' is not assignable to type '{ name?: string | undefined; description?: string | undefined; ingredients?: string[] | undefined; }'.
```
Current:
```text
client/src/pages/SocialRestaurantGuide.tsx(609,55): error TS2322: Type 'unknown' is not assignable to type '{ name?: string | undefined; description?: string | undefined; ingredients?: string[] | undefined; }'.
```
The diagnosed line is byte-identical and its location maps through the source diff. The LanguagePreferencesPage message differs additionally only in literal-union member order.

### client/src/pages/profile/LanguagePreferencesPage.tsx
Reviewed:
```text
client/src/pages/profile/LanguagePreferencesPage.tsx(48,25): error TS2367: This comparison appears to be unintentional because the types '"fr" | "en" | "ar" | "es" | "de" | "it" | "pt" | "zh" | "ja" | "ko" | "hi" | "ru" | "vi" | "tl" | "auto"' and '"null"' have no overlap.
```
Current:
```text
client/src/pages/profile/LanguagePreferencesPage.tsx(54,25): error TS2367: This comparison appears to be unintentional because the types '"en" | "es" | "fr" | "de" | "it" | "pt" | "zh" | "ja" | "ko" | "ar" | "hi" | "ru" | "vi" | "tl" | "auto"' and '"null"' have no overlap.
```
The diagnosed line is byte-identical and its location maps through the source diff. The LanguagePreferencesPage message differs additionally only in literal-union member order.

## What approval would authorize
Replace only the reviewed diagnostic fingerprint with the exact current fingerprint above, retaining the same count of 109 and unchanged validator/compiler enforcement. This is not authorization to absorb any new semantic errors, change compiler flags, drop positions, normalize the actual gate, reset localization allowances or publish.
The 109 known errors are not fixed or made type-clean by this update; they are the same previously reviewed debt. If approved, perform the exact deliberate update and run the canonical gate once to verify it. Without approval, keep the raw gate blocking and dependent ordinary implementation paused.

## All diagnostic positions
Each row was paired by full comparison signature and independently mapped old source position, preserving multiplicity. Lexical output order is not used to pair duplicate messages.

| File | Code | Reviewed line:column | Current line:column | Diff mapped; source line unchanged |
| --- | --- | --- | --- | --- |
| client/src/components/CulturalRecipeEditor.tsx | TS2322 | 295:16 | 295:16 | yes |
| client/src/components/CulturalRecipeEditor.tsx | TS7006 | 296:35 | 296:35 | yes |
| client/src/components/DailyMotivation.tsx | TS2339 | 29:24 | 29:24 | yes |
| client/src/components/DailyMotivation.tsx | TS2339 | 48:31 | 48:31 | yes |
| client/src/components/DailyMotivation.tsx | TS2339 | 52:28 | 52:28 | yes |
| client/src/components/FlavorToggle.tsx | TS2322 | 26:7 | 28:7 | yes |
| client/src/components/MobileVoiceRecorder.tsx | TS18046 | 85:11 | 85:11 | yes |
| client/src/components/MobileVoiceRecorder.tsx | TS18046 | 87:18 | 87:18 | yes |
| client/src/components/MobileVoiceRecorder.tsx | TS18046 | 90:38 | 90:38 | yes |
| client/src/components/RecipeEditorPro.tsx | TS2322 | 333:16 | 333:16 | yes |
| client/src/components/RecipeEditorPro.tsx | TS7006 | 334:35 | 334:35 | yes |
| client/src/components/SimpleVoiceRecorder.tsx | TS2322 | 288:11 | 288:11 | yes |
| client/src/components/VoiceControlButton.tsx | TS18046 | 108:54 | 108:54 | yes |
| client/src/components/biometrics/QuickLogMacrosButton.tsx | TS2459 | 5:15 | 5:15 | yes |
| client/src/components/macro-targeting/BodyCompositionSheet.tsx | TS2304 | 166:55 | 166:55 | yes |
| client/src/components/mealCreatorSteps/Step1.tsx | TS2322 | 36:38 | 36:38 | yes |
| client/src/components/mealCreatorSteps/Step2.tsx | TS2769 | 26:10 | 26:10 | yes |
| client/src/components/mealCreatorSteps/Step2.tsx | TS2769 | 37:10 | 37:10 | yes |
| client/src/components/mealCreatorSteps/Step4.tsx | TS2769 | 57:12 | 57:12 | yes |
| client/src/components/pro/ClinicalInterventionPanel.tsx | TS2367 | 76:17 | 76:17 | yes |
| client/src/components/pro/ProClientFolderModal.tsx | TS2322 | 1584:7 | 1584:7 | yes |
| client/src/components/pro/ProClientFolderModal.tsx | TS2322 | 995:7 | 995:7 | yes |
| client/src/data/diabeticAiPremades.dinner.ts | TS2304 | 11:8 | 11:8 | yes |
| client/src/data/diabeticMenu.breakfast.ts | TS2307 | 2:32 | 2:32 | yes |
| client/src/data/diabeticMenu.dinner.ts | TS2307 | 1:32 | 1:32 | yes |
| client/src/data/diabeticMenu.lunch.ts | TS2307 | 1:32 | 1:32 | yes |
| client/src/data/diabeticMenu.snacks.ts | TS2307 | 1:32 | 1:32 | yes |
| client/src/data/lifestyleDietPickerConfig.ts | TS2353 | 689:3 | 689:3 | yes |
| client/src/hooks/usePushNotifications.ts | TS2322 | 79:9 | 79:9 | yes |
| client/src/layout/AppLayout.tsx | TS2339 | 57:11 | 57:11 | yes |
| client/src/legacy/audio/AudioTestPanel.tsx | TS2307 | 2:29 | 2:29 | yes |
| client/src/legacy/audio/AudioTestPanel.tsx | TS2307 | 3:24 | 3:24 | yes |
| client/src/legacy/chef/ChefNavigationExample.tsx | TS2307 | 3:62 | 3:62 | yes |
| client/src/legacy/features/breakfast/BreakfastMealsHub.tsx | TS2339 | 112:25 | 112:25 | yes |
| client/src/legacy/features/breakfast/BreakfastMealsHub.tsx | TS7006 | 112:30 | 112:30 | yes |
| client/src/legacy/features/breakfast/BreakfastMealsHub.tsx | TS7006 | 122:54 | 122:54 | yes |
| client/src/legacy/features/breakfast/BreakfastMealsHub.tsx | TS2339 | 186:64 | 186:64 | yes |
| client/src/legacy/features/breakfast/BreakfastMealsHub.tsx | TS2339 | 188:49 | 188:49 | yes |
| client/src/legacy/features/breakfast/BreakfastMealsHub.tsx | TS7006 | 202:55 | 202:55 | yes |
| client/src/legacy/features/breakfast/BreakfastMealsHub.tsx | TS7006 | 202:61 | 202:61 | yes |
| client/src/legacy/features/breakfast/BreakfastMealsHub.tsx | TS7006 | 213:53 | 213:53 | yes |
| client/src/legacy/features/breakfast/BreakfastMealsHub.tsx | TS2339 | 40:33 | 40:33 | yes |
| client/src/legacy/features/breakfast/BreakfastMealsHub.tsx | TS7006 | 40:39 | 40:39 | yes |
| client/src/legacy/features/breakfast/BreakfastMealsHub.tsx | TS2339 | 64:72 | 64:72 | yes |
| client/src/legacy/features/breakfast/BreakfastMealsHub.tsx | TS2339 | 64:84 | 64:84 | yes |
| client/src/legacy/pages/CoachCornerHome.tsx | TS2304 | 30:12 | 30:12 | yes |
| client/src/legacy/pages/_future/potluck-planner.tsx | TS7006 | 100:33 | 100:33 | yes |
| client/src/legacy/pages/_future/potluck-planner.tsx | TS7006 | 242:51 | 242:51 | yes |
| client/src/legacy/pages/_future/potluck-planner.tsx | TS7006 | 242:64 | 242:64 | yes |
| client/src/legacy/pages/_future/potluck-planner.tsx | TS7006 | 346:36 | 346:36 | yes |
| client/src/legacy/pages/_future/potluck-planner.tsx | TS2307 | 54:94 | 54:94 | yes |
| client/src/legacy/studio-retired/RETIRED_CravingStudio.tsx | TS2304 | 370:59 | 370:59 | yes |
| client/src/lib/__tests__/groceryCoachBrandPick.test.tsx | TS2352 | 429:6 | 429:6 | yes |
| client/src/lib/__tests__/groceryCoachSummaryBarReopenCycle.test.tsx | TS2352 | 168:4 | 168:4 | yes |
| client/src/lib/__tests__/mealRemindersIosPermission.test.tsx | TS2556 | 49:37 | 49:37 | yes |
| client/src/lib/__tests__/mealRemindersIosPermission.test.tsx | TS2556 | 51:39 | 51:39 | yes |
| client/src/lib/__tests__/mealRemindersIosPermission.test.tsx | TS2556 | 53:36 | 53:36 | yes |
| client/src/lib/__tests__/mealRemindersIosPermission.test.tsx | TS2556 | 55:33 | 55:33 | yes |
| client/src/lib/__tests__/mealRemindersIosPermission.test.tsx | TS2556 | 57:70 | 57:70 | yes |
| client/src/lib/__tests__/mealRemindersIosPermission.test.tsx | TS2556 | 58:72 | 58:72 | yes |
| client/src/lib/__tests__/studioVideoMessageComposer.test.tsx | TS2345 | 125:7 | 125:7 | yes |
| client/src/lib/__tests__/studioVideoMessageComposer.test.tsx | TS2345 | 133:7 | 133:7 | yes |
| client/src/lib/__tests__/studioVideoMessageComposer.test.tsx | TS2345 | 246:7 | 246:7 | yes |
| client/src/lib/__tests__/studioVideoMessageComposer.test.tsx | TS2345 | 268:7 | 268:7 | yes |
| client/src/lib/entitlements.ts | TS2322 | 71:3 | 71:3 | yes |
| client/src/lib/entitlements.ts | TS2322 | 72:3 | 72:3 | yes |
| client/src/lib/entitlements.ts | TS2322 | 73:3 | 73:3 | yes |
| client/src/lib/entitlements.ts | TS2322 | 74:3 | 74:3 | yes |
| client/src/lib/fallbackMeals.ts | TS2305 | 1:10 | 1:10 | yes |
| client/src/lib/platform.ts | TS2774 | 36:9 | 36:9 | yes |
| client/src/pages/CompanionNutritionHub.tsx | TS2741 | 663:10 | 663:10 | yes |
| client/src/pages/FastFoodGuidePage.tsx | TS2322 | 504:55 | 504:55 | yes |
| client/src/pages/JoinStudio.tsx | TS2304 | 334:26 | 334:26 | yes |
| client/src/pages/MacroCalculator.tsx | TS2322 | 1047:9 | 1069:9 | yes |
| client/src/pages/MacroCalculator.tsx | TS2440 | 92:3 | 92:3 | yes |
| client/src/pages/MacroCalculator.tsx | TS2440 | 93:3 | 93:3 | yes |
| client/src/pages/PromoRedemption.tsx | TS2339 | 40:11 | 40:11 | yes |
| client/src/pages/SocialFindMeals.tsx | TS2741 | 257:11 | 258:11 | yes |
| client/src/pages/SocialFindMeals.tsx | TS2322 | 393:58 | 394:58 | yes |
| client/src/pages/SocialRestaurantGuide.tsx | TS2322 | 608:55 | 609:55 | yes |
| client/src/pages/TrainingNutritionHub.tsx | TS2551 | 1140:114 | 1140:114 | yes |
| client/src/pages/TrainingNutritionHub.tsx | TS2551 | 1140:65 | 1140:65 | yes |
| client/src/pages/TrainingNutritionHub.tsx | TS2551 | 1141:114 | 1141:114 | yes |
| client/src/pages/TrainingNutritionHub.tsx | TS2551 | 1141:65 | 1141:65 | yes |
| client/src/pages/WhiteLabelSolutions.tsx | TS2339 | 509:21 | 509:21 | yes |
| client/src/pages/admin/AdminCertifications.tsx | TS2345 | 340:24 | 340:24 | yes |
| client/src/pages/biometrics/sleep.tsx | TS7006 | 192:34 | 192:34 | yes |
| client/src/pages/certification/CertificationLesson.tsx | TS2322 | 124:13 | 124:13 | yes |
| client/src/pages/companion/CatNutritionHub.tsx | TS2741 | 459:10 | 459:10 | yes |
| client/src/pages/lifestyle/GatheringsPage.tsx | TS2300 | 10:10 | 10:10 | yes |
| client/src/pages/lifestyle/GatheringsPage.tsx | TS2300 | 114:3 | 114:3 | yes |
| client/src/pages/lifestyle/GatheringsPage.tsx | TS2300 | 69:10 | 69:10 | yes |
| client/src/pages/lifestyle/GatheringsPage.tsx | TS2300 | 91:3 | 91:3 | yes |
| client/src/pages/profile/LanguagePreferencesPage.tsx | TS2367 | 48:25 | 54:25 | yes |
| client/src/services/mealReminderService.ts | TS2322 | 188:7 | 188:7 | yes |
| client/src/utils/athleteIngredientMapper.ts | TS2304 | 1:59 | 1:59 | yes |
| server/routes/generation.ts | TS7053 | 51:26 | 51:26 | yes |
| server/routes/marketingCenterRoutes.ts | TS2554 | 125:41 | 125:41 | yes |
| server/routes/marketingCenterRoutes.ts | TS2339 | 136:35 | 136:35 | yes |
| server/routes/proBiometricsRoutes.ts | TS2769 | 12:3 | 12:3 | yes |
| server/routes/proProgramHistory.ts | TS2769 | 12:3 | 12:3 | yes |
| server/routes/procareRoutes.ts | TS7053 | 1521:49 | 1521:49 | yes |
| server/routes/studioGenerator.ts | TS2769 | 233:12 | 233:12 | yes |
| server/routes/studioGenerator.ts | TS2769 | 264:5 | 264:5 | yes |
| server/routes/voice.ts | TS2339 | 19:11 | 19:11 | yes |
| server/services/generators/cravingCreatorWrapped.ts | TS7006 | 35:48 | 35:48 | yes |
| server/services/hubCoupling/hubModules/competitionPro.ts | TS18047 | 130:35 | 130:35 | yes |
| server/services/hubCoupling/hubModules/competitionPro.ts | TS2322 | 135:9 | 135:9 | yes |
| server/services/notificationScheduler.ts | TS2322 | 29:7 | 29:7 | yes |

Full current stdout/stderr, reviewed/current complete messages and comparison metadata remain in .local/reports/spanish-next-types-current.json and spanish-next-type-comparison.json. The original retained artifact is spanish-phase2-types.json. These are diagnostic evidence files, not a second gate or an allowlist.
