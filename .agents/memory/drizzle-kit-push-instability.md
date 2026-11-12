---
name: drizzle-kit push instability
description: db:push can fail with an unrelated zod schema-pull error; use a migration script instead of chasing it.
---

`npm run db:push` (drizzle-kit push) pulls the *entire* live schema before diffing, and on this
project that pull can throw a zod `invalid_type` error (expected string, received null) that has
nothing to do with the column you're adding. It happens even with `--force`.

**Why:** Some existing column/table in the live DB doesn't match what drizzle-kit's introspection
expects, so any push — regardless of what you changed — can trip this.

**How to apply:** Don't spend time bisecting the full schema to find the offending table. Instead,
write a small idempotent migration script under `scripts/` (pattern: `scripts/migrate-add-mfa-columns.ts`)
using `pg.Pool` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`, run it once with `npx tsx`, and keep
`shared`/`server/db/schema` in sync by hand. This is safe and fast for additive column changes.

Do not treat a successful `drizzle-kit push` exit as proof that a fresh isolated
application database is complete.

**Why:** During isolated setup, push exited successfully after creating only part
of the schema. A separate atomic export/application exposed invalid baseline DDL.

**How to apply:** Verify required relations after bootstrap and apply exported
baseline DDL transactionally in authorized isolated databases. Stop on unrelated
schema errors instead of silently running the application against a partial
schema or falling back to the shared database.

A clean schema export/application still does not prove full application
readiness: some runtime prerequisites are owned by separate migrations rather
than Drizzle discovery.

**Why:** Isolated baseline initialization succeeded, but the application's
read-only startup guard correctly rejected missing migration-owned structures.

**How to apply:** Retain runtime readiness guards and distinguish ORM-baseline
success from a runnable isolated app. Respect an explicit stop-at-next-schema-error
instruction rather than bypassing guards or silently expanding migration scope.
