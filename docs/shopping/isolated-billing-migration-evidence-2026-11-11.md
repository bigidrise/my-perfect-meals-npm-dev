# Isolated Shopping environment — BLOCKED

## Required existing migrations applied

Dependency inspection found that the exported baseline did not include the
`businesses` base table. The existing source of that base migration is the
`CREATE TABLE IF NOT EXISTS businesses` statement in `server/prod.ts`.
The billing migration requires that table's ID, owner and Stripe identity
columns, plus the existing `users` and `client_links` tables.

Applied only the following, in dependency order:

1. The exact existing businesses base-table statement, extracted from
   `server/prod.ts` without importing or starting the Production application.
2. `runStripeBillingSchemaMigration`.
3. `runStripeOwnershipReconciliation`.

Steps 2–3 use the unchanged existing `runStripeBillingMigration` entry point in
`server/db/migrations/runStripeBillingMigration.ts`. All steps ran in one
transaction with lock/statement timeouts.

The extracted base statement's SHA256 was:

```text
3c267fe1d701c0b2561b274cec7dcd2ef0c500ffb488b695b1bf6b8d23c4c126
```

No replacement table definition, new column specification, organization
migration, unrelated backfill, application change, or guard bypass was introduced.
The isolated-only repeatable runner is:

```sh
node --import tsx scripts/shopping-isolation/initialize-billing.mjs
```

## Precise passing evidence

- Target identity verified before writing:
  database `mpm_shopping_founder_isolated`, address `127.0.0.1`, port `55432`,
  data directory `/home/runner/workspace/.local/shopping-isolated/postgres`.
- Public table count increased from 183 to **186**: the businesses base table
  and the two billing ledger/identity-owner tables.
- Unmodified `assertStripeBillingSchema` passed before commit, after commit,
  and during the isolated app's subsequent startup.
- The isolated app's pre-import PostgreSQL connection allowlist was installed.
- The existing safety-audit correlation-ID startup guard also passed.
- Source patch integrity check passed.

## Exact next blocker

The separate app probe on port 8080 exited with code 1 before accepting HTTP
requests. The next unmodified startup guard reported:

```text
STARTUP GUARD: 1 critical column(s) are missing from the database.
child_profiles.food_inclusion_priorities
Nutrition Priorities — pediatric HFC resolution requires this authoritative subject column
```

**Classification: missing existing migration.**

The existing `runNutritionPrioritiesMigration` in
`server/db/migrations/runNutritionPrioritiesMigration.ts` adds this column.
It is part of the existing critical-column preflight in `server/index.ts`,
followed by `assertColumnsExist` from
`server/bootstrap/assertColumnsExist.ts`.

This is not a newly encountered SQL syntax/constraint defect or a connection
configuration failure. The safe startup mode intentionally does not run broad
automatic migrations. No Nutrition Priorities migration was executed after
this new blocker appeared.

## Founder readiness and boundaries

- **BLOCKED:** no isolated authenticated account was established.
- The isolated database still has **zero users**.
- Create a Dish and Gatherings authenticated Shopping acceptance did not run.
- No founder-accessible testing URL is being offered.
- The main Development preview/workflow and all Production processes were not
  switched to this database.
- Shared customer data and the shared schema were not modified.
- No GitHub push, merge, or Production publication occurred.
- Existing Shopping actions, Add to Plan, Add to Macros, and application guards
  were not edited.
- The unrelated template Save endpoint remains deferred and is not reported
  as functional.
