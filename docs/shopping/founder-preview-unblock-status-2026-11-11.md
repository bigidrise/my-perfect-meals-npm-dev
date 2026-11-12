# Founder Shopping preview — BLOCKED

## Completed safely

- Reviewed the recorded schema history and My Best Life consumers. The recorded
  source already contained the duplicate declaration; no SQL migration defining
  two primary keys was found.
- Inspected only live catalog metadata inside a read-only transaction. It
  confirms `PRIMARY KEY (id)` and `UNIQUE (user_id)`, with constraint names
  `mbl_avatar_state_pkey` and `mbl_avatar_state_user_id_unique`.
- Corrected Development source to match those existing constraints:
  retained the UUID `id` primary key and changed the second declaration into
  ordinary `user_id` uniqueness. No columns or foreign-key relationships changed.
- Applied the exported baseline atomically to the verified local founder
  database, then applied Shopping migration only there. It now has 183 public
  tables. PostgreSQL confirms the same avatar PK/unique constraints.
- Added and passed a focused schema regression test.
- Release type gate passed with the unchanged reviewed baseline of 109 diagnostics.
- Negative connection test confirmed that the pre-import guard rejects a
  non-isolated PostgreSQL target before connecting.

No shared database migration or customer-row modification occurred.

## Isolation safeguards

`scripts/shopping-isolation/serve.mjs` verifies the fixed loopback PostgreSQL
cluster, exact database name/data directory and Shopping tables before enabling
Shopping in its child process.

`scripts/shopping-isolation/guard.mjs` runs before application imports and refuses
PostgreSQL connections outside `127.0.0.1:55432/mpm_shopping_founder_isolated`.
Inherited PG connection settings are overridden only for that child process.
There is no shared-database fallback.

The application was probed on port 8080; the main Development preview and its
workflow command were not switched.

## Next schema blocker — stopped as requested

The isolated app exited before listening because its existing startup guard
reported:

```text
STARTUP GUARD: Stripe billing schema is incomplete.
```

Missing prerequisites:

- `stripe_billing_events` and its required ledger columns.
- `stripe_identity_owners` and its identity/ownership columns.
- Business columns `stripe_checkout_reservation_id`,
  `stripe_checkout_session_id`, `stripe_checkout_seat_count`,
  `stripe_last_event_created_at`, `stripe_last_event_rank`,
  `stripe_last_event_id`.
- Required indexes:
  `stripe_identity_owners_owner_idx`,
  `stripe_billing_events_subscription_idx`,
  `stripe_billing_events_status_idx`,
  `businesses_stripe_customer_id_uniq`,
  `businesses_stripe_subscription_id_uniq`,
  `businesses_stripe_checkout_session_id_uniq`.

These are migration-owned runtime prerequisites not supplied by the current
Drizzle export. The existing authoritative migration is
`server/db/migrations/runStripeBillingMigration.ts`; the rejecting guard is
`server/db/migrations/assertStripeBillingSchema.ts`.

No billing migration was run, no billing guard was bypassed, and no unrelated
schema correction was attempted after this error.

## Not completed

- No isolated authenticated account/session was established.
- No authenticated Create a Dish or Gatherings Shopping acceptance ran.
- No founder-ready isolated preview URL is available.
- Do not use the current main preview for founder Shopping testing.

## First three hands-on tests once READY

1. **Single recipe:** Create a Dish for three servings, select Shopping, wait for
   acknowledgement, and compare list quantities with the recipe. Total-recipe
   amounts must not be multiplied by three again.
2. **Aggregation and retry:** Add a second recipe using the same ingredient and
   compatible units. Verify the sum, then resend the first recipe and confirm
   quantities do not increase again.
3. **Gatherings overlap:** Shop one finalized course, then shop the whole menu.
   The first course must be counted once, with the other courses added once.

## Separate template Save defect

`POST /api/recipes/:id/save` in `server/routes.ts` still returns success without
persisting a recipe. This remains separate deferred work and must not delay
initial founder testing of working recipe creators. Template save/reopen is not
reported as functional.
