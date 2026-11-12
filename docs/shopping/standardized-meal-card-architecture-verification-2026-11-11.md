# Standardized meal-card architecture verification

## Definitive answer

**The intended one-source-of-truth architecture is only partially implemented.**

- The primary active shared meal-card renderer is **`client/src/components/MealCard.tsx::MealCard`**. It is heavily used by meal builders.
- Its shared secondary-action component is **`client/src/components/MealCardActions.tsx::MealCardActions`**.
- **`MealCardActions` does not currently own Add to Plan or Add to Macros.** Those are rendered separately by the parent card or feature.
- **Create a Dish, Gatherings, Pediatrics and the other active creators do not render that shared action component.** Their action markup is implemented locally.
- Several files with “universal” or similar names are unused, only referenced by another unused component, or connected to retired screens. Their names do not establish authority.

Therefore adding Shopping in `MealCardActions` would **not** automatically update the creator features that prompted this investigation.

**Recommended single integration point:** extend the existing `MealCardActions`, reconnect active eligible card footers to it, and retain the existing renderer and feature-specific bodies. **Do not create another universal card or parallel action system.** Shopping implementation remains unapproved.

## Verification method and boundaries

Read-only source investigation in Development:

1. Searched imports, render sites and action ownership.
2. Built an in-memory TypeScript-aware import/dynamic-import and JSX-consumer graph from `client/src/main.tsx`.
3. Distinguished normal route consumers, a WebDriver-only test harness, and components not reachable from the application entry graph.
4. Inspected shared and inline action payloads, translation overrides and existing macro/plan behavior.

“Active” below means an application-connected implementation, subject to its route/feature/access guards. Import reachability is not proof that every guarded feature is enabled for every account, nor is this a signed-in browser verification.

No application code, shopping records, database schema, workflows, environment settings, native behavior, GitHub branches or Production were modified. Only investigation documents and project-intent notes were updated.

## 1. Current component hierarchy and ownership

```text
Seven active builder pages
  └─ components/MealCard.tsx
       ├─ card appearance, ingredients, instructions, nutrition, refinement
       ├─ biometrics/MacroBridgeButton.tsx           [parent-owned]
       ├─ AddToMealPlanButton.tsx                   [parent-owned]
       └─ MealCardActions.tsx
            ├─ ShareRecipeButton.tsx
            ├─ TranslateToggle.tsx
            └─ Prepare with Chef control / handoff

pages/SavedMeals.tsx
  └─ SavedMealRow.tsx
       ├─ separate saved-card appearance/details
       ├─ AddToMealPlanButton.tsx                   [parent-owned]
       ├─ macro button → SavedMeals handler        [parent-owned]
       ├─ remove-from-Favorites button             [parent-owned]
       └─ MealCardActions.tsx                      [shared secondary actions]

Create a Dish / Gatherings / other creators
  └─ local result-card JSX
       ├─ local macro control / quick-view callback
       ├─ AddToMealPlanButton.tsx                   [shared primitive]
       ├─ TranslateToggle.tsx                      [shared primitive]
       └─ local preparation/share/save/remove controls

My Perfect Beginning Create Meal page
  └─ local RecipeCard function
       └─ child-specific recipe body and local action footer
```

### Authoritative components: precise answers

| Responsibility | Current owner | Important limit |
|---|---|---|
| Main reusable builder-card appearance | `components/MealCard.tsx` | Not the renderer used by all creators or Saved Meals. |
| Shared secondary actions | `components/MealCardActions.tsx` | Share, manual translation, gated Chef preparation; not the complete footer. |
| Plan action/picker primitive | `components/AddToMealPlanButton.tsx` | Shared by many implementations, but each host supplies its meal payload. |
| Shared macro bridge primitive | `components/biometrics/MacroBridgeButton.tsx` | Main shared card uses it; several creators and Saved Meals use other existing callbacks instead. |
| Saved/Favorites card appearance | `components/SavedMealRow.tsx` | Different renderer, sharing only the secondary actions. |
| Template-hub family | `features/meals/MealHubFactory.tsx`, `components/RecipeQuickActions.tsx` | A real reusable family/factory, but not the universal renderer/action owner. |
| Pediatric recipe card | Local `RecipeCard` in `pages/lifestyle/MyPerfectBeginningCreateMealPage.tsx` | Genuine child-specific implementation, not a wrapper around the main `MealCard`. |
| Venue recommendation family | `components/away-from-home/AwayFromHomeMealCard.tsx` | Separate recommendation renderer; `GetawayVenueMeals` is a wrapper around this family. |

Shared `Card`, `GlassButton`, ingredient/image components, or copied “standardized 3-row layout” comments do **not** imply that features inherit one shared footer.

## 2. Complete direct-consumer inventory of the standardized hierarchy

### A. Main `MealCard`: seven normal application consumers

| Consumer | Relationship | Inherits changes made inside `MealCardActions`? |
|---|---|---|
| `pages/WeeklyMealBoard.tsx` | Direct shared-card rendering for General/weekly board slots | Yes |
| `pages/pro/GeneralNutritionBuilder.tsx` | Direct shared-card rendering | Yes |
| `pages/pro/PerformanceCompetitionBuilder.tsx` | Direct shared-card rendering for performance/competition views | Yes |
| `pages/physician/GLP1MealBuilder.tsx` | Direct shared-card rendering for metabolic/GLP-1 builder | Yes |
| `pages/physician/DiabeticMenuBuilder.tsx` | Direct shared-card rendering | Yes |
| `pages/physician/AntiInflammatoryMenuBuilder.tsx` | Direct shared-card rendering | Yes |
| `pages/BeachBodyMealBoard.tsx` | Direct shared-card rendering in multiple board views | Yes |

These seven page modules contain **22 shared-card JSX render sites** in the inspected source. This is a static render-site count, not a count of meals or users.

### B. Shared actions through a different card renderer

| Consumer | Relationship | Inheritance |
|---|---|---|
| `components/SavedMealRow.tsx` | Directly renders `MealCardActions`; is not a wrapper around the main `MealCard` | Inherits shared secondary-action changes |
| `pages/SavedMeals.tsx` | Renders `SavedMealRow` in its grouped/list paths | Saved Meals/Favorites content inherits through the row |
| Grocery Coach recipes opened through Saved Meals | Same saved-row path | Inherits there; this does not automatically change Coach’s own recommendation or Add All interface |

**These are the only two direct JSX consumers of `MealCardActions`: `MealCard` and `SavedMealRow`.**

### C. Real wrappers, but only test-harness consumers

| Component | Actual relationship | Availability |
|---|---|---|
| `components/CravingPicker.tsx` | Wraps/renders main `MealCard` | Only discovered consumer is `pages/e2e/MealPickerRetryHarness.tsx` |
| `components/FixedMenuPicker.tsx` | Wraps/renders main `MealCard` | Same harness |
| `pages/e2e/MealPickerRetryHarness.tsx` | Hosts both pickers | `App.tsx` admits it only for `navigator.webdriver` and `/__e2e/meal-picker-retry` |

These wrappers would inherit shared changes in that harness. **They are not evidence that the live Craving Creator or live menu flows use the shared card.** The live Craving Creator has its own footer.

## 3. Active implementations that bypass the shared card/actions

| Active feature/family | Source | Classification and current action owner | Automatic inheritance today |
|---|---|---|---|
| Create a Dish | `pages/lifestyle/CreateDishPage.tsx` | Local result-card JSX; local macro quick-view button, shared Plan primitive, directly mounted Translate and other controls | No |
| My Perfect Gatherings | `pages/lifestyle/GatheringsPage.tsx` | Local per-course result-card JSX and footer; course-specific state and callbacks | No |
| Craving Creator | `pages/craving-creator.tsx` | Local finalized-result cards and footer | No |
| Dessert Creator | `pages/CravingDessertCreator.tsx` | Local result cards and footer | No |
| Sushi Creator | `pages/SushiCreator.tsx` | Local result cards and footer | No |
| Beverage Creator | `pages/BeverageCreator.tsx` | Local result cards and footer | No |
| Athlete Beverage Creator | `pages/AthleteBeverageCreator.tsx` | Local result cards and footer | No |
| Fridge Rescue | `pages/fridge-rescue.tsx` | Local cards; MacroBridge control and direct Plan/Translate controls | No |
| Chef’s Kitchen | `pages/lifestyle/ChefsKitchenPage.tsx` | Local prepared-recipe footer and kitchen state | No |
| Pediatrics / My Perfect Beginning | `pages/lifestyle/MyPerfectBeginningCreateMealPage.tsx::RecipeCard` | Local child-recipe implementation; direct Kitchen and Translate controls | No |
| Breakfast/Lunch/Dinner/Snacks template hubs | `features/meals/MealHubFactory.tsx` → `components/RecipeQuickActions.tsx` | Genuine shared factory family, separate from main card/actions; edited/scaled ingredients live in the factory | No |
| My Perfect Getaway | `pages/lifestyle/MyPerfectGetaway.tsx` → `GetawayVenueMeals.tsx` → `AwayFromHomeMealCard.tsx` | Wrapper around the venue-card family, not around main `MealCard` | No |
| Buffet / Fast Food guide | `pages/MyPerfectBuffetPage.tsx`, `pages/FastFoodGuidePage.tsx` → `AwayFromHomeMealCard.tsx` | Other consumers of the same venue-card family | No |
| Social meal / restaurant surfaces | `pages/SocialFindMeals.tsx`, `pages/SocialRestaurantGuide.tsx` | Own rendering and Plan controls/recommendation flows | No |
| Companion/pet recipe generator | `pages/companion/CompanionMealGenerator.tsx` | Local pet-recipe presentation, distinct subject domain | No |
| Favorites picker modal | `components/FavoritesPickerModal.tsx` | Separate selection interface; its `SavedMealRow` type import is from a hook, not the shared saved-card component | No |
| My Perfect Menu / One-Touch concept cards | `pages/MyPerfectMenu.tsx`, One-Touch concept components | Concepts/handoff rather than universal finalized recipe card | No; Shopping must not be enabled on unfinalized concepts |
| Pairing guidance | `components/pairings/PairingResultCard.tsx`, pairing and Wine List Helper consumers | Separate guidance/alternatives card with direct Translate | No; not automatically a quantified shopping recipe |
| Public shared-meal page | `pages/SharedMealPage.tsx` | Local share-preview data model with name/image/macros, not a complete ingredient recipe | No; must not invent missing ingredients/quantities |

Not every separate card should become an immediately shoppable card. Venue estimates, shared previews, concepts and pairing suggestions remain unavailable until real finalized ingredients and quantities exist. Product and release gates remain unchanged.

Builder-level `GlobalMealActionBar` and `SnackCreatorModal` are separate toolbar/modal implementations. Their use in a builder does not make them consumers of `MealCardActions`, and changing the card footer does not automatically change their controls.

## 4. Obsolete, unused or retired paths — not active coverage

| Component/path | Verified relationship | Conclusion |
|---|---|---|
| `components/UniversalMealCardFooter.tsx` | No discovered importers/render consumers; not root-reachable | Its name does not make it authoritative. |
| `components/MealCardFooter.tsx` | No discovered importers/render consumers | Not the current shared footer. |
| `components/WeeklyMealCard.tsx` | No discovered importers/render consumers | Do not confuse it with main `MealCard` used on `WeeklyMealBoard`. |
| `components/MealCardDynamic.tsx` | No discovered importers/render consumers | Optional callbacks here do not provide live coverage. |
| `components/TemplateMealCard.tsx` | No discovered importers/render consumers | Not the active template-hub implementation. |
| `components/ui/meal-card.tsx` | No discovered importers/render consumers | A shopping callback prop here does not wire the current app. |
| `components/meal-cards/MealCard.tsx` | No discovered importers/render consumers | Different from `components/MealCard.tsx`. |
| `components/meal-calendar/MealCardButtons.tsx` | Rendered only by that unused `meal-cards/MealCard` | Not active calendar-action inheritance. |
| `components/MealCardFull.tsx` | Rendered by `components/BuilderDayBoard.tsx`; that parent has no discovered importers | A real wrapper relationship, but neither is root-reachable. |
| `components/meal/GeneratedMealCard.tsx` | Rendered only by `components/studio-wizard/StudioWizard.tsx` | Not an active general creator card. |
| `components/studio-wizard/StudioWizard.tsx` | Consumed by `legacy/studio-retired/RETIRED_DessertStudio.tsx` and `RETIRED_FridgeRescueStudio.tsx` | Retired branch, not application-entry reachable. |

**Correction to the earlier shopping audit:** its broad source inventory included Studio-generated and full-builder card implementations before their active reachability was established. They should not be counted as current customer-facing migration targets. The earlier audit has been clarified accordingly.

## 5. Exact action-inheritance answers

### If Shopping markup is added once to `MealCardActions`

It appears through the main shared card on all seven builder pages, and through `SavedMealRow` in Saved Meals/Favorites. It also appears in the gated picker test harness.

It does **not** appear on Create a Dish, Gatherings, Pediatrics, Craving, Dessert, Sushi, either Beverage Creator, Fridge Rescue, Chef’s Kitchen, template hubs or venue cards without reconnecting their footers.

If the new Shopping action is correctly hidden in builders as requested, **the current shared consumer graph would initially expose it mainly in Saved Meals/Favorites—not the creators that need it.** This is why fixing inheritance is a prerequisite.

Markup inheritance is not complete shopping functionality. The current main-card payload omits identity/yield information required for a correct transfer.

### If the primary Translate button is hidden

- Removing or moving its primary render inside `MealCardActions` affects that component’s direct/indirect consumers only.
- Merely changing `showTranslate`’s default to `false` is **not enough**: `SavedMealRow` explicitly passes `showTranslate={true}`.
- Main `MealCard` does not pass that override.
- Inline creators directly render their own `TranslateToggle` and will remain unchanged.
- Venue cards use their own translation UI and remain unchanged.
- Existing automatic saved-meal translation is a separate hook; hiding the manual control does not itself delete that hook.

Recommended later contract: preserve translation capability/callbacks and centrally move it to a secondary placement. Do not confuse “hide primary Translate” with “delete translation.”

### Add to Plan / Add to Macros ownership

These do not move automatically when `MealCardActions` changes:

- Main `MealCard` renders `MacroBridgeButton` and `AddToMealPlanButton` outside `MealCardActions`.
- Saved rows render their own macro button and Plan button. The macro callback is implemented in `pages/SavedMeals.tsx::handleAddToMacros`, builds the existing quick-view payload and opens Biometrics.
- Create a Dish and Gatherings render local macro buttons that compute existing per-serving nutrition, set quick-view state and navigate to Biometrics; Plan is separately rendered beside Translate.
- Other creators likewise compose their actions locally.
- Pediatric cards have child-specific actions. Preserving existing Plan/Macros means retaining them where they currently exist, not automatically adding adult macro-logging controls to child cards.

## 6. Why the architecture diverges and what should remain different

**Proven structural reason:** standardized visual patterns and shared button primitives were reused, but the complete footer was not consistently centralized. The current shared action component itself covers only part of the footer.

**Not proven:** who introduced each divergence, or a historical decision that every page deliberately rejected a universal card. This source audit does not invent those motives.

Some bodies legitimately differ:

- Pediatric texture/choking guidance, age suitability and child safety.
- Gathering courses, menu identity and independent course state.
- Clinical nutrition/protocol history, physician/client context and refinement.
- Kitchen preparation mode and step tracking.
- Venue evidence and uncertain ingredient/nutrition information.
- Template editing and explicit ingredient scaling.

Those differences justify configurable bodies/wrappers and capabilities. They do **not** require each eligible recipe to own a separate Shopping/Plan/Macros/Translate footer.

Reconnecting an entire creator to the builder-oriented `MealCard` immediately could alter its serving display, clinical/pediatric content, save/delete behavior, translation state, Chef handoff, refinement, images or navigation. **The minimum restoration is shared action composition, not a wholesale renderer replacement.**

## 7. Minimum restoration of one-source-of-truth actions

### Step A — Establish the existing shared component’s responsibility

Promote **the existing `MealCardActions`** from secondary actions to the authoritative eligible-recipe footer. Keep its identity and reuse current primitives.

Allow the parent to supply existing macro/plan callbacks or controls, not a new nutrition implementation. Let one action composition own order, visibility, pending states, accessible labels and primary/secondary placement.

Preserve all current host conditions: macro completeness, board/date rules, physician/client ownership, Chef feature gates and existing success callbacks.

### Step B — Supply canonical recipe data separately from display text

Current main `MealCard` passes display title/ingredients/instructions into its action payload, converts ingredient fields, and does not pass the original recipe ID/yield into that payload. Saved rows pass more identity/yield data, but still have their own detail-loading contract.

The shared footer needs an explicit original recipe/shopping-selection input:

- stable recipe and origin identity;
- canonical original ingredients and quantities/units;
- quantity basis and recipe yield;
- selected servings/batches;
- source/selection identity and revision;
- subject/destination authority and existing ingredient/product metadata;
- finalized/eligible state.

Keep translated display content separate. Do not use a translated ingredient name or macro-log serving count as shopping authority.

### Step C — Reconnect active footers, not whole feature bodies

1. Main `MealCard` and `SavedMealRow`: move their existing Plan/Macros composition through `MealCardActions` without changing behavior.
2. Create a Dish and Gatherings: replace only repeated footer markup with the same component, retaining local bodies and callbacks.
3. Remaining creators: Craving, Dessert, Sushi, Beverages, Fridge Rescue and Chef’s Kitchen follow the same pattern. Pediatric uses its explicit capability mapping.
4. Template hubs: reuse the existing footer with the factory’s edited/scaled canonical recipe, not the lightweight `RecipeQuickActions` identity alone.
5. Other finalized ingredient-backed families can reconnect with their own capabilities; incomplete previews remain unavailable.
6. Do not migrate unused/retired components to claim coverage.

### Step D — Explicit context/capability control

- Shopping visible only for eligible finalized recipes.
- Builder hosts explicitly keep card-level Shopping hidden initially; their bulk bars remain.
- Primary Translate hidden/moved centrally, with translation still reachable secondarily.
- Existing Add to Plan and Add to Macros retained where supported.
- No professional-to-client shopping write is inferred from a generic actor ID.
- Child/pet/venue contexts do not inherit inappropriate adult clinical or macro actions.

### Step E — Add Shopping once, after architecture approval

Connect the existing shared footer to the shared transfer adapter/service proposed in the shopping audit. That service remains responsible for quantities, acknowledgement, aggregation, repeat protection and card/bulk contribution identity.

**One UI integration point:** `client/src/components/MealCardActions.tsx`.

**One transfer operation:** shared by that footer and existing bulk shopping bars. The bars need not render the card footer, but they must use the same selection/receipt semantics.

No second universal card component is required. This architecture phase does not authorize API/schema work or implementation of Shopping.

## 8. Acceptance checks for eventual restoration

- Import/JSX inventory confirms all agreed eligible active recipe families mount the existing shared footer directly or through a real wrapper.
- A controlled shared action-placement change propagates to Create a Dish, Gatherings, saved cards and other connected creators without page-specific copies.
- No primary Translate override leaves a stray button; equivalent translation remains available.
- Existing Plan/Macros callbacks, quantities, serving choices and guards remain unchanged.
- Builder Shopping remains hidden while its bulk workflow still works.
- Canonical identity/ingredients survive display translation, restoration and cross-feature handoff.
- Retired code and a WebDriver-only harness are not counted as customer coverage.

These are proposed checks, not a claim that reconnection has already happened.

## Recommended decision

Approve the **architecture direction** first: reuse and complete `MealCardActions`, reconnect active eligible footers, keep necessary feature bodies and existing macro/plan implementations, and then integrate Shopping once.

The earlier shopping quantity/idempotency findings still apply. A shared footer fixes inheritance; it does not, by itself, fix shopping persistence.
