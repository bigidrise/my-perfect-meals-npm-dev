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
