# Four-screen Spanish implementation — Development only

## Status and boundaries

Implemented the authorized ordinary-copy and generation-language corrections for
Create a Dish, Fridge Rescue, Dashboard and My Perfect Gatherings, using the
existing EN/ES architecture. This is **not** a claim that Spanish is complete
across the platform or that these signed-in pages passed browser verification.

No publication, real-account modification, live/paid AI generation, database
migration, protected-wording approval, feature activation or release-check
exemption was performed. Existing English, canonical selections, numeric
nutrition, clinical checks and historical recipe content remain authoritative.

## Prerequisites

- The release-type investigation established 109 existing diagnostics with no
  added/removed normalized full messages. All diagnosed source lines were
  source-diff mapped, and an independent historical canonical run passed.
- The founder approved only the exact fingerprint update from
  `f35815894759a318412b3c26a05fed54432b0335d5ae4f84158ce144c2ca0133`
  to `7935edf0da4703eb6a68d259d0fbf0f3ee8715527c3b956194b49947057f2098`.
  Only that stored SHA was updated. The unchanged gate passed afterward.
- The prerequisite residual reconciliation reused 54 findings, 36 feature
  families and 248 registrations, with 15 sampled owners. Those are reviewed
  inventory-cohort counts, not remaining-defect counts after this implementation.
- All 11 existing protected-registry integrity blockers remain held.

## Implemented source owners

| Surface | Actual owner | Correction |
| --- | --- | --- |
| Create a Dish result shopping bar | `client/src/components/ShoppingAggregateBar.tsx` | Heading, ingredient count, share/copy feedback, add/update/pending actions and legacy add-success feedback. Original ingredient data is not translated. |
| Shared portion guidance | `client/src/components/ServingInstructionsBlock.tsx` | Heading, serving count, portion-method explanations and tips. Existing classification and percentage math are unchanged. |
| Dashboard Ask Chef | `client/src/components/ace/CoachCornerCard.tsx` | Descriptions and secondary labels. The Ask Chef wordmark remains unchanged. |
| Dashboard nutrition summary | `client/src/components/protocol/NutritionPersonalizationSummaryCard.tsx` | Ordinary macro-pill labels only; target resolution and numeric values are unchanged. |
| Shared diet/cuisine controls | `client/src/components/ui/DietOverrideControl.tsx`, `CuisineOverrideControl.tsx`, `client/src/i18n/useCreatorOptionLabels.ts` | Closed display-label maps and control copy. Canonical option arrays/IDs and user-authored text remain unchanged. Existing authoritative translations take precedence. |
| Fridge Rescue | `client/src/pages/fridge-rescue.tsx` | Entry/help text, cooking methods, ingredient control, servings, result controls, ordinary notifications, accessibility text, upgrade copy and manual quick-tour copy. |
| My Perfect Gatherings | `client/src/pages/lifestyle/GatheringsPage.tsx` | Planner, occasion/holiday/course labels, outdoor modes and equipment, entry guidance, ordinary errors/success feedback and result/serving controls. Traditional catalog dishes and authored recipes are not rewritten. |

New ordinary copy lives in `client/src/i18n/consumerFeatureCopy.ts`, composed
through the existing `consumerJourney` resources and `useConsumerCopy`.
`scripts/localization-check/resources.cjs` reads that dictionary explicitly;
no guard exemption or new localization system was introduced.

## Generation-language ownership

- **Create a Dish variety and retry:** `server/services/unifiedMealPipeline.ts`
  now captures the operation's language instruction from the loaded envelope
  and includes it in the shared primary/retry prompt. This path previously
  extracted selected medical/procedural layers without the language layer.
- **Emergency fallback:** the existing fallback options now carry
  `preferredLanguage`, forwarded by its caller. Existing allergy override
  matching and clinical/dietary inputs are preserved.
- **Gatherings outdoor preparation guide:** `server/routes/gatherings.ts`
  receives the envelope's language and applies the existing language helper.
  The normal course prompts already use protocol language enforcement.
- **Fridge Rescue defaults:** the active route forwards envelope language.
  `server/utils/fridgeRescueDisplayCopy.ts` localizes only newly constructed
  defaults/fallback prose. Ingredients, IDs, numeric macros, canonical difficulty
  and English inputs used for medical-badge evaluation remain unchanged.
- Existing same-origin language metadata and request-local language resolution
  handle Automatic. No detected-language preference is persisted.
- No saved or restored recipe was passed through a retrospective translator.

## Verification evidence

| Check | Result and limits |
| --- | --- |
| Focused Jest contracts | **103 passing tests across eight suites**, including 18 current component/provider-language tests. Providers/DB dependencies are mocked; credentials are removed from the test environment. No real model or persistence evidence is claimed. |
| Language cases | Explicit English/Spanish precedence, Automatic→Spanish, unsupported-language fallback, request isolation and invalid metadata. Initial variety, retry, outdoor guide, emergency fallback and actual Fridge Rescue provider-failure defaults are covered. |
| Preserved data | Canonical option arrays, ingredient payloads, numeric fallback nutrition, canonical difficulty, existing macro/portion math and allergy-override prompt inputs are covered by focused contracts. |
| Existing safety contracts | Fridge Rescue human-food contract, route completion and fallback scanning tests passed. No safeguard was disabled. |
| Localization-check self-tests | **27 passed**. |
| New-interface-copy guard | Final guard uses the actual translator binding and registered resources; no allowlist reset or unresolved-copy exemption. |
| Client/server production compilation | Both build targets passed. Existing large-chunk warnings are not new type exemptions. |
| Strict safety types | Passed. |
| Public startup screenshot | Anonymous `/welcome` rendered at 390×844. This verifies startup only, not signed-in pages or Spanish layout. |
| Signed-in EN/ES desktop/mobile review | **Unable, not passed.** The hosted browser cannot install request interception/fulfillment before navigation. A bounded CSP alternative did not demonstrate enforcement. The reviewer therefore never loaded the app or sent `/api` requests. No real account was used. |
| Four-screen canonical root type gate | **Passed after the founder's exact second approval**, described below. Later Ask Chef/Getaway work has a separate newly introduced blocker; see `ASK_CHEF_GETAWAY_SPANISH_EXECUTION.md`. |

Focused suites:

- `client/src/lib/__tests__/consumerFourScreenLocalization.test.ts`
- `client/src/lib/__tests__/foodWorkflowLocalization.test.tsx`
- `server/tests/consumerFourScreenGenerationLanguage.test.ts`
- `server/tests/craving-creator-exclude-meals.test.ts`
- `server/tests/requestLanguageContext.test.ts`
- `server/tests/fridgeRescueHumanFood.contract.test.ts`
- `server/tests/fridgeRescueRouteCompletion.test.ts`
- `server/tests/fridgeFallbackScan.test.ts`

Component tests exercise desktop/mobile **render branches**, not real browser
viewport layout, scrolling or wrapping. The requested 1440×1000 and 390×844
signed-in EN/ES checks remain unverified. Fresh live-model language compliance
also remains unverified because live generation was not authorized.

## Exact final fingerprint approval received and verified

The Gatherings localization imports move four already-reviewed diagnostics by
exactly two lines. The count remains **109**, every full diagnostic message
matches the first approval, and **105 raw diagnostic blocks are unchanged**.
There are no added or removed messages.

Approved exact change:

- Stored: `7935edf0da4703eb6a68d259d0fbf0f3ee8715527c3b956194b49947057f2098`
- Final: `e8dadf605ccc7c3c6dec1285551bfa2a37871bee3a9fa1993444c871565813a7`

The founder explicitly approved this exact update in the subsequent continuation.
Only the stored hash was changed, and the canonical gate passed with 109
diagnostics. The checker, compiler configuration, count and exemptions remain unchanged.
The generated build module was restored byte-for-byte.
The complete comparison is retained in
`.local/reports/final-spanish-position-comparison.json` and
`.local/reports/final-spanish-fingerprint-review.html`.

## Remaining English and completion limits

Intentionally held for separate review: Meal Safety, Medical Safety, Checking
safety, allergy/starch/protocol errors and clinical example wording. Existing
protected-registry failures remain unresolved, not excused from eventual scope.

Native brands, canonical identifiers, traditional catalog foods, user-authored
text and historical/generated recipe content are not automatically translated.
An English restored recipe is not evidence that a fresh Spanish request failed.

The broader residual inventory, professional surfaces, educational content and
other previously separated scopes are not declared complete by this slice.
Signed-in visual coverage remains unverified; it has not been replaced by a
passing unit test or startup screenshot. The four-screen fingerprint approval
is resolved. Later implementation verification is reported separately.
