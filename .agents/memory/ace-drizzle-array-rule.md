---
name: ACE — Drizzle ORM rule for array columns
description: Any ACE (or other) write to a table with text[] or structured-type columns must use drizzle ORM insert, not raw sql template.
---

## Rule

Whenever writing to a schema-defined table that contains `text[]` or other structured Postgres types (arrays, JSONB, enums), use the Drizzle ORM (`db.insert(...).values(...).onConflictDoUpdate(...)`) rather than `db.execute(sql\`INSERT ...\`)`.

**Why:** Drizzle's `sql` tagged template expands JavaScript arrays into multiple positional SQL parameters (`$14, $15, ...`) instead of binding them as a single `text[]` value. The ORM layer reads the schema column types and serializes correctly. This caused the `ace_daily_checkins.symptoms text[]` column to fail with a Postgres binding error on every check-in that included symptoms.

**How to apply:**
- `aceCheckin.ts` POST handler: already fixed — uses `db.insert(aceDailyCheckins).values({...}).onConflictDoUpdate({...})`.
- Any future ACE table with array columns: same pattern.
- Raw `sql` template is still fine for SELECT queries and simple scalar INSERTs/UPDATEs with no array columns.
- If raw SQL is unavoidable, serialize the JS array to a Postgres literal string (`{"val1","val2"}`) and cast it: `$N::text[]` — but prefer the ORM.
