---
name: Bounded startup migrations
description: Safety boundary for readiness-critical Production DDL that can block on PostgreSQL locks.
---

Ordinary Production startup must be read-only with respect to release schema and backfill work. Readiness-critical migrations run only through an explicit release opt-in, on a scoped database connection with finite PostgreSQL `lock_timeout` and `statement_timeout`. An application `Promise.race` warning is observability only and must never be treated as query cancellation.

**Why:** Repeating DDL and reconciliation on every Reserved VM boot increased startup time and made ownership-review conflicts part of ordinary readiness. JavaScript timers also do not cancel PostgreSQL work.

**How to apply:** Ordinary startup performs authoritative read-only schema assertions and fails closed. Audit indirect mutation owners too: route-registration helpers, session-store auto-create options, and environment-conditional development migrations. Explicit release work runs once through the bounded wrapper, stays idempotent, and propagates failures so readiness remains false. Keep legacy deferred maintenance behind a separate explicit opt-in. Do not change normal query timeouts globally.