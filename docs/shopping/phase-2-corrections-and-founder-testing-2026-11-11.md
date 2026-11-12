# Phase 2 corrections and founder-testing readiness

## Decision

**Do not begin founder Shopping testing in the current Development preview.**

The three requested implementation corrections passed focused regression and
real PostgreSQL tests. A separate PostgreSQL cluster was established, but the
full isolated application schema could not be bootstrapped. No authenticated
test account or isolated application session was created.

The existing Development application was not switched to the isolated database.
Shopping was not activated against the shared database. No customer records,
shared schema, GitHub remote, or Production publication were changed.

## Corrections

1. **Canonical recipe cache:** Preserves original ingredient evidence while
   refreshing current purchase servings, yield and quantity basis. Tests cover
   three servings becoming six, a missing yield becoming valid, and translated
   ingredients retaining canonical originals.
2. **Template identity:** Factory and fallback actions now share
   `templateShoppingSelectionId`, using `classic`, `light` or `highProtein`
   rather than an interpolated template object. Opening and serialized
   save/restoration preserve the ID; variants remain distinct. This is not
   proof of authenticated durable template saving.
3. **Contribution replacement:** Locks grocery rows in deterministic ID order
   before reading and revalidating their quantity, units and checked state.
   Manual reductions cannot delete another recipe's tracked contribution.
   Manual increases are preserved when replacing the recipe quantity.

No Add to Plan or Add to Macros handler was changed. Shared card composition and
existing builder/aggregate transfer branches remain.

## Passing verification

| Check | Result |
|---|---|
| Component/regression suites, including existing builder tests | 65 tests passed, 5 suites |
| Native PostgreSQL 16, independent connections | 32 checks passed |
| Isolated PostgreSQL/WASM compatibility | 26 checks passed |
| Release type gate | Passed; unchanged reviewed baseline of 109 diagnostics |
| Patch integrity | `git diff --check` passed |

Native checks verified different PostgreSQL backend PIDs, simultaneous repeated
transfers, a discarded post-commit result followed by a retry on another
connection, blocked replacement waiting on a manual edit, checked-state changes
while replacement waited, manual-delta preservation, and atomic rejection of
unsafe subtraction.

The lost-response scenario was simulated after the service committed, not by
dropping a browser's authenticated HTTP response. Router checks use injected
synthetic authentication; they are not an authenticated application acceptance
pass.

Commands:

```sh
node scripts/tests/meal-shopping-transfers.isolated.mjs --postgres
node scripts/tests/meal-shopping-transfers.isolated.mjs
npm run check:release-types
```

The native command requires the configured local PostgreSQL workflow.

## Isolation established

- A new PostgreSQL 16 cluster under `.local/shopping-isolated/postgres`.
- Database service bound only to `127.0.0.1:55432`.
- Runtime database guard verifies database name, server address and exact data
  directory; it does not use an inherited `DATABASE_URL`.
- Each native test run creates a disposable database, applies the Shopping
  migration there, uses synthetic fixtures, then removes that database.
- Cluster files are excluded from Git and deployment.
- No customer database content was copied.

## Specific application-bootstrap blocker

The existing baseline source declares two primary keys for `mbl_avatar_state`:

- `server/db/schema/mybestlife.ts:4`: `id` uses `.primaryKey()`.
- `server/db/schema/mybestlife.ts:17`: a second primary key uses `userId`.

PostgreSQL rejects the exported baseline with:

```text
42P16: multiple primary keys for table "mbl_avatar_state" are not allowed
```

The first Drizzle push left an incomplete, fresh local schema despite exiting
successfully. That empty, task-created database was reset before a second,
atomic baseline application. The atomic application failed and rolled back.

The full isolated founder database therefore has no usable application schema.
It was not presented as ready, and no unrelated primary-key decision was made.

## Additional existing save limitation

`server/routes.ts` registers `POST /api/recipes/:id/save` with a placeholder that
returns success without persisting a recipe. The template-ID correction does not
repair that separate persistence implementation. Real template save/reopen must
not be claimed until that path is implemented and tested.

## Not run / still blocked

- Authenticated Create a Dish → Shopping → List → second-recipe aggregation.
- Authenticated Gatherings individual-course/whole-menu overlap.
- Actual saved-recipe reopening, explicit updates and failed-save recovery in the
  real application.
- Browser-level lost-response retries.
- Founder login and hands-on isolated application use.

## Required next work

Resolve the baseline primary-key conflict without changing the shared database,
then bootstrap the full isolated schema and apply Shopping migration there.
Complete genuine account creation and authenticated acceptance before switching
the Development preview. Resolve the existing template Save placeholder before
claiming durable template save/reopen.

No shared-database migration or activation is authorized by this report.
