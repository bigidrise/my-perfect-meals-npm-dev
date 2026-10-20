# Smart Grocery List persistence foundation — Development handoff

Follow-up status: the guarded Development restart and non-mutating runtime
verification are now complete. See
`docs/smart-grocery-list-runtime-verification.md` for the safety review, runtime
results and remaining live-persistence limitation. The implementation/test results
below describe the initial foundation stage.

## Release boundary

This is a Development-only persistence foundation, not a product-recommendation release.
The user's completed Production compatibility verification was accepted without repeating
the Production investigation. No Production workspace edits, publication, GitHub push,
catalog lookups, recommendation activation, clinical-rule changes, or product-selection UI
were performed.

Development and Production share Neon. The additive column therefore exists in their
shared database, while the new application behavior is Development-gated.

## 1. Executed migration and verification

Executed once, through a standalone PostgreSQL client without importing application startup:

```sql
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

ALTER TABLE public.shopping_list_items
ADD COLUMN ingredient_metadata jsonb;

COMMIT;
```

The narrow preflight matched the expected table and its 12 existing column definitions,
and confirmed the new column was absent. The postflight confirmed:

| Property | Result |
|---|---|
| Column | `public.shopping_list_items.ingredient_metadata` |
| Type | `jsonb` |
| Nullable | YES |
| Default | NULL / no default expression |
| Other existing column definitions | Unchanged |

No row reads, DML, backfill, additional tables, indexes, constraints, schema sync,
`db:push`, or application startup migration runner were used for this migration.
No further database operations were used for implementation verification.

## 2. Implemented contract and paths

Version 1 stores original ingredient identity separately from conservative matching
identity. It distinguishes explicit ingredient/request requirements from profile guidance;
retains original recipe text, quantities, units and source identities; and combines
compatible recipe contributions without replacing them with retail/package amounts.

The optional selected-product record contains product key, name, brand, variant, UPC,
package/serving information, source provenance, product evidence, historical review
status, unresolved requirements and evaluation context. A saved-product source snapshot
preserves its existing product/nutrition payload without turning it into medical clearance.

Updated paths:

- BuilderShoppingBar and ShoppingAggregateBar transfers.
- Create a Dish's pre-flattening ingredient transfer.
- Shared `addMealsToShopping` / `sendToShoppingList` transfer functions.
- Both classic/enhanced POST registrations, through one Development implementation.
- Classic GET aggregation and PATCH.
- V2 preview, commit, GET hydration and PATCH.
- Stored meal-plan-to-shopping transfer, including nested plan structures.
- Development store addition, merging, editing, saving, refresh and local restoration.
- Product/qualifier-aware display consolidation.
- New Saved Grocery transfers and restoration of existing rows without erasing metadata.

The legacy application branches remain in place outside Development. Legacy rows remain
readable without generating metadata or backfill writes. A Development cache is
account-scoped and does not adopt the old unowned global cache. Late responses cannot
replace another account's state.

New metadata writes require a versioned capability response from the target shopping API.
The older Production API does not advertise that capability, so the Development client
will not send it metadata saves or patches.

## 3. Verification

**78 passing tests across five focused/regression suites.**

| Suite | Coverage |
|---|---|
| `server/tests/shoppingMetadataFoundation.test.ts` | Version/schema validation; qualifiers; source quantities; contributions; exact product distinctions; classic/V2 routes; duplicate POST order; account predicates; validation before deletion; legacy Production-style `replace_scope` loss |
| `client/src/lib/__tests__/shoppingMetadataStore.test.ts` | Transfer, save/update/refresh, browser-cache restoration, selected products, consolidation, legacy read-only hydration, account switches, late responses, refusal to write metadata to an old API |
| `server/tests/savedGroceries.route.test.ts` | Existing behavior plus Development evidence insertion and checked-item restoration without metadata erasure |
| `client/src/lib/__tests__/groceryCoachBrandPick.test.tsx` | Existing Grocery Coach regression coverage; recommendation behavior unchanged |
| `client/src/lib/__tests__/groceryCoachMealCatalog.test.tsx` | Existing Grocery Coach regression coverage; catalog behavior unchanged |

All fixtures used mocked database/request implementations. No existing customer items
were annotated or modified by the tests. The legacy Production limitation test executes
the old delete/insert mapping against synthetic in-memory rows, not against Production.

Commands:

```sh
npx jest --runInBand --runTestsByPath \
  server/tests/shoppingMetadataFoundation.test.ts \
  client/src/lib/__tests__/shoppingMetadataStore.test.ts \
  server/tests/savedGroceries.route.test.ts \
  client/src/lib/__tests__/groceryCoachBrandPick.test.tsx \
  client/src/lib/__tests__/groceryCoachMealCatalog.test.tsx \
  --globals='{"ts-jest":{"isolatedModules":true}}'

npx tsc --noEmit -p tsconfig.shopping-foundation.json --pretty false
git diff --check
```

The focused TypeScript check and whitespace check passed. The final full-project
TypeScript run still has 121 diagnostics. The only diagnostic within an edited source
file is the pre-existing missing `ScanLine` identifier in ShoppingListMasterView; its
presence before this work was confirmed from the original source. These unrelated
errors were not repaired in this task.

The running app's public landing screen rendered in a screenshot. This is not
authenticated shopping-flow coverage. No real-account browser flow was used.

## 4. Qualifier and product preservation result

**Qualifiers: PASS for the updated Development transfer → save → hydration →
consolidation paths under synthetic tests.** Original names such as low-sodium soy sauce,
reduced-sugar jam, gluten-free bread and vegan cream cheese are retained. Matching does
not use the destructive legacy normalization as its metadata identity.

**Structured products: PASS for supported Development insertion, update, hydration,
cache restoration and consolidation under synthetic tests.** Incompatible product or
qualifier identities stay separate. Product updates preserve original contributions.
Changing an ingredient clears its old retail association rather than silently carrying
the old product to a different ingredient.

This is persistence evidence, not a medical-suitability validation or a live
shared-database end-to-end test.

## 5. Remaining loss boundaries and Production compatibility

- Old Production `replace_scope` still deletes/recreates rows without their metadata.
  This known loss is reproduced in synthetic tests. Selected brands are **not**
  guaranteed to survive every Production shopping-list operation.
- Old Production insert/update/transfer branches remain metadata-unaware. They were
  intentionally not repaired or released by this task.
- Upstream callers that already reduce a product to a name before transfer cannot
  reconstruct missing UPC, variant, source evidence or recipe identity. Existing
  Grocery Coach recommendation/selection behavior was not expanded; name-only input
  remains name-only evidence.
- Historical legacy rows whose original qualifiers were already lost cannot recover
  them from this new nullable column. No backfill was attempted.
- Intentional clear/delete operations remove the row and its metadata. A scoped
  replacement retains metadata only when its replacement payload supplies it.
- Legacy Saved Grocery restoration keeps existing metadata; it does not automatically
  add metadata to an old row that has none.
- The initially deferred application restart has now been completed using the
  existing pre-import safe Development mode, after reviewing its migration and
  worker guards. Live preview checks confirm the new handler is loaded; actual
  authenticated Neon save/refresh was not exercised. See the runtime report.

The approved nullable/no-default additive column is compatible with old inserts.
It must not be removed by a later schema synchronization operation.

## 6. Approval boundaries

No approval is needed to complete the code and isolated verification described here.
The subsequent authorized safe Development restart is complete. No startup migrations
were enabled. Further shared-database write verification needs an isolated identity
and narrowly scoped cleanup plan before proceeding.
Repairing unrelated full-project TypeScript errors and any Production promotion are
separate work. Product-selection UI, product recommendations, clinical evaluation
integration and the next phase require explicit approval.

## 7. Complete changed-file list

### Shared contract/schema
- `shared/shoppingIngredientMetadata.ts`
- `shared/shoppingRecipeIngredient.ts`
- `shared/schema.ts`

### Server
- `server/services/shopping-list/metadataPersistence.ts`
- `server/routes/shoppingList.ts`
- `server/routes/shoppingListV2.ts`
- `server/routes/savedGroceries.ts`
- `server/routes/mealPlan.ts`
- `server/routes.ts`

### Client
- `client/src/stores/developmentShoppingListStore.ts`
- `client/src/stores/shoppingListStore.ts`
- `client/src/lib/shoppingIngredientTransfer.ts`
- `client/src/lib/shoppingMetadataGate.ts`
- `client/src/lib/shoppingMetadataTransport.ts`
- `client/src/lib/shoppingListApi.ts`
- `client/src/lib/shoppingConsolidation.ts`
- `client/src/components/BuilderShoppingBar.tsx`
- `client/src/components/ShoppingAggregateBar.tsx`
- `client/src/pages/lifestyle/CreateDishPage.tsx`
- `client/src/pages/ShoppingListMasterView.tsx`

### Tests/configuration
- `server/tests/shoppingMetadataFoundation.test.ts`
- `server/tests/savedGroceries.route.test.ts`
- `client/src/lib/__tests__/shoppingMetadataStore.test.ts`
- `client/src/lib/__mocks__/shoppingMetadataGate.ts`
- `jest.config.ts`
- `tsconfig.shopping-foundation.json`

### Handoff/project memory
- `docs/smart-grocery-list-foundation-development.md`
- `.agents/memory/smart-grocery-persistence-boundary.md`
- `.agents/memory/MEMORY.md`
