# Phase 2 Shopping integration — Development review

## Delivery status

Implemented the shared Shopping action, canonical recipe transfer contract,
acknowledged API, durable SQL receipts/contributions, and active card/bulk
integration. **Not activated for live persistence.**

No shared-database migration, customer-list write, real-account persistence test,
GitHub push, PR, merge, publication or deployment was performed.

The new write path requires both:

1. Explicit server activation through `MEAL_SHOPPING_TRANSFERS_ENABLED=true`.
2. Presence of the reviewed transfer tables.

No activation setting was changed. With the flag absent/false, capabilities do
not connect to the database and new transfers fail closed. Existing bulk bars
retain their prior path only after the server explicitly confirms that the new
path is unavailable. A capability/network error is **not** permission to fall
back to an untracked duplicate-prone transfer.

## What is implemented

### One shared Shopping action

`MealCardActions` composes one `MealShoppingAction`; hosts supply recipe data and
capabilities, not feature-specific Shopping buttons. Existing Plan, Macros,
preparation, save/share and secondary Translate remain.

- Individual builder Shopping stays hidden.
- Professional `/pro/` and `/care-team` workspaces do not receive the personal
  list Shopping action.
- Individual recipe transfers stay on the card.
- A request is pending/disabled until acknowledgement.
- Changed recipes/servings first return a review state. A second explicit
  **Update Shopping** action supplies the receipt version.
- Missing identity/yield, unknown/to-taste amounts and incomplete recipes display
  an explanation instead of inventing quantities.

### Canonical quantities and identity

`shared/mealShoppingSelection.ts` validates recipe selection, original yield,
requested servings, quantity basis, subject kind and ingredient evidence.

- Total-recipe amounts scale by `requested servings / original recipe yield`.
- Per-serving amounts scale by requested servings.
- Original fractions are parsed through the existing shared ingredient parser,
  including `½`, `1/2`, `1½` and `1 1/2`.
- Supported weight units convert only within weight; volume only within volume.
  No density inference merges weight with volume.
- Recipe/card/bulk identity is `recipe:<original-id>` unless an explicit stable
  selection identity is already present.
- Canonical originals are kept separate from translated display ingredients.
  Favorite saves, when the new path is active, carry canonical ingredient/yield
  provenance. Account-scoped, bounded session cache supports local restoration;
  **durable duplicate protection is in SQL, not that cache**.

### One transactional API

The existing V2 shopping router now mounts:

- `GET /api/shopping-list-v2/selections/capabilities`
- `POST /api/shopping-list-v2/selections`

The POST validates the full batch, resolves ownership exclusively from
authenticated server state, locks the owner's active cycle, compares durable
receipts, applies compatible ingredient deltas and records receipts/sources/
contributions in one transaction.

Exact repeats return `already_added`. Conflicting revisions require explicit
replacement with the expected version. A failure rolls back the whole transfer.
Checked/deleted/manually incompatible old contributions require review rather
than guessed subtraction.

The client hydrates the existing list after acknowledgement; it never calls
legacy `addItems` to apply the same committed quantities again.

### Existing bulk actions

- Builder active-day and selected-days actions now have an acknowledged
  selection-transfer branch.
- All eight active creator aggregate-bar callers pass finalized recipes, not
  just their display/pre-parsed ingredient arrays.
- Gatherings individual courses and whole-menu transfer use the same course
  IDs. Adding a course, then the menu, does not buy that course twice.
- Existing bulk navigation is retained after confirmed persistence.
- Existing full-clear paths rotate the active receipt cycle when activated.
  The legacy scope clear retains its adhoc/inbox scope; other scopes retain
  their existing handler.

## Verification

### Automated checks

Run the isolated client/contract suites:

```sh
NODE_OPTIONS=--max-old-space-size=2048 npx jest --runInBand \
  --globals='{"ts-jest":{"isolatedModules":true}}' \
  client/src/lib/__tests__/mealShoppingFlow.test.tsx \
  client/src/lib/__tests__/mealCardActionInheritance.test.tsx \
  client/src/lib/__tests__/builderShoppingFlowBaseline.test.tsx \
  client/src/lib/__tests__/groceryCoachSavedPlan.test.tsx \
  client/src/lib/__tests__/diabetesProtocolIndicator.test.tsx
```

Run the isolated database/API check:

```sh
node scripts/tests/meal-shopping-transfers.isolated.mjs
```

The PostgreSQL/WASM check creates synthetic tables/users in memory, applies the
review SQL **only there**, blocks network access after initialization, compiles
the actual router with Production settings, and invokes its Express stack with
injected synthetic authentication and persistence.

Coverage includes:

- 2 lb + 2 lb = 4 lb, without multiplying three-serving recipes twice.
- Fractions, compatible/incompatible units and selected-serving replacement.
- Repeat/reopen and card-versus-bulk identities.
- Stale receipt versions and explicit updates.
- Manual groceries, checked rows, product identity and original product evidence.
- Atomic rollback after an injected persistence failure.
- Re-shopping after an explicit new cycle.
- Deleted contributions returning review rather than false “already on list.”
- Disabled operation without connecting to a database.
- Authentication and rejection of submitted owner IDs.
- Compiled Production router persistence using the same implementation.
- Same protected router mounted by Development and Production entrypoints.
- Client success waiting for acknowledgement, repeat-click blocking, failure/
  retry, canonical translated/saved recipes, account switching and professional
  workspace restrictions.
- Existing builder behavior while inactive, plus activated selected-day and
  whole-menu adapter behavior.

The full Production server entrypoint also compiled with esbuild, using
Production settings, external packages and in-memory output. It was **not
started** against a database.

Final verification:

| Check | Result |
|---|---|
| Client/contract regression suites | **61 tests passed across 5 suites.** |
| Isolated PostgreSQL/API checks | **26 checks passed.** |
| Release type gate | **Passed; unchanged reviewed baseline of 109 diagnostics.** No baseline refresh. |
| Compiled Production server | **Compiled successfully in memory.** No server or database connection started. |
| Development smoke | Workflow running; public landing page rendered; fresh Vite connection and React mount succeeded. Expected unsigned-in profile response was 401. |
| Patch whitespace/integrity | `git diff --check` passed. |

The public smoke check does not verify authenticated meal-card rendering. That
behavior was checked through isolated component fixtures, not customer accounts.

### Important verification limits

- PGlite exposes a single connection; the test pool serializes transaction
  access. Repeat/concurrent-call outcomes and SQL receipts are covered, but this
  is not a real multi-session PostgreSQL contention/load test.
- No signed-in browser journey or installed-iOS persistence test was performed.
  Such a test must not target the shared customer database before approval.
- Production compilation/router execution is not a live Production deployment
  or end-to-end release approval.

## Changed-file inventory

### Shared and server

| File | Change |
|---|---|
| `shared/mealShoppingSelection.ts` | New validated selection, quantity, unit and adapter contract. |
| `shared/shoppingRecipeIngredient.ts` | Exported the existing numeric parser; legacy fallback behavior unchanged. |
| `server/services/shopping-list/selectionTransfers.ts` | New transactional receipt/contribution service with injected SQL pool. |
| `server/routes/mealShoppingSelections.ts` | New gated, protected capabilities/transfer/clear handlers. |
| `server/routes/shoppingListV2.ts` | Mounted the shared handlers inside the router already used by both runtimes. |
| `server/routes/shoppingList.ts` | Added gated cycle rotation to the existing scoped full-clear path. |
| `migrations/20261111_meal_shopping_transfers.sql` | Review-only additive migration; no startup registration. |

### Shared client controls and adapters

- `client/src/components/MealShoppingAction.tsx`
- `client/src/hooks/useMealShopping.ts`
- `client/src/lib/mealShoppingApi.ts`
- `client/src/components/MealCardActions.tsx`
- `client/src/components/MealCard.tsx`
- `client/src/components/SavedMealRow.tsx`
- `client/src/components/FavoriteButton.tsx`
- `client/src/components/RecipeQuickActions.tsx`
- `client/src/components/BuilderShoppingBar.tsx`
- `client/src/components/ShoppingAggregateBar.tsx`
- `client/src/features/meals/MealHubFactory.tsx`

### Connected creator payloads

- `client/src/pages/lifestyle/CreateDishPage.tsx`
- `client/src/pages/lifestyle/GatheringsPage.tsx`
- `client/src/pages/craving-creator.tsx`
- `client/src/pages/CravingDessertCreator.tsx`
- `client/src/pages/SushiCreator.tsx`
- `client/src/pages/BeverageCreator.tsx`
- `client/src/pages/AthleteBeverageCreator.tsx`
- `client/src/pages/fridge-rescue.tsx`
- `client/src/pages/lifestyle/ChefsKitchenPage.tsx`
- `client/src/pages/lifestyle/MyPerfectBeginningCreateMealPage.tsx`
- `client/src/pages/companion/CompanionMealGenerator.tsx`

Pediatric changes only carry stable recipe/yield provenance through generation,
image completion and restoration. No pediatric safety rule or nutrition formula
was modified. Template Shopping receives the actual selected/edited/scaled
ingredients rather than the old lightweight action summary.

### Tests and review documentation

- `client/src/lib/__tests__/mealShoppingFlow.test.tsx`
- `client/src/lib/__tests__/builderShoppingFlowBaseline.test.tsx`
- `client/src/lib/__tests__/mealCardActionInheritance.test.tsx`
- `scripts/tests/meal-shopping-transfers.isolated.mjs`
- `.agents/memory/meal-card-shopping-intent.md` — authorization boundary updated.
- `docs/shopping/phase-2-shopping-implementation-review-2026-11-11.md`

## Migration SQL — review only

This is the migration as written. **Do not run it on the shared database without
separate approval.** There is no backfill or guessed attribution of old groceries.

```sql
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '20s';
CREATE TABLE IF NOT EXISTS shopping_transfer_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination text NOT NULL DEFAULT 'adhoc:inbox',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, owner_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS shopping_transfer_active_cycle
  ON shopping_transfer_cycles(owner_id, destination) WHERE active;
CREATE TABLE IF NOT EXISTS shopping_transfer_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL,
  selection_id text NOT NULL,
  snapshot_hash text NOT NULL,
  snapshot jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(cycle_id, owner_id) REFERENCES shopping_transfer_cycles(id, owner_id),
  UNIQUE(cycle_id, selection_id),
  UNIQUE(id, owner_id)
);
CREATE TABLE IF NOT EXISTS shopping_transfer_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL,
  item_id uuid REFERENCES shopping_list_items(id) ON DELETE SET NULL,
  applied_quantity numeric NOT NULL CHECK(applied_quantity > 0),
  applied_unit text NOT NULL,
  metadata_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  FOREIGN KEY(receipt_id, owner_id) REFERENCES shopping_transfer_receipts(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS shopping_transfer_contribution_receipt ON shopping_transfer_contributions(receipt_id);
CREATE INDEX IF NOT EXISTS shopping_transfer_contribution_item ON shopping_transfer_contributions(item_id);
COMMIT;
```

## Compatibility findings and release blockers

### Required before activation/release

1. **Review and separately approve shared-database migration execution.** The
   application deliberately does not create these tables during startup.
2. **Approve activation separately.** Until then, new Shopping remains disabled
   and the existing bulk behavior remains available. Its previously documented
   fraction/repeat/optimistic-success limitations are not retroactively fixed
   while that old branch remains active.
3. **Review source contracts missing numeric yield or stable identity.**
   Beverage/Dessert serving labels and pet serving descriptions are not reliable
   numeric yields. Recipes without explicit usable evidence stay unavailable;
   no “single,” pitcher/party range, title or macro-per-serving value is converted
   into a guessed yield. Older saved pediatric recipes can also lack yield.
4. **Complete an approved isolated authenticated acceptance pass before broad
   release.** Do not use real customer lists for this.
5. **Confirm real PostgreSQL multi-session contention behavior** in an approved
   isolated database before relying on cross-device/load claims.

### Compatibility decisions

- Existing `shopping_list_items` and `shopping_list_sources` remain the list.
  Receipt tables are provenance/idempotency infrastructure, not a second cart.
- Unattributed old/manual rows are never backfilled. Metadata-incompatible or
  ambiguous rows may remain separate rather than being forcibly consolidated.
- Checked groceries remain checked; new purchases do not silently uncheck them.
- Manual deletion/edit conflicts block an unsafe recipe replacement.
- Venue estimates, menu concepts, public previews and incomplete recipes remain
  ineligible.
- No active import consumer was found for the older `DayByDayMealBoard` helper.
  Beach Body's old preview modal has no opening setter in its current page.
  Those dormant paths were not reactivated or used as the new transport. Its
  active builder shopping bar uses the new shared branch when activated.
- The old non-Development `/commit` helper defect was not adopted into the new
  path. The new selection service/router has no runtime-specific implementation
  fork.

**Stop point:** Development code and isolated verification are delivered for
review. No migration application or live activation is authorized by this report.
