# Spanish shared food workflows — Development review

## Result and boundary

Implemented the approved shared-first English/Spanish interface batch in Development.
No Production publication, schema change, nutrition-policy change, account operation,
provider generation, or real scanning lookup was performed for this work.

The preceding new-interface-text check is complete and remains enforced. This batch
adds ordinary Spanish presentation copy through the existing consumer namespace;
it does not create another language engine, translate arbitrary runtime prose, or
pad other-language catalogs.

This is **not** a claim that the whole platform, every food subdialog, generated
content, clinical wording, or the release pipeline is Spanish-ready.

## Owners and states

| Owner | Completed presentation coverage |
| --- | --- |
| `useMealGenerationProgress` / `MealGenerationProgress` | Ordinary shared titles and rotating messages for general, Create a Dish, snack, dessert, Fridge Rescue, companion, gathering, performance, sushi, restaurant, fast food, beverage and pairing contexts. Local rotation/timing and context-specific truthfulness stay intact. |
| `UniversalMealCardFooter` | Macro logging/busy/success/failure/missing-data states; replace action/fallback; weekly-plan navigation and success feedback. Names, servings, nutrition math and request bodies stay unchanged. |
| `BuilderShoppingBar` | Day picker, loading/empty/count states, send/update/cancel controls, local error fallbacks and completion feedback. Weekdays use the active display language; saved dates, Chicago timezone, legacy English shopping notes and ingredient metadata stay unchanged. |
| Dashboard → `InspirationCaptureModal` (Recipe Maker) | Reused existing EN/ES capture/options/loading/error/save/retry resources. Corrected the visible modal title to the existing dashboard's Spanish product naming, **Creador de Recetas**, without changing the legacy catalog or its English title. Existing retry fallback strings and handlers stay intact. |
| `CreateDishPage` | Intro, input/voice/clear/continue/change-food controls, preparation fallback, method and dimension labels, ordinary choice errors, servings labels, recipe/alternative controls, nutrition field labels, ingredient/instruction headings, macro/cooking actions and accessibility labels. Generated preparation choices and recipe content are not translated by this UI layer. |
| `GroceryStoreCoachSheet` | Meal/product navigation reuses existing translations. Added ordinary people/count/quick-start/loading, recipe-card recovery, Favorites, refine/restore, shopping/owned-ingredient, Smart Cart, save, replacement and feedback copy. Localized ordinary provenance headings while retaining their evidence values. Clinical prompts and recommendation/verification statements listed below remain unchanged. |
| `ShoppingListMasterView` | Header/actions, Coach/product/save entry descriptions, counts/categories, purchased/clear confirmations, bulk dialog and feedback, quantity/unit/delete labels, retailer explanation and temporary-history feedback. |
| Associated scan/voice owners | `VoiceShoppingModal`, `BarcodeScanButton`, `MobileBarcodeCamera`: ordinary capture/manual-entry prompts, typed-review controls, camera errors, unavailable-scanner fallback, captions and accessible names. Reachability limits for barcode UI are below. |
| Shared controls reached from these pages | `VoiceInputButton`, `KeepItSimpleToggle`, `FlavorToggle`, `AddOtherItems`: visible captions, ordinary explanations, input placeholders, toggle labels, error/success states and applicable accessible names. Recording/transcription behavior, boolean values, household suggestions and saved user input remain unchanged. |

New copy lives in `client/src/i18n/foodWorkflowCopy.ts`, connected by
`consumerJourney.ts`. Known aisle labels share `useFoodCategoryLabels`; unknown
or authored category values are not rewritten. Existing locale JSON files and
existing consumer phrase values were not rewritten.

The static guard reader explicitly understands this additional resource module,
including comparisons against the adoption commit before the module existed.
It still fails on a missing connected file or executable resource expression.
No adoption reset, exception, clinical approval, or baseline relaxation was added.

## Verification

### Automated checks

- `npm run validate:i18n:new`: **PASS**, including the final ordinary-copy fixes.
- `npm run test:i18n:new`: **27 passing tests**. Includes the new module's
  before-adoption/connected/missing-file/static-expression contract.
- Initial seven focused suites: **57 passing tests** for food copy, meal progress,
  Recipe Maker retry, Grocery Coach product navigation/carbohydrate display,
  consumer startup/localization and locale request transport.
- Expanded food/voice/retry verification after the browser findings:
  **40 passing tests in four suites**. This overlaps the preceding run; these
  counts are not additive.
- Additional language-preference and Create a Dish identity/request contracts:
  **13 passing tests in three suites**.
- The expanded food-copy suite covers unchanged macro payloads and serving math,
  unchanged shopping notes/quantities, authored names, weekly-plan handoff,
  manual barcode handler input, typed voice-shopping confirmation, ordinary
  ingredient-control toggling, shared voice fallback, and Add Other Items writes
  against local mocks only.
- Every shared progress context and all four modes were compared with the original
  English constructor, including full message order and timer cleanup.
- `git diff --check`: **PASS**.

Jest reports existing isolated-transpilation deprecation warnings; the older
standalone voice suite also warns that it does not initialize i18next. Its
English behavior tests passed; the new Spanish component tests initialize the
real local resources. These are not live provider tests.

### Browser evidence

One bounded browser pass used synthetic browser-local account, entitlement and
API fixtures. It did not sign in to a real account or allow app API requests to
reach the shared database. Unrecognized API requests were aborted. Cross-origin
fetch/XHR and camera access were blocked; third-party image/font/script requests
were not covered by that interception.

Actually observed:

- Desktop **1440 × 1000**, EN/ES: dashboard Recipe Maker capture modal, shopping
  entry controls, Grocery Coach meal/product modes and product-error feedback,
  Create a Dish entry and preparation fallback.
- Mobile **390 × 844**: Create a Dish in EN and ES; shopping and Grocery Coach
  in ES. Measured Create a Dish EN/ES and shopping ES document width was exactly
  390 pixels, with no buttons extending beyond the right edge.
- EN bulk-add dialog opened and cancelled without adding items.
- Manual language changes, save-error rollback, fixture reload restoration, and
  Auto storage semantics worked as detailed below.

Representative screenshot IDs: `cyft2w` (Recipe Maker ES), `h238nm` (Coach meal ES),
`ujx1b9` (Coach product error ES), `w59u69` (preparation ES), `fq01c2`
(Create a Dish ES mobile), `ecm47x` (EN mobile), `jvawbi` (shopping ES mobile),
`l537xt` (Coach ES mobile), `bf1xra` (language save), `1igsr5` (reload),
`xd4ihz` (English selection), `p3mfbx` (Auto).

The initial browser verdict was **failure**: it found ordinary English in the
shared voice caption, Recipe Maker title and Add Other Items, plus an unreachable
barcode dialog. The ordinary-copy findings were corrected at their real owners
and verified with the focused component tests, not a second whole-browser pass.
The screenshots therefore precede those last text corrections. Allergy and
condition-specific English was deliberately not translated.

Limits:

- No actual generation ran. Loading/result/success/action coverage beyond the
  observed states is source/component-contract evidence, not live AI evidence.
- Fresh Spanish-device public auth/signup was not exercised in this browser
  pass. Existing startup tests for es-ES/es-MX, English fallback and explicit
  English passed.
- ES bulk add, EN shopping mobile, desktop numeric overflow, full scan-analysis
  sheets and real device permissions were not browser-verified.
- The Coach sheet's desktop lower edge extends beyond the viewport in the
  fixture. Geometry/keyboard/scroll redesign remains separately owned; this
  patch changes no layout classes or sheet geometry.
- Unmocked workspace/progress/profile requests were intentionally aborted, so
  related fixture banners do not establish product defects.

### Barcode reachability

The current shopping page defines the manual/camera barcode dialog, but has no
`setBarcodeModalOpen(true)` call. `BarcodeScanButton` also has no current app
import. The same absence exists in the pre-change source. Its localized copy
and manual callback are verified at component level only; no reachable manual
barcode workflow is claimed. No new entry point or scanner activation was
added as part of a translation-only task.

## English deliberately retained

### Shared condition-specific progress

The following four contexts return their original complete copy unchanged,
including their ordinary shared lines:

- **Pediatric:** “Chef is crafting kid-friendly options…” / “Chef is crafting a
  kid-friendly meal…”; “Considering age-appropriate nutrition…”; “Reviewing food
  preferences and avoidances…”; “Balancing familiar foods with variety…”;
  “Checking ingredients and substitutions…”; “Finalizing a kid-friendly result…”.
- **Pregnancy:** “Chef is crafting your meal options…” / “Chef is crafting your
  meal…”; “Considering your pregnancy nutrition preferences…”; “Reviewing dietary
  considerations…”; “Balancing nourishment and meal satisfaction…”; “Checking
  ingredients and substitutions…”; “Finalizing your meal…”.
- **Diabetes:** the original general/options title; “Reviewing your food
  preferences…”; “Considering glucose-conscious meal choices…”; “Balancing
  carbohydrates, protein, and fiber…”; “Checking ingredients and substitutions…”;
  “Finalizing your meal options…”.
- **GLP-1:** the original general/options title; “Reviewing your food
  preferences…”; “Considering portion comfort and protein needs…”; “Balancing
  nourishment and meal satisfaction…”; “Checking ingredients and substitutions…”;
  “Finalizing your meal options…”.

### Create a Dish and safety controls

- “Couldn't create a fully safe version”.
- `We couldn't make a ${allergenLabel}-free version of ${dish} that passed your allergy protection${retried}. Your protection is still fully active. Try a different dish, or use your Safety PIN to make the original.`
  Its existing “this dish”, “your allergen”, “ and ” and “ (we tried twice)”
  fragments are unchanged too.
- “No options fit your current plan”.
- “Your health protocol eliminated all generated options. Try a lower-carb dish,
  or adjust your glucose settings.”
- “Try a different ingredient”; “Choose something without starches like meat,
  fish, or veggies.”
- “Meal Safety”, “Medical Safety” and existing child safety/PIN/glucose/starch
  controls. Browser-visible “Allergy Protection”, “Override Allergy Protection”
  and their explanations remain protected; no checkbox, override or safety
  authorization behavior was changed.

### Grocery Coach and scan verdicts

- Quick starts “Something diabetic-friendly” and “Heart-healthy option”.
- Loading status “Checking your health profile…”.
- “Product decisions use sourced catalog evidence; verify important package
  details before choosing.”
- “product(s) excluded for a known conflict:”.
- “Profile-Matched Pick · check current label”, “Needs profile review”,
  “Profile-guided option · product rule not cleared”, “Check Current Label”.
- “Catalog allergen declarations:”.
- “Adding to your list does not resolve the product or current-label checks above.”
- “No common brands flagged for your protocol — the recommendations above are
  your best picks.”
- “Health Protocol Notice”, its returned warning, profile badges, product grades,
  verification messages and current-label/evidence decisions.
- Scan verdict captions “Chef says: Go for it!”, “Chef says: Maybe think twice”,
  “Chef says: Just a heads up…”.

These items need separately approved wording or evidence-owner review before
claiming those clinical/evidence flows are fully Spanish.

Generated recipe names, ingredients, instructions, cooking times, serving-size
prose, preparation choices, brand/product evidence, server/provider messages,
saved history, user text, household suggestion data and technical unit values
remain authored data. This task does not promise that those values will be
Spanish or overwrite them to make the interface appear complete.

## Language detection, manual selector and persistence assessment

No language-detection, preference, authentication, request-language or persistence
implementation was changed.

- **Fresh-device detection:** the existing startup resolves Auto from
  `navigator.language`, including Spanish regional variants. Unsupported device
  languages fall back to English. Pure initialization tests passed before any
  account or storage hint.
- **Manual EN/ES:** `/language-preferences` already supports both and updates the
  visible UI immediately. Browser fixtures confirmed both directions.
- **Auto intent:** the saved value is `auto`, not its current resolved language.
  The source's device-language-change listener follows the device only when Auto
  is selected. Both the mocked selector tests and browser fixture preserved Auto.
- **Same-browser reload:** the non-sensitive local hint supplies startup language;
  authenticated account data becomes authoritative after refresh. The browser
  fixture restored Spanish on reload with no extra preference PATCH.
- **Save errors:** selection, interface and hint roll back. This passed both
  a mocked component test and the browser's missing-CSRF-fixture case.
- **Server persistence:** the existing authenticated preferences route validates
  the language and updates the authenticated user's database row; session refresh
  restores `preferredLanguage`. This is source evidence, not a real write test.
- **Real logout/login, separate browser sessions/devices and live AI responses:**
  not verified here. That requires approved account access and bounded writes
  under the existing separate verification task. Fixture reload is not proof of
  real server cross-session persistence.

## Release checks and remaining scope

`npm run check:release-types` **did not pass**: it reported 109 diagnostics but a
different fingerprint from the reviewed 109-diagnostic baseline. No diagnostics
were reported in this batch's then-changed owners; the pre-existing
`FlavorToggle` invalid `variant="ghost"` diagnostic was among the output before
that component's text-only localization. The baseline was not refreshed or
bypassed. The root mismatch remains unresolved and is not claimed as a clean
release check.

The preceding guard task's isolated full Phase 0 run recorded 94 failures and one
warning while the new guard passed. This task did not rerun that full legacy
suite or repair its findings; see `NEW_INTERFACE_TEXT_VERIFICATION.md`. Existing
gate definitions, clinical manifests, locale JSON files and baseline files are
unchanged.

Remaining Business/ProCare text, other creator-specific pages, full saved-product
and scan-analysis sheets, clinical/legal wording, generated-content language,
real account persistence, barcode entry reachability and the separate Coach
layout work are not authorized by this batch. **Nothing was published.**
