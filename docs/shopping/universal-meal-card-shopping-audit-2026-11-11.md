# Universal meal-card shopping integration — read-only audit

## Decision summary

**Architecture clarification:** the subsequent standardized-card verification
established that the existing `MealCardActions` should be the single action
integration point. Many creators currently bypass it. Reconnect their footers
rather than introducing another universal card. See
`standardized-meal-card-architecture-verification-2026-11-11.md`.

**Recommend one shared, ingredient-backed “Shopping” action for every eligible finalized recipe card, backed by one acknowledged, idempotent transfer operation.** Keep the existing shopping list. Do not create a second cart.

Start with Create a Dish and My Perfect Gatherings. Hide the new card action in meal builders initially, as requested, while preserving their day/selected-days shopping bars. Those bars must eventually use the same transfer identities so bulk and individual additions cannot double-count one another.

Replacing the primary Translate slot is practical, but removing recipe translation outright is not yet safe. Application navigation translation and translation of generated ingredient lists/instructions are separate implementations.

This report is based on source inspection and a pure ingredient-parser exercise. No app code, database records, shopping lists, clinical rules, native settings, workflows, environment settings, GitHub branches, or Production were changed. No PR or deployment was created.

## 1. What exists today

### User-visible gaps

- **Create a Dish:** no individual-card shopping action. A bottom `ShoppingAggregateBar` does exist, but only after generation in the current session and only for finalized visible results. Restoring a cached/saved recipe intentionally does not cold-mount that bar. This explains why a real card can be visible without an accessible shopping action; it is not a platform-wide absence of shopping code.
- **My Perfect Gatherings:** a bottom bar flattens ingredients from all current generated courses. There is no per-course shopping selection. It is also hidden on cold restoration. A user cannot use that bar to buy just one selected course.
- **Fridge Rescue:** no actual shopping action in the inspected result-card footer. A button has the misleading test ID `fridge-add-to-shopping`, but it is a `MacroBridgeButton` that logs nutrition, not ingredients.
- **Pediatric/My Perfect Beginning:** the inline `RecipeCard` exposes kitchen/translation and other recipe actions but no shopping transfer.
- **Saved/Favorites/shared cards:** the commonly used action component has sharing, translation and preparation, not shopping.

### Actual transport and storage

| Layer | Exact implementation | Current behavior |
|---|---|---|
| Recipe-page bulk bar | `client/src/components/ShoppingAggregateBar.tsx` | Maps flattened ingredients to `useShoppingListStore.getState().addItems(...)`, immediately shows success, then navigates to `/shopping-list-v2`. No meal-level receipt or awaitable save result. Suppressed in `/pro/` and `/care-team` contexts. |
| Builder bulk bar | `client/src/components/BuilderShoppingBar.tsx` | Resolves active/selected days and extra weeks, prepares ingredients, then uses the same store. Development uses recipe-aware preparation; the other branch uses `normalizeIngredients`. |
| Older board helper | `client/src/components/DayByDayMealBoard.tsx` → `client/src/lib/shoppingListApi.ts` | `addMealsToShopping` → `sendMealsToShopping` → `sendToShoppingList` → POST `/api/shopping-list`. Separate from the store-based bar. |
| Preview/commit UI | `client/src/components/ShoppingListPreviewModal.tsx` | POSTs `/api/shopping-list-v2/preview` and `/commit`; used by `BeachBodyMealBoard.tsx`. |
| Main store | `client/src/stores/shoppingListStore.ts` | Selects the Development store in Vite Development; otherwise uses the legacy persisted store. Legacy adds are optimistic, merge compatible units locally and synchronize separately. |
| Development store | `client/src/stores/developmentShoppingListStore.ts` | Account-scoped cache, serialized writes, metadata/product compatibility and some compatible-unit merging. Still exposes void `addItems`; save failures become `lastSyncError`, not an acknowledged result for the initiating card. |
| Existing list page | `client/src/pages/ShoppingListMasterView.tsx` | Reads/hydrates `useShoppingListStore`. Both `/shopping-list` and `/shopping-list-v2` route here through `GuardedShoppingList`. |
| General item API | `server/routes/shoppingList.ts`; additional POST in `server/routes.ts` | Authenticated item inserts and scoped reads; append is not a meal-level idempotent operation. More than one registration exists. |
| V2 API | `server/routes/shoppingListV2.ts` | Public structural preview, authenticated commit/read/edit/delete. Development and compiled Production take different commit branches. |
| Development persistence | `server/services/shopping-list/metadataPersistence.ts` | Transactional item POST and meal commit, metadata-aware grouping, recipe-source writes. |
| Item storage | `shared/schema.ts`: `shoppingListItems` / SQL `shopping_list_items` | User, name, text quantity/unit, category, scope, source builder, checked state, optional product key and ingredient metadata. |
| Source storage | `shared/schema.ts`: `shoppingListSources` / SQL `shopping_list_sources` | Per-item meal ID/name, generator, day/slot, contribution quantity/unit. No declared unique meal-transfer receipt or recipe-revision/serving contract. |

### Reusable data helpers

- `client/src/lib/shoppingIngredientTransfer.ts` re-exports `prepareShoppingRecipeIngredient` from `shared/shoppingRecipeIngredient.ts`.
- `shared/shoppingIngredientMetadata.ts` preserves original ingredient information, requirements, selected products and recipe contributions.
- `shared/developmentShoppingMerge.ts` provides metadata/product-aware grouping and merge behavior.
- `client/src/lib/shoppingListApi.ts` already accepts ingredient and meal arrays, but its existing contracts need correction before becoming the universal action.
- `server/services/shopping-list/builder-v2.ts::normalizeShopping` canonicalizes names and sums equal name/unit groups. It is not a complete safe-units or idempotency implementation.
- The existing stores already classify aisle/category and pantry status. Reuse them; do not duplicate classification inside every card.

There is no single universal meal-card shopping hook today.

## 2. Does aggregation actually work?

**Partly, and differently in different pathways.** It is incorrect to conclude that the bottom bar proves the entire transfer is reliable.

### Compatible ingredients

- The legacy client store normalizes ingredient names and supports conversions within known volume or weight units. Incompatible unit families stay separate. Unitless/count units generally merge only on exact unit equality.
- The Development store also checks ingredient/product compatibility and has a smaller explicit compatible-unit table.
- Server `normalizeShopping` groups canonical name plus lowercase unit; it does not convert cups to tablespoons or weights to volumes.
- Development server grouping uses exact unit equality in the inspected aggregation/commit paths. It does not provide the same cross-unit behavior as the client.
- Requirements, selected products and preparation distinctions cannot safely be replaced with a naive name-only merge.

### Quantity losses reproduced without database access

Create a Dish and Gatherings pre-parse quantity strings with `parseFloat`. The shared shopping bar also parses strings this way and defaults missing quantities to one.

Using the actual pure `prepareShoppingRecipeIngredient` helper:

| Original recipe amount | Current bar-style parsing | Existing shared helper |
|---|---:|---:|
| `1/2` cup | 1 cup | 0.5 cup |
| `1 1/2` cups | 1 cup | 1.5 cups |
| `½` cup | 1 cup after fallback | 0.5 cup |
| `2` cups | 2 cups | 2 cups |

Even the better shared helper currently defaults an unresolved amount to one. Reuse its parsing, but add an explicit unresolved result; do not copy its fallback into the new universal contract.

### Repeated adds and save confirmation

1. The aggregate bar has no transfer identity or in-flight add guard. Adding the same meal again adds quantities again.
2. Metadata contribution IDs are generated with time/randomness. Preserving contribution metadata is **not** equivalent to deduplicating a repeated user action.
3. The bar announces success before store synchronization finishes. In the legacy store, POST failures become an empty result and PATCH failures are swallowed. The Development queue records an error, but the bar does not await it.
4. The early Development `server/routes/shoppingList.ts` POST and the later `server/routes.ts` POST return different response shapes in their non-Development paths. The legacy store expects returned item identities, but the generic POST only includes inserted rows for metadata-bearing input. This is an additional identity/hydration risk; do not assume both registrations behave identically.
5. Development `/commit` has a meal-ID-based seen check inside a transaction. It does not model edited recipe revisions, changed servings, or a receipt shared with the aggregate bar, which does not use that endpoint.
6. The non-Development `/commit` branch references `buildShoppingListFromMeals` without an import/binding and marks it with a removed-helper comment/TypeScript suppression. It must not be adopted as the new canonical write path unchanged. This is a source-level finding, not a live Production reproduction.

### Manual items, saved recipes and edits

- Current append/store operations can add to an existing list, but repeated adds can increase its totals.
- `replace_scope` deletes rows in a scope. It must not be the implementation of a single-card add.
- `sendMealsToShopping` accepts a `strategy` option but does not forward it; a declared option is not proof of actual replacement behavior.
- Canonical recipe identity is not consistently passed into shared actions. For example, the shared `MealCard` action payload is built from displayed content and does not carry the full recipe identity/yield needed for reliable shopping.
- A saved meal, its open result card and a gathering bulk selection can refer to the same food through different IDs. That relationship must be carried explicitly, not inferred from its translated name.
- Current APIs do not provide a single safe “replace only this recipe’s prior contribution” operation. Edited dishes must not silently leave both old and new ingredients in the list.

## 3. Coverage matrix

“Bar only” means a page-level bulk transfer exists, not that each card can shop independently. This is a source inventory; it is not a claim that every route was exercised in a signed-in browser.

| Surface | Implementation | Existing shopping | Recommendation |
|---|---|---|---|
| Create a Dish | `pages/lifestyle/CreateDishPage.tsx`, inline result cards | Conditional current-session bar only | First integration: selected finalized card, including eligible restored recipes. Never shop unverified One-Touch ideas. |
| My Perfect Gatherings | `pages/lifestyle/GatheringsPage.tsx`, inline course cards | Conditional whole-course-array bar only | First integration: one current course; keep bulk workflow through the same selection ledger. |
| Craving Creator | `pages/craving-creator.tsx` | Aggregate bar | Add per-finalized-result action; preserve food identity and servings. |
| Dessert Creator | `pages/CravingDessertCreator.tsx` | Aggregate bar | Transfer selected whole-recipe/batch yield, not a macro-log serving. |
| Sushi Creator | `pages/SushiCreator.tsx` | Aggregate bar | Per-recipe action; preserve pieces/rolls/recipe-yield semantics. |
| Beverage Creator | `pages/BeverageCreator.tsx` | Aggregate bar | Per-finalized-drink action using actual ingredients/yield. |
| Athlete Beverage Creator | `pages/AthleteBeverageCreator.tsx` | Aggregate bar | Same operation; no changes to performance guidance. |
| Chef’s Kitchen | `pages/lifestyle/ChefsKitchenPage.tsx` | Aggregate bar | Shop the currently prepared recipe/handoff, not all preview ideas. Retain original recipe identity. |
| Fridge Rescue | `pages/fridge-rescue.tsx` | No transfer in inspected card actions | Add Shopping; correct misleading shopping test ID during implementation. Do not infer pantry ownership merely because the dish came from this creator. |
| My Perfect Beginning / pediatric creator | `pages/lifestyle/MyPerfectBeginningCreateMealPage.tsx::RecipeCard` | None in inspected card actions | Child-recipe adapter; preserve `recipeName`, ingredient quantity/unit, serving guidance, texture/choking and allergen information. Do not infer adult yields. |
| General/weekly board | `pages/WeeklyMealBoard.tsx` | Builder-level shopping | Hide new per-card action initially; preserve current-day/selected-days bar and stable day/slot identities. |
| General Nutrition professional builder | `pages/pro/GeneralNutritionBuilder.tsx` | Builder bar | Hide per-card action. Professional actor is not automatically the client’s shopping-list owner. |
| Performance/Competition builder | `pages/pro/PerformanceCompetitionBuilder.tsx` | Builder bar | Same visibility and ownership rule; preserve athlete serving/portion state. |
| Metabolic/GLP-1 builder | `pages/physician/GLP1MealBuilder.tsx` | Builder bar | Hide card action initially; retain clinical and portion authority. |
| Diabetes builder | `pages/physician/DiabeticMenuBuilder.tsx` | Builder bar | Same; no glucose or carbohydrate recalculation from shopping. |
| Anti-Inflammatory builder | `pages/physician/AntiInflammatoryMenuBuilder.tsx` | Builder bar | Same; retain validated ingredient qualifiers. |
| Beach Body board | `pages/BeachBodyMealBoard.tsx` | Bar plus preview/commit modal path | Keep builder visibility policy; repair/unify commit behavior before reusing it. |
| Older day-by-day board | `components/DayByDayMealBoard.tsx` | `addMealsToShopping` helper | Move transfer behind the shared service, not a second button implementation. |
| Shared rendered meal cards | `components/MealCard.tsx`, `components/MealCardActions.tsx` | No universal shopping action | Shared integration point, but pass original recipe ID/revision/yield and explicit shopping visibility from parent. |
| Saved Meals / Favorites | `pages/SavedMeals.tsx`, `components/SavedMealRow.tsx` | No universal per-saved-recipe transfer | Supply canonical saved/origin identity, original ingredients and yield; survive refresh/reopen without duplicate purchase contributions. |
| Grocery Coach saved cards | Existing Saved Meals/shared-card path | Coach already has a separate Add All pathway | Reuse the selection identity across Coach and saved-card shopping. Preserve any chosen product and requirements. |
| Retired Studio-generated recipe path | `components/meal/GeneratedMealCard.tsx`, `components/studio-wizard/StudioWizard.tsx` | Follow-up graph found only retired Studio consumers, not application-entry reachability | Do not count this as active customer coverage or a required current migration. |
| Unused full-builder card path | `components/MealCardFull.tsx` via `components/BuilderDayBoard.tsx` | Contains a removed-shopping stub; parent has no discovered importers and neither is application-entry reachable | Do not revive this path merely to implement Shopping. Active builders use `components/MealCard.tsx`. |
| Getaway / Away From Home | `pages/lifestyle/MyPerfectGetaway.tsx`, `components/away-from-home/GetawayVenueMeals.tsx`, `AwayFromHomeMealCard.tsx` | Venue/menu recommendations and macro/plan actions, not verified recipe shopping | No fabricated quantities from restaurant descriptions. Offer unavailable explanation or explicit route to generate a full governed recipe. |
| My Perfect Menu | `pages/MyPerfectMenu.tsx` | Concepts and generation/board handoff | Do not shop concept ingredients; enable only after a complete finalized recipe exists. Keep builder placement separate. |
| Pairings | `components/pairings/PairingResultCard.tsx`, pairing pages | Guidance/alternatives, not full quantified recipes | Not an eligible ingredient-backed recipe merely because it looks like a card. Keep existing Pairing release gates unchanged. |
| Companion/pet recipe generator | `pages/companion/CompanionMealGenerator.tsx` | Ingredients rendered; cart icon is not proof of a transfer | Include only finalized quantified recipes through a distinct pet-subject adapter; never reuse human clinical approval assumptions. |
| Templates, picker concepts and summary tiles | `TemplateMealCard.tsx`, `components/ui/meal-card.tsx`, `components/meal-cards/MealCard.tsx`, picker/One-Touch concept cards | Optional callback declarations and/or no ingredients | No active action until hydrated/finalized with real ingredient quantities. A declared `onSendToShoppingList` prop is not working integration. |
| Other legacy footer/card helpers | `MealCardDynamic.tsx`, `WeeklyMealCard.tsx`, `UniversalMealCardFooter.tsx`, `MealCardFooter.tsx`, `meal-calendar/MealCardButtons.tsx` | Scattered callbacks/actions; several have no discovered active import consumers | Do not count unused helpers as customer coverage. Consolidate only where an active caller is established; keep incomplete calendar cards unavailable. |
| Public/guest recipe views | Public shared pages or guest previews, where a real finalized recipe is exposed | No authenticated-list authority implied | Existing sign-in/entitlement flow must govern writes. Do not create a guest list or authentication bypass. |

## 4. Proposed reusable design

### A. A pure canonical recipe adapter

Proposed file: `shared/mealShoppingSelection.ts`, with thin host adapters where recipe contracts differ.

Input should carry:

- Stable recipe/origin identity and selection-instance identity.
- Original canonical ingredients, including raw quantity/unit and preparation text.
- Recipe revision or deterministic ingredient snapshot hash.
- Explicit ingredient quantity basis: entire recipe or per serving.
- Original recipe yield and selected shopping servings/batches.
- Source feature, subject context and destination-list context.
- Existing ingredient requirements and selected-product metadata, where present.
- Finalization/eligibility state.

Output: a validated shopping selection or structured reasons it cannot yet be transferred.

**Scale once:** whole-recipe quantities × selected servings / recipe yield, or per-serving quantities × selected servings. Do not use nutrition-per-serving as evidence that ingredients are per serving. Do not substitute a MacroBridge `servings: 1` value for shopping yield.

Fractions and string ingredients must be parsed from their original text before display conversion. No quantity may come from calorie or macro estimates. Preserve unknown/to-taste ingredients with their original text and an explicit review state; if the current list cannot represent them without pretending they equal one, block the transfer with a clear review message rather than omit them.

### B. One awaitable transfer service/hook

Proposed files: `client/src/lib/mealShoppingApi.ts`, `client/src/hooks/useMealShopping.ts`.

- Both card and bulk actions call the same operation.
- Distinguish pending, confirmed-added, already-added, review-required, unauthorized and failed results.
- Do not announce success or navigate before a confirmed server acknowledgement.
- Capture account identity and reject late responses after account switching.
- On success, reconcile/hydrate the existing store rather than optimistically adding the same ingredients a second time.
- Cards remain on the current page so users can add multiple courses. Provide a separate View List link.
- Preserve existing auth, CSRF/native transport, entitlement and actor/subject controls. No new clinical engine or extra AI calls.

### C. The existing shared action component, not another card system

The single integration point should be the existing
`client/src/components/MealCardActions.tsx`, after active inline creator footers
are reconnected to it. A small Shopping button may be a leaf control, not a
parallel card/footer system.

- Compact visible label “Shopping”; accessible name “Add [dish] to shopping list”.
- Pending disabled state; explicit Added/Already added result; retry on genuine failure.
- Disabled/unavailable reason for incomplete cards or unresolved quantities.
- Host capability prop such as `showShopping`, explicitly false in builders and unauthorized professional contexts.
- No recipe mutation, regeneration, macro logging or automatic product lookup.

Integrate into existing inline pages and active shared footers. Rebuilding every card into a new universal renderer is unnecessary.

### D. One transactional server operation with durable receipts

A proposed endpoint such as POST `/api/shopping-list-v2/selections` can be added to the existing router. It should accept one or multiple canonical selections and return per-selection results plus list reconciliation information.

Requirements:

1. Resolve the destination owner from authenticated server authority; never trust a submitted user ID.
2. Apply the existing intended shopping access policy in the production-effective handler. Resolve duplicate registrations deliberately rather than relying on a later guarded route.
3. Validate the complete request before writes. Never quietly drop bad ingredients.
4. Normalize only compatible names, requirements and units; preserve preparation notes and product identity conflicts.
5. Commit ingredient contributions, list updates and transfer receipts atomically.
6. Enforce uniqueness/idempotency in the database, including concurrent requests and a lost HTTP acknowledgement.
7. Return confirmed outcomes; a failed transaction leaves no partial meal in the list.

**Schema recommendation:** reuse `shoppingListItems` and `shoppingListSources`, but add durable transfer receipts and contribution linkage, probably through one small additive migration. A receipt table with account/list-cycle/selection identity, request identity and snapshot/serving information is preferable to pretending the existing source table already supplies this contract. Finalize the exact schema before implementation; do not run a migration as part of this audit.

Client-only flags or disabling a button do not prevent cross-device repeats or bulk/card double-counting.

## 5. Gatherings and edited-meal semantics

Recommended behavior:

1. Every generated course gets stable selection identity, retained through save/restore and explicit replacement.
2. Individual Shopping adds just that course’s current ingredient contribution.
3. Bulk Add Menu uses the exact same course identities, never a flattened anonymous ingredient array.
4. Course added individually, then included in Add Menu: only missing course contributions are added.
5. Exact same selection/snapshot/servings added again: acknowledged no-op, not doubled food.
6. Recipe edited/replaced or servings changed after shopping: show **Update shopping ingredients** and require a user action. Replace only that selection’s prior contribution with the current one; do not silently synchronize a regeneration into an active grocery list.
7. Removing a recipe from the displayed menu does not automatically delete groceries. Explain/manage an existing shopping contribution explicitly.
8. Intentional second batch: explicit Add another batch action creates a distinct purchase contribution.

Do not conflate transport request IDs with recipe-selection identities. A new HTTP request ID cannot make an accidental repeat look like a second intentional purchase.

Existing manual/legacy quantities are preserved as an untouched baseline. New transfer contributions must be separately attributable; updating one course must not remove manually added food, another course’s quantities, checked state or selected products. Do not retroactively guess which recipe owns old unattributed rows.

For a new shopping trip after clearing the list, use a new list cycle or equivalent receipt lifecycle. Otherwise durable “already added” receipts could prevent legitimate re-shopping forever.

## 6. Translation and mobile layout

### Translation is not yet demonstrably redundant

- `client/src/components/TranslateToggle.tsx` translates generated content through a separate manual path and detects the device language.
- `client/src/hooks/useTranslatedMeal.ts` uses app language when enabled. The main card enables it for a valid saved-meal identity; saved rows enable it when expanded. It falls back to original content on error.
- Many inline creator cards do not use that saved-meal hook. Global UI translation does not prove existing generated recipe text is translated.
- Pediatric translation currently updates recipe title/description/instructions in its callback, not the returned ingredient names. This is an existing parity gap to account for.
- Some translation callbacks update displayed recipe state. Shopping must use canonical original ingredients, not a translated name as ingredient identity.

**Recommendation:** reclaim the prominent Translate slot for Shopping, but retain translation in an existing More menu or a secondary action until name, ingredients, preparation notes and instructions have equivalent coverage. Do not remove translation solely because the navigation is multilingual.

### Least disruptive layout

- Where the layout is Macros full width, then Plan + Translate: keep Macros as-is and replace Translate’s primary slot with Shopping. No need to shrink macro text.
- Where `MealCardActions` has Share + Translate: use Share + Shopping and retain translation secondarily.
- Where space genuinely requires it, Macros + Shopping can share a row, but retain at least 44px touch targets, wrapping/localized labels and explicit accessible names.
- Pediatric Kitchen + Translate can become Kitchen + Shopping with translation retained secondarily.
- No forced navigation after each card add. This is essential for choosing several Gathering dishes.

## 7. Phased implementation proposal

### Phase 1 — Shared contract and trustworthy transfer

Build the adapter, acknowledged API/hook, transaction/receipt contract and tests. Establish compiled Production parity without activating unrelated Development-only Smart Grocery recommendations/product picker behavior.

Resolve required prerequisites before calling this release-safe: unresolved quantities, production commit/helper defect if that path is reused, effective auth/access registration, response identities, atomicity and idempotency.

### Phase 2 — Create a Dish and My Perfect Gatherings

Add the shared button; retain original identities/yields through restoration; connect both bulk bars to the same selection operation. Demonstrate selected course, changed course, changed yield, repeated clicks and mixed card/bulk behavior.

### Phase 3 — Shared saved cards and remaining human creators

Integrate `MealCardActions`, shared `MealCard`, `SavedMealRow`, Craving, Dessert, Sushi, Beverages, Chef’s Kitchen, Fridge Rescue and Pediatric cards with host-specific adapters. Preserve Grocery Coach selected-product transfers and existing safety/serving contracts.

### Phase 4 — Builder parity and less common eligible hosts

Keep per-card controls hidden in builders initially; unify their bulk transfer internally. Integrate authorized Studio/companion finalized recipes only with explicit subject/destination handling. Leave Getaway estimates, Pairing suggestions, templates and concept-only cards unavailable until genuine quantified recipes exist.

### Phase 5 — Translation parity and optional cleanup

Prove complete automatic recipe-content translation before removing the last translation fallback. Clean up unused card implementations separately; do not make a broad renderer rewrite a prerequisite.

## 8. Verification plan

No new full browser run was performed for this read-only audit.

### Unit tests

- Canonical adapters for structured/string ingredients, `quantity`/`qty`/`amount`, fractions, mixed fractions, Unicode fractions, zero/negative/nonfinite values, missing units and to-taste lines.
- Explicit recipe-total versus per-serving inputs; selected yield changes; no double scaling.
- Compatible volume/weight conversions and incompatible count/volume/weight separation.
- Preserve dry/cooked distinctions where conversion is not established, allergy/diet qualifiers, preparation text and selected-product conflicts.
- Stable identity across translation, saved-card restoration and creator-to-Favorites handoff.
- Eligibility distinguishes recipe cards from concepts, restaurant estimates and pediatric guidance-only content.

### API/integration tests

- Correct auth/access/owner on every effective handler in Development and compiled Production.
- Duplicate request, duplicate selection, simultaneous card/bulk adds, failed transaction and lost-response retry.
- Recipe revision/serving update affects only its prior contribution.
- Existing manual items, another course, checked items and selected products survive.
- List clear/new trip allows legitimate re-add.
- Account switch rejects late writes/responses and never adopts an unowned cache.
- Metadata-capable transfers do not rely on an older API silently preserving fields it does not understand.

### UI/regression tests

- Create a Dish: fresh and restored finalized card; correct selected recipe only.
- Gatherings: course A alone, then Add Menu; dessert replacement, updated contribution, explicit second batch.
- Saved/Favorites and Grocery Coach: same origin identity and chosen product survive.
- Pediatric: preparation/safety text unchanged; no adult yield assumptions.
- Builders: existing bulk bars retained and card shopping hidden as requested.
- Translation: app-language/device-language differences; ingredient/instruction parity.
- Mobile narrow widths, long dish names, loading/failure feedback and no forced navigation.

After implementation, a single focused authenticated browser pass is justified for the changed shopping-write journey. Development and Production share Neon: do not test live persistence without an authorized isolated identity and approved synthetic-record cleanup. Mocked tests and read-only UI checks do not establish real account persistence.

## 9. Scope estimate and release triage

This is a **medium-to-large cross-cutting feature**, not a one-button patch. Most difficulty is ingredient and contribution integrity, not appearance.

- Initial shared infrastructure + Create a Dish/Gatherings: roughly **10–16 application/data files plus 6–10 focused test files**, depending on schema choice and translation fallback placement.
- Full active eligible coverage: roughly **20–35 application/data files plus 10–15 test files**, with localization/accessibility updates and probably **one controlled additive migration**.
- The existing shopping list and tables remain the foundation. API enhancement is required for the recommended acknowledged/idempotent behavior; a new shopping system, new generation engine, or extra AI calls are not required.

**Required before Production:** reliable quantities/yields; explicit unresolved handling; truthful save confirmation; persistent repeat protection shared by card/bulk paths; manual-item preservation; owner/access/CSRF boundaries; compiled-runtime parity; retention of translation functionality.

**Valuable hardening:** richer per-course contribution management, clearer “already added / update / another batch” history, and improved recovery displays for old optimistic local entries.

**Backlog:** consolidating unused renderers, broad card redesign, completing automatic recipe-translation parity, and turning incomplete restaurant/menu suggestions into governed cookable recipes.

## Recommended approval boundary

Approve a Development-only implementation of Phases 1–2 first, with explicit approval for the additive persistence design and isolated write testing. Review the demonstrated result before broad rollout. This audit is not permission to implement, migrate, publish, create a PR, change clinical rules, or activate unrelated gated features.
