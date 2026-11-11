# Standardized meal-card actions — Phase 1 review checkpoint

## Scope and stop point

This work follows the latest founder brief: investigate and test existing builder
shopping, restore the existing shared action system, demonstrate inheritance,
and **stop before adding Shopping**.

The earlier read-only audits remain useful source inventories. This checkpoint
supersedes their earlier suggested phase ordering:

- `universal-meal-card-shopping-audit-2026-11-11.md`
- `standardized-meal-card-architecture-verification-2026-11-11.md`

No Shopping button, shopping transport, API, schema migration, list rewrite,
clinical calculation, safety policy, publication, merge or deployment was added.

## 1. What Phase 1 changed

The existing `client/src/components/MealCardActions.tsx` now owns primary action
layout and secondary translation placement. There is no replacement universal
card.

Hosts supply semantic `MealCardAction` slots containing their existing controls.
Plan, Macros, preparation, saving/removal and sharing still use the host's
existing callbacks, payloads, permissions and specialized components.
Old grouping divs containing slots are transparent to the shared composition;
unrelated notices remain intact. Layout is therefore not controlled by an
unchanged independent footer hidden inside a wrapper.

The existing primary Translate control now appears under **More**. Its
implementation and callbacks remain. This also applies to Saved/Favorites,
which explicitly passed `showTranslate={true}`.

### Connected footer hosts

| Host | Coverage and retained behavior |
|---|---|
| `components/MealCard.tsx` | Existing active builder consumers; Plan, macro guards, shared share/preparation and secondary translation. |
| `components/SavedMealRow.tsx` | Saved Meals/Favorites, including Grocery Coach handoff metadata, macro callback and remove-from-Favorites control. |
| `pages/lifestyle/CreateDishPage.tsx` | Existing finalized dish cards and callbacks. |
| `pages/lifestyle/GatheringsPage.tsx` | Existing independent course cards; whole-menu shopping bar unchanged. |
| `pages/craving-creator.tsx` | Existing Craving recipe actions. |
| `pages/CravingDessertCreator.tsx` | Existing Dessert actions, including its specialized Studio entry. |
| `pages/SushiCreator.tsx` | Existing Sushi recipe actions. |
| `pages/BeverageCreator.tsx` | Existing beverage callbacks and starch notice/dismissal. |
| `pages/AthleteBeverageCreator.tsx` | Existing athlete-beverage callbacks and starch notice/dismissal. |
| `pages/fridge-rescue.tsx` | Existing MacroBridge, Plan and guarded prepare/share callbacks. |
| `pages/lifestyle/ChefsKitchenPage.tsx` | Existing Kitchen callbacks and preparation state. |
| `pages/lifestyle/MyPerfectBeginningCreateMealPage.tsx` | Local pediatric recipe card's Kitchen and translation actions; no adult macro controls added. Delete and child-safety content remain outside the action composition. |
| `components/RecipeQuickActions.tsx` | Active recipe-template hub actions; existing save/calendar/cook/share handlers and dialogs retained. |
| `pages/companion/CompanionMealGenerator.tsx` | Existing pet-recipe save/regenerate controls; veterinary guidance retained. No human clinical controls added. |

These are **14 footer hosts**, not 14 total application pages. The existing
MealCard and SavedMealRow consumers inherit the change without individual page
footer edits.

Venue estimates, menu concepts, Pairing suggestions, public previews and unused
legacy footer/card modules were not promoted into finalized, quantified recipes.

## 2. Existing builder-shopping trace and baseline

### Actual execution

1. `BuilderShoppingBar` obtains meals from the active/selected days using
   `getDayLists` and its existing multi-week cache/fetch path.
2. Its `collectIngredients` flattens those meals. The Development branch uses
   `recipeIngredientTransfer`, which re-exports
   `prepareShoppingRecipeIngredient` from `shared/shoppingRecipeIngredient.ts`.
   The other branch uses `normalizeIngredients`.
3. `sendDays` maps ingredients into store rows and calls
   `useShoppingListStore.getState().addItems`.
4. In Development, `createDevelopmentShoppingListStore` provides account-scoped
   state and queued persistence. Its `compatibleUnit`/`combinedQuantity` logic
   handles supported compatible units; `shared/developmentShoppingMerge.ts`
   preserves metadata/product compatibility.
5. Existing POST/PATCH requests persist through `server/routes/shoppingList.ts`,
   `server/routes/shoppingListV2.ts` and the existing metadata persistence service
   in `server/services/shopping-list/metadataPersistence.ts`, depending on the
   route and runtime branch. The existing list UI reads the resulting store.

The separate `ShoppingAggregateBar` starts from an already-flattened ingredient
array. It currently uses `parseFloat` and then the same store add path.

### Serving and aggregation findings

Neither bar establishes an independent, authoritative ingredient-serving
conversion. They generally assume the supplied ingredient amounts already
represent the intended recipe total. Nutrition serving normalization is not
proof that ingredient quantities are per-serving.

The baseline verifies:

- Selected days only: two different three-serving recipes, each requiring 2 lb
  chicken, yield **4 lb**, not 12 lb.
- One three-serving recipe requiring 2 lb transfers 2 lb, not 6 lb.
- An already-scaled six-serving recipe requiring 4 lb transfers 4 lb, not 24 lb.
  This tests the transfer contract, not every creator's serving-control UI.
- Shared preparation preserves `1/2`, `½` and `1 1/2`.
- Supported compatible weight units combine; incompatible weight/volume units
  stay separate.
- Prior groceries survive subsequent additions.

### Confirmed gaps deliberately left unchanged

- The aggregate bar loses fractions through `parseFloat`/fallback handling.
- Repeating the existing builder send adds the quantities again.
- Existing bars report success/navigate before confirmed persistence.
- Client/server/runtime branches do not share one complete transfer contract.
- The existing helper can default an unresolved quantity to one; that fallback
  must not become the future canonical shopping contract.

These are Phase 2 requirements, not fixes silently included in Phase 1.

## 3. Verification and limits

`client/src/lib/__tests__/mealCardActionInheritance.test.tsx` extracts each
connected host's **actual current footer JSX**, supplies isolated synthetic
recipe data and mock leaf controls, and renders the real shared action owner.

The acceptance demonstration changes the shared layout setting from two
columns to one. Every one of the 14 actual host footer expressions inherits
the change without modifying its footer. The test restores the production
setting after each case.

Additional checks cover secondary Translate, the Saved/Favorites explicit
translation override, existing Plan/macro/removal callbacks, pediatric
translation without adult macro actions, and the builder's incomplete-nutrition
macro guard. Existing Grocery Coach saved-plan and diabetes indicator regression
tests also run with composition-aware mocks.

The shopping baseline uses the real Development store with an in-memory
GET/POST/PATCH substitute. Unexpected live network requests fail locally. It
does not write customer records or call meal generation.

This is an isolated component/contract demonstration, **not a signed-in browser
walkthrough of every page or an installed-iOS verification**. Page providers,
live recipe generation, paid services and real customer persistence were not
used to manufacture coverage.

### Final results

- **49 tests passed across four suites**, including the nine builder baseline
  cases, all 14 host inheritance cases and targeted callback/clinical-display
  regressions.
- **Release type gate passed:** the complete root diagnostic fingerprint exactly
  matches the unchanged, reviewed baseline of 109 existing diagnostics. This is
  not a claim that the legacy project is strict-TypeScript-clean.
- **All 15 changed runtime TSX modules returned HTTP 200** through Development's
  Vite transform after the final restart.
- **Development startup and mobile anonymous landing screenshot passed.** The
  fresh browser rendered the expected sign-in landing; its unauthenticated
  session refresh returned the expected 401. This does not establish signed-in
  meal-card visual coverage.
- `git diff --check` passed.
- Existing shopping bars, stores, API handlers and database schema were not
  modified. No live shopping transfer was executed.

## 4. Exact proposed Phase 2 integration — not implemented

### A. Canonical recipe/selection contract

Add a shared pure contract, proposed as `shared/mealShoppingSelection.ts`, and
small source adapters. It must carry:

- Stable `selectionId` for the selected recipe occurrence, retained across its
  card, save/restore and bulk-transfer paths. A recipe title, translated label
  or newly generated request UUID is not this identity.
- Original recipe/origin ID and deterministic ingredient snapshot hash.
- Canonical original ingredients, quantities, units, preparation distinctions,
  requirements and selected-product metadata.
- Explicit `quantityBasis`: `recipe_total` or `per_serving`.
- Original `recipeYield` and requested `shoppingServings`.
- Source feature, finalized/eligible state and the correct human/pet subject.

Scale exactly once:

- `recipe_total`: amount × shoppingServings ÷ recipeYield.
- `per_serving`: amount × shoppingServings.

Reuse the existing fraction parser and compatible-unit/metadata policy, but
return explicit unresolved/review results instead of inventing one unit.
Do not derive ingredient amounts from macros.

The shared builder card currently supplies display-oriented data rather than a
complete shopping identity/yield contract. Template hubs must pass their actual
edited/scaled recipe. Saved/origin identity and pet-subject handling also need
explicit adapters; they must not be inferred from card appearance.

### B. One acknowledged, transactional API

Proposed endpoint: **POST `/api/shopping-list-v2/selections`**, added to the
existing router and mounted in both Development and compiled Production paths.
It should accept one or many selections:

```json
{
  "requestId": "stable-for-this-network-retry",
  "operation": "add",
  "selections": [
    {
      "selectionId": "stable-selected-recipe-occurrence",
      "recipeId": "canonical-origin",
      "snapshotHash": "canonical-ingredient-snapshot",
      "quantityBasis": "recipe_total",
      "recipeYield": 3,
      "shoppingServings": 3,
      "source": "create-dish",
      "ingredients": [
        { "name": "chicken breast", "quantity": 2, "unit": "lb" }
      ]
    }
  ]
}
```

The example is a shape proposal, not permission to trust submitted owner IDs,
hashes or arbitrary clinical authority. The server resolves the destination
owner from authentication, validates/recomputes canonical transfer evidence,
and retains existing auth, CSRF/native, entitlement and subject boundaries.

Return per-selection acknowledged statuses such as `added`, `already_added`,
`review_required` or `conflict`, plus receipt IDs/versions and enough list
identity/revision information for reconciliation. Malformed/ineligible
selections must produce a clear reason and no partial meal writes.

Within one transaction: lock the owner's active transfer cycle, validate the
whole batch, deduplicate selections, merge only compatible contributions,
persist rows and sources, and write receipts. An exact repeat is a no-op even
after concurrent requests, refresh or a lost acknowledgement. A different
snapshot/serving count for an existing selection requires an explicit
`replace` operation with an expected receipt version, not a second blind add.

### C. Required additive schema proposal

Reuse **`shopping_list_items` and `shopping_list_sources`**. They remain the
actual shopping list; this is not a second cart. Current source rows do not
supply the durable uniqueness and revision contract.

Propose one separately reviewed additive migration defining:

| Proposed table | Required fields/invariant |
|---|---|
| `shopping_transfer_cycles` | Cycle UUID primary key; owner keyed to the existing user-ID type, list destination/scope, active flag, version and timestamps. A partial unique index permits one active cycle per owner/destination. Full-list clear closes the old cycle and inserts the next transactionally, retaining old receipt references. |
| `shopping_transfer_receipts` | UUID, owner, cycle, stable selection ID, origin recipe ID, snapshot hash, quantity basis, original/requested servings, source, version and timestamps. Unique `(owner, cycle, selection_id)` for the active selection. Network request IDs are audit/retry correlation, not the purchase identity. |
| `shopping_transfer_contributions` | Receipt/item linkage, applied quantity and unit, canonical merge key and ingredient metadata needed to identify that selection's exact contribution. Foreign keys and indexes enforce owner/cycle/receipt consistency. A deleted item's link becomes nullable rather than destroying the receipt's evidence. |

Do not backfill guessed ownership of existing grocery quantities. Treat current
manual/legacy quantities as the preserved baseline. New adds apply only their
own delta; explicit updates remove/replace only their tracked contribution.
Preserve checked state, selected products and unrelated groceries. If manual
edits/deletions make an old contribution impossible to reconcile safely,
return a review/conflict result rather than subtracting guessed amounts or
claiming an absent contribution is still on the list.

The exact SQL/types/indexes require implementation review against the existing
schema before approval. **No migration was authored or executed in Phase 1.
The Development database is shared with Production; applying DDL requires
separate approval even after approval to write Phase 2 code.**

### D. Shared UI and existing bulk integration

Add exactly one Shopping leaf action through the existing `MealCardActions`,
with an explicit host capability/payload. Introduce one awaitable transfer
helper/hook, proposed as `mealShoppingApi.ts` / `useMealShopping.ts`.

- Pending disables accidental repeats. Only acknowledged persistence produces
  Added/Already added. Failures remain retryable and visible.
- Reconcile the existing store after acknowledgement; do not call `addItems`
  again and double-apply an already committed transfer.
- Keep the user on the card so several Gathering courses can be selected;
  offer a separate View List action.
- Keep builder bulk bars and initially hide individual builder Shopping.
- Keep Gatherings' whole-menu option. Individual courses and Add Menu pass the
  same stable course-selection IDs, so previously added courses are no-ops.
- Connect existing active bulk paths to the same transfer service. A flattened
  anonymous ingredient array cannot satisfy cross-card/bulk repeat protection.
- Preserve the existing professional-context restrictions.
- Incomplete/uncertain recipes show a reason, not fabricated quantities.
- Changing a recipe or serving choice never silently changes purchased
  groceries. A second intentional batch requires an explicit new selection.

### E. Required before Production, not Phase 1 backlog additions

Before Phase 2 can be called release-safe, demonstrate in isolated persistence:

1. 2 lb + 2 lb = 4 lb, fraction accuracy and single serving conversion.
2. Safe compatible-unit/metadata merging and prior-grocery preservation.
3. Concurrent/double/lost-ack retries do not duplicate a selected meal.
4. Card then bulk, and bulk then card, deduplicate the same selection.
5. Save/reopen, serving changes, explicit contribution replacement and a new
   shopping cycle behave consistently.
6. Failed transactions leave no partial meal; success waits for persistence.
7. Effective route authorization and compiled-runtime route parity.

Do not adopt the existing non-Development `/commit` branch unchanged: the audit
identified a removed helper reference and divergent response/persistence
contracts. Either replace its active use with the reviewed selection operation
or explicitly correct it within that integration.

**Checkpoint:** Review Phase 1 and this proposal before beginning Phase 2.
